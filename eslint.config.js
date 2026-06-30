import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import unusedImportsPlugin from "eslint-plugin-unused-imports";

export default [
  {
    ignores: ["dist/**", "public/assets/**", "data/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.ts", "public/**/*.ts", "tests/**/*.ts"],
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
];
