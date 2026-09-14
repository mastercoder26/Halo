import assert from "node:assert/strict";
import test from "node:test";

import {
  dialValueToPosition,
  formatTrackTime,
  positionToDialValue,
} from "./seek-fraction.ts";

test("converts position and duration to dial percent", () => {
  assert.equal(positionToDialValue(30, 120), 25);
  assert.equal(positionToDialValue(0, 0), 0);
  assert.equal(positionToDialValue(200, 100), 100);
});

test("converts dial percent back to position seconds", () => {
  assert.equal(dialValueToPosition(25, 120), 30);
  assert.equal(dialValueToPosition(0, 0), 0);
  assert.equal(dialValueToPosition(150, 100), 100);
});

test("formats track time as m:ss", () => {
  assert.equal(formatTrackTime(0), "0:00");
  assert.equal(formatTrackTime(65), "1:05");
  assert.equal(formatTrackTime(3723), "62:03");
  assert.equal(formatTrackTime(-1), "0:00");
});
