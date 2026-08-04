import * as React from "react";

import ImageScale from "../icons/image-scale";
import Trash2 from "../icons/trash-2";
import Upload4 from "../icons/upload-4";
import type { Labels } from "../types";
import { cn } from "../utils/cn";

export type DropzoneProps = {
  labels: Labels;
  accept: string;
  disabled: boolean;
  sizeHint: string;
  /** Renders an "edit existing" button next to the upload icon. */
  onEditExisting?: () => void;
  /** Renders an app-owned remove button next to the edit-existing button. */
  onRemoveExisting?: () => void;
  onFile: (file: File) => void;
  children?: React.ReactNode;
};

const ICON_CHIP =
  "flex size-16 shrink-0 items-center justify-center self-center rounded-full border border-transparent transition-[filter]";
const ACTION_CHIP =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-transparent transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50";

// Static: the actual colours resolve from the `--icu-*` vars on the theme root.
const CHIP_STYLE: React.CSSProperties = {
  backgroundColor: "var(--icu-tint-strong)",
  color: "var(--icu-accent-text)",
};

export function Dropzone({
  labels,
  accept,
  disabled,
  sizeHint,
  onEditExisting,
  onRemoveExisting,
  onFile,
  children,
}: DropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const hasExistingActions = onEditExisting || onRemoveExisting;

  return (
    <div className="group/dropzone relative flex flex-1 flex-col">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) onFile(file);
        }}
      />

      <button
        type="button"
        disabled={disabled}
        className={cn(
          "group relative flex min-h-[260px] w-full flex-1 cursor-pointer flex-col items-center justify-center gap-5 border border-dashed p-8 text-center transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          disabled && "cursor-not-allowed opacity-60",
        )}
        style={{
          borderRadius: "var(--icu-radius-lg)",
          backgroundColor: dragActive
            ? "var(--icu-tint-strong)"
            : "var(--icu-tint)",
          borderColor: dragActive
            ? "var(--icu-line-strong)"
            : "var(--icu-line)",
        }}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (disabled) return;
          setDragActive(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
      >
        {children ?? (
          <>
            <div
              className={cn(ICON_CHIP, "group-hover:brightness-110")}
              style={CHIP_STYLE}
            >
              <Upload4 aria-hidden="true" className="h-7 w-7" />
            </div>

            <div className="space-y-1">
              <div
                className="text-lg font-semibold"
                style={{ color: "var(--icu-accent-text)" }}
              >
                {labels.dropzone}
              </div>
              <div className="text-sm opacity-70">{sizeHint}</div>
              <div className="text-xs opacity-50">{labels.dropzoneDrag}</div>
            </div>
          </>
        )}
      </button>

      {/* Sibling, not a child: a button inside a button is invalid HTML. */}
      {hasExistingActions ? (
        <div className="pointer-events-auto absolute right-4 top-4 z-10 flex gap-2 opacity-100 transition-opacity sm:pointer-events-none sm:opacity-0 sm:group-focus-within/dropzone:pointer-events-auto sm:group-focus-within/dropzone:opacity-100 sm:group-hover/dropzone:pointer-events-auto sm:group-hover/dropzone:opacity-100">
          {onEditExisting ? (
            <button
              type="button"
              aria-label={labels.editExisting}
              title={labels.editExisting}
              disabled={disabled}
              className={ACTION_CHIP}
              style={CHIP_STYLE}
              onClick={onEditExisting}
            >
              <ImageScale aria-hidden="true" className="h-5 w-5" />
            </button>
          ) : null}

          {onRemoveExisting ? (
            <button
              type="button"
              aria-label={labels.removeExisting}
              title={labels.removeExisting}
              disabled={disabled}
              className={ACTION_CHIP}
              style={CHIP_STYLE}
              onClick={onRemoveExisting}
            >
              <Trash2 aria-hidden="true" className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
