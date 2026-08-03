import type { CropFrame } from "./cropFrame";

export type ClampInput = {
  cropFrame: CropFrame;
  viewport: { width: number; height: number };
  /** Natural image size in px. */
  image: { width: number; height: number };
  rotation: number; // degrees
  baseScale: number;
  zoom: number;
  pan: { x: number; y: number };
  limitToImage: boolean;
};

export type ClampResult = {
  zoom: number;
  pan: { x: number; y: number };
  minZoom: number;
};

/** Lowest zoom we ever allow when the image isn't constrained to the frame. */
const FREE_MIN_ZOOM = 0.1;

function clampTo(value: number, lo: number, hi: number) {
  if (lo > hi) return (lo + hi) / 2; // infeasible interval — sit in the middle
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Keep the crop frame inside the image (Pintura's `imageCropLimitToImage`).
 *
 * The transform is `screen = C + P + R(θ)·(F ⊙ p_img · s)`. Flips drop out
 * because the image bounds are symmetric about its centre, so containment only
 * depends on rotation, scale and pan.
 *
 * Rotate the four crop-frame corners into image-aligned axes:
 *
 *     a_k = R(-θ)·(q_k - C)          d = R(-θ)·P
 *
 * A corner is inside the image when `|a_k.x - d.x| ≤ W·s/2` (and likewise y),
 * so every corner is inside when
 *
 *     d.x ∈ [max_k(a_k.x) - W·s/2,  min_k(a_k.x) + W·s/2]
 *
 * All four corners inside implies the whole (convex) frame is inside, so this
 * is tight, not conservative. The interval is non-empty exactly when
 * `spread_x ≤ W·s`, which is where `minZoom` comes from — and because `spread`
 * depends only on the frame and θ, it's a direct formula rather than a search.
 */
export function clampTransform(input: ClampInput): ClampResult {
  const { cropFrame, viewport, image, baseScale, pan, limitToImage } = input;

  if (
    !limitToImage ||
    cropFrame.width <= 0 ||
    cropFrame.height <= 0 ||
    image.width <= 0 ||
    image.height <= 0 ||
    baseScale <= 0
  ) {
    return { zoom: input.zoom, pan, minZoom: FREE_MIN_ZOOM };
  }

  const rad = (input.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const cx = viewport.width / 2;
  const cy = viewport.height / 2;

  const xs: number[] = [];
  const ys: number[] = [];
  for (const [qx, qy] of [
    [cropFrame.x, cropFrame.y],
    [cropFrame.x + cropFrame.width, cropFrame.y],
    [cropFrame.x, cropFrame.y + cropFrame.height],
    [cropFrame.x + cropFrame.width, cropFrame.y + cropFrame.height],
  ] as const) {
    const vx = qx - cx;
    const vy = qy - cy;
    // R(-θ)·v
    xs.push(vx * cos + vy * sin);
    ys.push(-vx * sin + vy * cos);
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const minZoom =
    Math.max((maxX - minX) / image.width, (maxY - minY) / image.height) /
    baseScale;

  const zoom = Math.max(input.zoom, minZoom);
  const scale = baseScale * zoom;
  const halfW = (image.width * scale) / 2;
  const halfH = (image.height * scale) / 2;

  // Pan expressed on the image's own axes, clamped, then rotated back.
  const dx = clampTo(pan.x * cos + pan.y * sin, maxX - halfW, minX + halfW);
  const dy = clampTo(-pan.x * sin + pan.y * cos, maxY - halfH, minY + halfH);

  return {
    zoom,
    pan: { x: dx * cos - dy * sin, y: dx * sin + dy * cos },
    minZoom,
  };
}
