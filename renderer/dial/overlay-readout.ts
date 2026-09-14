/** Shared overlay readout helpers for dial + edge control. */

export type OverlayRole =
  | "volume"
  | "brightness"
  | "appearance"
  | "keyboard-backlight"
  | "mute"
  | "keep-awake"
  | "now-playing"
  | "dock"
  | "off";

export function isDialOverlayRole(
  role: OverlayRole | undefined | null,
): role is Exclude<OverlayRole, "dock" | "off"> {
  return role != null && role !== "dock" && role !== "off";
}

export interface OverlayMediaMeta {
  title: string;
  artist: string;
  playing: boolean;
  position: number;
  duration: number;
}

export function formatTrackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function readoutForRole(
  role: OverlayRole | undefined,
  value: number,
  meta?: OverlayMediaMeta | null,
): { display: string; accessible: string; compact: boolean } {
  const rounded = Math.round(value);
  switch (role) {
    case "appearance":
      return {
        display: value >= 50 ? "Dark" : "Light",
        accessible: value >= 50 ? "Dark" : "Light",
        compact: true,
      };
    case "mute":
      return {
        display: value >= 50 ? "Muted" : "Unmuted",
        accessible: value >= 50 ? "Muted" : "Unmuted",
        compact: true,
      };
    case "keep-awake":
      return {
        display: value >= 50 ? "On" : "Off",
        accessible: value >= 50 ? "Keep awake on" : "Keep awake off",
        compact: true,
      };
    case "now-playing": {
      const position =
        meta && meta.duration > 0
          ? (rounded / 100) * meta.duration
          : (meta?.position ?? 0);
      const time = formatTrackTime(position);
      const title = meta?.title?.trim() || "Now Playing";
      return {
        display: time,
        accessible: `${title}, ${time}`,
        compact: true,
      };
    }
    default:
      return {
        display: String(rounded),
        accessible: `${rounded}%`,
        compact: false,
      };
  }
}

export function mediaTitle(meta?: OverlayMediaMeta | null): string {
  if (!meta?.title?.trim()) return "Now Playing";
  return meta.title.trim();
}
