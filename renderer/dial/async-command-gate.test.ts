import assert from "node:assert/strict";
import test from "node:test";

import { AsyncCommandGate } from "./async-command-gate.ts";

test("accepts one command and rejects duplicate clicks until released", () => {
  const gate = new AsyncCommandGate();

  assert.equal(gate.tryEnter(), true);
  assert.equal(gate.isBusy, true);
  assert.equal(gate.tryEnter(), false);

  gate.release();

  assert.equal(gate.isBusy, false);
  assert.equal(gate.tryEnter(), true);
});

test("can be released after a failed command so the user can retry", () => {
  const gate = new AsyncCommandGate();

  assert.equal(gate.tryEnter(), true);
  gate.release();

  assert.equal(gate.tryEnter(), true);
});
