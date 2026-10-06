import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      ".output",
      // Build-protection snapshot farm (hardlinked copies of .output) —
      // bundled files carry eslint directives for plugins we don't load.
      ".build-snapshots",
      ".vinxi",
      "artifacts",
      ".local",
      ".scaffold-backup",
      "attached_assets",
      "notebooks",
      "docs",
      ".cache",
      ".config",
      ".pythonlibs",
      ".upm",
      ".tanstack",
      "public",
      "screenshots",
      // Playwright deletes/recreates these while tests run; since lint and
      // test:e2e validations run in parallel, ESLint must never scan them or
      // its directory walk can crash on the vanishing folder (ENOENT).
      "test-results",
      "playwright-report",
      "supabase",
      "workers",
      "scripts",
      "cli",
      ".github",
      ".git",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
