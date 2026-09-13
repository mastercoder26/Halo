export type WorkArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const SETTINGS_WINDOW_WIDTH = 720;
export const SETTINGS_WINDOW_HEIGHT = 760;

export function centerSettingsWindow(workArea: WorkArea) {
  return {
    x: Math.round(workArea.x + (workArea.width - SETTINGS_WINDOW_WIDTH) / 2),
    y: Math.round(workArea.y + (workArea.height - SETTINGS_WINDOW_HEIGHT) / 2),
    width: SETTINGS_WINDOW_WIDTH,
    height: SETTINGS_WINDOW_HEIGHT,
  };
}
