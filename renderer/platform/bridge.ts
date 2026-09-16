/** Renderer-safe API exposed by Halo's Electron preload. */

export type HaloIpcListener = (event: unknown, payload: unknown) => void;

export interface HaloAPI {
  ipc: {
    invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
    on(channel: string, listener: HaloIpcListener): () => void;
  };
  files: {
    iconDataUrl(appPath: string, size?: 16 | 32 | 64): Promise<string>;
  };
}

declare global {
  interface Window {
    haloAPI: HaloAPI;
  }
}

export {};
