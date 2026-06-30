interface Snapshot {
  apps: AppSnapshot[];
  serverTime?: string;
}

interface AppSnapshot {
  id: string;
  name: string;
  repo: string;
  branches: BranchSnapshot[];
}

interface BranchSnapshot {
  name: string;
  status?: string;
  shortCommit?: string;
  remoteShortCommit?: string;
  updateAvailable?: boolean;
  remoteDeleted?: boolean;
  url?: string;
  error?: string;
}

const appsEl = mustQuery<HTMLElement>("#apps");
const noticeEl = mustQuery<HTMLElement>("#notice");
const refreshEl = mustQuery<HTMLButtonElement>("#refresh");
const lastUpdatedEl = mustQuery<HTMLElement>("#last-updated");

let snapshot: Snapshot = { apps: [] };
const busy = new Set<string>();

refreshEl.addEventListener("click", () => refresh(true));
document.addEventListener("click", async (event: MouseEvent) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const button = target.closest<HTMLButtonElement>("[data-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.action;
  if (!action) {
    return;
  }
  if (action === "refresh") {
    await refresh(true);
    return;
  }

  const appId = button.dataset.appId;
  const branch = button.dataset.branch;
  if (!appId || !branch) {
    return;
  }
  await runAction(action, appId, branch);
});

await refresh(false);
setInterval(() => refresh(false), 2500);

async function refresh(forceRemote: boolean): Promise<void> {
  try {
    showNotice("");
    const response = await fetch(forceRemote ? "/api/refresh" : "/api/apps", {
      method: forceRemote ? "POST" : "GET",
    });
    snapshot = (await readJson(response)) as Snapshot;
    render();
  } catch (error) {
    showNotice(error instanceof Error ? error.message : String(error));
  }
}

async function runAction(action: string, appId: string, branch: string): Promise<void> {
  const key = `${appId}:${branch}`;
  busy.add(key);
  render();
  try {
    showNotice("");
    const response = await fetch(`/api/apps/${encodeURIComponent(appId)}/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ branch }),
    });
    await readJson(response);
    await refresh(false);
  } catch (error) {
    showNotice(error instanceof Error ? error.message : String(error));
  } finally {
    busy.delete(key);
    render();
  }
}

function render(): void {
  lastUpdatedEl.textContent = snapshot.serverTime
    ? `Updated ${new Date(snapshot.serverTime).toLocaleTimeString()}`
    : "Not updated yet";

  if (!snapshot.apps.length) {
    appsEl.innerHTML = emptyHtml("No apps configured.");
    return;
  }

  appsEl.innerHTML = snapshot.apps.map(renderApp).join("");
}

function renderApp(app: AppSnapshot): string {
  const branches = app.branches ?? [];
  const branchRows = branches.length
    ? branches.map((branch) => renderBranch(app, branch)).join("")
    : emptyHtml("No branches discovered yet.");

  return `
    <article class="app-card">
      <header class="app-header">
        <div class="app-title">
          <div class="app-mark">${escapeHtml(app.name.slice(0, 1).toLowerCase())}</div>
          <div>
            <h2>${escapeHtml(app.name)}</h2>
            <p class="repo" title="${escapeHtml(app.repo)}">${escapeHtml(app.repo)}</p>
          </div>
        </div>
        <span class="branch-count">${branches.length} branch${branches.length === 1 ? "" : "es"}</span>
      </header>
      <div class="branch-list">
        ${branchRows}
      </div>
    </article>
  `;
}

function renderBranch(app: AppSnapshot, branch: BranchSnapshot): string {
  const status = branch.status ?? "idle";
  const key = `${app.id}:${branch.name}`;
  const isBusy = busy.has(key) || isTransient(status);
  const actions = isBusy ? [] : branchActions(status);
  const updateNote = branch.updateAvailable
    ? `<div class="muted">Update available: ${escapeHtml(branch.remoteShortCommit)}</div>`
    : branch.remoteDeleted
      ? `<div class="muted">Remote branch deleted</div>`
      : "";

  return `
    <div class="branch-row">
      <div class="branch-name" title="${escapeHtml(branch.name)}">
        <span>${escapeHtml(branch.name)}</span>
        ${updateNote}
      </div>
      <div class="sha">${escapeHtml(branch.shortCommit || "--------")}</div>
      <div><span class="status ${escapeHtml(status)}">${escapeHtml(labelStatus(status))}</span></div>
      <div class="link-slot">
        ${branch.url ? `<a class="play-link" href="${escapeAttribute(branch.url)}" target="_blank" rel="noreferrer"><span>Open app</span> ↗</a>` : `<span class="muted">No active URL</span>`}
      </div>
      <div class="actions">
        ${actions.map((action) => renderActionButton(app, branch, action)).join("")}
      </div>
      ${branch.error ? `<pre class="error-box">${escapeHtml(branch.error)}</pre>` : ""}
    </div>
  `;
}

function branchActions(status: string): BranchAction[] {
  if (["idle", "error"].includes(status)) {
    return ["launch", ...(status === "error" ? ["shutdown" as const] : [])];
  }
  if (status === "running") {
    return ["pause", "shutdown"];
  }
  if (status === "paused") {
    return ["resume", "shutdown"];
  }
  return [];
}

function renderActionButton(
  app: AppSnapshot,
  branch: BranchSnapshot,
  action: BranchAction
): string {
  const label = actionLabel(action);
  const tone = action === "shutdown" ? "danger" : action === "launch" ? "primary" : "secondary";

  return `
    <button class="icon-button ${tone}" type="button" data-action="${escapeAttribute(action)}" data-app-id="${escapeAttribute(app.id)}" data-branch="${escapeAttribute(branch.name)}" aria-label="${escapeAttribute(label)}" title="${escapeAttribute(label)}">
      <span class="icon ${escapeAttribute(actionIcon(action))}" aria-hidden="true"></span>
    </button>
  `;
}

function emptyHtml(message: string): string {
  return `<section class="empty"><p>${escapeHtml(message)}</p><button class="button secondary" type="button" data-action="refresh">Fetch branches</button></section>`;
}

function isTransient(status: string): boolean {
  return ["starting", "updating", "pausing", "stopping"].includes(status);
}

function labelStatus(status: string): string {
  if (status === "idle") {
    return "ready";
  }
  return status;
}

type BranchAction = "launch" | "pause" | "resume" | "shutdown";

function actionIcon(action: BranchAction): string {
  if (action === "pause") {
    return "pause-icon";
  }
  if (action === "shutdown") {
    return "stop-icon";
  }
  return "play-icon";
}

function actionLabel(action: BranchAction): string {
  if (action === "launch") {
    return "Launch";
  }
  if (action === "pause") {
    return "Pause";
  }
  if (action === "resume") {
    return "Resume";
  }
  return "Stop";
}

async function readJson(response: Response): Promise<unknown> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `HTTP ${response.status}`);
  }
  return payload;
}

function showNotice(message: string): void {
  noticeEl.textContent = message;
  noticeEl.classList.toggle("hidden", !message);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: unknown): string {
  return escapeHtml(value);
}

function mustQuery<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`missing element: ${selector}`);
  }
  return element;
}

export {};
