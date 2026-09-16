import { logger } from "../platform/electron.js";

import { edgeWatcher, isDialRole, type HotHit } from "./edge-watcher.js";
import { hapticAlignment } from "./feedback.js";
import { getNowPlayingState, getCachedNowPlayingState, nowPlayingDialValue, nowPlayingMeta } from "./now-playing.js";
import { settingsStore } from "./settings-store.js";
import { getValueForRole } from "./system-controls.js";
import {
  broadcastToDialWindows,
  ensureDialWindow,
  getDialSize,
  hideAllDials,
  showOnlyDial,
} from "../windows/dial-overlay.js";
import {
  broadcastToDockWindows,
  dockWidthForCount,
  ensureDockWindow,
  getDockHeight,
  hideAllDocks,
  showOnlyDock,
} from "../windows/dock-overlay.js";
import {
  broadcastToEdgeControlWindows,
  ensureEdgeControlWindow,
  getEdgeControlWindowSize,
  hideAllEdgeControls,
  showOnlyEdgeControl,
} from "../windows/edge-control-overlay.js";
import {
  broadcastToFocusTimerWindows,
  ensureFocusTimerWindow,
  getFocusTimerHudSize,
  hideAllFocusTimers,
  showOnlyFocusTimer,
} from "../windows/focus-timer-overlay.js";
import { focusTimer } from "./focus-timer.js";
import {
  isCorner,
  isEdge,
  isFocusTimerRole,
  roleLabel,
  type ActiveOverlayState,
  type CornerId,
  type EdgeId,
  type OverlayMediaMeta,
  type ZoneId,
  type ZoneRole,
} from "../types.js";

let activeState: ActiveOverlayState | null = null;
const stateListeners = new Set<(state: ActiveOverlayState | null) => void>();
const shownListeners = new Set<(state: ActiveOverlayState) => void>();
let showSeq = 0;
let lastHapticAt = 0;
let mediaPollTimer: ReturnType<typeof setInterval> | null = null;
let focusTimerPollTimer: ReturnType<typeof setInterval> | null = null;

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
      return {
        x: bounds.x + bounds.width - size,
        y: bounds.y + bounds.height - size,
      };
  }
}

/** Flush against the actual screen edge, centered along the display's long axis. */
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

async function floatingHudOrigin(
  hit: HotHit,
  zone: ZoneId,
  width: number,
  height: number,
): Promise<{ x: number; y: number }> {
  const settings = await settingsStore.load();
  const { bounds } = hit.display;
  const dockClear = settings.insets.dock;

  if (isCorner(zone)) {
    switch (zone) {
      case "bottom-right":
        return {
          x: bounds.x + bounds.width - width - 20,
          y: bounds.y + bounds.height - height - dockClear,
        };
      case "bottom-left":
        return {
          x: bounds.x + 20,
          y: bounds.y + bounds.height - height - dockClear,
        };
      case "top-right":
        return {
          x: bounds.x + bounds.width - width - 20,
          y: bounds.y + settings.insets.menuBar + 6,
        };
      case "top-left":
        return {
          x: bounds.x + 20,
          y: bounds.y + settings.insets.menuBar + 6,
        };
    }
  }

  switch (zone) {
    case "bottom":
      return {
        x: bounds.x + (bounds.width - width) / 2,
        y: bounds.y + bounds.height - height - dockClear,
      };
    case "top":
      return {
        x: bounds.x + (bounds.width - width) / 2,
        y: bounds.y + settings.insets.menuBar + 6,
      };
    case "left":
      return { x: bounds.x + 10, y: bounds.y + (bounds.height - height) / 2 };
    case "right":
      return {
        x: bounds.x + bounds.width - width - 10,
        y: bounds.y + (bounds.height - height) / 2,
      };
    default:
      return {
        x: bounds.x + (bounds.width - width) / 2,
        y: bounds.y + bounds.height - height - dockClear,
      };
  }
}

function setActive(state: ActiveOverlayState | null): void {
  activeState = state;
  for (const listener of stateListeners) listener(state);
}

