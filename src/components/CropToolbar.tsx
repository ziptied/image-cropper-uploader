import type * as React from "react";

import FlipHorizontal from "../icons/flip-horizontal";
import FlipVertical from "../icons/flip-vertical";
import RotateObjAnticlockwise from "../icons/rotate-obj-anticlockwise";
import RotateObjClockwise from "../icons/rotate-obj-clockwise";
import ShareLeft4 from "../icons/share-left-4";
import type { Labels } from "../types";

export type CropToolbarProps = {
  labels: Labels;
  disabled: boolean;
  onReset: () => void;
  onRotate: (degrees: number) => void;
  onFlipX: () => void;
  onFlipY: () => void;
};

const BUTTON =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center border transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50";

const BUTTON_STYLE: React.CSSProperties = {
  borderRadius: "var(--icu-radius)",
  borderColor: "var(--icu-line)",
  backgroundColor: "var(--icu-tint)",
  color: "var(--icu-accent-text)",
};

function ToolButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={BUTTON}
      style={BUTTON_STYLE}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function CropToolbar({
  labels,
  disabled,
  onReset,
  onRotate,
  onFlipX,
  onFlipY,
}: CropToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToolButton label={labels.reset} disabled={disabled} onClick={onReset}>
        <ShareLeft4 aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label={labels.rotateLeft}
        disabled={disabled}
        onClick={() => onRotate(-90)}
      >
        <RotateObjAnticlockwise aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label={labels.rotateRight}
        disabled={disabled}
        onClick={() => onRotate(90)}
      >
        <RotateObjClockwise aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label={labels.flipHorizontal}
        disabled={disabled}
        onClick={onFlipX}
      >
        <FlipHorizontal aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        label={labels.flipVertical}
        disabled={disabled}
        onClick={onFlipY}
      >
        <FlipVertical aria-hidden="true" className="h-4 w-4" />
      </ToolButton>
    </div>
  );
}
