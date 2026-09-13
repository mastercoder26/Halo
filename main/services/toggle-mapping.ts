/** Pure helpers for mute / keep-awake toggle mapping (0–100 dial values). */

export function mutedToDialValue(muted: boolean): number {
  return muted ? 100 : 0;
}

export function dialValueToMuted(value: number): boolean {
  return value >= 50;
}

export function keepAwakeToDialValue(active: boolean): number {
  return active ? 100 : 0;
}

export function dialValueToKeepAwake(value: number): boolean {
  return value >= 50;
}

export function muteLabel(value: number): string {
  return dialValueToMuted(value) ? "Muted" : "Unmuted";
}

export function keepAwakeLabel(value: number): string {
  return dialValueToKeepAwake(value) ? "On" : "Off";
}
