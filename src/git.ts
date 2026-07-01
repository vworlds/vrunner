import path from "node:path";
import type { AppConfig, VRunnerConfig } from "./config.js";
import { ensureDir, removePath, run, safeBranchSlug } from "./utils.js";

export interface RemoteBranch {
  name: string;
  commit: string;
  committedAt: string;
}

export class GitService {
  constructor(private readonly config: VRunnerConfig) {}

  repoPath(app: AppConfig): string {
    return path.join(this.config.dataDir, "repos", `${app.id}.git`);
  }

  worktreePath(app: AppConfig, branch: string): string {
    return path.join(this.config.dataDir, "worktrees", app.id, safeBranchSlug(branch));
  }

  async ensureRepo(app: AppConfig): Promise<void> {
    const repoPath = this.repoPath(app);
    await ensureDir(path.dirname(repoPath));
    try {
      await run("git", ["--git-dir", repoPath, "rev-parse", "--git-dir"]);
    } catch {
      await removePath(repoPath);
      await run("git", ["clone", "--mirror", app.repo, repoPath]);
    }
  }

  async fetch(app: AppConfig): Promise<void> {
    await this.ensureRepo(app);
    await run("git", ["--git-dir", this.repoPath(app), "remote", "update", "--prune"]);
  }

  async listBranches(app: AppConfig): Promise<RemoteBranch[]> {
    await this.ensureRepo(app);
    const result = await run("git", [
      "--git-dir",
      this.repoPath(app),
      "for-each-ref",
      "--format=%(refname:short)%09%(objectname)%09%(committerdate:iso8601-strict)",
      "refs/heads",
    ]);

    return result.stdout
      .split("\n")
      .map((line): RemoteBranch | null => {
        const [name, commit, committedAt] = line.trim().split("\t");
        return name && commit && committedAt ? { name, commit, committedAt } : null;
      })
      .filter((branch): branch is RemoteBranch => branch !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async branchCommit(app: AppConfig, branch: string): Promise<string> {
    await this.ensureRepo(app);
    const result = await run("git", [
      "--git-dir",
      this.repoPath(app),
      "rev-parse",
      `refs/heads/${branch}`,
    ]);
    return result.stdout.trim();
  }

  async commitDate(app: AppConfig, commit: string): Promise<string> {
    await this.ensureRepo(app);
    const result = await run("git", [
      "--git-dir",
      this.repoPath(app),
      "show",
      "-s",
      "--format=%cI",
      commit,
    ]);
    return result.stdout.trim();
  }

  async recreateWorktree(app: AppConfig, branch: string, commit: string): Promise<string> {
    const worktreePath = this.worktreePath(app, branch);
    await removePath(worktreePath);
    await run("git", ["--git-dir", this.repoPath(app), "worktree", "prune"]);
    await ensureDir(path.dirname(worktreePath));
    await run("git", [
      "--git-dir",
      this.repoPath(app),
      "worktree",
      "add",
      "--detach",
      worktreePath,
      commit,
    ]);
    return worktreePath;
  }

  async removeWorktree(app: AppConfig, branch: string): Promise<void> {
    await removePath(this.worktreePath(app, branch));
    await run("git", ["--git-dir", this.repoPath(app), "worktree", "prune"]);
  }
}
