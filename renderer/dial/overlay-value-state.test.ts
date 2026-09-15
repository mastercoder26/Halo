import assert from "node:assert/strict";
import test from "node:test";

import { OverlayValueState } from "./overlay-value-state.ts";

test("keeps a user's newest dial value when a stale overlay refresh arrives", () => {
  const state = new OverlayValueState();

  assert.equal(state.receiveOverlay("brightness:42", 18), true);
  assert.equal(state.value, 18);

  const request = state.beginChange(40);
  assert.equal(state.value, 40);
  assert.equal(state.receiveOverlay("brightness:42", 18), false);
  assert.equal(state.value, 40);
  assert.equal(state.confirmChange(request, 40), true);
  assert.equal(state.value, 40);
});

test("accepts the current overlay value for a different control", () => {
  const state = new OverlayValueState();

  state.receiveOverlay("brightness:42", 18);
  state.beginChange(40);

  assert.equal(state.receiveOverlay("volume:42", 63), true);
  assert.equal(state.value, 63);
});

test("does not let an old write confirmation replace a newer intended value", () => {
  const state = new OverlayValueState();

  state.receiveOverlay("brightness:42", 18);
  const first = state.beginChange(35);
  const second = state.beginChange(40);

  assert.equal(state.confirmChange(first, 35), false);
  assert.equal(state.value, 40);
  assert.equal(state.confirmChange(second, 40), true);
  assert.equal(state.value, 40);
});

test("restores the last confirmed value when the newest write fails", () => {
  const state = new OverlayValueState();

  state.receiveOverlay("brightness:42", 18);
  const first = state.beginChange(35);
  const second = state.beginChange(40);

  assert.equal(state.confirmChange(first, 35), false);
  assert.equal(state.rejectChange(second), true);
  assert.equal(state.value, 35);
  assert.equal(state.receiveOverlay("brightness:42", 35), true);
});

test("does not use an old control's confirmation as a new control's fallback", () => {
  const state = new OverlayValueState();

  state.receiveOverlay("brightness:42", 18);
  const brightnessRequest = state.beginChange(35);
  state.receiveOverlay("volume:42", 63);
  const volumeRequest = state.beginChange(74);

  assert.equal(state.confirmChange(brightnessRequest, 35), false);
  assert.equal(state.rejectChange(volumeRequest), true);
  assert.equal(state.value, 63);
});

test("accepts later OS refresh after the latest write is confirmed", () => {
  const state = new OverlayValueState();

  state.receiveOverlay("brightness:42", 18);
  const request = state.beginChange(80);
  assert.equal(state.confirmChange(request, 80), true);
  assert.equal(state.receiveOverlay("brightness:42", 72), true);
  assert.equal(state.value, 72);
});

test("blocks stale now-playing polls while a scrub revision is elevated", () => {
  const state = new OverlayValueState();

  state.receiveOverlay("now-playing:1:bottom-left", 20);
  state.beginChange(65);
  assert.equal(state.receiveOverlay("now-playing:1:bottom-left", 22), false);
  assert.equal(state.value, 65);
});

test("force-accepts overlay value even while revision is elevated", () => {
  const state = new OverlayValueState();

  state.receiveOverlay("brightness:42", 18);
  state.beginChange(40);
  assert.equal(state.receiveOverlay("brightness:42", 80, { force: true }), true);
  assert.equal(state.value, 80);
  assert.equal(state.receiveOverlay("brightness:42", 55), true);
  assert.equal(state.value, 55);
});