function sendActiveToWindow(
  win: { send: (channel: string, payload: unknown) => void },
): void {
  win.send("halo:overlay-state", getActiveOverlayState());
}

/** Push hide to every overlay so OverlayValueState.reset() runs before the next show. */
function broadcastOverlayNull(): void {
  broadcastToDialWindows("halo:overlay-state", null);
  broadcastToEdgeControlWindows("halo:overlay-state", null);
  broadcastToDockWindows("halo:overlay-state", null);
  broadcastToFocusTimerWindows("halo:overlay-state", null);
}

function stopMediaPoll(): void {
  if (mediaPollTimer != null) {
    clearInterval(mediaPollTimer);
    mediaPollTimer = null;
  }
}

function stopFocusTimerPoll(): void {
  if (focusTimerPollTimer != null) {
    clearInterval(focusTimerPollTimer);
    focusTimerPollTimer = null;
  }
}

function stopOverlayPolls(): void {
  stopMediaPoll();
  stopFocusTimerPoll();
}

function startFocusTimerPoll(
  win: { send: (channel: string, payload: unknown) => void },
  seq: number,
): void {
  stopFocusTimerPoll();
  focusTimerPollTimer = setInterval(() => {
    if (seq !== showSeq || !activeState || activeState.role !== "focus-timer") {
      stopFocusTimerPoll();
      return;
    }
    const timer = focusTimer.meta();
    if (seq !== showSeq || !activeState || activeState.role !== "focus-timer") return;
    setActive({
      ...activeState,
      value: timer.remainingMs,
      timer,
      label: roleLabel("focus-timer"),
    });
    sendActiveToWindow(win);
  }, 250);
}

function startMediaPoll(
  win: { send: (channel: string, payload: unknown) => void },
  seq: number,
): void {
  stopMediaPoll();
  mediaPollTimer = setInterval(() => {
    void (async () => {
      if (seq !== showSeq || !activeState || activeState.role !== "now-playing") {
        stopMediaPoll();
        return;
      }
      try {
        const media = await getNowPlayingState();
        if (seq !== showSeq || !activeState || activeState.role !== "now-playing") return;
        setActive({
          ...activeState,
          value: nowPlayingDialValue(media),
          meta: nowPlayingMeta(media.title ? media : { ...media, title: "Now Playing" }),
        });
        sendActiveToWindow(win);
      } catch (error) {
        logger.debug("overlay-manager", "Now playing poll failed", error);
      }
    })();
  }, 1000);
}

function placeholderNowPlaying(): { value: number; meta: OverlayMediaMeta } {
  const cached = getCachedNowPlayingState();
  if (cached.player) {
    return {
      value: nowPlayingDialValue(cached),
      meta: nowPlayingMeta(cached),
    };
  }
  return {
    value: 0,
    meta: {
      title: "Now Playing",
      artist: "",
      playing: false,
      position: 0,
      duration: 0,
    },
  };
}

async function hydrateNowPlaying(
  win: { send: (channel: string, payload: unknown) => void },
  seq: number,
): Promise<void> {
  try {
    const media = await getNowPlayingState();
    if (seq !== showSeq || !activeState || activeState.role !== "now-playing") return;
    setActive({
      ...activeState,
      value: nowPlayingDialValue(media),
      meta: nowPlayingMeta(media.title ? media : { ...media, title: "Now Playing" }),
    });
    sendActiveToWindow(win);
  } catch (error) {
    logger.debug("overlay-manager", "Now playing hydrate failed", error);
  }
}

export function getActiveOverlayState(): ActiveOverlayState | null {
  return activeState;
}

export function onOverlayState(
  listener: (state: ActiveOverlayState | null) => void,
): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

/** Fires after an overlay has been made visible and can be used safely by onboarding. */
export function onOverlayShown(listener: (state: ActiveOverlayState) => void): () => void {
  shownListeners.add(listener);
  return () => shownListeners.delete(listener);
}

function notifyOverlayShown(): void {
  if (!activeState) return;
  for (const listener of shownListeners) listener(activeState);
}

function maybeHaptic(): void {
  const now = Date.now();
  if (now - lastHapticAt < 400) return;
  lastHapticAt = now;
  void hapticAlignment();
}

