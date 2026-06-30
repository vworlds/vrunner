import { rm } from "node:fs/promises";
import type { AppConfig, VRunnerConfig } from "./config.js";
import { DockerService } from "./docker.js";
import { GitService, type RemoteBranch } from "./git.js";
import { PortAllocator } from "./ports.js";
import type { InstanceState, InstanceStatus, LastCommand, StateStore } from "./state.js";
import { errorMessage, instanceKey, shortSha, type RunResult } from "./utils.js";

interface RuntimeGitService {
  branchCommit(app: AppConfig, branch: string): Promise<string>;
  fetch(app: AppConfig): Promise<void>;
  listBranches(app: AppConfig): Promise<RemoteBranch[]>;
  recreateWorktree(app: AppConfig, branch: string, commit: string): Promise<string>;
  removeWorktree(app: AppConfig, branch: string): Promise<void>;
}

interface RuntimeDockerService {
  down(app: AppConfig, branch: string): Promise<RunResult>;
  envFilePath(app: AppConfig, branch: string): string;
  logs(app: AppConfig, branch: string): Promise<RunResult>;
  stop(app: AppConfig, branch: string): Promise<RunResult>;
  up(app: AppConfig, branch: string): Promise<RunResult>;
  writeEnvFile(app: AppConfig, branch: string, ports: Record<string, number>): Promise<string>;
}

interface RuntimePortAllocator {
  allocate(app: AppConfig): Record<string, number>;
}

export interface RuntimeServices {
  docker: RuntimeDockerService;
  git: RuntimeGitService;
  ports: RuntimePortAllocator;
}

interface BranchSnapshot {
  name: string;
  commit?: string;
  shortCommit?: string;
  status: string;
  remoteShortCommit?: string;
  branch?: string;
  desiredStatus?: InstanceState["desiredStatus"];
  remoteCommit?: string | null;
  ports?: Record<string, number>;
  url?: string | null;
  updateAvailable?: boolean;
  remoteDeleted?: boolean;
  error?: string | null;
  logs?: string[];
  lastCommand?: LastCommand;
  updatedAt?: string;
}

interface AppSnapshot {
  id: string;
  name: string;
  repo: string;
  branches: BranchSnapshot[];
}

