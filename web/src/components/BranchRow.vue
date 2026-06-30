<script setup lang="ts">
import { computed } from "vue";
import { NTag } from "naive-ui";
import type { BranchSnapshot } from "../api";

type BranchAction = "launch" | "pause" | "resume" | "shutdown";

const props = defineProps<{
  appId: string;
  branch: BranchSnapshot;
  busy: Set<string>;
}>();

const emit = defineEmits<{
  action: [action: string, appId: string, branch: string];
}>();

const status = computed(() => props.branch.status ?? "idle");
const key = computed(() => `${props.appId}:${props.branch.name}`);
const isBusy = computed(() => props.busy.has(key.value) || isTransient(status.value));

const primaryAction = computed<BranchAction>(() => {
  if (status.value === "running") {
    return "pause";
  }
  if (status.value === "paused") {
    return "resume";
  }
  return "launch";
});

const tagType = computed<"success" | "warning" | "info" | "error" | "default">(() => {
  if (status.value === "running") {
    return "success";
  }
  if (status.value === "paused") {
    return "warning";
  }
  if (status.value === "error") {
    return "error";
  }
  if (isTransient(status.value)) {
    return "info";
  }
  return "default";
});

const statusLabel = computed(() => (status.value === "idle" ? "ready" : status.value));
const canShutdown = computed(() => !isBusy.value && status.value !== "idle");
const canOpen = computed(() => status.value === "running" && !!props.branch.url);
const primaryIcon = computed(() => actionIcon(primaryAction.value));
const primaryLabel = computed(() => actionLabel(primaryAction.value));

function isTransient(value: string): boolean {
  return ["starting", "updating", "pausing", "stopping"].includes(value);
}

function actionIcon(action: BranchAction): string {
  if (action === "pause") {
    return "fa-pause";
  }
  if (action === "shutdown") {
    return "fa-stop";
  }
  return "fa-play";
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

function emitPrimary(): void {
  emit("action", primaryAction.value, props.appId, props.branch.name);
}

function emitShutdown(): void {
  emit("action", "shutdown", props.appId, props.branch.name);
}
</script>

<template>
  <div class="branch-row">
    <div class="branch-name" :title="branch.name">
      <span>{{ branch.name }}</span>
      <div v-if="branch.updateAvailable" class="muted">
        Update available: {{ branch.remoteShortCommit }}
      </div>
      <div v-else-if="branch.remoteDeleted" class="muted">Remote branch deleted</div>
    </div>

    <div class="sha">{{ branch.shortCommit || "--------" }}</div>

    <div class="status-cell">
      <n-tag :type="tagType" size="small" :bordered="false" round>
        {{ statusLabel }}
      </n-tag>
    </div>

    <div class="actions">
      <button
        class="icon-button primary"
        type="button"
        :disabled="isBusy"
        :aria-label="primaryLabel"
        :title="primaryLabel"
        @click="emitPrimary"
      >
        <i class="fa-solid" :class="primaryIcon" aria-hidden="true"></i>
      </button>
      <button
        class="icon-button danger"
        type="button"
        :disabled="!canShutdown"
        aria-label="Stop"
        title="Stop"
        @click="emitShutdown"
      >
        <i class="fa-solid fa-stop" aria-hidden="true"></i>
      </button>
      <a
        v-if="canOpen"
        class="icon-button link"
        :href="branch.url!"
        target="_blank"
        rel="noreferrer"
        aria-label="Open app"
        title="Open app"
      >
        <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
      </a>
    </div>

    <pre v-if="branch.error" class="error-box">{{ branch.error }}</pre>
  </div>
</template>

<style scoped>
.branch-row {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 112px 128px 136px;
  gap: 16px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid rgba(23, 19, 13, 0.08);
}

.branch-row:last-child {
  border-bottom: 0;
}

.branch-name {
  min-width: 0;
  font-weight: 760;
  letter-spacing: -0.02em;
}

.branch-name span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sha {
  color: #776e60;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.status-cell {
  min-width: 0;
}

.muted {
  color: #776e60;
  font-size: 13px;
}

.actions {
  display: flex;
  justify-content: end;
  gap: 8px;
}

.icon-button {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: 12px;
  color: #fff9ef;
  background: #17130d;
  box-shadow: 0 8px 20px rgba(23, 19, 13, 0.12);
  cursor: pointer;
  text-decoration: none;
  transition:
    box-shadow 150ms ease,
    opacity 150ms ease;
}

.icon-button:hover:not(:disabled) {
  box-shadow: 0 12px 24px rgba(23, 19, 13, 0.16);
}

.icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.icon-button.primary {
  background: #e35d2f;
}

.icon-button.danger {
  background: #b42318;
}

.icon-button.link {
  color: #1b7f49;
  background: rgba(27, 127, 73, 0.12);
  box-shadow: none;
}

.icon-button.link:hover {
  background: rgba(27, 127, 73, 0.2);
}

.error-box {
  grid-column: 1 / -1;
  margin-top: -4px;
  padding: 12px 14px;
  border: 1px solid rgba(180, 35, 24, 0.16);
  border-radius: 14px;
  color: #b42318;
  background: rgba(255, 241, 238, 0.78);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  white-space: pre-wrap;
}

@media (max-width: 860px) {
  .branch-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .actions {
    justify-content: start;
    flex-wrap: wrap;
  }
}
</style>
