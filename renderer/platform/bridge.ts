/** The complete, renderer-safe contract exposed by the Electron preload script. */

import type {
  ActiveOverlayState,
  ControlSnapshot,
  DisplayZoneSettings,
  HaloSettings,
  ZoneRole,
} from "../../main/types.ts";

export type {
  ActiveOverlayState,
  ControlSnapshot,
  DisplayZoneSettings,
  HaloSettings,
  ZoneRole,
};

export type ControlRole = Exclude<ZoneRole, "off">;

export interface DisplayInfo {
  id: number;
  label: string;
  primary: boolean;
  zones: DisplayZoneSettings;
}

export interface ControlUpdate {
  role: ControlRole;
  value: number;
}

export interface HaloAPI {
  window: {
    closeSettings(): Promise<void>;
  };
  settings: {
    get(): Promise<HaloSettings>;
    update(patch: Partial<HaloSettings>): Promise<HaloSettings>;
    resetHotZones(): Promise<HaloSettings>;
  };
  displays: {
    get(): Promise<DisplayInfo[]>;
    setZones(displayId: number, zones: DisplayZoneSettings): Promise<DisplayZoneSettings>;
  };
  controls: {
    get(): Promise<ControlSnapshot>;
    set(role: ControlRole, value: number): Promise<ControlUpdate>;
  };
  accessibility: {
    request(): Promise<{ trusted: boolean }>;
    openSettings(): Promise<void>;
  };
  app: {
    getAutoLaunch(): Promise<boolean>;
    setAutoLaunch(enabled: boolean): Promise<boolean>;
  };
  onboarding: {
    complete(): Promise<HaloSettings>;
  };
  overlay: {
    getState(): Promise<ActiveOverlayState | null>;
    onState(listener: (state: ActiveOverlayState | null) => void): () => void;
  };
}

declare global {
  interface Window {
    haloAPI: HaloAPI;
  }
}

export {};
