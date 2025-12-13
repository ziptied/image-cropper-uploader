import type { DecodedImage } from "./decodeImage";

export type ViewportRenderInput = {
  image: DecodedImage;
  viewportCss: { width: number; height: number };
  devicePixelRatio: number;
  baseScale: number;
  transform: {
    zoom: number;
    rotation: number; // degrees
    panX: number; // css px
    panY: number; // css px
  };
  targetCanvas?: HTMLCanvasElement;
};

/**
 * Draw the image into an offscreen canvas exactly as the viewport shows it.
 * This is the key to a WYSIWYG export (especially when rotation is involved).
 */
export function renderViewportCanvas(input: ViewportRenderInput) {
  const dpr = input.devicePixelRatio;
  const viewportWidthCss = Math.max(1, input.viewportCss.width);
  const viewportHeightCss = Math.max(1, input.viewportCss.height);

  const viewportWidth = Math.max(1, Math.round(viewportWidthCss * dpr));
  const viewportHeight = Math.max(1, Math.round(viewportHeightCss * dpr));

  const canvas = input.targetCanvas ?? document.createElement("canvas");
  canvas.width = viewportWidth;
  canvas.height = viewportHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas rendering context not available");

  ctx.clearRect(0, 0, viewportWidth, viewportHeight);

  const { zoom, rotation, panX, panY } = input.transform;
  const rotationRad = (rotation * Math.PI) / 180;

  const scaledWidth = input.image.width * input.baseScale * zoom;
  const scaledHeight = input.image.height * input.baseScale * zoom;

  ctx.save();
  // Set the context so all subsequent math is in CSS pixels.
  ctx.scale(dpr, dpr);

  ctx.translate(viewportWidthCss / 2, viewportHeightCss / 2);
  ctx.translate(panX, panY);
  ctx.rotate(rotationRad);

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
