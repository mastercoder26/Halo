export type OnboardingStage =
  | "permissions"
  | "controls"
  | "calibration"
  | "map"
  | "zones"
  | "empty"
  | "complete";
const MINIMUM_CONTROL_VALUE = 0;
const MAXIMUM_CONTROL_VALUE = 100;

const WALKTHROUGH_MAP_ZONES = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "top",
  "right",
  "bottom",
  "left",
] as const;

export function walkthroughMapZones(): readonly (typeof WALKTHROUGH_MAP_ZONES)[number][] {
  return WALKTHROUGH_MAP_ZONES;
}

export function initialOnboardingStage(): OnboardingStage {
  return "permissions";
}

export function advanceOnboardingStage(
  stage: OnboardingStage,
  accessibilityTrusted: boolean,
): OnboardingStage {
  if (stage === "permissions") {
    return accessibilityTrusted ? "controls" : "permissions";
  }
  return stage === "controls" ? "calibration" : "calibration";
}

export function adjustOnboardingControlValue(currentValue: number, delta: number): number {
  return Math.min(
    MAXIMUM_CONTROL_VALUE,
    Math.max(MINIMUM_CONTROL_VALUE, Math.round(currentValue + delta)),
  );
}

export function muteValueForOnboarding(isMuted: boolean): number {
  return isMuted ? MINIMUM_CONTROL_VALUE : MAXIMUM_CONTROL_VALUE;
}
