import assert from "node:assert/strict";
import test from "node:test";

import {
  persistSettingsAtomically,
  type SettingsPersistenceFileSystem,
} from "./settings-persistence.ts";

type SettingsSnapshot = { displayMode: string };

test("keeps cached settings and listeners unchanged when atomic replacement fails", async () => {
  const previous: SettingsSnapshot = { displayMode: "all" };
  const candidate: SettingsSnapshot = { displayMode: "cursor-display" };
  const filePath = "/tmp/halo/settings.json";
  const failure = new Error("replace failed");
  const notifications: SettingsSnapshot[] = [];
  const operations: string[] = [];
  let cache = previous;
  let temporaryPath = "";

  const fileSystem: SettingsPersistenceFileSystem = {
    async writeFile(nextPath) {
      temporaryPath = nextPath;
      operations.push("write");
    },
    async rename(fromPath, toPath) {
      assert.equal(fromPath, temporaryPath);
      assert.equal(toPath, filePath);
      operations.push("rename");
      throw failure;
    },
    async unlink(nextPath) {
      assert.equal(nextPath, temporaryPath);
      operations.push("unlink");
    },
  };

  await assert.rejects(
    persistSettingsAtomically({
      filePath,
      contents: JSON.stringify(candidate),
      next: candidate,
      commit: (settings) => {
        cache = settings;
      },
      notify: (settings) => {
        notifications.push(settings);
      },
      fileSystem,
    }),
    failure,
  );

  assert.deepEqual(
    { cache, notifications, operations },
    { cache: previous, notifications: [], operations: ["write", "rename", "unlink"] },
  );
  assert.match(temporaryPath, /^\/tmp\/halo\/\.settings\.json\..+\.tmp$/);
});

test("commits settings and notifies listeners only after atomic replacement succeeds", async () => {
  const candidate: SettingsSnapshot = { displayMode: "cursor-display" };
  const events: string[] = [];

  const fileSystem: SettingsPersistenceFileSystem = {
    async writeFile() {
      events.push("write");
    },
    async rename() {
      events.push("rename");
    },
    async unlink() {
      events.push("unlink");
    },
  };

  const result = await persistSettingsAtomically({
    filePath: "/tmp/halo/settings.json",
    contents: JSON.stringify(candidate),
    next: candidate,
    commit: () => {
      events.push("commit");
    },
    notify: () => {
      events.push("notify");
    },
    fileSystem,
  });

  assert.deepEqual(result, candidate);
  assert.deepEqual(events, ["write", "rename", "commit", "notify"]);
});
