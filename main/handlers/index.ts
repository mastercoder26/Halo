/** Halo's explicit, standalone renderer IPC surface. */

import * as fs from "node:fs/promises";

import { app, dialog, ipcMain, logger, screen } from "../platform/electron.js";
import { getSettingsWindow, openSettingsWindow } from "../windows/settings-window.js";
import { sanitizeSettings, settingsStore } from "../services/settings-store.js";
import {
  getControlSnapshot,
  isAccessibilityTrusted,
  openAccessibilitySettings,
  setValueForRole,
} from "../services/system-controls.js";
import {
  launchApp,
  listInstalledApps,
  pickApplications,
  resolveDockApps,
} from "../services/app-launcher.js";
import {
  nextNowPlaying,
  nowPlayingDialValue,
  nowPlayingMeta,
  playPauseNowPlaying,
  previousNowPlaying,
} from "../services/now-playing.js";
import {
  getActiveOverlayState,
  updateActiveControlValue,
  updateActiveNowPlaying,
} from "../services/overlay-manager.js";
import { levelDetentFeedback } from "../services/feedback.js";
import { focusTimer, type FocusTimerCommand } from "../services/focus-timer.js";
import {
  beginOnboardingTour,
  closeOnboardingForNow,
  completeOnboarding,
  getOnboardingSetupPayload,
  lowerOnboardingForSystemSettings,
  prepareOnboardingTour,
  restartOnboarding,
  restoreOnboardingPriority,
} from "../windows/onboarding-overlay.js";
import {
  ALL_ZONE_ROLES,
  CORNER_IDS,
  EDGE_IDS,
  defaultDisplayZones,
  defaultSettings,
  type DisplayMode,
  type DisplayZoneSettings,
  type HaloSettings,
  type ZoneRole,
} from "../types.js";

const ZONE_ROLES: ZoneRole[] = [...ALL_ZONE_ROLES];
const CONTROL_ROLES = new Set<ZoneRole>([
  "volume",
  "brightness",
  "appearance",
  "keyboard-backlight",
  "mute",
  "keep-awake",
  "now-playing",
]);
const FOCUS_TIMER_COMMANDS = new Set<FocusTimerCommand>([
  "start",
  "pause",
  "resume",
  "reset",
  "skip",
  "toggle",
]);
const controlWriteChains = new Map<ZoneRole, Promise<unknown>>();

function isZoneRole(value: unknown): value is ZoneRole {
  return typeof value === "string" && ZONE_ROLES.includes(value as ZoneRole);
}

function isDisplayZones(value: unknown): value is DisplayZoneSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const zones = value as DisplayZoneSettings;
  if (typeof zones.enabled !== "boolean" || !zones.corners || !zones.edges) return false;
  return (
    CORNER_IDS.every((id) => isZoneRole(zones.corners[id])) &&
    EDGE_IDS.every((id) => isZoneRole(zones.edges[id]))
  );
}

async function serializeControlWrite<T>(role: ZoneRole, operation: () => Promise<T>): Promise<T> {
  const previous = controlWriteChains.get(role) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  controlWriteChains.set(role, current);
  try {
    return await current;
  } finally {
    if (controlWriteChains.get(role) === current) controlWriteChains.delete(role);
  }
}

