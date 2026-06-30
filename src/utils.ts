import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface RunResult {
  command: string;
  args: string[];
  cwd?: string;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface CommandError extends Error {
  result?: RunResult;
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "item"
  );
}

export function shortHash(value: string, length = 8): string {
  return createHash("sha1").update(value).digest("hex").slice(0, length);
}

export function instanceKey(appId: string, branch: string): string {
  return `${appId}:${branch}`;
}

export function safeBranchSlug(branch: string): string {
  return `${slugify(branch)}-${shortHash(branch, 6)}`;
}

export function shortSha(sha?: string | null): string {
  return sha ? sha.slice(0, 8) : "";
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(tmp, filePath);
}

export async function removePath(filePath: string): Promise<void> {
  await rm(filePath, { recursive: true, force: true });
}

export function run(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; maxBuffer?: number } = {}
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        env: { ...process.env, ...(options.env ?? {}) },
        maxBuffer: options.maxBuffer ?? 1024 * 1024 * 20,
      },
      (error, stdout, stderr) => {
        const result: RunResult = {
          command,
          args,
          cwd: options.cwd,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          durationMs: Date.now() - startedAt,
        };

        if (error) {
          (error as CommandError).result = result;
          reject(error);
          return;
        }

        resolve(result);
      }
    );
  });
}

export function errorMessage(error: unknown): string {
  const commandError = error as CommandError;
  const result = commandError?.result;
  if (!result) {
    return error instanceof Error ? error.message : String(error);
  }
  const details = [result.stderr, result.stdout].filter(Boolean).join("\n");
  return details || commandError.message || `${result.command} failed`;
}
