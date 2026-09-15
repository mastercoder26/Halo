import assert from "node:assert/strict";
import test from "node:test";

import { createWheelAccumulator, wheelControlSteps } from "./wheel-control.ts";

test("accumulates small trackpad deltas into single steps", () => {
  const acc = createWheelAccumulator();
  assert.equal(wheelControlSteps(acc, 20), 0);
  assert.equal(wheelControlSteps(acc, 20), 0);
  assert.equal(wheelControlSteps(acc, 24), -1);
  assert.equal(wheelControlSteps(acc, -30), 0);
  assert.equal(wheelControlSteps(acc, -34), 1);
});

test("line-mode mouse wheels step once per notch", () => {
  const acc = createWheelAccumulator();
  assert.equal(wheelControlSteps(acc, 1, 1), 0);
  assert.equal(wheelControlSteps(acc, 3, 1), -1);
});
