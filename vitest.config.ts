import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["node_modules/**", "dist/**", "public/assets/**", "data/**"],
    include: ["tests/**/*.test.ts"],
  },
});
