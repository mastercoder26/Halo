// Halo backend — standalone macOS menu-bar utility with edge overlays.

import { app, Menu, logger, screen } from "./platform/electron.js";

import { registerHandlers } from "./handlers/index.js";
import { edgeWatcher } from "./services/edge-watcher.js";
import { startOverlayManager, stopOverlayManager } from "./services/overlay-manager.js";
import { settingsStore } from "./services/settings-store.js";
import { destroyTray, setupTray } from "./services/tray.js";
import { destroyAllDials } from "./windows/dial-overlay.js";
import { destroyAllDocks } from "./windows/dock-overlay.js";
import { destroyAllEdgeControls } from "./windows/edge-control-overlay.js";
import { destroyAllFocusTimers } from "./windows/focus-timer-overlay.js";
import { destroyOnboarding, startOnboardingIfNeeded } from "./windows/onboarding-overlay.js";
import { openSettingsWindow } from "./windows/settings-window.js";
import {
  destroyLaunchSplash,
  dismissLaunchSplash,
  showLaunchSplash,
} from "./windows/splash-window.js";

registerHandlers();

function setupApplicationMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Halo",
        submenu: [
          { role: "about" },
          { type: "separator" },
          {
            label: "Settings…",
            accelerator: "Command+,",
            click: () => void openSettingsWindow(),
          },
          { type: "separator" },
          { role: "hide" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      { role: "editMenu" },
      { role: "windowMenu" },
    ]),
  );
}

app.on("window-all-closed", () => {
  // Halo stays available from the menu bar.
});

app.on("activate", () => {
  try {
    app.dock?.hide();
  } catch {
    // Accessory apps may not expose a Dock API.
  }
  void openSettingsWindow();
});

app.on("before-quit", () => {
  logger.info("main", "Cleaning up");
  stopOverlayManager();
  destroyTray();
  destroyAllDials();
  destroyAllDocks();
  destroyAllEdgeControls();
  destroyAllFocusTimers();
  destroyOnboarding();
  destroyLaunchSplash();
});

app.whenReady().then(async () => {
  logger.info("main", "Halo ready");
  try {
    await app.dock?.hide();
  } catch {
    // Halo is an accessory until Settings is opened.
  }

  const splashReady = showLaunchSplash().catch((error) => {
    logger.warn("main", "Launch splash failed", error);
  });

  await settingsStore.load();
  setupApplicationMenu();
  await setupTray();
  startOverlayManager();

  await splashReady;
  await dismissLaunchSplash();
  await startOnboardingIfNeeded();

  screen.on("display-added", () => edgeWatcher.invalidateDisplayCache());
  screen.on("display-removed", () => edgeWatcher.invalidateDisplayCache());
  screen.on("display-metrics-changed", () => edgeWatcher.invalidateDisplayCache());
});
