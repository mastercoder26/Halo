import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

import type { HaloAPI, HaloIpcListener } from "./platform/bridge";

const INVOKE_CHANNELS = new Set([
  "window:openSettings",
  "window:closeSettings",
  "halo:getSettings",
  "halo:updateSettings",
  "halo:getAutoLaunch",
  "halo:setAutoLaunch",
  "halo:getDisplays",
  "halo:setDisplayZones",
  "halo:setDisplayMode",
  "halo:recalibrate",
  "halo:exportSettings",
  "halo:importSettings",
  "halo:getControls",
  "halo:getOverlayState",
  "halo:levelFeedback",
  "halo:setControl",
  "halo:mediaCommand",
  "halo:getFocusTimer",
  "halo:focusTimerCommand",
  "halo:getOnboardingSetup",
  "halo:prepareOnboardingTour",
  "halo:beginOnboardingTour",
  "halo:closeOnboarding",
  "halo:completeOnboarding",
  "halo:restartOnboarding",
  "halo:requestAccessibility",
  "halo:getAccessibilityTrusted",
  "halo:openAccessibilitySettings",
  "halo:restoreOnboardingPriority",
  "halo:getDockApps",
  "halo:getBaseDockApps",
  "halo:listInstalledApps",
  "halo:addDockApp",
  "halo:pickDockApps",
  "halo:setDockApps",
  "halo:launchApp",
  "halo:getFileIconDataUrl",
  "halo:zoneMeta",
]);

const EVENT_CHANNELS = new Set([
  "halo:overlay-state",
  "halo:settings-focus",
  "halo:onboarding-tour-progress",
]);

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  if (!INVOKE_CHANNELS.has(channel)) return Promise.reject(new Error(`Unsupported Halo IPC channel: ${channel}`));
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

const api: HaloAPI = {
  ipc: {
    invoke,
    on(channel: string, listener: HaloIpcListener): () => void {
      if (!EVENT_CHANNELS.has(channel)) throw new Error(`Unsupported Halo event channel: ${channel}`);
      const callback = (event: IpcRendererEvent, payload: unknown) => listener(event, payload);
      ipcRenderer.on(channel, callback);
      return () => ipcRenderer.removeListener(channel, callback);
    },
  },
  files: {
    iconDataUrl: (appPath, size = 64) => invoke<string>("halo:getFileIconDataUrl", appPath, size),
  },
};

contextBridge.exposeInMainWorld("haloAPI", api);
