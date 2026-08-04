import { expect, test } from "bun:test";

import { encodeWithOutputBudget } from "./outputQuality";

function blobOfSize(size: number) {
  return new Blob([new Uint8Array(size)]);
}

test("uses requested quality when the first export fits the byte budget", async () => {
  const qualities: number[] = [];

  const result = await encodeWithOutputBudget(
    async (quality) => {
      qualities.push(quality);
      return blobOfSize(400);
    },
    0.85,
    500,
  );

  expect(result.blob.size).toBe(400);
  expect(result.quality).toBe(0.85);
  expect(qualities).toEqual([0.85]);
});

test("lowers quality when the requested export is over budget", async () => {
  const qualities: number[] = [];

  const result = await encodeWithOutputBudget(
    async (quality) => {
      qualities.push(quality);
      return blobOfSize(Math.round(quality * 1000));
    },
    0.9,
    600,
    0.3,
  );

  expect(result.blob.size).toBeLessThanOrEqual(600);
  expect(result.quality).toBeGreaterThan(0.3);
  expect(result.quality).toBeLessThanOrEqual(0.6);
  expect(qualities[0]).toBe(0.9);
  expect(qualities[1]).toBe(0.3);
});

test("returns the floor-quality export when even the floor is over budget", async () => {
  const result = await encodeWithOutputBudget(
    async (quality) => blobOfSize(Math.round(quality * 1000)),
    0.9,
    200,
    0.3,
  );

  expect(result.blob.size).toBe(300);
  expect(result.quality).toBe(0.3);
});
