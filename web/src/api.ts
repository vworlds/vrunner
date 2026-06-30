export interface Snapshot {
  apps: AppSnapshot[];
  serverTime?: string;
  pollIntervalSeconds?: number;
}

export interface AppSnapshot {
  id: string;
  name: string;
  repo: string;
  branches: BranchSnapshot[];
}

export interface BranchSnapshot {
  name: string;
  status?: string;
  shortCommit?: string;
  remoteShortCommit?: string;
  updateAvailable?: boolean;
  remoteDeleted?: boolean;
  url?: string;
  error?: string;
}

export async function fetchSnapshot(forceRemote: boolean): Promise<Snapshot> {
  const response = await fetch(forceRemote ? "/api/refresh" : "/api/apps", {
    method: forceRemote ? "POST" : "GET",
  });
  return (await readJson(response)) as Snapshot;
}

export async function runAction(action: string, appId: string, branch: string): Promise<unknown> {
  const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ branch }),
  });
  return readJson(response);
}

async function readJson(response: Response): Promise<unknown> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `HTTP ${response.status}`);
  }
  return payload;
}
