import { defaultFocusTimerSettings } from "./services/focus-timer-settings.ts";

export { defaultFocusTimerSettings };

/** Shared Halo settings and zone types (backend + IPC). */

export type ZoneRole =
  | "off"
  | "volume"
  | "brightness"
  | "appearance"
  | "dock"
  | "keyboard-backlight"
  | "mute"
  | "keep-awake"
  | "now-playing"
  | "focus-timer";

export type FocusTimerPhase = "focus" | "short-break" | "long-break";
export type FocusTimerStatus = "idle" | "running" | "paused";

export interface FocusTimerSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
}

export interface FocusTimerMeta {
  phase: FocusTimerPhase;
  status: FocusTimerStatus;
  remainingMs: number;
  totalMs: number;
  cycleIndex: number;
  cyclesBeforeLongBreak: number;
}

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

export interface FeedbackSettings {
  haptics: boolean;
  sound: boolean;
}

export interface HaloSettings {
  version: 1;
  displayMode: DisplayMode;
  /** Per-display overrides keyed by display.id string. Missing → defaults. */
  displays: Record<string, DisplayZoneSettings>;
  dockApps: string[];
  feedback: FeedbackSettings;
  /** How far from the screen edge the hover zone extends (px). */
  hotZoneSize: number;
  /** Extra padding when leaving a zone before hide (px). */
  hotZoneHysteresis: number;
  /** Clearance from menu bar / Dock / notch when placing overlays. */
  insets: {
    menuBar: number;
    dock: number;
    notch: number;
  };
  /** First-launch coachmark walkthrough completed. */
  hasCompletedOnboarding: boolean;
  /** Shared Pomodoro durations for the focus-timer zone role. */
  focusTimer: FocusTimerSettings;
}

export interface DockAppInfo {
  path: string;
  name: string;
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

export interface OverlayMediaMeta {
  title: string;
  artist: string;
  playing: boolean;
  position: number;
  duration: number;
}

export interface ActiveOverlayState {
  zone: ZoneId;
  role: ZoneRole;
  displayId: number;
  value: number;
  label: string;
  meta?: OverlayMediaMeta;
  timer?: FocusTimerMeta;
}

export const ALL_ZONE_ROLES: ZoneRole[] = [
  "off",
  "volume",
  "brightness",
  "appearance",
  "dock",
  "keyboard-backlight",
  "mute",
  "keep-awake",
  "now-playing",
  "focus-timer",
];

export function defaultDisplayZones(): DisplayZoneSettings {
  return {
    enabled: true,
    corners: {
      "top-left": "brightness",
      "top-right": "off",
      "bottom-left": "volume",
      "bottom-right": "dock",
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
    dockApps: [],
    feedback: { haptics: true, sound: false },
    hotZoneSize: 10,
    hotZoneHysteresis: 24,
    insets: { menuBar: 28, dock: 16, notch: 0 },
    hasCompletedOnboarding: false,
    focusTimer: defaultFocusTimerSettings(),
  };
}

export function isCorner(zone: ZoneId): zone is CornerId {
  return (CORNER_IDS as string[]).includes(zone);
}

export function isEdge(zone: ZoneId): zone is EdgeId {
  return (EDGE_IDS as string[]).includes(zone);
}

export function isContinuousRole(role: ZoneRole): boolean {
  return (
    role === "volume" ||
    role === "brightness" ||
    role === "keyboard-backlight" ||
    role === "now-playing"
  );
}

export function isToggleRole(role: ZoneRole): boolean {
  return role === "appearance" || role === "mute" || role === "keep-awake";
}

export function isFocusTimerRole(role: ZoneRole): boolean {
  return role === "focus-timer";
}

export function isDockRole(role: ZoneRole): boolean {
  return role === "dock";
}

/** Roles that use the dial / edge-control overlays. */
export function isDialRole(role: ZoneRole): boolean {
  return isContinuousRole(role) || isToggleRole(role);
}

/** Tap/readout HUDs that stay visible while the cursor is over them. */
export function isHudRole(role: ZoneRole): boolean {
  return isFocusTimerRole(role);
}

export function roleLabel(role: ZoneRole): string {
  switch (role) {
    case "volume":
      return "Volume";
    case "brightness":
      return "Brightness";
    case "appearance":
      return "Appearance";
    case "dock":
      return "Dock";
    case "keyboard-backlight":
      return "Keyboard";
    case "mute":
      return "Mute";
    case "keep-awake":
      return "Keep Awake";
    case "now-playing":
      return "Now Playing";
    case "focus-timer":
      return "Focus Timer";
    default:
      return "Off";
  }
}
