import * as React from "react";

import type { CropShape } from "./types";
import { cn } from "./utils/cn";
import type { CropFrame } from "./utils/cropFrame";

export type CropOverlayProps = {
  shape: CropShape;
  frame: CropFrame;
  className?: string;
};

/**
 * SVG-based overlay is reliable across browsers (including iOS Safari).
 * We dim everything outside the crop frame and draw a crisp border.
 */
export function CropOverlay({ shape, frame, className }: CropOverlayProps) {
  const maskId = React.useId();
  const showCircle = shape === "circle";

  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const r = Math.min(frame.width, frame.height) / 2;

  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {showCircle ? (
            <circle cx={cx} cy={cy} r={r} fill="black" />
          ) : (
            <rect
              x={frame.x}
              y={frame.y}
              width={frame.width}
              height={frame.height}
              fill="black"
            />
          )}
        </mask>
      </defs>

      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.55)"
        mask={`url(#${maskId})`}
      />

      {showCircle ? (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="transparent"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2"
        />
      ) : (
        <rect
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          fill="transparent"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2"
        />
      )}
    </svg>
  );
}
