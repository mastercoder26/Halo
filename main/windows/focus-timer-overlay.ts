import { BrowserWindow, logger } from "../platform/electron.js";

import { getPreloadPath, getWindowUrl } from "./window-paths.js";
import type { ZoneId } from "../types.js";

const TIMER_WIDTH = 300;
const TIMER_HEIGHT = 168;

const windows = new Map<string, BrowserWindow>();
const creating = new Map<string, Promise<BrowserWindow>>();

function windowKey(displayId: number, zone: ZoneId): string {
  return `focus-timer-${displayId}-${zone}`;
}

export function getFocusTimerHudSize(): { width: number; height: number } {
  return { width: TIMER_WIDTH, height: TIMER_HEIGHT };
}

export async function ensureFocusTimerWindow(
  displayId: number,
  zone: ZoneId,
): Promise<BrowserWindow> {
  const key = windowKey(displayId, zone);
  const existing = windows.get(key);
  if (existing && !existing.isDestroyed()) return existing;

  const pending = creating.get(key);
  if (pending) return pending;

  const promise = createFocusTimerWindow(key, displayId, zone).finally(() => {
    creating.delete(key);
  });
  creating.set(key, promise);
  return promise;
}

async function createFocusTimerWindow(
  key: string,
  displayId: number,
  zone: ZoneId,
): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    windowKey: key,
    width: TIMER_WIDTH,
    height: TIMER_HEIGHT,
    frame: true,
    titleBarStyle: "hidden",
    toolbarStyle: "none",
    backgroundColor: "#00000000",
    vibrancy: "hud",
    visualEffectState: "active",
    alwaysOnTop: true,
    hiddenInMissionControl: true,
    skipTaskbar: true,
    focusable: true,
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

  const url = await getWindowUrl("focus-timer-window.html");
  await win.loadURL(`${url}?displayId=${displayId}&zone=${zone}`);
  windows.set(key, win);
  logger.debug("focus-timer-overlay", "Created focus timer window", { key });
  return win;
}

export function hideAllFocusTimers(): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.hide();
  }
}

export function getFocusTimerWindow(displayId: number, zone: ZoneId): BrowserWindow | null {
  const win = windows.get(windowKey(displayId, zone));
  if (!win || win.isDestroyed()) return null;
  return win;
}

export function showOnlyFocusTimer(displayId: number, zone: ZoneId): void {
  const keep = windowKey(displayId, zone);
  for (const [key, win] of windows) {
    if (win.isDestroyed()) continue;
    if (key === keep) continue;
    win.hide();
  }
}

export function destroyAllFocusTimers(): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.destroy();
  }
  windows.clear();
}

export function broadcastToFocusTimerWindows(channel: string, payload: unknown): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.send(channel, payload);
  }
}
