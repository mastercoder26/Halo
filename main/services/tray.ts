import { app, createTrayIcon, Menu, Tray, logger } from "../platform/electron.js";
import type { Rectangle } from "../platform/electron.js";

import { defaultSettings } from "../types.js";
import { edgeWatcher } from "./edge-watcher.js";
import { settingsStore } from "./settings-store.js";
import { openSettingsWindow } from "../windows/settings-window.js";

let tray: Tray | null = null;
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

function rebuildMenu(): void {
  if (!tray) return;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Halo", enabled: false },
      { type: "separator" },
      {
        label: "Open Settings…",
        accelerator: "Command+,",
        click: () => openSettingsFromTray(),
      },
      {
        label: "Reset Hot Zones",
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
  rebuildMenu();
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
  unsubscribeBypass?.();
  unsubscribeBypass = null;
  lastTrayBounds = null;
  tray?.destroy();
  tray = null;
}