function presentOverlayWindow(win: { isVisible(): boolean; showInactive(): void }): void {
  const alreadyVisible = win.isVisible();
  win.showInactive();
  if (!alreadyVisible) maybeHaptic();
  notifyOverlayShown();
}

function hideNonDialOverlays(): void {
  hideAllDocks();
  hideAllFocusTimers();
}

async function showDial(hit: HotHit, corner: CornerId): Promise<void> {
  const seq = ++showSeq;
  hideNonDialOverlays();
  hideAllEdgeControls();
  stopOverlayPolls();
  try {
    const win = await ensureDialWindow(hit.display.id, corner);
    if (seq !== showSeq) return;

    if (hit.role === "now-playing") {
      const placeholder = placeholderNowPlaying();
      await showDialWithValue(win, hit, corner, placeholder.value, placeholder.meta, seq);
      void hydrateNowPlaying(win, seq);
      return;
    }

    const value = await getValueForRole(hit.role, hit.display.id);
    if (seq !== showSeq) return;
    await showDialWithValue(win, hit, corner, value, undefined, seq);
  } catch (error) {
    logger.debug("overlay-manager", "Control value unavailable", error);
    if (seq === showSeq) hideEverything();
  }
}

async function showDialWithValue(
  win: Awaited<ReturnType<typeof ensureDialWindow>>,
  hit: HotHit,
  corner: CornerId,
  value: number,
  meta: OverlayMediaMeta | undefined,
  seq: number,
): Promise<void> {
  const origin = dialOrigin({ ...hit, zone: corner }, corner);
  win.setBounds({
    x: Math.round(origin.x),
    y: Math.round(origin.y),
    width: getDialSize(),
    height: getDialSize(),
  });

  setActive({
    zone: hit.zone,
    role: hit.role,
    displayId: hit.display.id,
    value,
    label: roleLabel(hit.role),
    meta,
  });
  showOnlyDial(hit.display.id, corner);
  sendActiveToWindow(win);
  presentOverlayWindow(win);
  if (hit.role === "now-playing") startMediaPoll(win, seq);
}

async function showEdgeControl(hit: HotHit, edge: EdgeId): Promise<void> {
  const seq = ++showSeq;
  hideAllDials();
  hideNonDialOverlays();
  stopOverlayPolls();
  try {
    const win = await ensureEdgeControlWindow(hit.display.id, edge);
    if (seq !== showSeq) return;

    if (hit.role === "now-playing") {
      const placeholder = placeholderNowPlaying();
      await showEdgeControlWithValue(win, hit, edge, placeholder.value, placeholder.meta, seq);
      void hydrateNowPlaying(win, seq);
      return;
    }

    const value = await getValueForRole(hit.role, hit.display.id);
    if (seq !== showSeq) return;
    await showEdgeControlWithValue(win, hit, edge, value, undefined, seq);
  } catch (error) {
    logger.debug("overlay-manager", "Control value unavailable", error);
    if (seq === showSeq) hideEverything();
  }
}

async function showEdgeControlWithValue(
  win: Awaited<ReturnType<typeof ensureEdgeControlWindow>>,
  hit: HotHit,
  edge: EdgeId,
  value: number,
  meta: OverlayMediaMeta | undefined,
  seq: number,
): Promise<void> {
  const origin = edgeControlOrigin(hit, edge);
  const { width, height } = getEdgeControlWindowSize(edge);
  win.setBounds({
    x: Math.round(origin.x),
    y: Math.round(origin.y),
    width,
    height,
  });

  setActive({
    zone: hit.zone,
    role: hit.role,
    displayId: hit.display.id,
    value,
    label: roleLabel(hit.role),
    meta,
  });
  showOnlyEdgeControl(hit.display.id, edge);
  sendActiveToWindow(win);
  presentOverlayWindow(win);
  if (hit.role === "now-playing") startMediaPoll(win, seq);
}

