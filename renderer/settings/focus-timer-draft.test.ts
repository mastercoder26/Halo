import assert from "node:assert/strict";
import test from "node:test";

import { parseBoundedInteger } from "./focus-timer-draft.ts";

test("keeps an empty numeric draft uncommitted while the user is editing", () => {
  assert.equal(parseBoundedInteger("", 1, 90), null);
});

test("commits whole numbers inside the allowed range", () => {
  assert.equal(parseBoundedInteger("25", 1, 90), 25);
});

test("rejects fractional, malformed, and out-of-range numeric drafts", () => {
  assert.equal(parseBoundedInteger("12.5", 1, 90), null);
  assert.equal(parseBoundedInteger("minutes", 1, 90), null);
  assert.equal(parseBoundedInteger("0", 1, 90), null);
  assert.equal(parseBoundedInteger("91", 1, 90), null);
});
