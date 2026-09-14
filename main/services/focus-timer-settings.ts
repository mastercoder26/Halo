/** Pure Focus Timer settings sanitize (safe for node:test). */

export interface FocusTimerSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
}

export function defaultFocusTimerSettings(): FocusTimerSettings {
  return {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function sanitizeFocusTimerSettings(raw: unknown): FocusTimerSettings {
  const base = defaultFocusTimerSettings();
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<FocusTimerSettings>)
      : {};
  return {
    focusMinutes: clampInt(src.focusMinutes, 1, 90, base.focusMinutes),
    shortBreakMinutes: clampInt(src.shortBreakMinutes, 1, 60, base.shortBreakMinutes),
    longBreakMinutes: clampInt(src.longBreakMinutes, 1, 60, base.longBreakMinutes),
    cyclesBeforeLongBreak: clampInt(src.cyclesBeforeLongBreak, 1, 8, base.cyclesBeforeLongBreak),
  };
}
