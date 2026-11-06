import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".wrangler/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/lib/vtracer/wasm_vtracer_bg.js",
    "src/lib/vtracer/wasm_vtracer.d.ts",
    "src/lib/vtracer/vtracer_wasm_v1.js",
  ]),
]);

export default eslintConfig;
