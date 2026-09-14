import { BrowserWindow, logger } from "../platform/electron.js";

import { getPreloadPath, getWindowUrl } from "./window-paths.js";
import type { ZoneId } from "../types.js";

const DOCK_HEIGHT = 88;
const DOCK_MIN_WIDTH = 200;
const DOCK_MAX_WIDTH = 520;

const windows = new Map<string, BrowserWindow>();
// Dedupe concurrent creation so overlapping calls never orphan a duplicate window.
const creating = new Map<string, Promise<BrowserWindow>>();

function windowKey(displayId: number, zone: ZoneId): string {
  return `dock-${displayId}-${zone}`;
}

export function getDockHeight(): number {
  return DOCK_HEIGHT;
}

export function dockWidthForCount(count: number): number {
  const width = 28 + Math.max(1, count) * 56;
  return Math.max(DOCK_MIN_WIDTH, Math.min(DOCK_MAX_WIDTH, width));
}

export async function ensureDockWindow(
  displayId: number,
  zone: ZoneId,
  width: number,
): Promise<BrowserWindow> {
  const key = windowKey(displayId, zone);
  const existing = windows.get(key);
  if (existing && !existing.isDestroyed()) {
    return existing;
  }

  const pending = creating.get(key);
  if (pending) return pending;

  const promise = createDockWindow(key, displayId, zone, width).finally(() => {
    creating.delete(key);
  });
  creating.set(key, promise);
  return promise;
}

async function createDockWindow(
  key: string,
  displayId: number,
  zone: ZoneId,
  width: number,
): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    windowKey: key,
    width,
    height: DOCK_HEIGHT,
    frame: true,
    titleBarStyle: "hidden",
    toolbarStyle: "none",
    backgroundColor: "#00000000",
    vibrancy: "hud",
    visualEffectState: "active",
    alwaysOnTop: true,
    hiddenInMissionControl: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
    },
  });

  win.setWindowButtonVisibility(false);
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setSkipTaskbar(true);

  win.on("closed", () => {
    windows.delete(key);
  });

  const url = await getWindowUrl("dock-window.html");
  await win.loadURL(`${url}?displayId=${displayId}&zone=${zone}`);
  windows.set(key, win);
  logger.debug("dock-overlay", "Created dock window", { key });
  return win;
}

export function getDockWindow(displayId: number, zone: ZoneId): BrowserWindow | null {
  const win = windows.get(windowKey(displayId, zone));
  if (!win || win.isDestroyed()) return null;
  return win;
}

export function hideAllDocks(): void {
  // Hide unconditionally: isVisible() can lag behind an in-flight native
  // showInactive() call, which would skip the hide and leave a dock stuck open.
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.hide();
  }
}

export function showOnlyDock(displayId: number, zone: ZoneId): void {
  const keep = windowKey(displayId, zone);
  for (const [key, win] of windows) {
    if (win.isDestroyed()) continue;
    if (key === keep) continue;
    win.hide();
  }
}

export function destroyAllDocks(): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.destroy();
  }
  windows.clear();
}

export function broadcastToDockWindows(channel: string, payload: unknown): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.send(channel, payload);
  }
}
