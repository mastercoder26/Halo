/** Pure onboarding step helpers (safe for node:test). */

export type OnboardingZoneId =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "left"
  | "right"
  | "top"
  | "bottom";

export type OnboardingRole =
  | "off"
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
  zone: OnboardingZoneId;
  role: OnboardingRole;
  copy: string;
}

export interface OnboardingControlAvailability {
  brightnessSupported: boolean;
  keyboardSupported: boolean;
}

const STEP_ORDER: OnboardingZoneId[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "top",
  "right",
  "bottom",
  "left",
];

/** Mirrors defaultDisplayZones() without importing main/types.js. */
const DEFAULT_ROLES: Record<OnboardingZoneId, OnboardingRole> = {
  "top-left": "brightness",
  "top-right": "off",
  "bottom-left": "volume",
  "bottom-right": "dock",
  left: "off",
  right: "off",
  top: "off",
  bottom: "off",
};

export function copyForZone(
  zone: OnboardingZoneId,
  role: OnboardingRole = DEFAULT_ROLES[zone],
): string {
  switch (role) {
    case "brightness":
      return "Try scrubbing brightness here";
    case "volume":
      return "Try scrubbing volume here";
    case "dock":
      return "Park apps in the Quick Dock";
    case "appearance":
      return "Toggle appearance from this edge";
    case "mute":
      return "Mute the system from here";
    case "keep-awake":
      return "Keep the display awake from here";
    case "now-playing":
      return "Control what's playing from here";
    case "keyboard-backlight":
      return "Adjust keyboard backlight here";
    case "focus-timer":
      return "Start a focus session from here";
    default:
      return "Leave free, or assign a control in Settings";
  }
}

export function buildOnboardingSteps(
  roleForZone: (zone: OnboardingZoneId) => OnboardingRole = (zone) => DEFAULT_ROLES[zone],
  availability: OnboardingControlAvailability = {
    brightnessSupported: true,
    keyboardSupported: true,
  },
): OnboardingStep[] {
  return STEP_ORDER.flatMap((zone) => {
    const role = roleForZone(zone);
    if (
      role === "off" ||
      (role === "brightness" && !availability.brightnessSupported) ||
      (role === "keyboard-backlight" && !availability.keyboardSupported)
    ) {
      return [];
    }
    return [{ zone, role, copy: copyForZone(zone, role) }];
  });
}

export const ONBOARDING_STEP_COUNT = STEP_ORDER.length;
