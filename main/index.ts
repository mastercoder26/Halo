// Halo backend — focused menu bar utility for cursor-edge controls.

import { app, Menu, logger, screen } from "./platform/electron.js";

import { registerHandlers } from "./handlers/index.js";
import { edgeWatcher } from "./services/edge-watcher.js";
import { startOverlayManager, stopOverlayManager } from "./services/overlay-manager.js";
import { settingsStore } from "./services/settings-store.js";
import { destroyTray, setupTray } from "./services/tray.js";
import { destroyAllDials } from "./windows/dial-overlay.js";
import { destroyAllEdgeControls } from "./windows/edge-control-overlay.js";
import { openSettingsWindow } from "./windows/settings-window.js";

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
  // Halo remains available through the menu bar.
});

app.on("activate", () => {
  try {
    app.dock?.hide();
  } catch {
    // The accessory app has no Dock presence.
  }
  void openSettingsWindow();
});

app.on("before-quit", () => {
  logger.info("main", "Cleaning up");
  stopOverlayManager();
  destroyTray();
  destroyAllDials();
  destroyAllEdgeControls();
});

app.whenReady().then(async () => {
  logger.info("main", "Halo ready");
  try {
    await app.dock?.hide();
  } catch {
    // The accessory app has no Dock presence.
  }

  await settingsStore.load();
  setupApplicationMenu();
  await setupTray();
  startOverlayManager();

  screen.on("display-added", () => edgeWatcher.invalidateDisplayCache());
  screen.on("display-removed", () => edgeWatcher.invalidateDisplayCache());
  screen.on("display-metrics-changed", () => edgeWatcher.invalidateDisplayCache());
});
