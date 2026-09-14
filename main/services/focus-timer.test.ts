import assert from "node:assert/strict";
import test from "node:test";

import {
  durationMsForPhase,
  formatTimerMmSs,
  nextPhaseAfterSkip,
  nextPhase,
  phaseLabel,
} from "./focus-timer-logic.ts";
import { sanitizeFocusTimerSettings } from "./focus-timer-settings.ts";

test("durationMsForPhase uses configured minutes", () => {
  const config = {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4,
  };
  assert.equal(durationMsForPhase("focus", config), 25 * 60_000);
  assert.equal(durationMsForPhase("short-break", config), 5 * 60_000);
  assert.equal(durationMsForPhase("long-break", config), 15 * 60_000);
});

test("nextPhase advances to short break then long break after N focuses", () => {
  assert.deepEqual(nextPhase("focus", 0, 4), { phase: "short-break", cycleIndex: 0 });
  assert.deepEqual(nextPhase("short-break", 0, 4), { phase: "focus", cycleIndex: 1 });
  assert.deepEqual(nextPhase("focus", 1, 4), { phase: "short-break", cycleIndex: 1 });
  assert.deepEqual(nextPhase("focus", 3, 4), { phase: "long-break", cycleIndex: 0 });
  assert.deepEqual(nextPhase("long-break", 0, 4), { phase: "focus", cycleIndex: 0 });
});

test("skipping a phase preserves whether the timer is paused", () => {
  assert.deepEqual(nextPhaseAfterSkip("focus", 0, 4, "paused"), {
    phase: "short-break",
    cycleIndex: 0,
    status: "paused",
  });
  assert.deepEqual(nextPhaseAfterSkip("short-break", 0, 4, "running"), {
    phase: "focus",
    cycleIndex: 1,
    status: "running",
  });
});

test("formatTimerMmSs pads countdown segments", () => {
  assert.equal(formatTimerMmSs(0), "00:00");
  assert.equal(formatTimerMmSs(1_000), "00:01");
  assert.equal(formatTimerMmSs(65_000), "01:05");
  assert.equal(formatTimerMmSs(25 * 60_000), "25:00");
});

test("phaseLabel is short and readable", () => {
  assert.equal(phaseLabel("focus"), "Focus");
  assert.equal(phaseLabel("short-break"), "Break");
  assert.equal(phaseLabel("long-break"), "Long break");
});

test("sanitizeFocusTimerSettings clamps durations and cycles", () => {
  assert.deepEqual(
    sanitizeFocusTimerSettings({
      focusMinutes: 200,
      shortBreakMinutes: 0,
      longBreakMinutes: -3,
      cyclesBeforeLongBreak: 99,
    }),
    {
      focusMinutes: 90,
      shortBreakMinutes: 1,
      longBreakMinutes: 1,
      cyclesBeforeLongBreak: 8,
    },
  );
  assert.deepEqual(sanitizeFocusTimerSettings(null), {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4,
  });
});
