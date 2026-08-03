import type { CropConfig } from "../types";

export type CropFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Avatar is always circular, so its ratio is fixed at 1. Otherwise an explicit
 * `ratio` wins, falling back to the output's own aspect — anything else would
 * crop one shape and then squash it into a differently-shaped file.
 */
export function getCropRatio(
  crop: Pick<CropConfig, "ratio" | "shape" | "output">,
) {
  if (crop.shape === "avatar") return 1;
  const ratio = crop.ratio ?? crop.output.width / crop.output.height;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

/** Largest rect of the given ratio, centred in the viewport with padding. */
export function computeCropFrame(
  viewportWidth: number,
  viewportHeight: number,
  ratio: number,
  pad = 24,
): CropFrame {
  const availableWidth = Math.max(0, viewportWidth - 2 * pad);
  const availableHeight = Math.max(0, viewportHeight - 2 * pad);

  if (availableWidth === 0 || availableHeight === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const availableAspect = availableWidth / availableHeight;
  const width =
    availableAspect > ratio ? availableHeight * ratio : availableWidth;
  const height =
    availableAspect > ratio ? availableHeight : availableWidth / ratio;

  return {
    x: (viewportWidth - width) / 2,
    y: (viewportHeight - height) / 2,
    width,
    height,
  };
}
