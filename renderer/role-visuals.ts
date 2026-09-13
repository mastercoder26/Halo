export type HaloRole =
  | "volume"
  | "brightness"
  | "appearance"
  | "keyboard-backlight"
  | "mute"
  | "keep-awake";

const ROLE_COLORS: Record<HaloRole, { accent: string; glow: string }> = {
  volume: { accent: "#22D3EE", glow: "rgba(34,211,238,0.45)" },
  brightness: { accent: "#FBBF24", glow: "rgba(251,191,36,0.45)" },
  appearance: { accent: "#A78BFA", glow: "rgba(167,139,250,0.45)" },
  "keyboard-backlight": { accent: "#2DD4BF", glow: "rgba(45,212,191,0.45)" },
  mute: { accent: "#FB7185", glow: "rgba(251,113,133,0.45)" },
  "keep-awake": { accent: "#34D399", glow: "rgba(52,211,153,0.45)" },
};

export function accentForRole(role: HaloRole): string {
  return ROLE_COLORS[role].accent;
}

export function glowForRole(role: HaloRole): string {
  return ROLE_COLORS[role].glow;
}
