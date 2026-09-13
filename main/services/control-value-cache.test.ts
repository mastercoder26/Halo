import assert from "node:assert/strict";
import test from "node:test";

import { ControlValueCache, writeThenCommit } from "./control-value-cache.ts";

test("does not replace a confirmed value when a write fails", async () => {
  const cache = new ControlValueCache<number>();
  cache.commit(24, 100);

  await assert.rejects(
    () => writeThenCommit(cache, async () => Promise.reject(new Error("unavailable")), () => 200),
    /unavailable/,
  );

  assert.equal(cache.getIfFresh(250, 200), 24);
});

test("commits a successful write and allows a later retry after failure", async () => {
  const cache = new ControlValueCache<boolean>();
  let attempts = 0;

  await assert.rejects(
    () =>
      writeThenCommit(
        cache,
        async () => {
          attempts += 1;
          throw new Error("first write failed");
        },
        () => 100,
      ),
    /first write failed/,
  );

  const value = await writeThenCommit(
    cache,
    async () => {
      attempts += 1;
      return true;
    },
    () => 200,
  );

  assert.equal(value, true);
  assert.equal(attempts, 2);
  assert.equal(cache.getIfFresh(250, 300), true);
});
