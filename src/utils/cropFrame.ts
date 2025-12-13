import type { CropShape, Template } from "../types";

export type CropFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getTemplateAspect(template: Template) {
  if (template.shape === "circle" || template.shape === "square") return 1;
  return template.aspect ?? 1;
}

export function computeCropFrame(
  viewportWidth: number,
  viewportHeight: number,
  template: Pick<Template, "shape" | "aspect">,
  pad = 24,
): CropFrame {
  const aspect = template.shape === "rect" ? (template.aspect ?? 1) : 1;
  const availableWidth = Math.max(0, viewportWidth - 2 * pad);
  const availableHeight = Math.max(0, viewportHeight - 2 * pad);

  if (availableWidth === 0 || availableHeight === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const availableAspect = availableWidth / availableHeight;
  const width =
    availableAspect > aspect ? availableHeight * aspect : availableWidth;
  const height =
    availableAspect > aspect ? availableHeight : availableWidth / aspect;

  return {
    x: (viewportWidth - width) / 2,
    y: (viewportHeight - height) / 2,
    width,
    height,
  };
}
