import type { CropFrame } from "./cropFrame";
import type { DecodedImage } from "./decodeImage";
import { renderViewportCanvas } from "./renderViewportCanvas";

export type ExportCroppedWebPInput = {
  image: DecodedImage;
  viewportCss: { width: number; height: number };
  cropFrameCss: CropFrame;
  output: { width: number; height: number };
  shape: "circle" | "square" | "rect";
  circleAlphaOutput: boolean;
  devicePixelRatio: number;
  baseScale: number;
  transform: {
    zoom: number;
    rotation: number;
    panX: number;
    panY: number;
  };
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
 * Export the visible crop region to WebP, scaled to the template output size.
 */
export async function exportCroppedWebP(input: ExportCroppedWebPInput) {
  const viewportCanvas = renderViewportCanvas({
    image: input.image,
    viewportCss: input.viewportCss,
    devicePixelRatio: input.devicePixelRatio,
    baseScale: input.baseScale,
    transform: input.transform,
  });

  const outCanvas = document.createElement("canvas");
  outCanvas.width = input.output.width;
  outCanvas.height = input.output.height;

  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("Canvas rendering context not available");

  const dpr = input.devicePixelRatio;
  const sx = input.cropFrameCss.x * dpr;
  const sy = input.cropFrameCss.y * dpr;
  const sw = input.cropFrameCss.width * dpr;
  const sh = input.cropFrameCss.height * dpr;

  outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
  outCtx.drawImage(
    viewportCanvas,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    outCanvas.width,
    outCanvas.height,
  );

  if (input.shape === "circle" && input.circleAlphaOutput) {
    applyCircleMask(outCtx, outCanvas.width, outCanvas.height);
  }

  const blob = await toWebpBlob(outCanvas, input.quality);
  return { blob, width: outCanvas.width, height: outCanvas.height };
}
