/** Dial/edge feedback fires once per this many percent. */
export const LEVEL_DETENT = 5;

/**
 * Floor buckets: 0–4 → 0, 5–9 → 1, … so crossing 5, 10, 15… each ticks once.
 */
export function levelDetentIndex(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.max(0, Math.min(100, value));
  return Math.floor(clamped / LEVEL_DETENT);
}

/**
 * Tracks the last detent bucket. `claimSteps` returns how many buckets were crossed
 * (0 if still in the same bucket) so fast jumps can pulse more than once.
 */
export class LevelDetentTracker {
  private last: number | null = null;

  sync(value: number): void {
    if (!Number.isFinite(value)) return;
    this.last = levelDetentIndex(value);
  }

  reset(): void {
    this.last = null;
  }

  /** True the first time `value` lands in a new 5% bucket. */
  claim(value: number): boolean {
    return this.claimSteps(value) > 0;
  }

  /** Number of 5% buckets crossed since the last claim/sync. */
  claimSteps(value: number): number {
    if (!Number.isFinite(value)) return 0;
    const detent = levelDetentIndex(value);
    if (this.last == null) {
      this.last = detent;
      return 0;
    }
    const steps = Math.abs(detent - this.last);
    if (steps === 0) return 0;
    this.last = detent;
    return steps;
  }
}
