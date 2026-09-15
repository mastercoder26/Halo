import assert from "node:assert/strict";
import test from "node:test";

import { LevelDetentTracker, levelDetentIndex } from "./level-detent.ts";

test("levelDetentIndex uses floor buckets of 5%", () => {
  assert.equal(levelDetentIndex(0), 0);
  assert.equal(levelDetentIndex(4), 0);
  assert.equal(levelDetentIndex(5), 1);
  assert.equal(levelDetentIndex(49), 9);
  assert.equal(levelDetentIndex(50), 10);
  assert.equal(levelDetentIndex(100), 20);
});

test("claim fires once per new bucket and sync suppresses the opening value", () => {
  const tracker = new LevelDetentTracker();
  tracker.sync(47);
  assert.equal(tracker.claim(49), false);
  assert.equal(tracker.claim(50), true);
  assert.equal(tracker.claim(54), false);
  assert.equal(tracker.claim(55), true);
  assert.equal(tracker.claim(55), false);
});

test("claim fires when crossing downward", () => {
  const tracker = new LevelDetentTracker();
  tracker.sync(52);
  assert.equal(tracker.claim(50), false);
  assert.equal(tracker.claim(49), true);
});

test("claimSteps reports multi-bucket jumps", () => {
  const tracker = new LevelDetentTracker();
  tracker.sync(20);
  assert.equal(tracker.claimSteps(22), 0);
  assert.equal(tracker.claimSteps(41), 4);
  assert.equal(tracker.claimSteps(41), 0);
});
