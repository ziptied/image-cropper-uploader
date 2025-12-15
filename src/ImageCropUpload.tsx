import * as React from "react";
import { createPortal } from "react-dom";

import { CropOverlay } from "./CropOverlay";
import { SliderControl } from "./components/SliderControl";
import CheckUnderline from "./icons/check-underline";
import ImageScale from "./icons/image-scale";
import RotateObjClockwise from "./icons/rotate-obj-clockwise";
import ShareLeft4 from "./icons/share-left-4";
import Upload4 from "./icons/upload-4";
import Xmark from "./icons/xmark";
import type {
  ImageCropUploadAppearance,
  ImageCropUploadProps,
  SliderRenderContext,
  Template,
} from "./types";
import { clamp } from "./utils/clamp";
import { cn } from "./utils/cn";
import { computeCropFrame, getTemplateAspect } from "./utils/cropFrame";
import { type DecodedImage, decodeImage } from "./utils/decodeImage";
import { exportCroppedWebP } from "./utils/exportCroppedWebP";
import { renderViewportCanvas } from "./utils/renderViewportCanvas";

type ResolvedAppearance = Required<
  Omit<
    ImageCropUploadAppearance,
    | "confirmButtonClassName"
    | "confirmButtonStyle"
    | "sliderClassName"
    | "sliderStyle"
    | "sliderTrackColor"
    | "sliderRangeColor"
    | "sliderThumbColor"
    | "sliderThumbBorderColor"
    | "sliderThumbRadius"
    | "modalBackground"
  >
> & {
  confirmButtonClassName?: string;
  confirmButtonStyle?: React.CSSProperties;
  sliderClassName?: string;
  sliderStyle?: React.CSSProperties;
  sliderTrackColor?: string;
  sliderRangeColor?: string;
  sliderThumbColor?: string;
  sliderThumbBorderColor?: string;
  sliderThumbRadius?: React.CSSProperties["borderRadius"];
  modalBackground?: string;
};

function getDefaultLabel() {
  return "Choose a file to upload";
}

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function stripExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? fileName : fileName.slice(0, lastDot);
}

function wrapRotationDegrees(degrees: number) {
  // Keep rotation in [-180, 180] so the slider stays meaningful while auto-rotating.
  const normalized = (((degrees + 180) % 360) + 360) % 360;
  return normalized - 180;
}