export function registerHandlers(): void {
  ipcMain.handle("window:openSettings", () => openSettingsWindow());
  ipcMain.handle("window:closeSettings", () => getSettingsWindow()?.close());

  ipcMain.handle("halo:getSettings", () => settingsStore.load());
  ipcMain.handle("halo:updateSettings", async (_event, patch: Partial<HaloSettings>) => {
    const next = await settingsStore.update(patch ?? {});
    if (patch?.focusTimer) focusTimer.applyConfig(next.focusTimer);
    return next;
  });
  ipcMain.handle("halo:getAutoLaunch", () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle("halo:setAutoLaunch", (_event, openAtLogin: unknown) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(openAtLogin) });
    return app.getLoginItemSettings().openAtLogin;
  });
  ipcMain.handle("halo:getDisplays", async () => {
    const settings = await settingsStore.load();
    const primaryId = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((display) => ({
      id: display.id,
      label: display.label || `Display ${display.id}`,
      bounds: display.bounds,
      workArea: display.workArea,
      internal: display.internal,
      primary: display.id === primaryId,
      zones: settings.displays[String(display.id)] ?? defaultDisplayZones(),
    }));
  });
  ipcMain.handle("halo:setDisplayZones", async (_event, displayId: unknown, zones: unknown) => {
    if ((typeof displayId !== "number" && typeof displayId !== "string") || !isDisplayZones(zones)) {
      throw new Error("Invalid display zones");
    }
    const settings = await settingsStore.setDisplayZones(displayId, zones);
    return settings.displays[String(displayId)] ?? defaultDisplayZones();
  });
  ipcMain.handle("halo:setDisplayMode", (_event, mode: DisplayMode) => {
    if (mode !== "all" && mode !== "cursor-display") throw new Error("Invalid display mode");
    return settingsStore.update({ displayMode: mode });
  });
  ipcMain.handle("halo:recalibrate", () => {
    const defaults = defaultSettings();
    return settingsStore.update({
      hotZoneSize: defaults.hotZoneSize,
      hotZoneHysteresis: defaults.hotZoneHysteresis,
      insets: defaults.insets,
    });
  });
  ipcMain.handle("halo:exportSettings", async () => {
    const options = {
      title: "Export Halo Settings",
      defaultPath: "halo-settings.json",
      filters: [{ name: "Halo Settings", extensions: ["json"] }],
    };
    const parent = getSettingsWindow();
    const result = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { ok: false as const, canceled: true };
    try {
      await fs.writeFile(result.filePath, JSON.stringify(await settingsStore.load(), null, 2), "utf8");
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle("halo:importSettings", async () => {
    const options = {
      title: "Import Halo Settings",
      properties: ["openFile"] as Array<"openFile">,
      filters: [{ name: "Halo Settings", extensions: ["json"] }],
    };
    const parent = getSettingsWindow();
    const result = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths.length) return { ok: false as const, canceled: true };
    try {
      const raw = JSON.parse(await fs.readFile(result.filePaths[0], "utf8")) as unknown;
      const settings = await settingsStore.save(sanitizeSettings(raw));
      focusTimer.applyConfig(settings.focusTimer);
      return { ok: true as const, settings };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle("halo:getControls", () => getControlSnapshot());
  ipcMain.handle("halo:getOverlayState", () => getActiveOverlayState());
  ipcMain.handle("halo:levelFeedback", () => levelDetentFeedback());
  ipcMain.handle("halo:setControl", async (_event, payload: unknown) => {
    if (!payload || typeof payload !== "object") throw new Error("Invalid control request");
    const { role, value } = payload as { role?: unknown; value?: unknown };
    if (!isZoneRole(role) || !CONTROL_ROLES.has(role) || typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("Invalid control request");
    }
    return serializeControlWrite(role, async () => {
      const active = getActiveOverlayState();
      const nextValue = await setValueForRole(
        role,
        Math.round(value),
        active?.role === role ? active.displayId : undefined,
      );
      updateActiveControlValue(role, nextValue);
      return { role, value: nextValue };
    });
  });
  ipcMain.handle("halo:mediaCommand", async (_event, command: unknown) => {
    if (command !== "playPause" && command !== "next" && command !== "previous") {
      throw new Error("Invalid media command");
    }
    const state = command === "playPause"
      ? await playPauseNowPlaying()
      : command === "next"
        ? await nextNowPlaying()
        : await previousNowPlaying();
    const value = nowPlayingDialValue(state);
    const meta = nowPlayingMeta(state);
    updateActiveNowPlaying(value, meta);
    return { value, meta };
  });

  ipcMain.handle("halo:getFocusTimer", async () => {
    await focusTimer.ensureConfig();
    return focusTimer.snapshot();
  });
  ipcMain.handle("halo:focusTimerCommand", (_event, command: unknown) => {
    if (typeof command !== "string" || !FOCUS_TIMER_COMMANDS.has(command as FocusTimerCommand)) {
      throw new Error("Invalid focus timer command");
    }
    return focusTimer.command(command as FocusTimerCommand);
  });

  ipcMain.handle("halo:getOnboardingSetup", () => getOnboardingSetupPayload());
  ipcMain.handle("halo:prepareOnboardingTour", (_event, payload: unknown) => prepareOnboardingTour(payload));
  ipcMain.handle("halo:beginOnboardingTour", (_event, payload: unknown) => beginOnboardingTour(payload));
  ipcMain.handle("halo:closeOnboarding", () => {
    closeOnboardingForNow();
    return { ok: true };
  });
  ipcMain.handle("halo:completeOnboarding", async () => {
    await completeOnboarding();
    return { ok: true };
  });
  ipcMain.handle("halo:restartOnboarding", async () => {
    await restartOnboarding();
    return { ok: true };
  });
  ipcMain.handle("halo:requestAccessibility", async () => ({ trusted: await isAccessibilityTrusted(true) }));
  ipcMain.handle("halo:getAccessibilityTrusted", async () => ({ trusted: await isAccessibilityTrusted(false) }));
  ipcMain.handle("halo:openAccessibilitySettings", async () => {
    lowerOnboardingForSystemSettings();
    await openAccessibilitySettings();
  });
  ipcMain.handle("halo:restoreOnboardingPriority", () => restoreOnboardingPriority());

  ipcMain.handle("halo:getDockApps", async () => resolveDockApps((await settingsStore.load()).dockApps));
  ipcMain.handle("halo:getBaseDockApps", async () => resolveDockApps((await settingsStore.load()).dockApps));
  ipcMain.handle("halo:listInstalledApps", () => listInstalledApps());
  ipcMain.handle("halo:addDockApp", async (_event, appPath: unknown) => {
    if (typeof appPath !== "string" || !appPath.endsWith(".app")) throw new Error("Invalid app path");
    const settings = await settingsStore.load();
    if (settings.dockApps.includes(appPath)) return settings;
    if (settings.dockApps.length >= 8) throw new Error("Dock is full (8 apps max)");
    return settingsStore.update({ dockApps: [...settings.dockApps, appPath] });
  });
  ipcMain.handle("halo:pickDockApps", async () => {
    const picked = await pickApplications();
    if (!picked.length) return settingsStore.load();
    const settings = await settingsStore.load();
    const dockApps = [...picked, ...settings.dockApps.filter((path) => !picked.includes(path))].slice(0, 8);
    return settingsStore.update({ dockApps });
  });
  ipcMain.handle("halo:setDockApps", (_event, paths: unknown) => {
    if (!Array.isArray(paths)) throw new Error("Invalid Dock app list");
    return settingsStore.update({
      dockApps: paths.filter((path): path is string => typeof path === "string").slice(0, 8),
    });
  });
  ipcMain.handle("halo:launchApp", (_event, appPath: unknown) => {
    if (typeof appPath !== "string" || !appPath.endsWith(".app")) {
      return { ok: false, error: "Invalid app path" };
    }
    return launchApp(appPath);
  });
  ipcMain.handle("halo:getFileIconDataUrl", async (_event, filePath: unknown, size: unknown) => {
    if (typeof filePath !== "string" || !filePath.endsWith(".app")) return "";
    const iconSize = size === 16 ? "small" : size === 32 ? "normal" : "large";
    return (await app.getFileIcon(filePath, { size: iconSize })).toDataURL();
  });
  ipcMain.handle("halo:zoneMeta", () => ({ corners: CORNER_IDS, edges: EDGE_IDS, roles: ZONE_ROLES }));

  logger.info("handlers", "IPC handlers registered");
}
