import { BrowserWindow, logger } from "../platform/electron.js";

import { getPreloadPath, getWindowUrl } from "./window-paths.js";

const ONBOARDING_WINDOW_SIZE = { width: 560, height: 460 };

let onboardingWindow: BrowserWindow | null = null;

export async function openOnboardingWindow(): Promise<void> {
  if (onboardingWindow && !onboardingWindow.isDestroyed()) {
    onboardingWindow.show();
    onboardingWindow.focus();
    return;
  }

  onboardingWindow = new BrowserWindow({
    ...ONBOARDING_WINDOW_SIZE,
    resizable: false,
    title: "Welcome to Halo",
    show: false,
    vibrancy: "sidebar",
    titleBarStyle: "hidden",
    backgroundColor: "#00000000",
    webPreferences: { preload: getPreloadPath() },
  });

  onboardingWindow.once("ready-to-show", () => onboardingWindow?.show());
  onboardingWindow.on("closed", () => {
    onboardingWindow = null;
  });

  const url = await getWindowUrl("onboarding-window.html");
  logger.info("onboarding", "Loading onboarding URL", { url });
  await onboardingWindow.loadURL(url);
}

export function closeOnboardingWindow(): void {
  onboardingWindow?.close();
}
