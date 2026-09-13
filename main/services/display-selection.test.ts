import assert from "node:assert/strict";
import test from "node:test";

import { displaysForMode } from "./display-selection.ts";

test("all mode preserves every enabled display candidate", () => {
  const displays = ["left", "center", "right"];

  assert.deepEqual(displaysForMode("all", displays, "center"), displays);
});

test("cursor mode evaluates only the display under the pointer", () => {
  const displays = ["left", "center", "right"];

  assert.deepEqual(displaysForMode("cursor-display", displays, "center"), ["center"]);
});
