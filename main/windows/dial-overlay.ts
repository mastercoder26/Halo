import { BrowserWindow, logger } from "../platform/electron.js";

import { getPreloadPath, getWindowUrl } from "./window-paths.js";
import type { CornerId } from "../types.js";

const DIAL_SIZE = 256;

const windows = new Map<string, BrowserWindow>();
// Dedupe concurrent creation: overlapping ensureDialWindow calls for the same
// key must share one window, or an orphaned duplicate can stay visible forever.
const creating = new Map<string, Promise<BrowserWindow>>();

function windowKey(displayId: number, corner: CornerId): string {
  return `dial-${displayId}-${corner}`;
}

export function getDialSize(): number {
  return DIAL_SIZE;
}

export async function ensureDialWindow(
  displayId: number,
  corner: CornerId,
): Promise<BrowserWindow> {
  const key = windowKey(displayId, corner);
  const existing = windows.get(key);
  if (existing && !existing.isDestroyed()) return existing;

  const pending = creating.get(key);
  if (pending) return pending;

  const promise = createDialWindow(key, displayId, corner).finally(() => {
    creating.delete(key);
  });
  creating.set(key, promise);
  return promise;
}

async function createDialWindow(
  key: string,
  displayId: number,
  corner: CornerId,
): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
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

  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setSkipTaskbar(true);

  win.on("closed", () => {
    windows.delete(key);
  });

  const url = await getWindowUrl("dial-window.html");
  await win.loadURL(`${url}?displayId=${displayId}&corner=${corner}`);
  windows.set(key, win);
  logger.debug("dial-overlay", "Created dial window", { key });
  return win;
}

export function getDialWindow(displayId: number, corner: CornerId): BrowserWindow | null {
  const win = windows.get(windowKey(displayId, corner));
  if (!win || win.isDestroyed()) return null;
  return win;
}

export function hideAllDials(): void {
  // Hide unconditionally: isVisible() can lag behind an in-flight native
  // showInactive() call, which would skip the hide and leave a dial stuck open.
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.hide();
  }
}

export function showOnlyDial(displayId: number, corner: CornerId): void {
  const keep = windowKey(displayId, corner);
  for (const [key, win] of windows) {
    if (win.isDestroyed()) continue;
    if (key === keep) continue;
    win.hide();
  }
}

export function destroyAllDials(): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.destroy();
  }
  windows.clear();
}

export function broadcastToDialWindows(channel: string, payload: unknown): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}
