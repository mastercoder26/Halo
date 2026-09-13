import assert from "node:assert/strict";
import test from "node:test";

import { positionForSeekFraction, seekFraction } from "./seek-fraction.ts";

test("converts playback time into a clamped seek fraction", () => {
  assert.equal(seekFraction(45, 90), 0.5);
  assert.equal(seekFraction(-1, 90), 0);
  assert.equal(seekFraction(100, 90), 1);
  assert.equal(seekFraction(45, 0), 0);
});

test("converts a seek fraction into a bounded playback position", () => {
  assert.equal(positionForSeekFraction(0.5, 90), 45);
  assert.equal(positionForSeekFraction(-1, 90), 0);
  assert.equal(positionForSeekFraction(2, 90), 90);
  assert.equal(positionForSeekFraction(0.5, 0), 0);
});
