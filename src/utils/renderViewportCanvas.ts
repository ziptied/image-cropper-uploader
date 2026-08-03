import type { Transform } from "../types";
import type { DecodedImage } from "./decodeImage";

export type ViewportRenderInput = {
  image: DecodedImage;
  viewportCss: { width: number; height: number };
  /**
   * Canvas pixels per CSS pixel. The screen preview passes `devicePixelRatio`;
   * the exporter passes whatever ratio lands the crop frame on the output
   * canvas 1:1.
   */
  pixelRatio: number;
  baseScale: number;
  transform: Transform;
  background?: string;
  targetCanvas?: HTMLCanvasElement;
};

/**
 * Draw the image into a canvas exactly as the viewport shows it.
 * This is the key to a WYSIWYG export (especially when rotation is involved).
 */
export function renderViewportCanvas(input: ViewportRenderInput) {
  const ratio = input.pixelRatio;
  const viewportWidthCss = Math.max(1, input.viewportCss.width);
  const viewportHeightCss = Math.max(1, input.viewportCss.height);

  const viewportWidth = Math.max(1, Math.round(viewportWidthCss * ratio));
  const viewportHeight = Math.max(1, Math.round(viewportHeightCss * ratio));

  const canvas = input.targetCanvas ?? document.createElement("canvas");
  canvas.width = viewportWidth;
  canvas.height = viewportHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering context not available");

  ctx.clearRect(0, 0, viewportWidth, viewportHeight);
  if (input.background && input.background !== "transparent") {
    ctx.fillStyle = input.background;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);
  }

  const { zoom, rotation, flipX, flipY, panX, panY } = input.transform;
  const rotationRad = (rotation * Math.PI) / 180;

  const scaledWidth = input.image.width * input.baseScale * zoom;
  const scaledHeight = input.image.height * input.baseScale * zoom;

  ctx.save();
  // Set the context so all subsequent math is in CSS pixels.
  ctx.scale(ratio, ratio);

  ctx.translate(viewportWidthCss / 2, viewportHeightCss / 2);
  ctx.translate(panX, panY);
  ctx.rotate(rotationRad);
  // Mirror about the image's own centre, so pan and rotation are unaffected.
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);

  ctx.drawImage(
    input.image.image,
    -scaledWidth / 2,
    -scaledHeight / 2,
    scaledWidth,
    scaledHeight,
  );
  ctx.restore();

  return canvas;
}
