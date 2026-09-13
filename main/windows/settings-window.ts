import { BrowserWindow, app, logger, screen } from "../platform/electron.js";
import type { Point, Rectangle } from "../platform/electron.js";

import { getPreloadPath, getWindowUrl } from "./window-paths.js";
import {
  centerSettingsWindow,
  SETTINGS_WINDOW_HEIGHT,
  SETTINGS_WINDOW_WIDTH,
} from "./settings-window-position.js";

let settingsWindow: BrowserWindow | null = null;

function settingsWindowBounds(anchor: Point | undefined): Rectangle | undefined {
  if (!anchor) return undefined;
  return centerSettingsWindow(screen.getDisplayNearestPoint(anchor).workArea);
}

export async function openSettingsWindow(anchor?: Point): Promise<void> {
  const bounds = settingsWindowBounds(anchor);

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    logger.debug("settings", "Settings window already exists, showing it");
    try {
      await app.dock?.show();
    } catch {
      // accessory apps may not have a dock tile
    }
    if (bounds) settingsWindow.setBounds(bounds);
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  logger.info("settings", "Creating settings window");

  try {
    await app.dock?.show();
  } catch {
    // ignore
  }

  settingsWindow = new BrowserWindow({
    ...(bounds ?? {
      width: SETTINGS_WINDOW_WIDTH,
      height: SETTINGS_WINDOW_HEIGHT,
      center: true,
    }),
    minWidth: 560,
    minHeight: 520,
    title: "Halo Settings",
    show: false,
    vibrancy: "sidebar",
    titleBarStyle: "hidden",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: getPreloadPath(),
    },
  });

  settingsWindow.once("ready-to-show", () => {
    settingsWindow?.show();
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
    try {
      app.dock?.hide();
    } catch {
      // ignore
    }
  });

  const url = await getWindowUrl("settings-window.html");
  logger.info("settings", "Loading settings URL", { url });
  await settingsWindow.loadURL(url);
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}