export class Runtime {
  private readonly docker: RuntimeDockerService;
  private readonly git: RuntimeGitService;
  private readonly ports: RuntimePortAllocator;
  private readonly branchCache = new Map<string, RemoteBranch[]>();
  private readonly locks = new Map<string, Promise<unknown>>();
  private pollTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: VRunnerConfig,
    private readonly stateStore: StateStore,
    services: Partial<RuntimeServices> = {}
  ) {
    const git = services.git ?? new GitService(config);
    this.git = git;
    this.docker = services.docker ?? new DockerService(config, git as GitService);
    this.ports = services.ports ?? new PortAllocator(config, stateStore);
  }

  async start(): Promise<void> {
    await this.refreshBranches({ restartRunning: false });
    const intervalMs = Math.max(5, Number(this.config.poll.intervalSeconds ?? 45)) * 1000;
    this.pollTimer = setInterval(() => {
      this.refreshBranches({ restartRunning: true }).catch((error: unknown) => {
        console.error("poll failed", error);
      });
    }, intervalMs);
  }

  async refreshBranches({ restartRunning }: { restartRunning: boolean }): Promise<void> {
    for (const app of this.config.apps) {
      try {
        await this.git.fetch(app);
        const branches = await this.git.listBranches(app);
        const previous = this.branchCache.get(app.id) ?? [];
        this.branchCache.set(app.id, branches);

        if (restartRunning) {
          await this.handleBranchUpdates(app, previous, branches);
        }
      } catch (error) {
        console.error(`failed refreshing ${app.id}:`, errorMessage(error));
      }
    }
  }

  private async handleBranchUpdates(
    app: AppConfig,
    previousBranches: RemoteBranch[],
    nextBranches: RemoteBranch[]
  ): Promise<void> {
    const previous = new Map(previousBranches.map((branch) => [branch.name, branch.commit]));
    const next = new Map(nextBranches.map((branch) => [branch.name, branch.commit]));

    for (const instance of Object.values(this.stateStore.instances)) {
      if (instance.appId !== app.id) {
        continue;
      }
      const remoteCommit = next.get(instance.branch);
      const knownCommit = previous.get(instance.branch);

      if (!remoteCommit) {
        await this.stateStore.patchInstance(instanceKey(app.id, instance.branch), {
          remoteDeleted: true,
          updateAvailable: false,
        });
        continue;
      }

      if (remoteCommit === instance.commit) {
        continue;
      }
      if (knownCommit === undefined && instance.commit === remoteCommit) {
        continue;
      }

      const key = instanceKey(app.id, instance.branch);
      if (instance.status === "running") {
        await this.withLock(key, () => this.updateRunning(app, instance.branch, remoteCommit));
      } else if (instance.status === "paused") {
        await this.stateStore.patchInstance(key, {
          remoteCommit,
          updateAvailable: true,
          remoteDeleted: false,
        });
      } else if (instance.status === "error" && instance.desiredStatus === "running") {
        await this.withLock(key, () => this.retryErrored(app, instance.branch, remoteCommit));
      }
    }
  }

  async launch(appId: string, branch: string): Promise<InstanceState> {
    const app = this.findApp(appId);
    const key = instanceKey(app.id, branch);
    return this.withLock(key, async () => {
      const existing = this.stateStore.getInstance(key);
      if (existing?.status === "running") {
        return existing;
      }
      if (existing?.status === "paused") {
        return this.resumeLocked(app, branch);
      }
      if (existing?.status === "error") {
        return this.retryErrored(app, branch, await this.latestCommit(app, branch));
      }

      await this.stateStore.setInstance(key, {
        appId: app.id,
        branch,
        status: "starting",
        desiredStatus: "running",
        ports: {},
        logs: [],
      });

      try {
        await this.git.fetch(app);
        const commit = await this.git.branchCommit(app, branch);
        const ports = this.ports.allocate(app);
        return await this.startInstanceAtCommit(app, branch, commit, ports, "starting");
      } catch (error) {
        const message = errorMessage(error);
        await this.stateStore.patchInstance(key, { status: "error", error: message });
        throw new Error(message);
      }
    });
  }

  async pause(appId: string, branch: string): Promise<InstanceState> {
    const app = this.findApp(appId);
    const key = instanceKey(app.id, branch);
    return this.withLock(key, async () => {
      const instance = this.requireInstance(key);
      if (instance.status === "paused") {
        return instance;
      }
      await this.stateStore.patchInstance(key, { status: "pausing" });
      try {
        const result = await this.docker.stop(app, branch);
        return this.mustPatchInstance(key, {
          status: "paused",
          desiredStatus: "paused",
          lastCommand: summarizeResult(result),
          error: null,
        });
      } catch (error) {
        const message = errorMessage(error);
        await this.stateStore.patchInstance(key, { status: "error", error: message });
        throw new Error(message);
      }
    });
  }

  async resume(appId: string, branch: string): Promise<InstanceState> {
    const app = this.findApp(appId);
    const key = instanceKey(app.id, branch);
    return this.withLock(key, () => this.resumeLocked(app, branch));
  }

  private async resumeLocked(app: AppConfig, branch: string): Promise<InstanceState> {
    const key = instanceKey(app.id, branch);
    const instance = this.requireInstance(key);
    if (instance.status === "running") {
      return instance;
    }
    await this.stateStore.patchInstance(key, { status: "starting", desiredStatus: "running" });
    try {
      await this.git.fetch(app);
      const commit = await this.git.branchCommit(app, branch);
      if (commit !== instance.commit) {
        return await this.startInstanceAtCommit(app, branch, commit, instance.ports, "starting");
      }
      const result = await this.docker.up(app, branch);
      return this.mustPatchInstance(key, {
        status: "running",
        desiredStatus: "running",
        commit,
        shortCommit: shortSha(commit),
        remoteCommit: null,
        updateAvailable: false,
        remoteDeleted: false,
        lastCommand: summarizeResult(result),
        error: null,
      });
    } catch (error) {
      const message = errorMessage(error);
      await this.stateStore.patchInstance(key, { status: "error", error: message });
      throw new Error(message);
    }
  }

  async shutdown(appId: string, branch: string): Promise<{ ok: true }> {
    const app = this.findApp(appId);
    const key = instanceKey(app.id, branch);
    return this.withLock(key, async () => {
      this.requireInstance(key);
      await this.stateStore.patchInstance(key, { status: "stopping", desiredStatus: "stopped" });
      try {
        try {
          await this.docker.down(app, branch);
        } catch (error) {
          console.warn(`docker down failed for ${key}:`, errorMessage(error));
        }
        await this.git.removeWorktree(app, branch);
        await rm(this.docker.envFilePath(app, branch), { force: true });
        await this.stateStore.removeInstance(key);
        return { ok: true };
      } catch (error) {
        const message = errorMessage(error);
        await this.stateStore.patchInstance(key, { status: "error", error: message });
        throw new Error(message);
      }
    });
  }

  private async updateRunning(app: AppConfig, branch: string, commit: string): Promise<void> {
    const key = instanceKey(app.id, branch);
    const instance = this.requireInstance(key);
    await this.stateStore.patchInstance(key, { status: "updating", remoteCommit: commit });
    try {
      await this.docker.down(app, branch);
      await this.startInstanceAtCommit(app, branch, commit, instance.ports, "updating");
    } catch (error) {
      const message = errorMessage(error);
      await this.stateStore.patchInstance(key, { status: "error", error: message });
    }
  }

  async logs(appId: string, branch: string): Promise<string> {
    const app = this.findApp(appId);
    this.requireInstance(instanceKey(app.id, branch));
    const result = await this.docker.logs(app, branch);
    return result.stdout || result.stderr;
  }

  snapshot(): { apps: AppSnapshot[]; serverTime: string; pollIntervalSeconds: number } {
    const apps = this.config.apps.map((app): AppSnapshot => {
      const remoteBranches = this.branchCache.get(app.id) ?? [];
      const branchMap = new Map<string, BranchSnapshot>(
        remoteBranches.map((branch) => [
          branch.name,
          {
            name: branch.name,
            commit: branch.commit,
            shortCommit: shortSha(branch.commit),
            status: "idle",
          },
        ])
      );

      for (const instance of Object.values(this.stateStore.instances)) {
        if (instance.appId !== app.id) {
          continue;
        }
        const existing = branchMap.get(instance.branch) ?? {
          name: instance.branch,
          status: "idle",
        };
        branchMap.set(instance.branch, {
          ...existing,
          ...instance,
          name: instance.branch,
          shortCommit: instance.shortCommit ?? shortSha(instance.commit ?? existing.commit),
          remoteShortCommit: shortSha(instance.remoteCommit),
          status: instance.status,
        });
      }

      return {
        id: app.id,
        name: app.name,
        repo: app.repo,
        branches: [...branchMap.values()].sort(compareBranches),
      };
    });

    return {
      apps,
      serverTime: new Date().toISOString(),
      pollIntervalSeconds: this.config.poll.intervalSeconds,
    };
  }

  private findApp(appId: string): AppConfig {
    const app = this.config.apps.find((candidate) => candidate.id === appId);
    if (!app) {
      throw new Error(`unknown app: ${appId}`);
    }
    return app;
  }

  private requireInstance(key: string): InstanceState {
    const instance = this.stateStore.getInstance(key);
    if (!instance) {
      throw new Error(`instance is not active: ${key}`);
    }
    return instance;
  }

  private async mustPatchInstance(
    key: string,
    patch: Partial<InstanceState>
  ): Promise<InstanceState> {
    const instance = await this.stateStore.patchInstance(key, patch);
    if (!instance) {
      throw new Error(`instance is not active: ${key}`);
    }
    return instance;
  }

  private instanceUrl(app: AppConfig, ports: Record<string, number>): string | null {
    const urlPort =
      app.ports.find((port) => port.url) ?? app.ports.find((port) => port.protocol === "tcp");
    if (!urlPort) {
      return null;
    }
    const port = ports[urlPort.env];
    if (!port) {
      return null;
    }
    return `${app.urlProtocol}://${this.config.server.publicHost}:${port}`;
  }

  private async latestCommit(app: AppConfig, branch: string): Promise<string> {
    await this.git.fetch(app);
    return this.git.branchCommit(app, branch);
  }

  private async retryErrored(
    app: AppConfig,
    branch: string,
    commit: string
  ): Promise<InstanceState> {
    const key = instanceKey(app.id, branch);
    const instance = this.requireInstance(key);
    const ports = hasPorts(instance.ports) ? instance.ports : this.ports.allocate(app);

    await this.bestEffortDown(app, branch, key);
    return this.startInstanceAtCommit(app, branch, commit, ports, "starting");
  }

  private async startInstanceAtCommit(
    app: AppConfig,
    branch: string,
    commit: string,
    ports: Record<string, number>,
    startingStatus: InstanceStatus
  ): Promise<InstanceState> {
    const key = instanceKey(app.id, branch);
    const url = this.instanceUrl(app, ports);

    await this.stateStore.patchInstance(key, {
      status: startingStatus,
      desiredStatus: "running",
      commit,
      shortCommit: shortSha(commit),
      ports,
      url,
      remoteCommit: commit,
      updateAvailable: false,
      remoteDeleted: false,
    });

    try {
      await this.git.recreateWorktree(app, branch, commit);
      await this.docker.writeEnvFile(app, branch, ports);
      const result = await this.docker.up(app, branch);
      return await this.mustPatchInstance(key, {
        status: "running",
        desiredStatus: "running",
        commit,
        shortCommit: shortSha(commit),
        ports,
        url,
        remoteCommit: null,
        updateAvailable: false,
        remoteDeleted: false,
        lastCommand: summarizeResult(result),
        error: null,
      });
    } catch (error) {
      const message = errorMessage(error);
      await this.stateStore.patchInstance(key, {
        status: "error",
        desiredStatus: "running",
        commit,
        shortCommit: shortSha(commit),
        ports,
        url,
        remoteCommit: commit,
        error: message,
      });
      throw new Error(message);
    }
  }

  private async bestEffortDown(app: AppConfig, branch: string, key: string): Promise<void> {
    try {
      await this.docker.down(app, branch);
    } catch (error) {
      console.warn(`docker down failed for ${key}:`, errorMessage(error));
    }
  }

  private async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    const marker = current.catch(() => undefined);
    this.locks.set(key, marker);
    try {
      return await current;
    } finally {
      if (this.locks.get(key) === marker) {
        this.locks.delete(key);
      }
    }
  }
}

function hasPorts(ports: Record<string, number>): boolean {
  return Object.keys(ports).length > 0;
}

function summarizeResult(result: RunResult): LastCommand {
  return {
    command: [result.command, ...result.args].join(" "),
    stdout: result.stdout.slice(-4000),
    stderr: result.stderr.slice(-4000),
    durationMs: result.durationMs,
    at: new Date().toISOString(),
  };
}

function compareBranches(a: BranchSnapshot, b: BranchSnapshot): number {
  const score = (branch: BranchSnapshot) => {
    if (branch.status === "running") {
      return 0;
    }
    if (["starting", "updating", "pausing", "stopping"].includes(branch.status)) {
      return 1;
    }
    if (branch.status === "paused") {
      return 2;
    }
    if (branch.status === "error") {
      return 3;
    }
    return 4;
  };
  const scoreDiff = score(a) - score(b);
  if (scoreDiff) {
    return scoreDiff;
  }
  return a.name.localeCompare(b.name);
}
