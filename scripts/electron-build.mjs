import path from "node:path";
import { fileURLToPath } from "node:url";

import { build, context } from "esbuild";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const distRoot = path.join(projectRoot, "dist");
export const mainEntry = path.join(projectRoot, "main", "index.ts");
export const preloadEntry = path.join(projectRoot, "renderer", "preload.ts");
export const mainOutput = path.join(distRoot, "main", "index.js");
export const preloadOutput = path.join(distRoot, "preload.cjs");

function commonOptions() {
  return {
    bundle: true,
    external: ["electron"],
    legalComments: "none",
    logLevel: "info",
    minify: false,
    platform: "node",
    sourcemap: true,
    target: "node24",
  };
}

export function mainBuildOptions() {
  return {
    ...commonOptions(),
    entryPoints: [mainEntry],
    format: "esm",
    outfile: mainOutput,
  };
}

export function preloadBuildOptions() {
  return {
    ...commonOptions(),
    entryPoints: [preloadEntry],
    format: "cjs",
    outfile: preloadOutput,
  };
}

export async function buildElectronProcesses() {
  await Promise.all([build(mainBuildOptions()), build(preloadBuildOptions())]);
}

export async function watchElectronProcesses() {
  const [mainContext, preloadContext] = await Promise.all([
    context(mainBuildOptions()),
    context(preloadBuildOptions()),
  ]);

  await Promise.all([mainContext.rebuild(), preloadContext.rebuild()]);
  await Promise.all([mainContext.watch(), preloadContext.watch()]);

  return async () => {
    await Promise.all([mainContext.dispose(), preloadContext.dispose()]);
  };
}
