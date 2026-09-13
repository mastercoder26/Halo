import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";

import { build as buildRenderer } from "vite";

import { buildElectronProcesses, distRoot, projectRoot } from "./electron-build.mjs";

function run(command, args) {
  execFileSync(command, args, { cwd: projectRoot, stdio: "inherit" });
}

await rm(distRoot, { force: true, recursive: true });
run(process.execPath, [path.join("scripts", "build-native.mjs")]);

await Promise.all([
  buildElectronProcesses(),
  buildRenderer({ configFile: path.join(projectRoot, "vite.config.ts") }),
]);
