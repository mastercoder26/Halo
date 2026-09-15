/** Accumulate trackpad/mouse wheel into precise ±1 control steps. */

const PIXELS_PER_STEP = 64;
const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 120;

export interface WheelAccumulator {
  pixels: number;
}

export function createWheelAccumulator(): WheelAccumulator {
  return { pixels: 0 };
}

export function resetWheelAccumulator(accumulator: WheelAccumulator): void {
  accumulator.pixels = 0;
}

function wheelDeltaPixels(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1) return deltaY * LINE_HEIGHT_PX;
  if (deltaMode === 2) return deltaY * PAGE_HEIGHT_PX;
  return deltaY;
}

/**
 * Convert a wheel event into an integer control delta.
 * Positive delta increases the control value (scroll up / fingers down on natural trackpad).
 * Trackpad pixel floods are accumulated so each step is 1, not 2+ per event.
 */
export function wheelControlSteps(
  accumulator: WheelAccumulator,
  deltaY: number,
  deltaMode = 0,
  pixelsPerStep = PIXELS_PER_STEP,
): number {
  accumulator.pixels += wheelDeltaPixels(deltaY, deltaMode);

  let steps = 0;
  while (accumulator.pixels >= pixelsPerStep) {
    accumulator.pixels -= pixelsPerStep;
    steps -= 1;
  }
  while (accumulator.pixels <= -pixelsPerStep) {
    accumulator.pixels += pixelsPerStep;
    steps += 1;
  }
  return steps;
}
