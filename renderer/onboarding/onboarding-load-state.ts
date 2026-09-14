const ONBOARDING_ZONES = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "left",
  "right",
  "top",
  "bottom",
] as const;

export type ZoneId = (typeof ONBOARDING_ZONES)[number];
export type OnboardingRole =
  | "volume"
  | "brightness"
  | "appearance"
  | "dock"
  | "keyboard-backlight"
  | "mute"
  | "keep-awake"
  | "now-playing"
  | "focus-timer";

export interface OnboardingStep {
  zone: ZoneId;
  role: OnboardingRole;
  copy: string;
}

export type OnboardingLoadState =
  | { kind: "loading" }
  | { kind: "ready"; steps: OnboardingStep[] }
  | { kind: "error" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return (
    isRecord(value) &&
    typeof value.zone === "string" &&
    ONBOARDING_ZONES.some((zone) => zone === value.zone) &&
    typeof value.role === "string" &&
    [
      "volume",
      "brightness",
      "appearance",
      "dock",
      "keyboard-backlight",
      "mute",
      "keep-awake",
      "now-playing",
      "focus-timer",
    ].some((role) => role === value.role) &&
    typeof value.copy === "string" &&
    value.copy.trim().length > 0
  );
}

export function createOnboardingLoadingState(): OnboardingLoadState {
  return { kind: "loading" };
}

export function createOnboardingLoadErrorState(): OnboardingLoadState {
  return { kind: "error" };
}

export function resolveOnboardingLoad(payload: unknown): OnboardingLoadState {
  if (!isRecord(payload) || !Array.isArray(payload.steps) || payload.steps.length === 0) {
    return createOnboardingLoadErrorState();
  }

  if (!payload.steps.every(isOnboardingStep)) {
    return createOnboardingLoadErrorState();
  }

  return {
    kind: "ready",
    steps: payload.steps.map(({ zone, role, copy }) => ({ zone, role, copy })),
  };
}

export function shouldCloseOnboardingForKey(key: string, defaultPrevented: boolean): boolean {
  return key === "Escape" && !defaultPrevented;
}
