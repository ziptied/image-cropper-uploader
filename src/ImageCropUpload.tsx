import * as React from "react";
import { createPortal } from "react-dom";

import { CropOverlay } from "./CropOverlay";
import type { ImageCropUploadProps, Template } from "./types";
import { clamp } from "./utils/clamp";
import { cn } from "./utils/cn";
import { computeCropFrame, getTemplateAspect } from "./utils/cropFrame";
import { type DecodedImage, decodeImage } from "./utils/decodeImage";
import { exportCroppedWebP } from "./utils/exportCroppedWebP";

function getDefaultLabel() {
  return "Drop image here or click to browse";
}

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function stripExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? fileName : fileName.slice(0, lastDot);
}

function templateToLabel(template: Template) {
  const aspect = getTemplateAspect(template);
  const shape = template.shape;
  const output = `${template.output.width}×${template.output.height}`;
  if (shape === "rect") return `Rect ${aspect.toFixed(3)} (${output})`;
  return `${shape[0]?.toUpperCase() ?? ""}${shape.slice(1)} (${output})`;
}

function getFocusableElements(container: HTMLElement) {
  const selector =
    'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("aria-hidden"),
  );
}

function useFocusTrap(
  open: boolean,
  containerRef: React.RefObject<HTMLElement>,
) {
  React.useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;
    const containerEl: HTMLElement = container;

    const focusable = getFocusableElements(containerEl);
    focusable[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = getFocusableElements(containerEl);
      if (items.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const currentIndex = active ? items.indexOf(active) : -1;

      const nextIndex = event.shiftKey
        ? (currentIndex - 1 + items.length) % items.length
        : (currentIndex + 1) % items.length;

      event.preventDefault();
      items[nextIndex]?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, containerRef]);
}

