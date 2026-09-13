import { logger, type BrowserWindow } from "../platform/electron.js";

import { edgeWatcher, type HotHit } from "./edge-watcher.js";
import { getValueForRole } from "./system-controls.js";
import {
  broadcastToDialWindows,
  ensureDialWindow,
  getDialSize,
  hideAllDials,
  showOnlyDial,
} from "../windows/dial-overlay.js";
import {
  broadcastToEdgeControlWindows,
  ensureEdgeControlWindow,
  getEdgeControlWindowSize,
  hideAllEdgeControls,
  showOnlyEdgeControl,
} from "../windows/edge-control-overlay.js";
import {
  isCorner,
  roleLabel,
  type ActiveOverlayState,
  type CornerId,
  type EdgeId,
  type ZoneRole,
} from "../types.js";

let activeState: ActiveOverlayState | null = null;
let showSequence = 0;

function dialOrigin(hit: HotHit, corner: CornerId): { x: number; y: number } {
  const size = getDialSize();
  const { bounds } = hit.display;
  switch (corner) {
    case "top-left":
      return { x: bounds.x, y: bounds.y };
    case "top-right":
      return { x: bounds.x + bounds.width - size, y: bounds.y };
    case "bottom-left":
      return { x: bounds.x, y: bounds.y + bounds.height - size };
    case "bottom-right":
      return { x: bounds.x + bounds.width - size, y: bounds.y + bounds.height - size };
  }
}

function edgeControlOrigin(hit: HotHit, edge: EdgeId): { x: number; y: number } {
  const { width, height } = getEdgeControlWindowSize(edge);
  const { bounds } = hit.display;
  switch (edge) {
    case "left":
      return { x: bounds.x, y: bounds.y + (bounds.height - height) / 2 };
    case "right":
      return { x: bounds.x + bounds.width - width, y: bounds.y + (bounds.height - height) / 2 };
    case "top":
      return { x: bounds.x + (bounds.width - width) / 2, y: bounds.y };
    case "bottom":
      return { x: bounds.x + (bounds.width - width) / 2, y: bounds.y + bounds.height - height };
  }
}

function setActive(state: ActiveOverlayState | null): void {
  activeState = state;
}

function broadcastState(state: ActiveOverlayState | null): void {
  broadcastToDialWindows("halo:overlay-state", state);
  broadcastToEdgeControlWindows("halo:overlay-state", state);
}

function sendState(win: BrowserWindow): void {
  win.webContents.send("halo:overlay-state", activeState);
}

function hideOverlays(): void {
  showSequence += 1;
  hideAllDials();
  hideAllEdgeControls();
  if (activeState) {
    setActive(null);
    broadcastState(null);
  }
}

async function showDial(hit: HotHit, corner: CornerId, sequence: number): Promise<void> {
  hideAllEdgeControls();
  const win = await ensureDialWindow(hit.display.id, corner);
  if (sequence !== showSequence) return;

  const value = await getValueForRole(hit.role, hit.display.id);
  if (sequence !== showSequence) return;

  const origin = dialOrigin(hit, corner);
  const size = getDialSize();
  win.setBounds({ x: Math.round(origin.x), y: Math.round(origin.y), width: size, height: size });
  setActive({
    zone: hit.zone,
    role: hit.role,
    displayId: hit.display.id,
    value,
    label: roleLabel(hit.role),
  });
  showOnlyDial(hit.display.id, corner);
  if (!win.isVisible()) win.showInactive();
  sendState(win);
}

async function showEdgeControl(hit: HotHit, edge: EdgeId, sequence: number): Promise<void> {
  hideAllDials();
  const win = await ensureEdgeControlWindow(hit.display.id, edge);
  if (sequence !== showSequence) return;

  const value = await getValueForRole(hit.role, hit.display.id);
  if (sequence !== showSequence) return;

  const origin = edgeControlOrigin(hit, edge);
  const size = getEdgeControlWindowSize(edge);
  win.setBounds({
    x: Math.round(origin.x),
    y: Math.round(origin.y),
    width: size.width,
    height: size.height,
  });
  setActive({
    zone: hit.zone,
    role: hit.role,
    displayId: hit.display.id,
    value,
    label: roleLabel(hit.role),
  });
  showOnlyEdgeControl(hit.display.id, edge);
  if (!win.isVisible()) win.showInactive();
  sendState(win);
}

async function showOverlay(hit: HotHit): Promise<void> {
  const sequence = ++showSequence;
  try {
    if (isCorner(hit.zone)) {
      await showDial(hit, hit.zone, sequence);
    } else {
      await showEdgeControl(hit, hit.zone, sequence);
    }
  } catch (error) {
    logger.debug("overlay-manager", "Control value unavailable", error);
    if (sequence === showSequence) hideOverlays();
  }
}

export function getActiveOverlayState(): ActiveOverlayState | null {
  return activeState;
}

export function startOverlayManager(): void {
  edgeWatcher.onHit((hit) => {
    if (!hit) {
      hideOverlays();
      return;
    }
    void showOverlay(hit);
  });
  edgeWatcher.start();
}

export function stopOverlayManager(): void {
  edgeWatcher.stop();
  hideOverlays();
}

export function updateActiveControlValue(role: ZoneRole, value: number): void {
  if (!activeState || activeState.role !== role) return;
  setActive({ ...activeState, value });
  broadcastState(activeState);
}
