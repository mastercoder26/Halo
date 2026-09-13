/** Electron preload bridge. Only the app's explicit capabilities reach the renderer. */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  ActiveOverlayState,
  ControlRole,
  ControlSnapshot,
  ControlUpdate,
  DisplayInfo,
  DisplayZoneSettings,
  HaloAPI,
  HaloSettings,
  NowPlayingSnapshot,
} from "./platform/bridge";

function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return ipcRenderer.invoke(channel, ...args) as Promise<T>;
}

function onOverlayState(listener: (state: ActiveOverlayState | null) => void): () => void {
  const callback = (_event: IpcRendererEvent, state: ActiveOverlayState | null) => listener(state);
  ipcRenderer.on("halo:overlay-state", callback);
  return () => ipcRenderer.removeListener("halo:overlay-state", callback);
}

const haloAPI: HaloAPI = {
  window: {
    closeSettings: () => invoke<void>("window:closeSettings"),
  },
  settings: {
    get: () => invoke<HaloSettings>("halo:getSettings"),
    update: (patch) => invoke<HaloSettings>("halo:updateSettings", patch),
    resetHotZones: () => invoke<HaloSettings>("halo:recalibrate"),
  },
  displays: {
    get: () => invoke<DisplayInfo[]>("halo:getDisplays"),
    setZones: (displayId, zones) =>
      invoke<DisplayZoneSettings>("halo:setDisplayZones", displayId, zones),
  },
  controls: {
    get: () => invoke<ControlSnapshot>("halo:getControls"),
    set: (role: ControlRole, value: number) =>
      invoke<ControlUpdate>("halo:setControl", { role, value }),
  },
  accessibility: {
    request: () => invoke<{ trusted: boolean }>("halo:requestAccessibility"),
    openSettings: () => invoke<void>("halo:openAccessibilitySettings"),
  },
  app: {
    getAutoLaunch: () => invoke<boolean>("halo:getAutoLaunch"),
    setAutoLaunch: (enabled) => invoke<boolean>("halo:setAutoLaunch", enabled),
  },
  onboarding: {
    complete: () => invoke<HaloSettings>("halo:completeOnboarding"),
  },
  media: {
    getNowPlaying: () => invoke<NowPlayingSnapshot>("halo:getNowPlaying"),
    setPlaying: (playing) => invoke<NowPlayingSnapshot>("halo:setMusicPlaying", playing),
    seek: (fraction) => invoke<NowPlayingSnapshot>("halo:seekMusic", fraction),
  },
  overlay: {
    getState: () => invoke<ActiveOverlayState | null>("halo:getOverlayState"),
    onState: onOverlayState,
  },
};

contextBridge.exposeInMainWorld("haloAPI", haloAPI);
