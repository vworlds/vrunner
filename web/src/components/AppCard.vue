<script setup lang="ts">
import { computed } from "vue";
import { NCard, NTag } from "naive-ui";
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
</script>

<template>
  <n-card class="app-card" :bordered="true" size="large">
    <header class="app-header">
      <div class="app-title">
        <div class="app-mark">{{ initial }}</div>
        <div>
          <h2>{{ app.name }}</h2>
          <p class="repo" :title="app.repo">{{ app.repo }}</p>
        </div>
      </div>
      <n-tag :bordered="false" type="default" size="small">{{ branchCount }}</n-tag>
    </header>

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

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 14px;
}

.app-mark {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 14px;
  color: #fff8ed;
  background: #17130d;
  font-weight: 900;
  letter-spacing: -0.08em;
}

h2 {
  margin: 0;
  font-size: 24px;
  letter-spacing: -0.04em;
}

.repo {
  max-width: 520px;
  overflow: hidden;
  margin: 4px 0 0;
  color: #776e60;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  .app-header {
    align-items: start;
    flex-direction: column;
  }
}
</style>
