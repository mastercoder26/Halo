/**
 * Electron platform boundary for the main process.
 *
 * Keeping the native imports here makes the rest of the main process
 * independent from the previous host runtime while retaining Electron's
 * native types and APIs.
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  powerSaveBlocker,
  screen,
  systemPreferences,
  Tray,
} from "electron";

export {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  powerSaveBlocker,
  screen,
  systemPreferences,
  Tray,
};
export type { Display, Point, Rectangle } from "electron";

type LogLevel = "debug" | "info" | "warn" | "error";

export interface MainLogger {
  debug(scope: string, message: string, details?: unknown): void;
  info(scope: string, message: string, details?: unknown): void;
  warn(scope: string, message: string, details?: unknown): void;
  error(scope: string, message: string, details?: unknown): void;
}

function writeLog(level: LogLevel, scope: string, message: string, details?: unknown): void {
  const prefix = `[${scope}] ${message}`;

  // Logging must never alter control flow in a native event handler.
  try {
    switch (level) {
      case "debug":
        if (details === undefined) console.debug(prefix);
        else console.debug(prefix, details);
        return;
      case "info":
        if (details === undefined) console.info(prefix);
        else console.info(prefix, details);
        return;
      case "warn":
        if (details === undefined) console.warn(prefix);
        else console.warn(prefix, details);
        return;
      case "error":
        if (details === undefined) console.error(prefix);
        else console.error(prefix, details);
    }
  } catch {
    // Best-effort diagnostics only.
  }
}

/** Main-process logger with the established scoped logging call shape. */
export const logger: MainLogger = Object.freeze({
  debug: (scope: string, message: string, details?: unknown) => writeLog("debug", scope, message, details),
  info: (scope: string, message: string, details?: unknown) => writeLog("info", scope, message, details),
  warn: (scope: string, message: string, details?: unknown) => writeLog("warn", scope, message, details),
  error: (scope: string, message: string, details?: unknown) => writeLog("error", scope, message, details),
});

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

/**
 * Return an app icon suitable for the macOS menu bar. The packaged app can
 * place it next to the app bundle resources, while local development reads the
 * checked-in project asset.
 */
export function createTrayIcon() {
  const directories = [
    process.resourcesPath,
    path.resolve(currentDirectory, "..", ".."),
  ];
  try {
    directories.push(app.getAppPath());
  } catch {
    // Tray setup happens after app readiness, but keep this helper harmless in tests.
  }

  for (const directory of directories) {
    for (const fileName of ["app-icon.png", "app-icon.icns"]) {
      const image = nativeImage.createFromPath(path.join(directory, fileName));
      if (!image.isEmpty()) return image.resize({ width: 18, height: 18 });
    }
  }

  return nativeImage.createEmpty();
}
