import * as React from "react";
import { createPortal } from "react-dom";

import { ImageCropper } from "./ImageCropper";
import { Dropzone } from "./components/Dropzone";
import Xmark from "./icons/xmark";
import { DEFAULT_LABELS } from "./labels";
import { resolveTheme } from "./theme";
import type { CropResult, ImageCropUploadProps, Labels } from "./types";
import { cn } from "./utils/cn";

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * `showModal()` — not `<dialog open>` — is what gives us the top layer, a real
 * focus trap and working Escape. v1 used the latter, which silently provided
 * none of them.
 *
 * The backdrop of a modal dialog is part of the dialog's own hit area, so
 * click-outside is a DOM hit test rather than a React handler on the element.
 */
function useShowModal(
  ref: React.RefObject<HTMLDialogElement | null>,
  onClose: () => void,
) {
  const onCloseRef = React.useRef(onClose);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;

    function onBackdropClick(event: MouseEvent) {
      if (event.target === dialog) onCloseRef.current();
    }

    dialog.showModal();
    dialog.addEventListener("click", onBackdropClick);
    return () => {
      dialog.removeEventListener("click", onBackdropClick);
      dialog.close();
    };
  }, [ref]);
}

/**
 * Dropzone + modal wrapper around {@link ImageCropper}. Use the cropper
 * directly if you'd rather supply your own dialog.
 */
export function ImageCropUpload({
  crop,
  onCropped,
  onCancel,
  presets,
  theme,
  quality,
  maxOutputBytes,
  minQuality,
  labels,
  validateFile,
  accept = "image/*",
  maxBytes,
  initialImageUrl,
  onRemoveExisting,
  disabled = false,
  className,
  children,
}: ImageCropUploadProps) {
  const [editing, setEditing] = React.useState<File | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const resolvedTheme = React.useMemo(() => resolveTheme(theme), [theme]);
  const t: Labels = React.useMemo(
    () => ({ ...DEFAULT_LABELS, ...labels }),
    [labels],
  );

  const close = React.useCallback(
    (reason: "cancel" | "done") => {
      setEditing(null);
      if (reason === "cancel") onCancel?.();
    },
    [onCancel],
  );

  const cancel = React.useCallback(() => close("cancel"), [close]);

  function loadFile(file: File) {
    setErrorMessage(null);

    if (maxBytes != null && file.size > maxBytes) {
      setErrorMessage(`File too large (max ${formatBytes(maxBytes)}).`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Unsupported file type.");
      return;
    }
    const validation = validateFile?.(file);
    if (validation && validation.ok === false) {
      setErrorMessage(validation.reason);
      return;
    }

    setEditing(file);
  }

  async function loadInitialUrl(url: string) {
    setErrorMessage(null);
    try {
      // Fetched rather than passed as a URL so `originalFile` is a real File.
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch image");
      const blob = await res.blob();
      const name = url.split("/").pop() || "image";
      setEditing(new File([blob], name, { type: blob.type || "image/*" }));
    } catch {
      setErrorMessage("Could not load the existing image for editing.");
    }
  }

  async function handleExport(result: CropResult) {
    await onCropped(result);
    close("done");
  }

  const sizeHint =
    maxBytes != null
      ? `PNG, JPG up to ${formatBytes(maxBytes)}`
      : "PNG, JPG or WebP";

  return (
    <div
      className={cn("flex h-full w-full flex-col gap-3", className)}
      style={resolvedTheme.vars}
    >
      <Dropzone
        labels={t}
        accept={accept}
        disabled={disabled}
        sizeHint={sizeHint}
        onFile={loadFile}
        {...(initialImageUrl && !disabled
          ? { onEditExisting: () => void loadInitialUrl(initialImageUrl) }
          : {})}
        {...(initialImageUrl && onRemoveExisting && !disabled
          ? { onRemoveExisting }
          : {})}
      >
        {children}
      </Dropzone>

      {errorMessage ? (
        <p className="text-sm" style={{ color: "var(--icu-danger)" }}>
          {errorMessage}
        </p>
      ) : null}

      {editing
        ? createPortal(
            <CropDialog labels={t} vars={resolvedTheme.vars} onClose={cancel}>
              <ImageCropper
                image={editing}
                crop={crop}
                onExport={handleExport}
                onCancel={cancel}
                {...(presets ? { presets } : {})}
                {...(theme ? { theme } : {})}
                {...(quality != null ? { quality } : {})}
                {...(maxOutputBytes != null ? { maxOutputBytes } : {})}
                {...(minQuality != null ? { minQuality } : {})}
                {...(labels ? { labels } : {})}
              />
            </CropDialog>,
            document.body,
          )
        : null}
    </div>
  );
}

function CropDialog({
  labels,
  vars,
  onClose,
  children,
}: {
  labels: Labels;
  vars: React.CSSProperties;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const titleId = React.useId();
  useShowModal(dialogRef, onClose);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="w-fit max-w-[calc(100vw-2rem)] border p-4 shadow-lg backdrop:bg-black/60"
      style={{
        ...vars,
        // Painted surface, so it must carry its own text colour rather than
        // inheriting one from <body> through the portal.
        backgroundColor: "var(--icu-surface)",
        color: "var(--icu-text)",
        borderColor: "var(--icu-line)",
        borderRadius: "var(--icu-radius-lg)",
        // A CSS reset (Tailwind preflight included) zeroes the auto margin that
        // normally centres a modal dialog, so set it here rather than rely on it.
        margin: "auto",
        maxHeight: "92vh",
        overflowY: "auto",
      }}
      onCancel={(event) => {
        // Escape. Let React own the unmount instead of the browser closing it.
        event.preventDefault();
        onClose();
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold" id={titleId}>
          {labels.title}
        </h2>
        <button
          type="button"
          aria-label={labels.close}
          title={labels.close}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2"
          style={{ borderRadius: "var(--icu-radius)" }}
          onClick={onClose}
        >
          <Xmark aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {children}
    </dialog>
  );
}
