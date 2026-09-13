/** Shared settings and overlay types for Halo's cursor controls. */

export type ZoneRole =
  | "off"
  | "volume"
  | "brightness"
  | "appearance"
  | "keyboard-backlight"
  | "mute"
  | "keep-awake";

export type CornerId = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type EdgeId = "left" | "right" | "top" | "bottom";
export type ZoneId = CornerId | EdgeId;

export const CORNER_IDS: CornerId[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
export const EDGE_IDS: EdgeId[] = ["left", "right", "top", "bottom"];

export type DisplayMode = "all" | "cursor-display";

export interface DisplayZoneSettings {
  enabled: boolean;
  corners: Record<CornerId, ZoneRole>;
  edges: Record<EdgeId, ZoneRole>;
}

export interface HaloSettings {
  version: 1;
  displayMode: DisplayMode;
  /** Per-display overrides keyed by display.id string. Missing displays use defaults. */
  displays: Record<string, DisplayZoneSettings>;
  /** How far from the screen edge the hover zone extends (px). */
  hotZoneSize: number;
  /** Extra padding when leaving a zone before hide (px). */
  hotZoneHysteresis: number;
  /** Clearance from menu bar, Dock, and notch when placing edge controls. */
  insets: {
    menuBar: number;
    dock: number;
    notch: number;
  };
}

export interface ControlSnapshot {
  volume: number;
  brightness: number;
  appearance: "light" | "dark";
  keyboardBacklight: number;
  muted: boolean;
  keepAwake: boolean;
  accessibilityTrusted: boolean;
  brightnessSupported: boolean;
  keyboardSupported: boolean;
}

export interface ActiveOverlayState {
  zone: ZoneId;
  role: ZoneRole;
  displayId: number;
  value: number;
  label: string;
}

export const ALL_ZONE_ROLES: ZoneRole[] = [
  "off",
  "volume",
  "brightness",
  "appearance",
  "keyboard-backlight",
  "mute",
  "keep-awake",
];

export function defaultDisplayZones(): DisplayZoneSettings {
  return {
    enabled: true,
    corners: {
      "top-left": "brightness",
      "top-right": "off",
      "bottom-left": "volume",
      "bottom-right": "off",
    },
    edges: {
      left: "off",
      right: "off",
      top: "off",
      bottom: "off",
    },
  };
}

export function defaultSettings(): HaloSettings {
  return {
    version: 1,
    displayMode: "all",
    displays: {},
    hotZoneSize: 10,
    hotZoneHysteresis: 24,
    insets: { menuBar: 28, dock: 16, notch: 0 },
  };
}

export function isCorner(zone: ZoneId): zone is CornerId {
  return (CORNER_IDS as string[]).includes(zone);
}

export function isEdge(zone: ZoneId): zone is EdgeId {
  return (EDGE_IDS as string[]).includes(zone);
}

export function roleLabel(role: ZoneRole): string {
  switch (role) {
    case "volume":
      return "Volume";
    case "brightness":
      return "Brightness";
    case "appearance":
      return "Appearance";
    case "keyboard-backlight":
      return "Keyboard";
    case "mute":
      return "Mute";
    case "keep-awake":
      return "Keep Awake";
    default:
      return "Off";
  }
}
