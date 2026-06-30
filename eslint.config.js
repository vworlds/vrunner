import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import vuePlugin from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

export default [
  {
    ignores: ["dist/**", "data/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      curly: ["error", "all"],
      "unused-imports/no-unused-imports": "error",
    },
  },
  {
    files: ["web/**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      curly: ["error", "all"],
      "unused-imports/no-unused-imports": "error",
    },
  },
  {
    files: ["web/**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: [".vue"],
      },
    },
    plugins: {
      vue: vuePlugin,
      "@typescript-eslint": tsPlugin,
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      ...vuePlugin.configs["flat/recommended"].rules,
      "vue/multi-word-component-names": "off",
    },
  },
];
