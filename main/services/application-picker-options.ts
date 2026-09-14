import type { OpenDialogOptions } from "electron";

/** Let the native picker select one or more macOS application bundles. */
export const applicationPickerOptions = {
  title: "Choose apps for Halo Dock",
  message: "Select one or more applications (.app)",
  buttonLabel: "Add to Dock",
  properties: ["openFile", "multiSelections"],
  defaultPath: "/Applications",
} satisfies OpenDialogOptions;