export function ImageCropUpload({
  template,
  onCropped,
  onCancel,
  validateFile,
  accept = "image/*",
  maxBytes,
  webpQuality = 0.9,
  initialImageUrl,
  label = getDefaultLabel(),
  disabled = false,
  className,
  allowTemplateSwitch = false,
  templatePresets,
}: ImageCropUploadProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);

  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);

  const [activeTemplate, setActiveTemplate] =
    React.useState<Template>(template);

  const [decoded, setDecoded] = React.useState<DecodedImage | null>(null);
  const [originalFile, setOriginalFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const previewCleanupRef = React.useRef<(() => void) | null>(null);

  const [viewportSize, setViewportSize] = React.useState({
    width: 0,
    height: 0,
  });

  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });

  const [isDragging, setIsDragging] = React.useState(false);
  const dragStartRef = React.useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

  // Keep `activeTemplate` in sync unless the user has template switching enabled.
  React.useEffect(() => {
    if (!allowTemplateSwitch) setActiveTemplate(template);
  }, [allowTemplateSwitch, template]);

  // Measure the viewport so crop frame can be responsive.
  React.useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Clean up decoded resources / object URLs.
  React.useEffect(() => {
    return () => decoded?.cleanup?.();
  }, [decoded]);

  React.useEffect(() => {
    return () => previewCleanupRef.current?.();
  }, []);

  useFocusTrap(editorOpen, dialogRef);

  const cropFrame = React.useMemo(() => {
    return computeCropFrame(
      viewportSize.width,
      viewportSize.height,
      activeTemplate,
      24,
    );
  }, [viewportSize.width, viewportSize.height, activeTemplate]);

  const baseScale = React.useMemo(() => {
    if (!decoded) return 1;
    const vw = Math.max(1, viewportSize.width);
    const vh = Math.max(1, viewportSize.height);
    return Math.max(vw / decoded.width, vh / decoded.height);
  }, [decoded, viewportSize.width, viewportSize.height]);

  const imageStyle = React.useMemo(() => {
    if (!decoded) return undefined;
    return {
      width: `${decoded.width * baseScale}px`,
      height: `${decoded.height * baseScale}px`,
      transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
      transformOrigin: "center center",
      willChange: "transform",
    } satisfies React.CSSProperties;
  }, [decoded, baseScale, pan.x, pan.y, rotation, zoom]);

  function showError(message: string) {
    setErrorMessage(message);
  }

  function resetTransform() {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }

  async function loadFile(file: File) {
    setErrorMessage(null);

    if (maxBytes != null && file.size > maxBytes) {
      showError(`File too large (max ${formatBytes(maxBytes)}).`);
      return;
    }

    if (!file.type.startsWith("image/")) {
      showError("Unsupported file type.");
      return;
    }

    const userValidation = validateFile?.(file);
    if (userValidation && userValidation.ok === false) {
      showError(userValidation.reason);
      return;
    }

    try {
      const decodedImage = await decodeImage(file);
      setDecoded(decodedImage);
      setOriginalFile(file);

      previewCleanupRef.current?.();
      const objectUrl = URL.createObjectURL(file);
      previewCleanupRef.current = () => URL.revokeObjectURL(objectUrl);
      setPreviewUrl(objectUrl);

      resetTransform();
      setEditorOpen(true);
    } catch {
      showError(
        "Could not read image. This image format isn’t supported in your browser. Please upload JPG, PNG, or WebP.",
      );
    }
  }

  async function loadInitialUrl(url: string) {
    setErrorMessage(null);
    try {
      // We fetch so we can return a real `originalFile` in the result object.
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch image");
      const blob = await res.blob();
      const file = new File([blob], "image", {
        type: blob.type || "application/octet-stream",
      });

      const decodedImage = await decodeImage(file);
      setDecoded(decodedImage);
      setOriginalFile(file);

      previewCleanupRef.current?.();
      previewCleanupRef.current = null;
      setPreviewUrl(url);

      resetTransform();
      setEditorOpen(true);
    } catch {
      showError("Could not load the existing image for editing.");
    }
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function closeEditor(reason: "cancel" | "done") {
    setEditorOpen(false);
    setProcessing(false);
    setIsDragging(false);
    dragStartRef.current = null;

    // Keep dropzone ready for another upload.
    setDecoded(null);
    setOriginalFile(null);
    setPreviewUrl(null);
    previewCleanupRef.current?.();
    previewCleanupRef.current = null;

    if (reason === "cancel") onCancel?.();
  }

  async function onConfirm() {
    if (!decoded || !originalFile) return;
    if (processing) return;

    setProcessing(true);

    try {
      const dpr = window.devicePixelRatio || 1;
      const quality = clamp(webpQuality, 0, 1);

      const { blob, width, height } = await exportCroppedWebP({
        image: decoded,
        viewportCss: viewportSize,
        cropFrameCss: cropFrame,
        output: activeTemplate.output,
        shape: activeTemplate.shape,
        circleAlphaOutput: activeTemplate.circleAlphaOutput ?? false,
        devicePixelRatio: dpr,
        baseScale,
        transform: { zoom, rotation, panX: pan.x, panY: pan.y },
        quality,
      });

      const fileName = `${stripExtension(originalFile.name || "cropped")}.webp`;
      const file = new File([blob], fileName, { type: "image/webp" });

      await onCropped({
        blob,
        file,
        fileName,
        mimeType: "image/webp",
        width,
        height,
        originalFile,
        transform: { zoom, rotation, panX: pan.x, panY: pan.y },
      });

      closeEditor("done");
    } catch {
      showError("Processing failed. Please try a different image.");
      setProcessing(false);
    }
  }

  function onPointerDown(event: React.PointerEvent) {
    if (processing) return;
    setIsDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!isDragging || processing) return;
    const start = dragStartRef.current;
    if (!start) return;
    setPan({
      x: start.panX + (event.clientX - start.x),
      y: start.panY + (event.clientY - start.y),
    });
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!isDragging) return;
    setIsDragging(false);
    dragStartRef.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  const presets = React.useMemo(() => {
    if (!allowTemplateSwitch) return [];
    const list =
      templatePresets && templatePresets.length > 0
        ? templatePresets
        : [template];
    // De-dupe by shape + output + aspect.
    const seen = new Set<string>();
    return list.filter((t) => {
      const key = `${t.shape}:${t.output.width}x${t.output.height}:${t.aspect ?? ""}:${
        t.circleAlphaOutput ?? false
      }`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allowTemplateSwitch, templatePresets, template]);

  const canEditInitial = Boolean(initialImageUrl) && !disabled;
  const viewportAspect =
    activeTemplate.viewport?.width && activeTemplate.viewport?.height
      ? activeTemplate.viewport.width / activeTemplate.viewport.height
      : getTemplateAspect(activeTemplate);

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (!file) return;
          void loadFile(file);
          e.currentTarget.value = "";
        }}
      />

      <button
        type="button"
        className={cn(
          "relative flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center",
          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          dragActive && "border-primary bg-muted/30",
          disabled && "cursor-not-allowed opacity-60",
        )}
        disabled={disabled}
        onClick={() => {
          openFilePicker();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          void loadFile(file);
        }}
      >
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">
          {maxBytes != null ? `Max size: ${formatBytes(maxBytes)}.` : " "}
        </div>
      </button>

      {errorMessage ? (
        <div className="mt-2 text-sm text-destructive">{errorMessage}</div>
      ) : null}

      {canEditInitial ? (
        <button
          type="button"
          className="mt-2 rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          disabled={disabled}
          onClick={() => {
            if (!initialImageUrl) return;
            void loadInitialUrl(initialImageUrl);
          }}
        >
          Edit existing image
        </button>
      ) : null}

      {editorOpen
        ? createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-black/60"
                disabled={processing}
                tabIndex={-1}
                onClick={() => {
                  if (processing) return;
                  closeEditor("cancel");
                }}
              />

              <dialog
                ref={dialogRef}
                aria-labelledby="image-crop-title"
                aria-describedby="image-crop-description"
                className={cn(
                  "relative z-10 w-[min(92vw,760px)] rounded-xl border bg-background p-4 shadow-lg",
                  "focus-visible:outline-none",
                )}
                open
                onCancel={(e) => {
                  e.preventDefault();
                  if (processing) return;
                  closeEditor("cancel");
                }}
              >
                <div className="mb-3 space-y-1">
                  <div
                    id="image-crop-title"
                    className="text-base font-semibold"
                  >
                    Crop image
                  </div>
                  <div
                    id="image-crop-description"
                    className="text-sm text-muted-foreground"
                  >
                    Drag to reposition. Use sliders to zoom and rotate.
                  </div>
                </div>

                {allowTemplateSwitch && presets.length > 1 ? (
                  <div className="mb-3 flex items-center gap-2">
                    <label
                      className="text-sm font-medium"
                      htmlFor="templateSelect"
                    >
                      Template
                    </label>
                    <select
                      id="templateSelect"
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      value={templateToLabel(activeTemplate)}
                      disabled={processing}
                      onChange={(e) => {
                        const next = presets.find(
                          (t) => templateToLabel(t) === e.target.value,
                        );
                        if (next) setActiveTemplate(next);
                      }}
                    >
                      {presets.map((t) => (
                        <option
                          key={templateToLabel(t)}
                          value={templateToLabel(t)}
                        >
                          {templateToLabel(t)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                  <div
                    ref={viewportRef}
                    className={cn(
                      "relative overflow-hidden rounded-lg bg-muted",
                      processing && "opacity-70",
                    )}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    // Required to stop scroll/zoom conflicts on touch devices while panning.
                    // (This is why we use Pointer Events instead of mouse/touch separately.)
                    onContextMenu={(e) => e.preventDefault()}
                    style={{
                      ...(activeTemplate.viewport
                        ? {
                            width: activeTemplate.viewport.width,
                            height: activeTemplate.viewport.height,
                          }
                        : {
                            width: "100%",
                            maxWidth: "560px",
                            aspectRatio: viewportAspect,
                          }),
                      touchAction: "none",
                    }}
                  >
                    <div
                      className={cn(
                        "absolute inset-0 flex items-center justify-center",
                        isDragging ? "cursor-grabbing" : "cursor-grab",
                      )}
                      style={{ touchAction: "none" }}
                    >
                      {previewUrl ? (
                        <img
                          alt=""
                          src={previewUrl}
                          draggable={false}
                          className="select-none"
                          style={imageStyle}
                        />
                      ) : null}
                    </div>

                    <CropOverlay
                      shape={activeTemplate.shape}
                      frame={cropFrame}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="zoom">
                        Zoom
                      </label>
                      <input
                        id="zoom"
                        aria-label="Zoom"
                        type="range"
                        min={1}
                        max={5}
                        step={0.01}
                        value={zoom}
                        disabled={processing}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="rotation">
                        Rotation
                      </label>
                      <input
                        id="rotation"
                        aria-label="Rotation"
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        value={rotation}
                        disabled={processing}
                        onChange={(e) => setRotation(Number(e.target.value))}
                        className="w-full"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                          disabled={processing}
                          onClick={() =>
                            setRotation((r) => clamp(r - 90, -180, 180))
                          }
                        >
                          -90°
                        </button>
                        <button
                          type="button"
                          className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                          disabled={processing}
                          onClick={() =>
                            setRotation((r) => clamp(r + 90, -180, 180))
                          }
                        >
                          +90°
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                        disabled={processing}
                        onClick={resetTransform}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                    disabled={processing}
                    onClick={() => closeEditor("cancel")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    disabled={processing}
                    onClick={() => void onConfirm()}
                  >
                    {processing ? "Processing…" : "OK"}
                  </button>
                </div>
              </dialog>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
