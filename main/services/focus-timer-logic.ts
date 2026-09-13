/** Pure Focus Timer helpers (safe for node:test). */

import type { FocusTimerStatus } from "../types.js";

export type FocusTimerPhase = "focus" | "short-break" | "long-break";

export interface FocusTimerDurations {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
}

export function durationMsForPhase(
  phase: FocusTimerPhase,
  config: FocusTimerDurations,
): number {
  switch (phase) {
    case "focus":
      return config.focusMinutes * 60_000;
    case "short-break":
      return config.shortBreakMinutes * 60_000;
    case "long-break":
      return config.longBreakMinutes * 60_000;
  }
}

export function nextPhase(
  phase: FocusTimerPhase,
  cycleIndex: number,
  cyclesBeforeLongBreak: number,
): { phase: FocusTimerPhase; cycleIndex: number } {
  if (phase === "focus") {
    const completed = cycleIndex + 1;
    if (completed >= cyclesBeforeLongBreak) {
      return { phase: "long-break", cycleIndex: 0 };
    }
    return { phase: "short-break", cycleIndex };
  }
  if (phase === "long-break") {
    return { phase: "focus", cycleIndex: 0 };
  }
  return { phase: "focus", cycleIndex: cycleIndex + 1 };
}

/**
 * Skipping replaces the current phase but should never silently start or stop
 * a timer. In particular, a paused timer remains paused on the next phase.
 */
export function nextPhaseAfterSkip(
  phase: FocusTimerPhase,
  cycleIndex: number,
  cyclesBeforeLongBreak: number,
  status: FocusTimerStatus,
): { phase: FocusTimerPhase; cycleIndex: number; status: FocusTimerStatus } {
  return { ...nextPhase(phase, cycleIndex, cyclesBeforeLongBreak), status };
}

export function formatTimerMmSs(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function phaseLabel(phase: FocusTimerPhase): string {
  switch (phase) {
    case "focus":
      return "Focus";
    case "short-break":
      return "Break";
    case "long-break":
      return "Long break";
  }
}
