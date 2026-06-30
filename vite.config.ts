import { resolve } from "node:path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  root: "web",
  base: "/",
  plugins: [vue()],
  build: {
    outDir: resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "web/src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5050",
      "/vendor": "http://127.0.0.1:5050",
    },
  },
});
