import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";

import { watchAccessibilityPermission } from "./accessibility-permission-watcher.ts";

test("watches for Accessibility permission until macOS reports it granted", async () => {
  const pendingChecks: Array<(trusted: boolean) => void> = [];
  const scheduledCheck: { current?: () => void } = {};
  let trustedNotifications = 0;
  let clearedTimer: unknown;

  const stopWatching = watchAccessibilityPermission({
    checkTrusted: () =>
      new Promise<boolean>((resolve) => {
        pendingChecks.push(resolve);
      }),
    onTrusted: () => {
      trustedNotifications += 1;
    },
    schedule: (callback) => {
      scheduledCheck.current = callback;
      return "permission-poll";
    },
    cancel: (timer) => {
      clearedTimer = timer;
    },
  });

  assert.equal(pendingChecks.length, 1, "the first permission check should happen immediately");
  pendingChecks.shift()?.(false);
  await setImmediate();

  scheduledCheck.current?.();
  assert.equal(pendingChecks.length, 1, "permission should be checked again while it is denied");
  pendingChecks.shift()?.(true);
  await setImmediate();

  assert.equal(trustedNotifications, 1, "granting access should update onboarding immediately");

  stopWatching();
  scheduledCheck.current?.();
  await setImmediate();

  assert.equal(clearedTimer, "permission-poll");
  assert.equal(
    pendingChecks.length,
    0,
    "stopping the watcher should prevent later permission checks",
  );
});

test("does not overlap slow Accessibility permission checks", async () => {
  const pendingChecks: Array<(trusted: boolean) => void> = [];
  const scheduledCheck: { current?: () => void } = {};

  const stopWatching = watchAccessibilityPermission({
    checkTrusted: () =>
      new Promise<boolean>((resolve) => {
        pendingChecks.push(resolve);
      }),
    onTrusted: () => undefined,
    schedule: (callback) => {
      scheduledCheck.current = callback;
      return 1;
    },
    cancel: () => undefined,
  });

  scheduledCheck.current?.();
  scheduledCheck.current?.();
  assert.equal(pendingChecks.length, 1);

  pendingChecks.shift()?.(false);
  await setImmediate();
  scheduledCheck.current?.();
  assert.equal(pendingChecks.length, 1);

  stopWatching();
});
