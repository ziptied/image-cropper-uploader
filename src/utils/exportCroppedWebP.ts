import type { CropShape, Transform } from "../types";
import type { CropFrame } from "./cropFrame";
import type { DecodedImage } from "./decodeImage";
import { renderViewportCanvas } from "./renderViewportCanvas";

export type ExportCroppedWebPInput = {
  image: DecodedImage;
  viewportCss: { width: number; height: number };
  cropFrameCss: CropFrame;
  output: { width: number; height: number };
  shape: CropShape;
  background?: string;
  alphaMask: boolean;
  baseScale: number;
  transform: Transform;
  quality: number;
};

function toWebpBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("WebP export failed"));
        else resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

function applyCircleMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Export the visible crop region to WebP at the template's output size.
 *
 * The viewport is re-rendered at `output.width / cropFrame.width` canvas pixels
 * per CSS pixel, so the crop region lands on the output canvas 1:1 and never
 * gets upscaled from whatever the on-screen preview happened to be.
 */
export async function exportCroppedWebP(input: ExportCroppedWebPInput) {
  if (input.cropFrameCss.width <= 0 || input.cropFrameCss.height <= 0) {
    throw new Error("Crop frame has no size");
  }

  const pixelRatio = input.output.width / input.cropFrameCss.width;

  const viewportCanvas = renderViewportCanvas({
    image: input.image,
    viewportCss: input.viewportCss,
    pixelRatio,
    baseScale: input.baseScale,
    transform: input.transform,
  });

  const outCanvas = document.createElement("canvas");
  outCanvas.width = input.output.width;
  outCanvas.height = input.output.height;

  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("Canvas rendering context not available");

  outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
  if (input.background && input.background !== "transparent") {
    outCtx.fillStyle = input.background;
    outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
  }

  outCtx.drawImage(
    viewportCanvas,
    input.cropFrameCss.x * pixelRatio,
    input.cropFrameCss.y * pixelRatio,
    input.cropFrameCss.width * pixelRatio,
    input.cropFrameCss.height * pixelRatio,
    0,
    0,
    outCanvas.width,
    outCanvas.height,
  );

  if (input.shape === "avatar" && input.alphaMask) {
    applyCircleMask(outCtx, outCanvas.width, outCanvas.height);
  }

  const blob = await toWebpBlob(outCanvas, input.quality);
  return { blob, width: outCanvas.width, height: outCanvas.height };
}
