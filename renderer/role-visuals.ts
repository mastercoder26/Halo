/** Per-role accent colors and copy shared by Settings Signal Map and overlays. */

export type HaloRole =
  | "off"
  | "volume"
  | "brightness"
  | "appearance"
  | "mute"
  | "keep-awake"
  | "now-playing"
  | "dock"
  | "keyboard-backlight"
  | "focus-timer";

export interface RoleVisual {
  label: string;
  accent: string;
  /** Soft glow / rgba tint derived from accent for shadows. */
  glow: string;
  blurb: string;
  /** Lucide icon name used by Settings RolePalette. */
  icon:
    | "Power"
    | "Volume2"
    | "Sun"
    | "Moon"
    | "VolumeX"
    | "Coffee"
    | "Music2"
    | "AppWindow"
    | "Keyboard"
    | "Timer";
}

export const ROLE_VISUALS: Record<HaloRole, RoleVisual> = {
  off: {
    label: "Off",
    accent: "#64748B",
    glow: "rgba(100,116,139,0.45)",
    blurb: "Disable this zone",
    icon: "Power",
  },
  volume: {
    label: "Volume",
    accent: "#22D3EE",
    glow: "rgba(34,211,238,0.55)",
    blurb: "Scrub system volume",
    icon: "Volume2",
  },
  brightness: {
    label: "Brightness",
    accent: "#FBBF24",
    glow: "rgba(251,191,36,0.55)",
    blurb: "Scrub display brightness",
    icon: "Sun",
  },
  appearance: {
    label: "Appearance",
    accent: "#A78BFA",
    glow: "rgba(167,139,250,0.55)",
    blurb: "Toggle light / dark mode",
    icon: "Moon",
  },
  mute: {
    label: "Mute",
    accent: "#FB7185",
    glow: "rgba(251,113,133,0.55)",
    blurb: "Toggle system mute",
    icon: "VolumeX",
  },
  "keep-awake": {
    label: "Keep Awake",
    accent: "#34D399",
    glow: "rgba(52,211,153,0.55)",
    blurb: "Prevent display sleep",
    icon: "Coffee",
  },
  "now-playing": {
    label: "Now Playing",
    accent: "#E879F9",
    glow: "rgba(232,121,249,0.55)",
    blurb: "Seek and control media",
    icon: "Music2",
  },
  dock: {
    label: "Dock",
    accent: "#818CF8",
    glow: "rgba(129,140,248,0.55)",
    blurb: "Show your Quick Dock",
    icon: "AppWindow",
  },
  "keyboard-backlight": {
    label: "Keyboard",
    accent: "#2DD4BF",
    glow: "rgba(45,212,191,0.55)",
    blurb: "Adjust keyboard backlight",
    icon: "Keyboard",
  },
  "focus-timer": {
    label: "Focus Timer",
    accent: "#FBBF24",
    glow: "rgba(251,191,36,0.55)",
    blurb: "Focus and break cycles",
    icon: "Timer",
  },
};

export const ROLE_ORDER: HaloRole[] = [
  "off",
  "volume",
  "brightness",
  "appearance",
  "mute",
  "keep-awake",
  "now-playing",
  "dock",
  "keyboard-backlight",
  "focus-timer",
];

export function accentForRole(role: HaloRole | undefined | null): string {
  if (!role) return ROLE_VISUALS.volume.accent;
  return ROLE_VISUALS[role]?.accent ?? ROLE_VISUALS.volume.accent;
}

export function glowForRole(role: HaloRole | undefined | null): string {
  if (!role) return ROLE_VISUALS.volume.glow;
  return ROLE_VISUALS[role]?.glow ?? ROLE_VISUALS.volume.glow;
}

export function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
