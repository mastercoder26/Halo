import { execFileSync, spawn } from "node:child_process";
import path from "node:path";

import { createServer } from "vite";

import { mainOutput, projectRoot, watchElectronProcesses } from "./electron-build.mjs";

function run(command, args) {
  execFileSync(command, args, { cwd: projectRoot, stdio: "inherit" });
}

function electronBinary() {
  return path.join(
    projectRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "electron.cmd" : "electron",
  );
}

run(process.execPath, [path.join("scripts", "build-native.mjs")]);

const stopWatching = await watchElectronProcesses();
const server = await createServer({
  configFile: path.join(projectRoot, "vite.config.ts"),
  server: { host: "127.0.0.1" },
});
await server.listen();

const devUrl = server.resolvedUrls?.local?.[0]?.replace(/\/$/, "");
if (!devUrl) {
  await server.close();
  await stopWatching();
  throw new Error("Vite did not expose a local development URL.");
}

const electron = spawn(electronBinary(), [mainOutput], {
  cwd: projectRoot,
  env: {
    ...process.env,
    HALO_DEV_SERVER_URL: devUrl,
    NODE_ENV: "development",
  },
  stdio: "inherit",
});

let closing = false;
async function close(exitCode = 0) {
  if (closing) return;
  closing = true;
  electron.kill();
  await server.close();
  await stopWatching();
  process.exit(exitCode);
}

electron.once("exit", (code) => {
  void close(code ?? 0);
});
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
