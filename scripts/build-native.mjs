#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import console from "node:console";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");
const nativeDir = path.join(projectRoot, "native");

const targets = [
  { src: "brightness.swift", out: "brightness" },
  { src: "modifier-state.swift", out: "modifier-state" },
  { src: "haptic.swift", out: "haptic" },
];

for (const target of targets) {
  const src = path.join(nativeDir, target.src);
  const out = path.join(nativeDir, target.out);
  if (!fs.existsSync(src)) {
    console.error("[halo-native] missing", src);
    process.exit(1);
  }
  execFileSync("swiftc", ["-O", src, "-o", out], { stdio: "inherit" });
  fs.chmodSync(out, 0o755);
  console.log("[halo-native] built", out);
}
