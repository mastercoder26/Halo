import assert from "node:assert/strict";
import test from "node:test";

import { keyboardControlValue } from "./keyboard-control.ts";

test("adjusts values for arrow and page keys", () => {
  assert.equal(keyboardControlValue(50, "ArrowRight"), 52);
  assert.equal(keyboardControlValue(50, "ArrowUp"), 52);
  assert.equal(keyboardControlValue(50, "ArrowLeft"), 48);
  assert.equal(keyboardControlValue(50, "ArrowDown"), 48);
  assert.equal(keyboardControlValue(50, "PageUp"), 60);
  assert.equal(keyboardControlValue(50, "PageDown"), 40);
});

test("moves to range boundaries for Home and End", () => {
  assert.equal(keyboardControlValue(50, "Home"), 0);
  assert.equal(keyboardControlValue(50, "End"), 100);
});

test("clamps adjusted values to the 0–100 range", () => {
  assert.equal(keyboardControlValue(99, "ArrowRight"), 100);
  assert.equal(keyboardControlValue(1, "ArrowLeft"), 0);
  assert.equal(keyboardControlValue(95, "PageUp"), 100);
  assert.equal(keyboardControlValue(5, "PageDown"), 0);
});

test("returns null for unsupported keys", () => {
  assert.equal(keyboardControlValue(50, "Enter"), null);
});
