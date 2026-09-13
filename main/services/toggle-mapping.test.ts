import assert from "node:assert/strict";
import test from "node:test";

import {
  dialValueToKeepAwake,
  dialValueToMuted,
  keepAwakeLabel,
  keepAwakeToDialValue,
  muteLabel,
  mutedToDialValue,
} from "./toggle-mapping.ts";

test("maps mute boolean to dial extremes", () => {
  assert.equal(mutedToDialValue(true), 100);
  assert.equal(mutedToDialValue(false), 0);
});

test("treats dial values at or above 50 as muted", () => {
  assert.equal(dialValueToMuted(0), false);
  assert.equal(dialValueToMuted(49), false);
  assert.equal(dialValueToMuted(50), true);
  assert.equal(dialValueToMuted(100), true);
});

test("maps keep-awake boolean to dial extremes", () => {
  assert.equal(keepAwakeToDialValue(true), 100);
  assert.equal(keepAwakeToDialValue(false), 0);
  assert.equal(dialValueToKeepAwake(50), true);
  assert.equal(dialValueToKeepAwake(10), false);
});

test("labels mute and keep-awake for readout", () => {
  assert.equal(muteLabel(100), "Muted");
  assert.equal(muteLabel(0), "Unmuted");
  assert.equal(keepAwakeLabel(100), "On");
  assert.equal(keepAwakeLabel(0), "Off");
});
