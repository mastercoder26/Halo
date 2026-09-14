import { BrowserWindow, logger, screen } from "../platform/electron.js";

import { getPreloadPath, getWindowUrl } from "./window-paths.js";

/** Keep in sync with renderer splash plate layout. */
export const SPLASH_SIZE = 200;

const MIN_VISIBLE_MS = 1400;

let splashWindow: BrowserWindow | null = null;
let shownAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function showLaunchSplash(): Promise<void> {
  if (splashWindow && !splashWindow.isDestroyed()) return;

  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh, x: ox, y: oy } = display.workArea;
  const x = Math.round(ox + (sw - SPLASH_SIZE) / 2);
  const y = Math.round(oy + (sh - SPLASH_SIZE) / 2);

  const win = new BrowserWindow({
    windowKey: "halo-splash",
    width: SPLASH_SIZE,
    height: SPLASH_SIZE,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    hiddenInMissionControl: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: getPreloadPath(),
    },
  });

  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true);

  win.on("closed", () => {
    if (splashWindow === win) splashWindow = null;
  });

  const url = await getWindowUrl("splash-window.html");
  await win.loadURL(url);
  splashWindow = win;

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    win.once("ready-to-show", () => {
      shownAt = Date.now();
      win.showInactive();
      finish();
    });

    setTimeout(() => {
      if (!win.isDestroyed() && !win.isVisible()) {
        shownAt = Date.now();
        win.showInactive();
      }
      finish();
    }, 700);
  });

  logger.debug("splash", "Launch splash shown");
}

export async function dismissLaunchSplash(): Promise<void> {
  const win = splashWindow;
  if (!win || win.isDestroyed()) {
    splashWindow = null;
    return;
  }

  const elapsed = shownAt > 0 ? Date.now() - shownAt : 0;
  if (elapsed < MIN_VISIBLE_MS) {
    await sleep(MIN_VISIBLE_MS - elapsed);
  }

  if (win.isDestroyed()) {
    splashWindow = null;
    return;
  }

  try {
    win.hide();
    win.destroy();
  } catch {
    // ignore
  }
  splashWindow = null;
  logger.debug("splash", "Launch splash dismissed");
}

export function destroyLaunchSplash(): void {
  const win = splashWindow;
  splashWindow = null;
  if (!win || win.isDestroyed()) return;
  try {
    win.destroy();
  } catch {
    // ignore
  }
}
