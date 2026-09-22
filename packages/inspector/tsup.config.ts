import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  format: ["esm", "cjs"],
  tsconfig: "tsconfig.build.json",
  dts: true,
  clean: true,
  shims: true,
  sourcemap: true,
  target: "node18",
  platform: "node",
  external: ["@ai-sdk/provider-utils"],
});
