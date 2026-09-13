import { BrowserWindow, logger } from "../platform/electron.js";

import { getPreloadPath, getWindowUrl } from "./window-paths.js";
import type { EdgeId } from "../types.js";

export const EDGE_CONTROL_LENGTH = 220;
export const EDGE_CONTROL_THICKNESS = 72;

const windows = new Map<string, BrowserWindow>();
// Dedupe concurrent creation: overlapping ensureEdgeControlWindow calls for the
// same key must share one window, or an orphaned duplicate can stay visible forever.
const creating = new Map<string, Promise<BrowserWindow>>();

function windowKey(displayId: number, edge: EdgeId): string {
  return `edge-${displayId}-${edge}`;
}

function isVerticalEdge(edge: EdgeId): boolean {
  return edge === "left" || edge === "right";
}

export function getEdgeControlWindowSize(edge: EdgeId): { width: number; height: number } {
  return isVerticalEdge(edge)
    ? { width: EDGE_CONTROL_THICKNESS, height: EDGE_CONTROL_LENGTH }
    : { width: EDGE_CONTROL_LENGTH, height: EDGE_CONTROL_THICKNESS };
}

export async function ensureEdgeControlWindow(
  displayId: number,
  edge: EdgeId,
): Promise<BrowserWindow> {
  const key = windowKey(displayId, edge);
  const existing = windows.get(key);
  if (existing && !existing.isDestroyed()) return existing;

  const pending = creating.get(key);
  if (pending) return pending;

  const promise = createEdgeControlWindow(key, displayId, edge).finally(() => {
    creating.delete(key);
  });
  creating.set(key, promise);
  return promise;
}

async function createEdgeControlWindow(
  key: string,
  displayId: number,
  edge: EdgeId,
): Promise<BrowserWindow> {
  const { width, height } = getEdgeControlWindowSize(edge);
  const win = new BrowserWindow({
    width,
    height,
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

  const url = await getWindowUrl("edge-window.html");
  await win.loadURL(`${url}?displayId=${displayId}&edge=${edge}`);
  windows.set(key, win);
  logger.debug("edge-control-overlay", "Created edge control window", { key });
  return win;
}

export function getEdgeControlWindow(displayId: number, edge: EdgeId): BrowserWindow | null {
  const win = windows.get(windowKey(displayId, edge));
  if (!win || win.isDestroyed()) return null;
  return win;
}

export function hideAllEdgeControls(): void {
  // Hide unconditionally: isVisible() can lag behind an in-flight native
  // showInactive() call, which would skip the hide and leave a control stuck open.
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.hide();
  }
}

export function showOnlyEdgeControl(displayId: number, edge: EdgeId): void {
  const keep = windowKey(displayId, edge);
  for (const [key, win] of windows) {
    if (win.isDestroyed()) continue;
    if (key === keep) continue;
    win.hide();
  }
}

export function destroyAllEdgeControls(): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.destroy();
  }
  windows.clear();
}

export function broadcastToEdgeControlWindows(channel: string, payload: unknown): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}
