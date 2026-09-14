/** Renderer-side role helpers (mirrors main/types classification). */

import type { OverlayRole } from "./overlay-readout";

export function isToggleRole(role: OverlayRole | undefined): boolean {
  return role === "appearance" || role === "mute" || role === "keep-awake";
}

export function isMediaRole(role: OverlayRole | undefined): boolean {
  return role === "now-playing";
}

export function toggleNextValue(current: number): number {
  return current >= 50 ? 0 : 100;
}
