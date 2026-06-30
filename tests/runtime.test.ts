import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { AppConfig, VRunnerConfig } from "../src/config.js";
import { Runtime, type RuntimeServices } from "../src/runtime.js";
import { StateStore } from "../src/state.js";
import type { RunResult } from "../src/utils.js";

type RuntimeDocker = RuntimeServices["docker"];
type RuntimeGit = RuntimeServices["git"];
type RuntimePorts = RuntimeServices["ports"];

describe("Runtime Docker failure retry behavior", () => {
  let tempDir: string;
  let app: AppConfig;
  let config: VRunnerConfig;
  let docker: FakeDocker;
  let git: FakeGit;
  let ports: FakePorts;
  let stateStore: StateStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "vrunner-runtime-"));
    app = {
      id: "vecs",
      name: "vecs demo",
      repo: "git@example.com:vecs.git",
      composeFile: "ci/docker-compose.yaml",
      env: {},
      ports: [{ env: "APP_PORT", protocol: "tcp", url: true }],
      urlProtocol: "http",
    };
    config = {
      apps: [app],
      configPath: path.join(tempDir, "config.json"),
      dataDir: tempDir,
      poll: { intervalSeconds: 45 },
      ports: {
        tcp: { start: 18000, end: 18999 },
        udp: { start: 19000, end: 19999 },
      },
      server: { host: "127.0.0.1", port: 5050, publicHost: "127.0.0.1" },
    };
    docker = new FakeDocker();
    git = new FakeGit();
    ports = new FakePorts();
    stateStore = new StateStore(tempDir);
    await stateStore.load();
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  test("failed launch keeps the attempted commit and allocated ports", async () => {
    docker.failNextUp = new Error("docker build failed");
    const runtime = makeRuntime(config, stateStore, git, docker, ports);

    await expect(runtime.launch("vecs", "dev")).rejects.toThrow("docker build failed");

    const instance = stateStore.getInstance("vecs:dev");
    expect(instance).toMatchObject({
      branch: "dev",
      commit: "commit-a",
      desiredStatus: "running",
      error: "docker build failed",
      ports: { APP_PORT: 18000 },
      status: "error",
      url: "http://127.0.0.1:18000",
    });
    expect(git.recreated).toEqual(["commit-a"]);
    expect(docker.wroteEnvFor).toEqual(["dev"]);
  });

  test("errored desired-running branch retries after upstream moves", async () => {
    const runtime = makeRuntime(config, stateStore, git, docker, ports);
    await runtime.refreshBranches({ restartRunning: false });
    await stateStore.setInstance("vecs:dev", {
      appId: "vecs",
      branch: "dev",
      commit: "commit-a",
      desiredStatus: "running",
      error: "docker build failed",
      ports: { APP_PORT: 18000 },
      status: "error",
      url: "http://127.0.0.1:18000",
    });

    git.commit = "commit-b";
    await runtime.refreshBranches({ restartRunning: true });

    const instance = stateStore.getInstance("vecs:dev");
    expect(instance).toMatchObject({
      branch: "dev",
      commit: "commit-b",
      desiredStatus: "running",
      error: null,
      ports: { APP_PORT: 18000 },
      status: "running",
      url: "http://127.0.0.1:18000",
    });
    expect(docker.downCalls).toBe(1);
    expect(docker.upCalls).toBe(1);
    expect(git.recreated).toEqual(["commit-b"]);
    expect(ports.allocateCalls).toBe(0);
  });
});

function makeRuntime(
  config: VRunnerConfig,
  stateStore: StateStore,
  git: FakeGit,
  docker: FakeDocker,
  ports: FakePorts
) {
  return new Runtime(config, stateStore, { docker, git, ports });
}

function result(command: string): RunResult {
  return {
    args: [],
    command,
    durationMs: 1,
    stderr: "",
    stdout: "",
  };
}

class FakeDocker implements RuntimeDocker {
  downCalls = 0;
  failNextUp?: Error;
  upCalls = 0;
  wroteEnvFor: string[] = [];

  async down() {
    this.downCalls += 1;
    return result("docker down");
  }

  envFilePath(_app: AppConfig, branch: string) {
    return `/tmp/${branch}.env`;
  }

  async logs() {
    return result("docker logs");
  }

  async stop() {
    return result("docker stop");
  }

  async up() {
    this.upCalls += 1;
    if (this.failNextUp) {
      const error = this.failNextUp;
      this.failNextUp = undefined;
      throw error;
    }
    return result("docker up");
  }

  async writeEnvFile(_app: AppConfig, branch: string) {
    this.wroteEnvFor.push(branch);
    return `/tmp/${branch}.env`;
  }
}

class FakeGit implements RuntimeGit {
  commit = "commit-a";
  recreated: string[] = [];

  async branchCommit() {
    return this.commit;
  }

  async fetch() {}

  async listBranches() {
    return [{ commit: this.commit, name: "dev" }];
  }

  async recreateWorktree(_app: AppConfig, _branch: string, commit: string) {
    this.recreated.push(commit);
    return `/tmp/${commit}`;
  }

  async removeWorktree() {}
}

class FakePorts implements RuntimePorts {
  allocateCalls = 0;

  allocate() {
    this.allocateCalls += 1;
    return { APP_PORT: 18000 };
  }
}