function animateIconButtonPress(button: HTMLButtonElement) {
  // Web Animations API keeps this dependency-free and scoped.
  // The cubic-bezier approximates an easeInOutBack feel.
  button.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.03)" },
      { transform: "scale(0.94)" },
      { transform: "scale(1)" },
    ],
    {
      duration: 420,
      easing: "cubic-bezier(0.68,-0.6,0.32,1.6)",
    },
  );
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
  appearance,
  renderZoomControl,
  renderRotationControl,
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
  const previewCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

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
    if (!editorOpen) return;
    const el = viewportRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setViewportSize({ width: rect.width, height: rect.height });
    };
    // First measure can be 0 while the dialog is still being laid out.
    // Measure again on the next paint to be safe (this fixes "1px image" reports).
    updateSize();
    requestAnimationFrame(updateSize);

    const ro = new ResizeObserver(() => updateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [editorOpen]);

  // If a fixed viewport is provided by the template, use it as a reliable fallback.
  React.useEffect(() => {
    if (!editorOpen) return;
    const fixed = activeTemplate.viewport;
    if (!fixed) return;
    setViewportSize({ width: fixed.width, height: fixed.height });
  }, [activeTemplate.viewport, editorOpen]);

  // Clean up decoded resources / object URLs.
  React.useEffect(() => {
    return () => decoded?.cleanup?.();
  }, [decoded]);

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

  function showError(message: string) {
    setErrorMessage(message);
  }

  function resetTransform() {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }

  /**
   * Zoom should feel like it's zooming "into what I'm looking at".
   *
   * We do that by keeping the *currently centered* image point anchored at the
   * viewport center while the zoom changes.
   *
   * Math intuition:
   * - `pan` is the screen-space offset of the image center from the viewport center.
   * - If zoom changes from z -> z', the required pan becomes `pan * (z'/z)`.
   */
  const setZoomAnchored = React.useCallback((nextZoom: number) => {
    setZoom((prevZoom) => {
      if (prevZoom <= 0) return nextZoom;
      const ratio = nextZoom / prevZoom;
      setPan((p) => ({ x: p.x * ratio, y: p.y * ratio }));
      return nextZoom;
    });
  }, []);

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

    if (reason === "cancel") onCancel?.();
  }

  // Render a canvas preview so export is truly WYSIWYG (same renderer as export).
  React.useEffect(() => {
    if (!editorOpen) return;
    if (!decoded) return;
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    renderViewportCanvas({
      image: decoded,
      viewportCss: viewportSize,
      devicePixelRatio: window.devicePixelRatio || 1,
      baseScale,
      transform: { zoom, rotation, panX: pan.x, panY: pan.y },
      targetCanvas: canvas,
    });
  }, [
    baseScale,
    decoded,
    editorOpen,
    pan.x,
    pan.y,
    rotation,
    viewportSize,
    zoom,
  ]);

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

  const sizeHint =
    maxBytes != null
      ? `PNG, JPG up to ${formatBytes(maxBytes)}`
      : "PNG, JPG, WebP up to 10MB";

  const resolvedAppearance = React.useMemo<ResolvedAppearance>(() => {
    const base: ResolvedAppearance = {
      dropzoneBackground:
        appearance?.dropzoneBackground ?? "hsl(var(--accent)/0.08)",
      dropzoneBackgroundActive:
        appearance?.dropzoneBackgroundActive ?? "hsl(var(--accent)/0.16)",
      dropzoneBorder: appearance?.dropzoneBorder ?? "hsl(var(--accent)/0.4)",
      dropzoneBorderActive:
        appearance?.dropzoneBorderActive ?? "hsl(var(--accent)/0.8)",
      iconBackground: appearance?.iconBackground ?? "hsl(var(--accent)/0.16)",
      iconColor: appearance?.iconColor ?? "hsl(var(--accent))",
      dialogScrimColor: appearance?.dialogScrimColor ?? "rgba(0,0,0,0.6)",
      closeButtonColor:
        appearance?.closeButtonColor ?? "hsl(var(--muted-foreground))",
      closeButtonHoverColor:
        appearance?.closeButtonHoverColor ?? "hsl(var(--foreground))",
      toolbarButtonBackground:
        appearance?.toolbarButtonBackground ?? "rgba(0,0,0,0.35)",
      toolbarButtonBorder:
        appearance?.toolbarButtonBorder ?? "rgba(255,255,255,0.5)",
      toolbarButtonColor: appearance?.toolbarButtonColor ?? "#fff",
      sliderTrackColor: appearance?.sliderTrackColor ?? "hsl(var(--muted))",
      sliderRangeColor: appearance?.sliderRangeColor ?? "hsl(var(--accent))",
      sliderThumbColor:
        appearance?.sliderThumbColor ?? "hsl(var(--background))",
      sliderThumbBorderColor:
        appearance?.sliderThumbBorderColor ??
        "color-mix(in srgb, hsl(var(--accent)) 55%, transparent)",
      sliderThumbRadius:
        appearance?.sliderThumbRadius ?? "var(--radius-sm, 0.25rem)",
    };
    if (appearance?.confirmButtonClassName !== undefined) {
      base.confirmButtonClassName = appearance.confirmButtonClassName;
    }
    if (appearance?.confirmButtonStyle !== undefined) {
      base.confirmButtonStyle = appearance.confirmButtonStyle;
    }
    if (appearance?.sliderClassName !== undefined) {
      base.sliderClassName = appearance.sliderClassName;
    }
    if (appearance?.sliderStyle !== undefined) {
      base.sliderStyle = appearance.sliderStyle;
    }
    if (appearance?.modalBackground !== undefined) {
      base.modalBackground = appearance.modalBackground;
    }
    return base;
  }, [appearance]);

  const circleIconClasses =
    "flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-transparent text-current transition-colors aspect-square";

  const sliderClassNames = React.useMemo(
    () =>
      cn(
        "w-full appearance-none bg-transparent focus-visible:outline-none",
        resolvedAppearance.sliderClassName,
      ),
    [resolvedAppearance.sliderClassName],
  );

  const sliderInlineStyle = React.useMemo<React.CSSProperties>(() => {
    if (resolvedAppearance.sliderStyle) {
      return {
        accentColor: "hsl(var(--accent))",
        ...resolvedAppearance.sliderStyle,
      };
    }
    return { accentColor: "hsl(var(--accent))" };
  }, [resolvedAppearance.sliderStyle]);

  const sliderTrackStyle = React.useMemo<React.CSSProperties>(
    () => ({
      backgroundColor: resolvedAppearance.sliderTrackColor,
      borderRadius: "var(--radius-sm, 0.25rem)",
    }),
    [resolvedAppearance.sliderTrackColor],
  );

  const sliderRangeStyle = React.useMemo<React.CSSProperties>(
    () => ({
      backgroundColor: resolvedAppearance.sliderRangeColor,
    }),
    [resolvedAppearance.sliderRangeColor],
  );

  const sliderThumbStyle = React.useMemo<React.CSSProperties>(
    () => ({
      backgroundColor: resolvedAppearance.sliderThumbColor,
      borderColor: resolvedAppearance.sliderThumbBorderColor,
      borderRadius: resolvedAppearance.sliderThumbRadius,
    }),
    [
      resolvedAppearance.sliderThumbBorderColor,
      resolvedAppearance.sliderThumbColor,
      resolvedAppearance.sliderThumbRadius,
    ],
  );

  const zoomRenderContext = React.useMemo<SliderRenderContext>(
    () => ({
      value: zoom,
      min: 1,
      max: 5,
      step: 0.01,
      disabled: processing,
      id: "zoom",
      label: "Zoom",
      className: sliderClassNames,
      style: sliderInlineStyle,
      trackStyle: sliderTrackStyle,
      rangeStyle: sliderRangeStyle,
      thumbStyle: sliderThumbStyle,
      onChange: (value) => setZoomAnchored(value),
    }),
    [
      processing,
      sliderClassNames,
      sliderInlineStyle,
      sliderTrackStyle,
      sliderRangeStyle,
      sliderThumbStyle,
      zoom,
      setZoomAnchored,
    ],
  );

  const rotationRenderContext = React.useMemo<SliderRenderContext>(
    () => ({
      value: rotation,
      min: -180,
      max: 180,
      step: 1,
      disabled: processing,
      id: "rotation",
      label: "Rotation",
      className: sliderClassNames,
      style: sliderInlineStyle,
      trackStyle: sliderTrackStyle,
      rangeStyle: sliderRangeStyle,
      thumbStyle: sliderThumbStyle,
      onChange: (value) => setRotation(value),
    }),
    [
      processing,
      rotation,
      sliderClassNames,
      sliderInlineStyle,
      sliderTrackStyle,
      sliderRangeStyle,
      sliderThumbStyle,
    ],
  );

  const dropzoneStyle = React.useMemo<React.CSSProperties>(() => {
    return dragActive
      ? {
          backgroundColor: resolvedAppearance.dropzoneBackgroundActive,
          borderColor: resolvedAppearance.dropzoneBorderActive,
        }
      : {
          backgroundColor: resolvedAppearance.dropzoneBackground,
          borderColor: resolvedAppearance.dropzoneBorder,
        };
  }, [
    dragActive,
    resolvedAppearance.dropzoneBackground,
    resolvedAppearance.dropzoneBackgroundActive,
    resolvedAppearance.dropzoneBorder,
    resolvedAppearance.dropzoneBorderActive,
  ]);

  const iconStyle = React.useMemo<React.CSSProperties>(
    () => ({
      backgroundColor: resolvedAppearance.iconBackground,
      color: resolvedAppearance.iconColor,
    }),
    [resolvedAppearance.iconBackground, resolvedAppearance.iconColor],
  );

  const toolbarButtonStyle = React.useMemo<React.CSSProperties>(
    () => ({
      backgroundColor: resolvedAppearance.toolbarButtonBackground,
      borderColor: resolvedAppearance.toolbarButtonBorder,
      color: resolvedAppearance.toolbarButtonColor,
    }),
    [
      resolvedAppearance.toolbarButtonBackground,
      resolvedAppearance.toolbarButtonBorder,
      resolvedAppearance.toolbarButtonColor,
    ],
  );

  const closeButtonColors = React.useMemo(
    () => ({
      base: resolvedAppearance.closeButtonColor,
      hover:
        resolvedAppearance.closeButtonHoverColor ??
        resolvedAppearance.closeButtonColor,
    }),
    [
      resolvedAppearance.closeButtonColor,
      resolvedAppearance.closeButtonHoverColor,
    ],
  );

  const confirmButtonClassName = React.useMemo(
    () =>
      cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50",
        resolvedAppearance.confirmButtonClassName,
      ),
    [resolvedAppearance.confirmButtonClassName],
  );

  return (
    <div className={cn("flex h-full w-full flex-col gap-3", className)}>
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
        disabled={disabled}
        className={cn(
          "group relative flex min-h-[260px] w-full flex-1 cursor-pointer flex-col items-center justify-center gap-5 rounded-2xl border border-dashed",
          "bg-transparent p-8 text-center backdrop-blur transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          disabled && "cursor-not-allowed opacity-60",
        )}
        style={dropzoneStyle}
        onClick={() => {
          if (disabled) return;
          openFilePicker();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (disabled) return;
          setDragActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (disabled) return;
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (disabled) return;
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (disabled) return;
          setDragActive(false);
          const file = e.dataTransfer.files?.[0];
          if (!file) return;
          void loadFile(file);
        }}
      >
        <div className="flex items-center justify-center gap-3">
          <div
            className={cn(circleIconClasses, "group-hover:brightness-110")}
            style={iconStyle}
          >
            <Upload4 aria-hidden="true" className="h-7 w-7" />
          </div>
          {canEditInitial ? (
            <button
              type="button"
              aria-label="Edit existing image"
              className={cn(
                circleIconClasses,
                "hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
              style={iconStyle}
              onClick={(e) => {
                e.stopPropagation();
                if (!initialImageUrl) return;
                void loadInitialUrl(initialImageUrl);
              }}
            >
              <ImageScale aria-hidden="true" className="h-6 w-6" />
            </button>
          ) : null}
        </div>

        <div className="space-y-1">
          <div className="text-lg font-semibold text-primary">{label}</div>
          <div className="text-sm text-muted-foreground">{sizeHint}</div>
          <div className="text-xs text-muted-foreground/80">
            or drag and drop
          </div>
        </div>
      </button>

      {errorMessage ? (
        <div className="mt-2 text-sm text-destructive">{errorMessage}</div>
      ) : null}

      {editorOpen
        ? createPortal(
            <div
              className="fixed inset-0 flex items-center justify-center"
              style={{ zIndex: 500 }}
            >
              <button
                type="button"
                aria-label="Close"
                className="absolute inset-0"
                style={{ backgroundColor: resolvedAppearance.dialogScrimColor }}
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
                style={
                  resolvedAppearance.modalBackground
                    ? { backgroundColor: resolvedAppearance.modalBackground }
                    : undefined
                }
                open
                onCancel={(e) => {
                  e.preventDefault();
                  if (processing) return;
                  closeEditor("cancel");
                }}
              >
                <button
                  type="button"
                  aria-label="Close"
                  title="Close"
                  className={cn(
                    "pointer-events-auto absolute right-3 top-3 z-50 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background/80",
                    "border-transparent text-current hover:opacity-80",
                    "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                  )}
                  disabled={processing}
                  style={{ color: closeButtonColors.base }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = closeButtonColors.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = closeButtonColors.base;
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeEditor("cancel");
                  }}
                >
                  <Xmark aria-hidden="true" className="h-4 w-4" />
                </button>

                <div className="mb-3 space-y-1">
                  <div
                    id="image-crop-title"
                    className="text-base font-semibold"
                  >
                    Adjust Image
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
                            height: "min(60vh, 420px)",
                          }),
                      touchAction: "none",
                    }}
                  >
                    <div
                      className={cn(
                        // Keep the image under the crop guide (overlay is always top-most).
                        "absolute inset-0 z-10 flex items-center justify-center",
                        isDragging ? "cursor-grabbing" : "cursor-grab",
                      )}
                      style={{ touchAction: "none" }}
                    >
                      <canvas
                        ref={previewCanvasRef}
                        className="h-full w-full"
                      />
                    </div>

                    <CropOverlay
                      className="z-20"
                      shape={activeTemplate.shape}
                      frame={cropFrame}
                      viewport={viewportSize}
                    />

                    <div className="pointer-events-auto absolute right-2 top-4 z-50 flex flex-col gap-2">
                      <button
                        type="button"
                        aria-label="Reset"
                        title="Reset"
                        // Keep this above the overlay and canvas so it's always clickable.
                        className={cn(
                          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-current backdrop-blur transition-colors",
                          "hover:brightness-110",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          "disabled:pointer-events-none disabled:opacity-50",
                        )}
                        style={toolbarButtonStyle}
                        disabled={processing}
                        onPointerDown={(e) => {
                          // Prevent the viewport's panning handler from capturing the pointer.
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();

                          const button = e.currentTarget;
                          animateIconButtonPress(button);

                          resetTransform();
                        }}
                      >
                        <ShareLeft4 aria-hidden="true" className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        aria-label="Rotate 90° clockwise"
                        title="Rotate 90° clockwise"
                        className={cn(
                          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-current backdrop-blur transition-colors",
                          "hover:brightness-110",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          "disabled:pointer-events-none disabled:opacity-50",
                        )}
                        style={toolbarButtonStyle}
                        disabled={processing}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          animateIconButtonPress(e.currentTarget);
                          setRotation((r) => wrapRotationDegrees(r + 90));
                        }}
                      >
                        <RotateObjClockwise
                          aria-hidden="true"
                          className="h-4 w-4"
                        />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      {renderZoomControl ? (
                        renderZoomControl(zoomRenderContext)
                      ) : (
                        <SliderControl {...zoomRenderContext} />
                      )}
                    </div>

                    <div className="space-y-2">
                      {renderRotationControl ? (
                        renderRotationControl(rotationRenderContext)
                      ) : (
                        <SliderControl {...rotationRenderContext} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className={confirmButtonClassName}
                    style={resolvedAppearance.confirmButtonStyle}
                    disabled={processing}
                    onClick={() => void onConfirm()}
                  >
                    <CheckUnderline aria-hidden="true" className="h-4 w-4" />
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
