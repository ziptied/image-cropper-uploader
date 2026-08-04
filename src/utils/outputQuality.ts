import { clamp } from "./clamp";

const DEFAULT_MIN_QUALITY = 0.35;
const SEARCH_STEPS = 6;

type EncodedBlob = {
  blob: Blob;
  quality: number;
};

function normalizeQuality(value: number) {
  return Number(clamp(value, 0, 1).toFixed(3));
}

function hasOutputBudget(
  maxOutputBytes: number | undefined,
): maxOutputBytes is number {
  return (
    typeof maxOutputBytes === "number" &&
    Number.isFinite(maxOutputBytes) &&
    maxOutputBytes > 0
  );
}

/**
 * Encode once at the requested quality. If the result is over budget, encode at
 * the floor quality, then binary-search upward to keep as much quality as fits.
 */
export async function encodeWithOutputBudget(
  encode: (quality: number) => Promise<Blob>,
  quality: number,
  maxOutputBytes?: number,
  minQuality = DEFAULT_MIN_QUALITY,
): Promise<EncodedBlob> {
  const requestedQuality = normalizeQuality(quality);
  const first = await encode(requestedQuality);

  if (!hasOutputBudget(maxOutputBytes) || first.size <= maxOutputBytes) {
    return { blob: first, quality: requestedQuality };
  }

  const floorQuality = normalizeQuality(Math.min(requestedQuality, minQuality));
  const floor = await encode(floorQuality);

  if (floor.size > maxOutputBytes || floorQuality === requestedQuality) {
    return { blob: floor, quality: floorQuality };
  }

  let best: EncodedBlob = { blob: floor, quality: floorQuality };
  let low = floorQuality;
  let high = requestedQuality;

  for (let index = 0; index < SEARCH_STEPS; index += 1) {
    const nextQuality = normalizeQuality((low + high) / 2);

    if (nextQuality === low || nextQuality === high) {
      break;
    }

    const blob = await encode(nextQuality);

    if (blob.size <= maxOutputBytes) {
      best = { blob, quality: nextQuality };
      low = nextQuality;
    } else {
      high = nextQuality;
    }
  }

  return best;
}
