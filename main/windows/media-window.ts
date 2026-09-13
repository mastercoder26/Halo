import { BrowserWindow, logger } from "../platform/electron.js";

import { getPreloadPath, getWindowUrl } from "./window-paths.js";

let mediaWindow: BrowserWindow | null = null;

export async function openMediaWindow(): Promise<void> {
  if (mediaWindow && !mediaWindow.isDestroyed()) {
    mediaWindow.show();
    mediaWindow.focus();
    return;
  }

  mediaWindow = new BrowserWindow({
    width: 420,
    height: 300,
    resizable: false,
    title: "Now Playing",
    show: false,
    vibrancy: "sidebar",
    titleBarStyle: "hidden",
    backgroundColor: "#00000000",
    webPreferences: { preload: getPreloadPath() },
  });

  mediaWindow.once("ready-to-show", () => mediaWindow?.show());
  mediaWindow.on("closed", () => {
    mediaWindow = null;
  });

  const url = await getWindowUrl("media-window.html");
  logger.info("media", "Loading media URL", { url });
  await mediaWindow.loadURL(url);
}

export function closeMediaWindow(): void {
  mediaWindow?.close();
}
