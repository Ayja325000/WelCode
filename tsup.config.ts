import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    main: "src/main/main.ts",
    preload: "src/main/preload.ts"
  },
  format: ["cjs"],
  platform: "node",
  target: "node20",
  outDir: "dist/main",
  clean: true,
  sourcemap: true,
  splitting: false,
  dts: false,
  external: ["electron"]
});
