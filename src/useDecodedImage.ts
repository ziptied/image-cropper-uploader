import * as React from "react";

import { type DecodedImage, decodeImage } from "./utils/decodeImage";

function releaseImage(image: DecodedImage) {
  // `cleanup` only revokes the object URL; the bitmap needs closing too.
  if (image.kind === "image-bitmap") image.image.close();
  image.cleanup?.();
}

/**
 * Decode a File/Blob/URL for canvas, releasing the previous one.
 *
 * `onError` is read through a ref: callers almost always pass an inline
 * callback, and depending on it would re-decode the image on every parent
 * render.
 */
export function useDecodedImage(
  image: File | Blob | string,
  onError?: (error: Error) => void,
) {
  const [decoded, setDecoded] = React.useState<DecodedImage | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const onErrorRef = React.useRef(onError);
  React.useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  React.useEffect(() => {
    let cancelled = false;
    let held: DecodedImage | null = null;

    setDecoded(null);
    setErrorMessage(null);

    decodeImage(image)
      .then((next) => {
        if (cancelled) {
          releaseImage(next);
          return;
        }
        held = next;
        setDecoded(next);
      })
      .catch(() => {
        if (cancelled) return;
        const error = new Error(
          "Could not read image. Please try a JPG, PNG or WebP.",
        );
        setErrorMessage(error.message);
        onErrorRef.current?.(error);
      });

    return () => {
      cancelled = true;
      if (held) releaseImage(held);
    };
  }, [image]);

  return { decoded, errorMessage, setErrorMessage };
}
