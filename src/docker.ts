import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig, VRunnerConfig } from "./config.js";
import type { GitService } from "./git.js";
import { ensureDir, run, safeBranchSlug, slugify } from "./utils.js";

export class DockerService {
  constructor(
    private readonly config: VRunnerConfig,
    private readonly gitService: GitService
  ) {}

  projectName(app: AppConfig, branch: string): string {
    return `vrunner-${slugify(app.id)}-${safeBranchSlug(branch)}`.slice(0, 63);
  }

  envFilePath(app: AppConfig, branch: string): string {
    return path.join(this.config.dataDir, "env", `${app.id}-${safeBranchSlug(branch)}.env`);
  }

  composeFilePath(app: AppConfig, branch: string): string {
    return path.join(this.gitService.worktreePath(app, branch), app.composeFile);
  }

  async writeEnvFile(app: AppConfig, branch: string, ports: Record<string, number>): Promise<string> {
    const env: Record<string, string> = { ...app.env };
    for (const [key, value] of Object.entries(ports)) {
      env[key] = String(value);
    }

    const envFilePath = this.envFilePath(app, branch);
    await ensureDir(path.dirname(envFilePath));
    const lines = Object.entries(env)
      .map(([key, value]) => `${key}=${escapeEnvValue(value)}`)
      .join("\n");
    await writeFile(envFilePath, `${lines}\n`);
    return envFilePath;
  }

  composeArgs(app: AppConfig, branch: string): string[] {
    return [
      "compose",
      "--env-file",
      this.envFilePath(app, branch),
      "-f",
      this.composeFilePath(app, branch),
      "-p",
      this.projectName(app, branch)
    ];
  }

  async up(app: AppConfig, branch: string) {
    return run("docker", [...this.composeArgs(app, branch), "up", "-d", "--build", "--remove-orphans"], {
      cwd: this.gitService.worktreePath(app, branch)
    });
  }

  async stop(app: AppConfig, branch: string) {
    return run("docker", [...this.composeArgs(app, branch), "stop"], {
      cwd: this.gitService.worktreePath(app, branch)
    });
  }

  async down(app: AppConfig, branch: string) {
    return run("docker", [...this.composeArgs(app, branch), "down", "--remove-orphans"], {
      cwd: this.gitService.worktreePath(app, branch)
    });
  }

  async logs(app: AppConfig, branch: string) {
    return run("docker", [...this.composeArgs(app, branch), "logs", "--tail", "200"], {
      cwd: this.gitService.worktreePath(app, branch),
      maxBuffer: 1024 * 1024 * 10
    });
  }
}

function escapeEnvValue(value: unknown): string {
  const stringValue = String(value ?? "");
  if (/^[A-Za-z0-9_./:-]*$/.test(stringValue)) return stringValue;
  return JSON.stringify(stringValue);
}
