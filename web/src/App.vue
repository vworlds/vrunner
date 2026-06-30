<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { NAlert, NButton, NCard, NConfigProvider, NEmpty, NSpin, NTag } from "naive-ui";
import type { Snapshot } from "./api";
import { fetchSnapshot, runAction } from "./api";
import AppCard from "./components/AppCard.vue";

const snapshot = ref<Snapshot>({ apps: [] });
const notice = ref("");
const busy = ref(new Set<string>());
const lastUpdated = ref("Starting...");
const refreshing = ref(false);

let timer: ReturnType<typeof setInterval> | undefined;

const hasApps = computed(() => snapshot.value.apps.length > 0);

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
    notice.value = "";
    snapshot.value = await fetchSnapshot(forceRemote);
    lastUpdated.value = snapshot.value.serverTime
      ? `Updated ${new Date(snapshot.value.serverTime).toLocaleTimeString()}`
      : "Not updated yet";
  } catch (error) {
    notice.value = error instanceof Error ? error.message : String(error);
  } finally {
    refreshing.value = false;
  }
}

async function handleAction(action: string, appId: string, branch: string): Promise<void> {
  const key = `${appId}:${branch}`;
  busy.value.add(key);
  try {
    notice.value = "";
    await runAction(action, appId, branch);
    await refresh(false);
  } catch (error) {
    notice.value = error instanceof Error ? error.message : String(error);
  } finally {
    busy.value.delete(key);
  }
}
</script>

<template>
  <n-config-provider>
    <main class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">local app launcher</p>
          <h1>vrunner</h1>
          <p class="lede">Run, pause, and keep branch demos fresh from one small control room.</p>
        </div>
        <div class="hero-actions">
          <n-button :loading="refreshing" @click="refresh(true)"> Refresh </n-button>
          <span class="timestamp">{{ lastUpdated }}</span>
        </div>
      </header>

      <n-alert v-if="notice" class="notice" type="error" :show-icon="true" :title="undefined">
        {{ notice }}
      </n-alert>

      <section class="apps" aria-live="polite">
        <n-spin :show="refreshing && !hasApps">
          <div v-if="hasApps" class="app-grid">
            <AppCard
              v-for="app in snapshot.apps"
              :key="app.id"
              :app="app"
              :busy="busy"
              @action="handleAction"
            />
          </div>
          <n-empty v-else description="No apps configured." class="empty-state">
            <template #extra>
              <n-button @click="refresh(true)">Fetch branches</n-button>
            </template>
          </n-empty>
        </n-spin>
      </section>
    </main>
  </n-config-provider>
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
  align-items: center;
  gap: 14px;
  padding-bottom: 8px;
}

.timestamp {
  color: #776e60;
  font-size: 13px;
  white-space: nowrap;
}

.notice {
  margin-bottom: 18px;
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

@media (max-width: 860px) {
  .hero {
    align-items: start;
    flex-direction: column;
  }

  .hero-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
