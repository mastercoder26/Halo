import { LevelDetentTracker } from "./level-detent";

interface FeedbackFlags {
  haptics: boolean;
  sound: boolean;
}

let flags: FeedbackFlags = { haptics: true, sound: false };

/** Cap multi-detent jumps so a big scrub doesn't spam the actuator. */
const MAX_PULSES_PER_CLAIM = 4;

export function refreshFeedbackSettings(): Promise<void> {
  return window.haloAPI.ipc
    .invoke<{ feedback?: FeedbackFlags }>("halo:getSettings")
    .then((settings) => {
      if (settings?.feedback) {
        flags = {
          haptics: Boolean(settings.feedback.haptics),
          sound: Boolean(settings.feedback.sound),
        };
      }
    })
    .catch(() => {
      // Keep last-known flags; default is haptics on.
    });
}

function pulseHaptic(): void {
  void window.haloAPI.ipc.invoke("halo:levelFeedback");
}

/**
 * Tick once per newly crossed 5% detent. Call from pointer/wheel handlers
 * with the optimistic local value (before slow setControl coalescing).
 */
export function tickLevelFeedback(tracker: LevelDetentTracker, value: number): void {
  const steps = tracker.claimSteps(value);
  if (steps <= 0) return;

  if (flags.haptics) {
    const pulses = Math.min(steps, MAX_PULSES_PER_CLAIM);
    for (let i = 0; i < pulses; i++) pulseHaptic();
  }

  // The native feedback service applies the user's sound preference too.
}
