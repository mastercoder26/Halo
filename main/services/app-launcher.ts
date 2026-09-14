import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import * as path from "path";

import { dialog, shell } from "../platform/electron.js";

import { applicationPickerOptions } from "./application-picker-options.js";
import type { DockAppInfo } from "../types.js";
import { getSettingsWindow } from "../windows/settings-window.js";

function appNameFromPath(appPath: string): string {
  return path.basename(appPath, ".app");
}

export function resolveDockApps(paths: string[]): DockAppInfo[] {
  return paths.slice(0, 8).map((appPath) => ({
    path: appPath,
    name: appNameFromPath(appPath),
  }));
}

export async function launchApp(appPath: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const error = await shell.openPath(appPath);
    if (error) return { ok: false, error };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

const APP_SCAN_DIRS = [
  "/Applications",
  "/Applications/Utilities",
  "/System/Applications",
  "/System/Applications/Utilities",
  path.join(homedir(), "Applications"),
];

/**
 * Scan the standard application folders for installed .app bundles.
 * Used by the searchable in-app picker.
 */
export async function listInstalledApps(): Promise<DockAppInfo[]> {
  const results = new Map<string, DockAppInfo>();
  await Promise.all(
    APP_SCAN_DIRS.map(async (dir) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.name.endsWith(".app") || entry.name.startsWith(".")) continue;
          const appPath = path.join(dir, entry.name);
          if (!results.has(appPath)) {
            results.set(appPath, { path: appPath, name: appNameFromPath(appPath) });
          }
        }
      } catch {
        // Folder missing or unreadable — skip it.
      }
    }),
  );
  return [...results.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export async function pickApplications(): Promise<string[]> {
  const parent = getSettingsWindow();
  const result =
    parent && !parent.isDestroyed()
      ? await dialog.showOpenDialog(parent, applicationPickerOptions)
      : await dialog.showOpenDialog(applicationPickerOptions);
  if (result.canceled || !result.filePaths?.length) return [];
  return result.filePaths.filter((p) => p.endsWith(".app")).slice(0, 8);
}
