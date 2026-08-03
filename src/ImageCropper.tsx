import * as React from "react";

import { CropOverlay } from "./CropOverlay";
import { CropToolbar } from "./components/CropToolbar";
import { RatioPicker } from "./components/RatioPicker";
import { SliderControl } from "./components/SliderControl";
import CheckUnderline from "./icons/check-underline";
import { DEFAULT_LABELS } from "./labels";
import { resolveTheme } from "./theme";
import type {
  ImageCropperHandle,
  ImageCropperProps,
  Labels,
  RatioPreset,
  Transform,
} from "./types";
import { useCropGestures } from "./useCropGestures";
import { useDecodedImage } from "./useDecodedImage";
import { useElementSize } from "./useElementSize";
import { clampTransform } from "./utils/clampTransform";
import { cn } from "./utils/cn";
import { computeCropFrame, getCropRatio } from "./utils/cropFrame";
import { exportCrop } from "./utils/exportCrop";
import { presetKey } from "./utils/presets";
import { renderViewportCanvas } from "./utils/renderViewportCanvas";

const IDENTITY: Transform = {
  zoom: 1,
  rotation: 0,
  flipX: false,
  flipY: false,
  panX: 0,
  panY: 0,
};

function wrapRotationDegrees(degrees: number) {
  // Keep rotation in [-180, 180] so the slider stays meaningful.
  const normalized = (((degrees + 180) % 360) + 360) % 360;
  return normalized - 180;
}

export const ImageCropper = React.forwardRef<
  ImageCropperHandle,
  ImageCropperProps
