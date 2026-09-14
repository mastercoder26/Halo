import type { OverlayMediaMeta, OverlayRole } from "./overlay-readout";

type ControlAriaRole = "group" | "slider" | "switch";

export function controlRole(role: OverlayRole | undefined): ControlAriaRole {
  if (role === "now-playing") return "group";
  if (role === "appearance" || role === "mute" || role === "keep-awake") return "switch";
  return "slider";
}

export function controlAccessibleLabel(
  role: OverlayRole | undefined,
  label: string | undefined,
  meta: OverlayMediaMeta | undefined,
  fallbackLabel: string,
): string {
  if (role === "now-playing") {
    const title = meta?.title?.trim() || "Now Playing";
    return `${title} playback controls`;
  }
  return label || fallbackLabel;
}

export function edgeSliderOrientation(
  role: OverlayRole | undefined,
  isVertical: boolean,
): "horizontal" | "vertical" | undefined {
  if (controlRole(role) !== "slider") return undefined;
  return isVertical ? "vertical" : "horizontal";
}
