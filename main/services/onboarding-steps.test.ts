import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOnboardingSteps,
  copyForZone,
  ONBOARDING_STEP_COUNT,
  type OnboardingRole,
  type OnboardingZoneId,
} from "./onboarding-steps.ts";

test("onboarding walks usable default zones in corner-then-edge order", () => {
  const steps = buildOnboardingSteps();
  assert.equal(steps.length, 3);
  assert.equal(ONBOARDING_STEP_COUNT, 8);
  assert.deepEqual(
    steps.map((step) => step.zone),
    [
      "top-left",
      "bottom-left",
      "bottom-right",
    ],
  );
});

test("default layout copy matches assigned roles", () => {
  const steps = buildOnboardingSteps();
  const byZone = Object.fromEntries(steps.map((step) => [step.zone, step]));
  assert.equal(byZone["top-left"].copy, "Try scrubbing brightness here");
  assert.equal(byZone["bottom-left"].copy, "Try scrubbing volume here");
  assert.equal(byZone["bottom-right"].copy, "Park apps in the Quick Dock");
  assert.equal(byZone["top-left"].role, "brightness");
  assert.equal(byZone["bottom-left"].role, "volume");
});

test("copyForZone respects an explicit role override", () => {
  assert.equal(copyForZone("top", "focus-timer"), "Start a focus session from here");
});

test("omits off and unsupported roles while preserving configured zone order", () => {
  const roles: Record<OnboardingZoneId, OnboardingRole> = {
    "top-left": "brightness",
    "top-right": "keyboard-backlight",
    "bottom-left": "volume",
    "bottom-right": "dock",
    top: "off",
    right: "focus-timer",
    bottom: "off",
    left: "appearance",
  };
  const steps = buildOnboardingSteps(
    (zone) => roles[zone],
    { brightnessSupported: false, keyboardSupported: false },
  );

  assert.deepEqual(
    steps.map((step) => [step.zone, step.role]),
    [
      ["bottom-left", "volume"],
      ["bottom-right", "dock"],
      ["right", "focus-timer"],
      ["left", "appearance"],
    ],
  );
});