>(function ImageCropper(
  {
    image,
    crop,
    presets,
    theme,
    quality = 0.9,
    labels,
    className,
    hideFooter = false,
    onExport,
    onCancel,
    onError,
  },
  ref,
) {
  const t: Labels = React.useMemo(
    () => ({ ...DEFAULT_LABELS, ...labels }),
    [labels],
  );
  const resolvedTheme = React.useMemo(() => resolveTheme(theme), [theme]);

  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const { decoded, errorMessage, setErrorMessage } = useDecodedImage(
    image,
    onError,
  );
  const [processing, setProcessing] = React.useState(false);
  const viewportSize = useElementSize(viewportRef, crop.viewport);

  // Raw, unclamped. `view` below is what actually gets drawn and exported.
  const [transform, setTransform] = React.useState<Transform>(IDENTITY);
  const [activePreset, setActivePreset] = React.useState<RatioPreset | null>(
    null,
  );

  // `crop` is always the initial state; presets only take over once one is
  // picked. A preset matching `crop` starts out highlighted.
  const ratioOptions = presets && presets.length > 1 ? presets : null;

  const shape = activePreset?.shape ?? crop.shape ?? "rect";
  const ratio = getCropRatio(
    activePreset
      ? { ratio: activePreset.ratio, shape, output: crop.output }
      : crop,
  );
  const background = crop.background ?? "transparent";
  const limitToImage = crop.limitToImage ?? (crop.fit ?? "cover") === "cover";

  // A new image starts from an untouched transform. Adjusting during render
  // (React's documented pattern for derived-from-prop resets) avoids painting
  // one frame of the new image with the old image's pan and zoom.
  const [lastImage, setLastImage] = React.useState(image);
  if (image !== lastImage) {
    setLastImage(image);
    setTransform(IDENTITY);
  }

  // ---------------------------------------------------------------- geometry

  const cropFrame = React.useMemo(
    () => computeCropFrame(viewportSize.width, viewportSize.height, ratio, 24),
    [viewportSize.width, viewportSize.height, ratio],
  );

  const baseScale = React.useMemo(() => {
    if (!decoded) return 1;
    const fw = Math.max(1, cropFrame.width);
    const fh = Math.max(1, cropFrame.height);
    if (crop.fit === "contain") {
      return Math.min(fw / decoded.width, fh / decoded.height);
    }
    return Math.max(fw / decoded.width, fh / decoded.height);
  }, [decoded, cropFrame.width, cropFrame.height, crop.fit]);

  /**
   * The single source of truth for what is drawn. Clamping is derived rather
   * than written back into state, so a ratio change or a viewport resize
   * re-constrains the image automatically without an extra render pass.
   */
  const view = React.useMemo(
    () =>
      clampTransform({
        cropFrame,
        viewport: viewportSize,
        image: decoded ?? { width: 0, height: 0 },
        rotation: transform.rotation,
        baseScale,
        zoom: transform.zoom,
        pan: { x: transform.panX, y: transform.panY },
        limitToImage,
      }),
    [cropFrame, viewportSize, decoded, transform, baseScale, limitToImage],
  );

  const drawn = React.useMemo<Transform>(
    () => ({
      ...transform,
      zoom: view.zoom,
      panX: view.pan.x,
      panY: view.pan.y,
    }),
    [transform, view],
  );

  const maxZoom = Math.max(5, view.minZoom * 4);

  // ----------------------------------------------------------------- preview

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !decoded) return;
    if (viewportSize.width <= 0 || viewportSize.height <= 0) return;

    renderViewportCanvas({
      image: decoded,
      viewportCss: viewportSize,
      pixelRatio: window.devicePixelRatio || 1,
      baseScale,
      transform: drawn,
      background,
      targetCanvas: canvas,
    });
  }, [decoded, viewportSize, baseScale, drawn, background]);

  // ---------------------------------------------------------------- gestures

  const { isDragging, setZoomAt, handlers } = useCropGestures({
    viewportRef,
    viewport: viewportSize,
    view,
    maxZoom,
    enabled: !processing && decoded !== null,
    setTransform,
  });

  // ------------------------------------------------------------------ export

  const reset = React.useCallback(() => setTransform(IDENTITY), []);

  const runExport = React.useCallback(async () => {
    if (!decoded || processing) return;
    if (cropFrame.width <= 0) return;

    setProcessing(true);
    setErrorMessage(null);

    try {
      await onExport(
        await exportCrop({
          source: image,
          image: decoded,
          crop,
          shape,
          background,
          viewport: viewportSize,
          cropFrame,
          baseScale,
          transform: drawn,
          quality,
        }),
      );
    } catch (cause) {
      const error =
        cause instanceof Error
          ? cause
          : new Error("Processing failed. Please try a different image.");
      setErrorMessage(error.message);
      onError?.(error);
    } finally {
      setProcessing(false);
    }
  }, [
    decoded,
    processing,
    cropFrame,
    image,
    viewportSize,
    crop,
    shape,
    background,
    baseScale,
    drawn,
    quality,
    onExport,
    onError,
    setErrorMessage,
  ]);

  React.useImperativeHandle(ref, () => ({ export: runExport, reset }), [
    runExport,
    reset,
  ]);

  // ------------------------------------------------------------------ render

  const isActivePreset = (preset: RatioPreset) =>
    activePreset
      ? presetKey(preset) === presetKey(activePreset)
      : (preset.shape ?? "rect") === shape && preset.ratio === ratio;

  const toolsDisabled = processing || !decoded;

  const rotateBy = (degrees: number) =>
    setTransform((p) => ({
      ...p,
      rotation: wrapRotationDegrees(p.rotation + degrees),
    }));

  return (
    <div
      className={cn("flex w-full flex-col gap-3", className)}
      style={resolvedTheme.vars}
    >
      {ratioOptions ? (
        <RatioPicker
          label={t.ratio}
          presets={ratioOptions}
          disabled={processing}
          isActive={isActivePreset}
          onSelect={setActivePreset}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1fr_240px]">
        <div className="flex flex-col gap-3">
          <div
            ref={viewportRef}
            className={cn(
              "relative overflow-hidden",
              isDragging ? "cursor-grabbing" : "cursor-grab",
              processing && "opacity-70",
            )}
            style={{
              ...(crop.viewport
                ? { width: crop.viewport.width, height: crop.viewport.height }
                : { width: "100%", height: "min(60vh, 420px)" }),
              borderRadius: "var(--icu-radius-lg)",
              backgroundColor: "var(--icu-tint)",
              touchAction: "none",
            }}
            {...handlers}
            onContextMenu={(e) => e.preventDefault()}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full"
            />
            <CropOverlay
              shape={shape}
              frame={cropFrame}
              viewport={viewportSize}
            />
          </div>

          <CropToolbar
            labels={t}
            disabled={toolsDisabled}
            onReset={reset}
            onRotate={rotateBy}
            onFlipX={() => setTransform((p) => ({ ...p, flipX: !p.flipX }))}
            onFlipY={() => setTransform((p) => ({ ...p, flipY: !p.flipY }))}
          />
        </div>

        <div className="space-y-4">
          <SliderControl
            label={t.zoom}
            value={view.zoom}
            min={view.minZoom}
            max={maxZoom}
            step={0.01}
            disabled={processing || !decoded}
            hint={`${view.zoom.toFixed(2)}×`}
            onChange={(value) => setZoomAt(value)}
          />
          <SliderControl
            label={t.rotation}
            value={transform.rotation}
            min={-180}
            max={180}
            step={1}
            disabled={processing || !decoded}
            hint={`${Math.round(transform.rotation)}°`}
            onChange={(rotation) => setTransform((p) => ({ ...p, rotation }))}
          />
          <p className="text-xs opacity-60">{t.description}</p>
        </div>
      </div>

      {errorMessage ? (
        <p className="text-sm" style={{ color: "var(--icu-danger)" }}>
          {errorMessage}
        </p>
      ) : null}

      {hideFooter ? null : (
        <div className="flex items-center justify-end gap-2">
          {onCancel ? (
            <button
              type="button"
              className="px-4 py-2 text-sm transition-opacity hover:opacity-70 disabled:opacity-50"
              disabled={processing}
              onClick={onCancel}
            >
              {t.cancel}
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              borderRadius: "var(--icu-radius)",
              backgroundColor: "var(--icu-color)",
              color: "var(--icu-fg)",
            }}
            disabled={processing || !decoded}
            onClick={() => void runExport()}
          >
            <CheckUnderline aria-hidden="true" className="h-4 w-4" />
            {processing ? t.processing : t.confirm}
          </button>
        </div>
      )}
    </div>
  );
});
