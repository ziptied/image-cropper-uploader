import type { RatioPreset } from "../types";

/**
 * Identity for a preset. Presets are usually declared inline, so the array is a
 * new object every render and reference equality can't be used to tell which
 * one is selected.
 */
export function presetKey(preset: RatioPreset) {
  return `${preset.shape ?? "rect"}:${preset.ratio}:${preset.label}`;
}
