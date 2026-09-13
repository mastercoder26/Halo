import assert from "node:assert/strict";
import test from "node:test";

import { parseKeyboardBacklight } from "./keyboard-backlight.ts";

test("normalizes the hardware keyboard-backlight registry value", () => {
  assert.equal(parseKeyboardBacklight('"KeyboardBacklightBrightness" = 128'), 50);
  assert.equal(parseKeyboardBacklight('"KeyboardBacklightBrightness" = 255'), 100);
});

test("returns null when the keyboard backlight is not exposed by hardware", () => {
  assert.equal(parseKeyboardBacklight("no matching service"), null);
});
