import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

interface PackageManifest {
  scripts: {
    build?: string;
    dev?: string;
    package?: string;
    test?: string;
  };
  devDependencies: {
    electron?: string;
    "electron-builder"?: string;
  };
  build?: {
    mac?: unknown;
    afterPack?: string;
  };
}

async function readPackageManifest(): Promise<PackageManifest> {
  const source = await readFile(new URL("./package.json", import.meta.url), "utf8");
  return JSON.parse(source) as PackageManifest;
}

test("uses automatic Node test discovery", async () => {
  const manifest = await readPackageManifest();

  assert.equal(manifest.scripts.test, "node --test");
});

test("declares a standalone Electron macOS workflow", async () => {
  const manifest = await readPackageManifest();

  assert.match(manifest.scripts.build ?? "", /scripts\/build\.mjs/);
  assert.match(manifest.scripts.dev ?? "", /scripts\/dev\.mjs/);
  assert.match(manifest.scripts.package ?? "", /electron-builder/);
  assert.ok(manifest.devDependencies.electron);
  assert.ok(manifest.devDependencies["electron-builder"]);
  assert.ok(manifest.build?.mac);
  assert.equal(manifest.build?.afterPack, "./scripts/adhoc-sign-macos.cjs");
});
