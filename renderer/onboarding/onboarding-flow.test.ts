import assert from "node:assert/strict";
import test from "node:test";

import {
  adjustOnboardingControlValue,
  advanceOnboardingStage,
  initialOnboardingStage,
  muteValueForOnboarding,
  walkthroughMapZones,
} from "./onboarding-flow.ts";

test("onboarding starts with permissions and will not enter the control check without Accessibility", () => {
  assert.equal(initialOnboardingStage(), "permissions");
  assert.equal(advanceOnboardingStage("permissions", false), "permissions");
  assert.equal(advanceOnboardingStage("permissions", true), "controls");
  assert.equal(advanceOnboardingStage("controls", true), "calibration");
});

test("onboarding control adjustments stay small and inside the system range", () => {
  assert.equal(adjustOnboardingControlValue(42, 5), 47);
  assert.equal(adjustOnboardingControlValue(2, -5), 0);
  assert.equal(adjustOnboardingControlValue(98, 5), 100);
});

test("onboarding mute actions map to the same control values used by the live overlay", () => {
  assert.equal(muteValueForOnboarding(false), 100);
  assert.equal(muteValueForOnboarding(true), 0);
});

test("the walkthrough map always introduces every corner and edge before the live tour", () => {
  assert.deepEqual(walkthroughMapZones(), [
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
    "top",
    "right",
    "bottom",
    "left",
  ]);
});
