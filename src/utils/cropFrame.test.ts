import { expect, test } from "bun:test";

import { computeCropFrame, getCropRatio } from "./cropFrame";

const WIDE = { width: 1920, height: 1080 };

test("ratio falls back to the output aspect, not to square", () => {
  // Cropping 1:1 and then exporting 16:9 would silently squash the image.
  expect(getCropRatio({ output: WIDE })).toBeCloseTo(16 / 9, 6);
});

test("an explicit ratio wins over the output aspect", () => {
  expect(getCropRatio({ ratio: 1, output: WIDE })).toBe(1);
});

test("avatar is always circular regardless of output", () => {
  expect(getCropRatio({ shape: "avatar", ratio: 16 / 9, output: WIDE })).toBe(
    1,
  );
});

test("a nonsense ratio degrades to square rather than NaN", () => {
  expect(getCropRatio({ ratio: 0, output: WIDE })).toBe(1);
  expect(getCropRatio({ ratio: -3, output: WIDE })).toBe(1);
  expect(getCropRatio({ output: { width: 100, height: 0 } })).toBe(1);
});

test("the frame keeps its ratio and stays centred", () => {
  const frame = computeCropFrame(600, 400, 16 / 9, 24);

  expect(frame.width / frame.height).toBeCloseTo(16 / 9, 6);
  expect(frame.x + frame.width / 2).toBeCloseTo(300, 6);
  expect(frame.y + frame.height / 2).toBeCloseTo(200, 6);
  expect(frame.width).toBeLessThanOrEqual(600 - 48);
  expect(frame.height).toBeLessThanOrEqual(400 - 48);
});
