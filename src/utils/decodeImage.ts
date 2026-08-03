export type DecodedImage =
  | {
      kind: "image-bitmap";
      image: ImageBitmap;
      width: number;
      height: number;
      cleanup?: () => void;
    }
  | {
      kind: "html-image";
      image: HTMLImageElement;
      width: number;
      height: number;
      cleanup?: () => void;
    };

type DecodeImageInput = File | Blob | string;

function loadHtmlImage(src: string, crossOrigin = false) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    // Without this a remote image taints the canvas and `toBlob` throws later,
    // long after the cause. Object URLs are same-origin, so it's opt-in.
    if (crossOrigin) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/**
 * Decode a File or URL into something Canvas can draw.
 *
 * Notes for junior devs:
 * - `createImageBitmap` is fast and can respect EXIF orientation (when supported).
 * - Safari support varies, so we keep a safe HTMLImageElement fallback.
 */
export async function decodeImage(
  input: DecodeImageInput,
): Promise<DecodedImage> {
  if (typeof input === "string") {
    const image = await loadHtmlImage(input, true);
    return {
      kind: "html-image",
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  }

  const objectUrl = URL.createObjectURL(input);

  // Prefer ImageBitmap for performance + EXIF orientation when available.
  if (typeof createImageBitmap === "function") {
    try {
      const image = await createImageBitmap(
        input,
        // `imageOrientation` is not in all TS lib versions, so we keep it permissive.
        { imageOrientation: "from-image" } as never,
      );
      return {
        kind: "image-bitmap",
        image,
        width: image.width,
        height: image.height,
        cleanup: () => URL.revokeObjectURL(objectUrl),
      };
    } catch {
      // Fall through to HTMLImageElement.
    }
  }

  const image = await loadHtmlImage(objectUrl);
  return {
    kind: "html-image",
    image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}
