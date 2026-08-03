import * as React from "react";

import type { CropShape } from "./types";
import { cn } from "./utils/cn";
import type { CropFrame } from "./utils/cropFrame";

export type CropOverlayProps = {
  shape: CropShape;
  frame: CropFrame;
  viewport: { width: number; height: number };
  /** Guide stroke colour. Defaults to the themed base colour. */
  stroke?: string;
  className?: string;
};

/**
 * SVG-based overlay is reliable across browsers (including iOS Safari).
 * We dim everything outside the crop frame and draw a crisp border.
 */
export function CropOverlay({
  shape,
  frame,
  viewport,
  stroke = "var(--icu-color)",
  className,
}: CropOverlayProps) {
  const maskId = React.useId();

  // If we don't know the viewport size yet, we can't align the overlay reliably.
  if (viewport.width <= 0 || viewport.height <= 0) return null;

  const isCircle = shape === "avatar";
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const r = Math.min(frame.width, frame.height) / 2;

  const guide = (props: React.SVGProps<SVGCircleElement & SVGRectElement>) =>
    isCircle ? (
      <circle cx={cx} cy={cy} r={r} {...props} />
    ) : (
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        {...props}
      />
    );

  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      preserveAspectRatio="none"
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
    >
      <defs>
        {/* Important: use `userSpaceOnUse` so our pixel coords match the viewport. */}
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={viewport.width}
          height={viewport.height}
        >
          <rect
            x={0}
            y={0}
            width={viewport.width}
            height={viewport.height}
            fill="white"
          />
          {guide({ fill: "black" })}
        </mask>
      </defs>

      <rect
        x={0}
        y={0}
        width={viewport.width}
        height={viewport.height}
        fill="rgba(0,0,0,0.55)"
        mask={`url(#${maskId})`}
      />

      {guide({ fill: "transparent", stroke, strokeWidth: 2 })}
    </svg>
  );
}
