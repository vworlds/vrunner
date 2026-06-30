<script setup lang="ts">
import { computed } from "vue";
import { NAvatar, NBadge, NCard, NEllipsis, NTag } from "naive-ui";
import type { AppSnapshot } from "../api";
import BranchRow from "./BranchRow.vue";

const props = defineProps<{
  app: AppSnapshot;
  busy: Set<string>;
}>();

defineEmits<{
  action: [action: string, appId: string, branch: string];
}>();

const branchCount = computed(
  () => `${props.app.branches.length} branch${props.app.branches.length === 1 ? "" : "es"}`
);
const initial = computed(() => props.app.name.slice(0, 1).toLowerCase());
const hasUpdates = computed(() =>
  props.app.branches.some((b) => b.updateAvailable || b.remoteDeleted)
);
</script>

<template>
  <n-card class="app-card" :bordered="true" size="large">
    <template #header>
      <div class="app-title">
        <n-badge dot :show="hasUpdates" color="#e35d2f" :offset="[-4, 4]">
          <n-avatar round :size="42" color="#17130d">{{ initial }}</n-avatar>
        </n-badge>
        <div class="app-info">
          <span class="app-name">{{ app.name }}</span>
          <n-ellipsis :line-clamp="1" class="repo">
            {{ app.repo }}
          </n-ellipsis>
        </div>
      </div>
    </template>
    <template #header-extra>
      <n-tag :bordered="false" type="default" size="small">{{ branchCount }}</n-tag>
    </template>

    <div class="branch-list">
      <BranchRow
        v-for="branch in app.branches"
        :key="branch.name"
        :app-id="app.id"
        :branch="branch"
        :busy="busy"
        @action="$emit('action', $event[0], $event[1], $event[2])"
      />
      <div v-if="!app.branches.length" class="no-branches">
        <p>No branches discovered yet.</p>
      </div>
    </div>
  </n-card>
</template>

<style scoped>
.app-card {
  background: rgba(255, 252, 246, 0.86);
  backdrop-filter: blur(16px);
}

.app-title {
  display: flex;
  align-items: center;
  gap: 14px;
}

.app-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.app-name {
  display: block;
  min-width: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.04em;
}

.repo {
  display: block;
  max-width: 520px;
  color: #776e60;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.3;
}

.branch-list {
  display: grid;
}

.no-branches {
  padding: 24px;
  text-align: center;
  color: #776e60;
}

@media (max-width: 860px) {
  .app-title {
    align-items: start;
    flex-direction: column;
  }
}
</style>
