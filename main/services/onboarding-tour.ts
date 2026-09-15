import type { OnboardingStep } from "./onboarding-steps.js";
import type { ZoneId, ZoneRole } from "../types.js";

export interface OnboardingTarget {
  displayId: number;
  zone: ZoneId;
  role: ZoneRole;
}

export interface OnboardingTourProgress {
  index: number;
  complete: boolean;
}

export interface OnboardingTourRuntime {
  setTarget: (target: OnboardingTarget | null) => void;
  hideCoachmark: () => void;
  showCoachmark: () => void;
  publishProgress: (progress: OnboardingTourProgress) => void;
  schedule: (callback: () => void, delayMs: number) => unknown;
  cancelSchedule: (timer: unknown) => void;
}

export interface OnboardingOverlayShown {
  displayId: number;
  zone: ZoneId;
  role: ZoneRole;
}

/**
 * Keep the real Halo overlay on screen long enough for the user to recognize
 * the result of the interaction before the next coachmark takes focus.
 */
export const ONBOARDING_TOUR_ADVANCE_DELAY_MS = 1_500;

export function onboardingTargetAllowsHit(
  hit: OnboardingTarget,
  target: OnboardingTarget | null,
): boolean {
  return (
    target !== null &&
    hit.displayId === target.displayId &&
    hit.zone === target.zone &&
    hit.role === target.role
  );
}

export class OnboardingTour {
  private readonly runtime: OnboardingTourRuntime;
  private displayId: number | null = null;
  private steps: OnboardingStep[] = [];
  private index = 0;
  private advanceTimer: unknown = null;
  private awaitingAdvance = false;
  private completed = false;

  constructor(runtime: OnboardingTourRuntime) {
    this.runtime = runtime;
  }

  get canComplete(): boolean {
    return this.completed;
  }

  start(displayId: number, steps: OnboardingStep[]): void {
    this.cancel();
    this.displayId = displayId;
    this.steps = [...steps];
    this.index = 0;
    this.completed = false;
    this.armCurrentStep();
  }

  onOverlayShown(shown: OnboardingOverlayShown): void {
    const target = this.currentTarget();
    if (this.awaitingAdvance || !onboardingTargetAllowsHit(shown, target)) return;
    this.awaitingAdvance = true;
    this.runtime.hideCoachmark();
    this.advanceTimer = this.runtime.schedule(() => {
      this.advanceTimer = null;
      this.awaitingAdvance = false;
      this.index += 1;
      if (this.index >= this.steps.length) {
        this.completed = true;
        this.runtime.setTarget(null);
        this.runtime.publishProgress({ index: this.index, complete: true });
        this.runtime.showCoachmark();
        return;
      }
      this.runtime.publishProgress({ index: this.index, complete: false });
      this.armCurrentStep();
      this.runtime.showCoachmark();
    }, ONBOARDING_TOUR_ADVANCE_DELAY_MS);
  }

  cancel(): void {
    if (this.advanceTimer !== null) this.runtime.cancelSchedule(this.advanceTimer);
    this.advanceTimer = null;
    this.awaitingAdvance = false;
    this.completed = false;
    this.runtime.setTarget(null);
  }

  private armCurrentStep(): void {
    const target = this.currentTarget();
    this.runtime.setTarget(target);
  }

  private currentTarget(): OnboardingTarget | null {
    const step = this.steps[this.index];
    if (this.displayId === null || !step) return null;
    return { displayId: this.displayId, zone: step.zone, role: step.role };
  }
}
