import assert from "node:assert/strict";
import test from "node:test";

import { SerializedAppIconLoader } from "./app-icon-loader.ts";

test("serializes native icon reads while preserving request order", async () => {
  let active = 0;
  let peak = 0;
  const completed: string[] = [];
  const loader = new SerializedAppIconLoader(async (appPath) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve));
    completed.push(appPath);
    active -= 1;
    return new Uint8Array([completed.length]);
  });

  await Promise.all([
    loader.load("/Applications/One.app", "normal"),
    loader.load("/Applications/Two.app", "normal"),
    loader.load("/Applications/Three.app", "normal"),
  ]);

  assert.equal(peak, 1);
  assert.deepEqual(completed, [
    "/Applications/One.app",
    "/Applications/Two.app",
    "/Applications/Three.app",
  ]);
});

test("deduplicates concurrent reads and serves later requests from cache", async () => {
  let reads = 0;
  const loader = new SerializedAppIconLoader(async () => {
    reads += 1;
    await new Promise((resolve) => setImmediate(resolve));
    return new Uint8Array([42]);
  });

  const first = loader.load("/Applications/Halo.app", "large");
  const second = loader.load("/Applications/Halo.app", "large");
  assert.equal(first, second);
  assert.deepEqual(await first, new Uint8Array([42]));
  assert.deepEqual(await loader.load("/Applications/Halo.app", "large"), new Uint8Array([42]));
  assert.equal(reads, 1);
});