async function showDock(hit: HotHit): Promise<void> {
  const seq = ++showSeq;
  hideAllDials();
  hideAllEdgeControls();
  hideAllFocusTimers();
  stopOverlayPolls();
  const settings = await settingsStore.load();
  const count = Math.max(1, settings.dockApps.length);
  const width = dockWidthForCount(count);
  const win = await ensureDockWindow(hit.display.id, hit.zone, width);
  if (seq !== showSeq) return;
  const origin = await floatingHudOrigin(hit, hit.zone, width, getDockHeight());
  if (seq !== showSeq) return;
  win.setBounds({
    x: Math.round(origin.x),
    y: Math.round(origin.y),
    width,
    height: getDockHeight(),
  });
  setActive({
    zone: hit.zone,
    role: "dock",
    displayId: hit.display.id,
    value: 0,
    label: "Dock",
  });
  showOnlyDock(hit.display.id, hit.zone);
  sendActiveToWindow(win);
  presentOverlayWindow(win);
}

async function showFocusTimer(hit: HotHit): Promise<void> {
  const seq = ++showSeq;
  hideAllDials();
  hideAllEdgeControls();
  hideAllDocks();
  stopOverlayPolls();
  await focusTimer.ensureConfig();
  const { width, height } = getFocusTimerHudSize();
  const win = await ensureFocusTimerWindow(hit.display.id, hit.zone);
  if (seq !== showSeq) return;
  const origin = await floatingHudOrigin(hit, hit.zone, width, height);
  if (seq !== showSeq) return;
  const timer = focusTimer.meta();
  win.setBounds({
    x: Math.round(origin.x),
    y: Math.round(origin.y),
    width,
    height,
  });
  setActive({
    zone: hit.zone,
    role: "focus-timer",
    displayId: hit.display.id,
    value: timer.remainingMs,
    label: roleLabel("focus-timer"),
    timer,
  });
  showOnlyFocusTimer(hit.display.id, hit.zone);
  sendActiveToWindow(win);
  presentOverlayWindow(win);
  startFocusTimerPoll(win, seq);
}

function hideEverything(): void {
  showSeq += 1;
  stopOverlayPolls();
  hideAllDials();
  hideAllDocks();
  hideAllEdgeControls();
  hideAllFocusTimers();
  broadcastOverlayNull();
  setActive(null);
}

async function onHit(hit: HotHit | null): Promise<void> {
  if (!hit) {
    hideEverything();
    return;
  }
  try {
    if (hit.role === "dock") {
      await showDock(hit);
    } else if (isFocusTimerRole(hit.role)) {
      await showFocusTimer(hit);
    } else if (isDialRole(hit.role) && isCorner(hit.zone)) {
      await showDial(hit, hit.zone);
    } else if (isDialRole(hit.role) && isEdge(hit.zone)) {
      await showEdgeControl(hit, hit.zone);
    } else {
      hideEverything();
    }
  } catch (error) {
    logger.error("overlay-manager", "Failed to show overlay", error);
  }
}

export function startOverlayManager(): void {
  edgeWatcher.onHit((hit) => void onHit(hit));
  edgeWatcher.start();
  logger.info("overlay-manager", "Started");
}

export function stopOverlayManager(): void {
  edgeWatcher.stop();
  hideEverything();
}

export async function refreshActiveValue(): Promise<void> {
  if (
    !activeState ||
    activeState.role === "dock" ||
    activeState.role === "off" ||
    activeState.role === "focus-timer"
  ) {
    return;
  }
  if (activeState.role === "now-playing") {
    const media = await getNowPlayingState();
    if (!activeState || activeState.role !== "now-playing") return;
    setActive({
      ...activeState,
      value: nowPlayingDialValue(media),
      meta: nowPlayingMeta(media.title ? media : { ...media, title: "Now Playing" }),
    });
    return;
  }
  const value = await getValueForRole(activeState.role, activeState.displayId);
  setActive({ ...activeState, value });
}

export function updateActiveControlValue(role: ZoneRole, value: number): void {
  if (!activeState || activeState.role !== role) return;
  setActive({ ...activeState, value });
}

export function updateActiveNowPlaying(
  value: number,
  meta: OverlayMediaMeta,
): void {
  if (!activeState || activeState.role !== "now-playing") return;
  setActive({ ...activeState, value, meta });
}
