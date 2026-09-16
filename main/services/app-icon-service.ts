import { app } from "../platform/electron.js";

import { SerializedAppIconLoader, type AppIconSize } from "./app-icon-loader.js";

const iconLoader = new SerializedAppIconLoader(async (appPath, size) => {
  const icon = await app.getFileIcon(appPath, { size });
  return new Uint8Array(icon.toPNG());
});

export function appIconSizeForPixels(value: unknown): AppIconSize {
  const pixels = typeof value === "number" ? value : Number(value);
  return pixels <= 16 ? "small" : pixels <= 32 ? "normal" : "large";
}

export function loadAppIconPng(appPath: string, size: AppIconSize): Promise<Uint8Array> {
  return iconLoader.load(appPath, size);
}

export async function loadAppIconDataUrl(appPath: string, size: AppIconSize): Promise<string> {
  const png = await loadAppIconPng(appPath, size);
  return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
}
