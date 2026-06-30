import { readFile } from "node:fs/promises";
import path from "node:path";
import { atomicWriteJson, ensureDir } from "./utils.js";

export type InstanceStatus =
  | "starting"
  | "running"
  | "pausing"
  | "paused"
  | "updating"
  | "stopping"
  | "error";

export interface LastCommand {
  command: string;
  stdout: string;
  stderr: string;
  durationMs: number;
  at: string;
}

export interface InstanceState {
  appId: string;
  branch: string;
  status: InstanceStatus;
  desiredStatus: "running" | "paused" | "stopped";
  commit?: string;
  shortCommit?: string;
  remoteCommit?: string | null;
  ports: Record<string, number>;
  url?: string | null;
  updateAvailable?: boolean;
  remoteDeleted?: boolean;
  error?: string | null;
  logs?: string[];
  lastCommand?: LastCommand;
  updatedAt?: string;
}

interface PersistedState {
  instances: Record<string, InstanceState>;
}

export class StateStore {
  filePath: string;
  state: PersistedState = { instances: {} };

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "state.json");
  }

  async load(): Promise<void> {
    await ensureDir(path.dirname(this.filePath));
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.state = { instances: {}, ...(JSON.parse(raw) as Partial<PersistedState>) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.save();
    }
  }

  async save(): Promise<void> {
    await atomicWriteJson(this.filePath, this.state);
  }

  get instances(): Record<string, InstanceState> {
    return this.state.instances;
  }

  getInstance(key: string): InstanceState | undefined {
    return this.state.instances[key];
  }

  async setInstance(key: string, value: InstanceState): Promise<void> {
    this.state.instances[key] = {
      ...value,
      updatedAt: new Date().toISOString()
    };
    await this.save();
  }

  async patchInstance(key: string, patch: Partial<InstanceState>): Promise<InstanceState | undefined> {
    const current = this.state.instances[key];
    if (!current) return undefined;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.state.instances[key] = next;
    await this.save();
    return next;
  }

  async removeInstance(key: string): Promise<void> {
    delete this.state.instances[key];
    await this.save();
  }
}
