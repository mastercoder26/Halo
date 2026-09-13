import type { DisplayMode } from "../types.js";

export function displaysForMode<T>(mode: DisplayMode, allDisplays: readonly T[], cursorDisplay: T): T[] {
  return mode === "all" ? [...allDisplays] : [cursorDisplay];
}
