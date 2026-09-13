import { app, ipcMain, logger, screen } from "../platform/electron.js";

import {
  getActiveOverlayState,
  updateActiveControlValue,
} from "../services/overlay-manager.js";
import { settingsStore } from "../services/settings-store.js";
import {
  getControlSnapshot,
  isAccessibilityTrusted,
  openAccessibilitySettings,
  setValueForRole,
} from "../services/system-controls.js";
import { getSettingsWindow } from "../windows/settings-window.js";
import {
  ALL_ZONE_ROLES,
  CORNER_IDS,
  EDGE_IDS,
  defaultDisplayZones,
  defaultSettings,
  type DisplayZoneSettings,
  type HaloSettings,
  type ZoneRole,
} from "../types.js";

const CONTROL_ROLES = new Set<ZoneRole>(ALL_ZONE_ROLES.filter((role) => role !== "off"));
const controlWriteChains = new Map<ZoneRole, Promise<unknown>>();

function isZoneRole(value: unknown): value is ZoneRole {
  return typeof value === "string" && ALL_ZONE_ROLES.includes(value as ZoneRole);
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
  ipcMain.handle("window:closeSettings", async () => getSettingsWindow()?.close());

  ipcMain.handle("halo:getSettings", async () => settingsStore.load());
  ipcMain.handle("halo:updateSettings", async (_event, patch: Partial<HaloSettings>) => {
    return settingsStore.update(patch ?? {});
  });
  ipcMain.handle("halo:getAutoLaunch", () => app.getLoginItemSettings().openAtLogin);
  ipcMain.handle("halo:setAutoLaunch", (_event, openAtLogin: boolean) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(openAtLogin) });
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle("halo:getDisplays", async () => {
    const settings = await settingsStore.load();
    const primaryDisplayId = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map((display) => ({
      id: display.id,
      label: display.label || `Display ${display.id}`,
      primary: display.id === primaryDisplayId,
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
  ipcMain.handle("halo:recalibrate", async () => {
    const defaults = defaultSettings();
    return settingsStore.update({
      hotZoneSize: defaults.hotZoneSize,
      hotZoneHysteresis: defaults.hotZoneHysteresis,
      insets: defaults.insets,
    });
  });

  ipcMain.handle("halo:getControls", () => getControlSnapshot());
  ipcMain.handle("halo:getOverlayState", () => getActiveOverlayState());
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

  ipcMain.handle("halo:requestAccessibility", async () => ({
    trusted: await isAccessibilityTrusted(true),
  }));
  ipcMain.handle("halo:openAccessibilitySettings", () => openAccessibilitySettings());
  logger.info("handlers", "Core IPC handlers registered");
}
