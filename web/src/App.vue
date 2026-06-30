<script setup lang="ts">
import { NConfigProvider, NMessageProvider, type GlobalThemeOverrides } from "naive-ui";
import Dashboard from "./Dashboard.vue";

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#e35d2f",
    primaryColorHover: "#c84f25",
    primaryColorPressed: "#a93a1d",
    errorColor: "#b42318",
    errorColorHover: "#9a1f16",
    errorColorPressed: "#7a1810",
    borderRadius: "12px",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <Dashboard />
    </n-message-provider>
  </n-config-provider>
</template>
