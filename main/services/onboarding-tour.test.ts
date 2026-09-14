import assert from "node:assert/strict";
import test from "node:test";

import {
  ONBOARDING_TOUR_ADVANCE_DELAY_MS,
  OnboardingTour,
  onboardingTargetAllowsHit,
  type OnboardingTourRuntime,
} from "./onboarding-tour.ts";

const steps = [
  { zone: "top-left" as const, role: "brightness" as const, copy: "Try brightness" },
  { zone: "bottom-left" as const, role: "volume" as const, copy: "Try volume" },
];

function createRuntime(): {
  runtime: OnboardingTourRuntime;
  targets: Array<{ displayId: number; zone: string; role: string } | null>;
  progress: Array<{ index: number; complete: boolean }>;
  events: string[];
  delays: number[];
} {
  const targets: Array<{ displayId: number; zone: string; role: string } | null> = [];
  const progress: Array<{ index: number; complete: boolean }> = [];
  const events: string[] = [];
  const delays: number[] = [];
  return {
    targets,
    progress,
    events,
    delays,
    runtime: {
      setTarget(target) {
        targets.push(target);
      },
      hideCoachmark() {
        events.push("hide");
      },
      showCoachmark() {
        events.push("show");
      },
      publishProgress(next) {
        progress.push(next);
      },
      schedule(callback, delayMs) {
        delays.push(delayMs);
        callback();
        return 1;
      },
      cancelSchedule() {},
    },
  };
}

test("gates interaction to the selected display and current zone", () => {
  const target = { displayId: 7, zone: "top-left" as const, role: "brightness" as const };
  assert.equal(onboardingTargetAllowsHit(target, target), true);
  assert.equal(onboardingTargetAllowsHit({ ...target, displayId: 8 }, target), false);
  assert.equal(onboardingTargetAllowsHit({ ...target, zone: "bottom-left" }, target), false);
  assert.equal(onboardingTargetAllowsHit({ ...target, role: "volume" }, target), false);
});

test("advances only after the matching Halo overlay is shown and restores the coachmark", () => {
  const { runtime, targets, progress, events, delays } = createRuntime();
  const tour = new OnboardingTour(runtime);
  tour.start(7, steps);

  tour.onOverlayShown({ displayId: 8, zone: "top-left", role: "brightness" });
  assert.deepEqual(targets[targets.length - 1], { displayId: 7, zone: "top-left", role: "brightness" });

  tour.onOverlayShown({ displayId: 7, zone: "top-left", role: "brightness" });
  assert.deepEqual(targets[targets.length - 1], { displayId: 7, zone: "bottom-left", role: "volume" });
  assert.deepEqual(progress, [{ index: 1, complete: false }]);
  assert.deepEqual(events, ["hide", "show"]);
  assert.deepEqual(delays, [ONBOARDING_TOUR_ADVANCE_DELAY_MS]);
});

test("keeps the completed control visible long enough to acknowledge it", () => {
  assert.equal(ONBOARDING_TOUR_ADVANCE_DELAY_MS, 1_500);
});

test("marks the tour ready to finish only after the final matching overlay and always clears its gate", () => {
  const { runtime, targets, progress } = createRuntime();
  const tour = new OnboardingTour(runtime);
  tour.start(7, steps);
  tour.onOverlayShown({ displayId: 7, zone: "top-left", role: "brightness" });
  tour.onOverlayShown({ displayId: 7, zone: "bottom-left", role: "volume" });

  assert.equal(tour.canComplete, true);
  assert.deepEqual(progress, [
    { index: 1, complete: false },
    { index: 2, complete: true },
  ]);
  assert.equal(targets[targets.length - 1], null);

  tour.cancel();
  assert.equal(targets[targets.length - 1], null);
  assert.equal(tour.canComplete, false);
});
