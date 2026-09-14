import { app, createTrayIcon, Menu, Tray, logger } from "../platform/electron.js";
import type { Rectangle } from "../platform/electron.js";

import { defaultSettings } from "../types.js";
import { edgeWatcher } from "./edge-watcher.js";
import { focusTimer, formatTimerMmSs, phaseLabel } from "./focus-timer.js";
import { settingsStore } from "./settings-store.js";
import { openSettingsWindow } from "../windows/settings-window.js";

let tray: Tray | null = null;
let unsubscribeTimer: (() => void) | null = null;
let unsubscribeBypass: (() => void) | null = null;
let lastTrayBounds: Rectangle | null = null;

export function getTray(): Tray | null {
  return tray;
}

function openSettingsFromTray(bounds: Rectangle | null = lastTrayBounds): void {
  const sourceBounds = bounds ?? tray?.getBounds() ?? null;
  if (!sourceBounds) {
    void openSettingsWindow();
    return;
  }
  void openSettingsWindow({
    x: sourceBounds.x + sourceBounds.width / 2,
    y: sourceBounds.y + sourceBounds.height / 2,
  });
}

async function rebuildMenu(): Promise<void> {
  if (!tray) return;

  await focusTimer.ensureConfig();
  const timer = focusTimer.snapshot();
  const timerActive = timer.status === "running" || timer.status === "paused";
  const timerItems = timerActive
    ? [
        { label: `Focus Timer · ${formatTimerMmSs(timer.remainingMs)}`, click: () => openSettingsFromTray() },
        { label: `${phaseLabel(timer.phase)} · ${timer.status === "paused" ? "Paused" : "Running"}`, enabled: false },
      ]
    : [];

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Halo", enabled: false },
      { type: "separator" },
      { label: "Open Settings…", accelerator: "Command+,", click: () => openSettingsFromTray() },
      ...timerItems,
      {
        label: "Recalibrate Hot Zones",
        click: () => {
          const defaults = defaultSettings();
          void settingsStore.update({
            hotZoneSize: defaults.hotZoneSize,
            hotZoneHysteresis: defaults.hotZoneHysteresis,
            insets: defaults.insets,
          });
        },
      },
      { type: "separator" },
      { label: "Hold ⌘⇧E to bypass zones", enabled: false },
      { type: "separator" },
      { label: "Quit Halo", click: () => app.quit() },
    ]),
  );
}

export async function setupTray(): Promise<void> {
  if (tray) return;

  tray = new Tray(createTrayIcon());
  tray.setToolTip("Halo — hold ⌘⇧E to bypass hot zones");
  await rebuildMenu();
  unsubscribeTimer = focusTimer.onChange(() => void rebuildMenu());
  unsubscribeBypass = edgeWatcher.onBypassChange((held) => {
    tray?.setTitle(held ? "⏸" : "");
    tray?.setToolTip(
      held ? "Halo — zones bypassed (release ⌘⇧E to resume)" : "Halo — hold ⌘⇧E to bypass hot zones",
    );
  });
  tray.on("click", (_event, bounds) => {
    lastTrayBounds = bounds;
    openSettingsFromTray(bounds);
  });
  tray.on("right-click", (_event, bounds) => {
    lastTrayBounds = bounds;
  });
  logger.info("tray", "Ready");
}

export function destroyTray(): void {
  unsubscribeTimer?.();
  unsubscribeTimer = null;
  unsubscribeBypass?.();
  unsubscribeBypass = null;
  lastTrayBounds = null;
  tray?.destroy();
  tray = null;
}
