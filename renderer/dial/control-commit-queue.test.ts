import assert from "node:assert/strict";
import test from "node:test";

import { LatestValueQueue } from "./control-commit-queue.ts";

test("commits one value at a time and retains only the latest queued value", async () => {
  const values: number[] = [];
  let active = 0;
  let maximumActive = 0;
  let releaseFirst: (() => void) | undefined;
  const firstCommit = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const queue = new LatestValueQueue(async (value: number) => {
    values.push(value);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    if (value === 10) await firstCommit;
    active -= 1;
  });

  queue.submit(10);
  queue.submit(20);
  queue.submit(30);
  releaseFirst?.();

  await queue.whenIdle();

  assert.deepEqual(values, [10, 30]);
  assert.equal(maximumActive, 1);
});

test("commits a newer value after an already-started value completes", async () => {
  const values: number[] = [];
  let releaseFirst: (() => void) | undefined;
  let releaseSecond: (() => void) | undefined;
  let markSecondStarted: (() => void) | undefined;
  const firstCommit = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const secondCommit = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });
  const secondStarted = new Promise<void>((resolve) => {
    markSecondStarted = resolve;
  });

  const queue = new LatestValueQueue(async (value: number) => {
    values.push(value);
    if (value === 10 && values.length === 1) await firstCommit;
    if (value === 20) {
      markSecondStarted?.();
      await secondCommit;
    }
  });

  queue.submit(10);
  queue.submit(20);
  releaseFirst?.();
  await secondStarted;
  queue.submit(10);
  releaseSecond?.();

  await queue.whenIdle();

  assert.deepEqual(values, [10, 20, 10]);
});
