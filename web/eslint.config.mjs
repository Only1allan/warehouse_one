import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Measurement and fixture scripts drive SDK internals that are not fully typed.
    files: ["scripts/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    ".next-offline/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated test artifacts are not source code.
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
