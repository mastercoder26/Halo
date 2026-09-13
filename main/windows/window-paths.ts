import * as path from "path";
import { fileURLToPath, pathToFileURL } from "url";

// Use unique names to avoid conflicts with esbuild's CommonJS shims
const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = path.dirname(currentFilePath);

// Support both the bundled dist/main/index.js entry and an unbundled
// dist/main/windows/window-paths.js layout.
const mainOutputRoot = path.basename(currentDirPath) === "windows"
  ? path.resolve(currentDirPath, "..")
  : currentDirPath;
const DIST_ROOT = path.resolve(mainOutputRoot, "..");

/**
 * Absolute path to the build directory that contains HTML entry points.
 */
export function getBuildRoot(): string {
  return DIST_ROOT;
}

/**
 * Resolve the on-disk HTML file for a given window.
 */
export function resolveWindowHtml(htmlFileName: string): string {
  return path.join(DIST_ROOT, "renderer", htmlFileName);
}

/**
 * Return a file:// URL for a locally built HTML file.
 */
export function getWindowFileUrl(htmlFileName: string): string {
  return pathToFileURL(resolveWindowHtml(htmlFileName)).toString();
}

/**
 * Absolute path to the built preload script.
 *
 * The Electron build outputs the preload entry to `dist/preload.cjs` with a
 * stable filename, and Electron injects it through `webPreferences.preload`.
 */
export function getPreloadPath(): string {
  return path.join(DIST_ROOT, "preload.cjs");
}

/**
 * Resolve the correct URL for a window, preferring the dev server when available.
 */
export async function getWindowUrl(htmlFileName: string): Promise<string> {
  const devServerUrl = process.env.HALO_DEV_SERVER_URL?.replace(/\/$/, "");
  if (devServerUrl) {
    return `${devServerUrl}/${htmlFileName}`;
  }

  return getWindowFileUrl(htmlFileName);
}
