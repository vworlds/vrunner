<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  NButton,
  NEmpty,
  NFlex,
  NSkeleton,
  NStatistic,
  NTime,
  NTooltip,
  useMessage,
} from "naive-ui";
import type { Snapshot } from "./api";
import { fetchSnapshot, runAction } from "./api";
import AppCard from "./components/AppCard.vue";

const snapshot = ref<Snapshot>({ apps: [] });
const busy = ref(new Set<string>());
const refreshing = ref(false);
const lastUpdated = ref<number | null>(null);

let timer: ReturnType<typeof setInterval> | undefined;

const hasApps = computed(() => snapshot.value.apps.length > 0);
const totalBranches = computed(() =>
  snapshot.value.apps.reduce((sum, app) => sum + app.branches.length, 0)
);
const runningCount = computed(() =>
  snapshot.value.apps.reduce(
    (sum, app) => sum + app.branches.filter((b) => b.status === "running").length,
    0
  )
);
const errorCount = computed(() =>
  snapshot.value.apps.reduce(
    (sum, app) => sum + app.branches.filter((b) => b.status === "error").length,
    0
  )
);

const message = useMessage();

onMounted(() => {
  void refresh(false);
  timer = setInterval(() => void refresh(false), 2500);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});

async function refresh(forceRemote: boolean): Promise<void> {
  refreshing.value = true;
  try {
    snapshot.value = await fetchSnapshot(forceRemote);
    lastUpdated.value = snapshot.value.serverTime
      ? new Date(snapshot.value.serverTime).getTime()
      : null;
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    refreshing.value = false;
  }
}

async function handleAction(action: string, appId: string, branch: string): Promise<void> {
  const key = `${appId}:${branch}`;
  busy.value.add(key);
  try {
    await runAction(action, appId, branch);
    await refresh(false);
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    busy.value.delete(key);
  }
}
</script>

<template>
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">local app launcher</p>
        <h1>vrunner</h1>
        <p class="lede">Run, pause, and keep branch demos fresh from one small control room.</p>
      </div>
      <div class="hero-actions">
        <n-flex :gap="24" align="center">
          <n-statistic label="Branches" :value="totalBranches" tabular-nums />
          <n-statistic label="Running" :value="runningCount" tabular-nums />
          <n-statistic v-if="errorCount" label="Errors" :value="errorCount" tabular-nums />
        </n-flex>
        <n-flex :gap="14" align="center">
          <n-button :loading="refreshing" @click="refresh(true)">Refresh</n-button>
          <n-tooltip v-if="lastUpdated">
            <template #trigger>
              <span class="timestamp">
                <n-time :time="lastUpdated" type="relative" :to="Date.now()" text />
              </span>
            </template>
            Last updated
          </n-tooltip>
          <span v-else class="timestamp">Starting...</span>
        </n-flex>
      </div>
    </header>

    <section class="apps" aria-live="polite">
      <div v-if="hasApps" class="app-grid">
        <AppCard
          v-for="app in snapshot.apps"
          :key="app.id"
          :app="app"
          :busy="busy"
          @action="handleAction"
        />
      </div>
      <n-empty v-else-if="!refreshing" description="No apps configured." class="empty-state">
        <template #extra>
          <n-button @click="refresh(true)">Fetch branches</n-button>
        </template>
      </n-empty>
      <div v-else class="skeleton-grid">
        <n-skeleton text :repeat="6" height="18px" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.shell {
  width: min(1180px, calc(100% - 32px));
  margin: 0 auto;
  padding: 42px 0 56px;
}

.hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}

.eyebrow {
  margin: 0 0 10px;
  color: #a93a1d;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(46px, 9vw, 88px);
  line-height: 0.88;
  letter-spacing: -0.08em;
}

.lede {
  max-width: 620px;
  margin: 18px 0 0;
  color: #776e60;
  font-size: 18px;
}

.hero-actions {
  display: flex;
  align-items: end;
  gap: 28px;
  padding-bottom: 8px;
}

.timestamp {
  color: #776e60;
  font-size: 13px;
  white-space: nowrap;
}

.apps {
  display: grid;
  gap: 22px;
}

.app-grid {
  display: grid;
  gap: 22px;
}

.empty-state {
  padding: 48px;
}

.skeleton-grid {
  display: grid;
  gap: 12px;
  padding: 24px;
}

@media (max-width: 860px) {
  .hero {
    align-items: start;
    flex-direction: column;
  }

  .hero-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
