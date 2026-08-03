import { expect, test } from "bun:test";

import { clampTransform } from "./clampTransform";

const VIEWPORT = { width: 560, height: 420 };
const FRAME = { x: 80, y: 24, width: 400, height: 372 }; // ~1.075 ratio, centred
const IMAGE = { width: 1600, height: 1200 };

// `cover` baseScale: the image exactly fills the frame at zoom 1.
const BASE_SCALE = Math.max(
  FRAME.width / IMAGE.width,
  FRAME.height / IMAGE.height,
);

function run(over: Partial<Parameters<typeof clampTransform>[0]> = {}) {
  return clampTransform({
    cropFrame: FRAME,
    viewport: VIEWPORT,
    image: IMAGE,
    rotation: 0,
    baseScale: BASE_SCALE,
    zoom: 1,
    pan: { x: 0, y: 0 },
    limitToImage: true,
    ...over,
  });
}

/** Are all four crop-frame corners inside the image, given a transform? */
function cornersInsideImage(
  rotation: number,
  zoom: number,
  pan: { x: number; y: number },
) {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const scale = BASE_SCALE * zoom;
  const halfW = (IMAGE.width * scale) / 2;
  const halfH = (IMAGE.height * scale) / 2;
  const epsilon = 1e-6;

  return [
    [FRAME.x, FRAME.y],
    [FRAME.x + FRAME.width, FRAME.y],
    [FRAME.x, FRAME.y + FRAME.height],
    [FRAME.x + FRAME.width, FRAME.y + FRAME.height],
  ].every(([qx, qy]) => {
    const vx = (qx as number) - VIEWPORT.width / 2 - pan.x;
    const vy = (qy as number) - VIEWPORT.height / 2 - pan.y;
    const ix = vx * cos + vy * sin;
    const iy = -vx * sin + vy * cos;
    return Math.abs(ix) <= halfW + epsilon && Math.abs(iy) <= halfH + epsilon;
  });
}

test("cover fit at zoom 1 pins pan to the image edge, never past it", () => {
  // The frame is 400x372 and the image covers to 400x300... at zoom 1 the
  // narrow axis is exact, so there is slack on one axis only.
  const slack = (IMAGE.width * BASE_SCALE - FRAME.width) / 2;
  const pushed = run({ pan: { x: 10_000, y: 10_000 } });

  expect(pushed.pan.x).toBeCloseTo(slack, 6);
  expect(cornersInsideImage(0, pushed.zoom, pushed.pan)).toBe(true);
});

test("an unrotated centred transform is left alone", () => {
  const result = run();
  expect(result.pan.x).toBeCloseTo(0, 6);
  expect(result.pan.y).toBeCloseTo(0, 6);
  expect(result.zoom).toBeCloseTo(1, 6);
});

test("corners stay inside the image at awkward rotations", () => {
  for (const rotation of [17, 45, 90, 123, -60, 180]) {
    const result = run({ rotation, zoom: 1, pan: { x: 900, y: -700 } });
    expect(cornersInsideImage(rotation, result.zoom, result.pan)).toBe(true);
  }
});

test("minZoom rises off-axis and forces zoom up", () => {
  const straight = run({ rotation: 0 });
  const angled = run({ rotation: 45 });

  expect(angled.minZoom).toBeGreaterThan(straight.minZoom);
  // zoom 1 is below the 45° floor, so it must have been raised to meet it.
  expect(angled.zoom).toBeCloseTo(angled.minZoom, 6);
  expect(angled.zoom).toBeGreaterThan(1);
});

test("limitToImage false leaves the transform untouched", () => {
  const pan = { x: 5000, y: -5000 };
  const result = run({ limitToImage: false, zoom: 0.2, pan });

  expect(result.pan).toEqual(pan);
  expect(result.zoom).toBe(0.2);
});

test("a degenerate frame or image is a no-op rather than NaN", () => {
  const result = run({ cropFrame: { x: 0, y: 0, width: 0, height: 0 } });
  expect(Number.isFinite(result.pan.x)).toBe(true);
  expect(Number.isFinite(result.zoom)).toBe(true);
});
