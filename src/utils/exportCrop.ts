import type { CropConfig, CropResult, CropShape, Transform } from "../types";
import { clamp } from "./clamp";
import type { CropFrame } from "./cropFrame";
import type { DecodedImage } from "./decodeImage";
import { exportCroppedWebP } from "./exportCroppedWebP";

export type ExportCropInput = {
  source: File | Blob | string;
  image: DecodedImage;
  crop: CropConfig;
  shape: CropShape;
  background: string;
  viewport: { width: number; height: number };
  cropFrame: CropFrame;
  baseScale: number;
  transform: Transform;
  quality: number;
};

function stripExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? fileName : fileName.slice(0, lastDot);
}

/**
 * The editor only ever holds a `File` when the caller gave it one. A Blob or a
 * URL still has to come back as a real `File` so `result.originalFile` can be
 * appended to a FormData without special-casing at the call site.
 */
function toOriginalFile(source: File | Blob | string): File {
  if (source instanceof File) return source;
  if (typeof source === "string") {
    return new File([], source.split("/").pop() || "image");
  }
  return new File([source], "image", { type: source.type });
}

/** Render the current crop to WebP and assemble the public result object. */
export async function exportCrop(input: ExportCropInput): Promise<CropResult> {
  const originalFile = toOriginalFile(input.source);

  const { blob, width, height } = await exportCroppedWebP({
    image: input.image,
    viewportCss: input.viewport,
    cropFrameCss: input.cropFrame,
    output: input.crop.output,
    shape: input.shape,
    background: input.background,
    alphaMask: input.crop.alphaMask ?? true,
    baseScale: input.baseScale,
    transform: input.transform,
    quality: clamp(input.quality, 0, 1),
  });

  const fileName = `${stripExtension(originalFile.name || "cropped")}.webp`;

  return {
    blob,
    file: new File([blob], fileName, { type: "image/webp" }),
    fileName,
    mimeType: "image/webp",
    width,
    height,
    originalFile,
    transform: input.transform,
  };
}
