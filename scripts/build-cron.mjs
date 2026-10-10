import { build } from "esbuild";

await build({
  entryPoints: ["scripts/cron.ts"],
  outfile: "dist/cron.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  packages: "external",
  tsconfig: "tsconfig.json"
});
