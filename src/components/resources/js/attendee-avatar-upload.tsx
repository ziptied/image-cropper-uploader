import InputError from "@/components/input-error";
import { cn } from "@/lib/utils";
import { router } from "@inertiajs/react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  ImageCropUpload,
  type ImageCropUploadAppearance,
  type ImageCropUploadResult,
  type SliderRenderContext,
  type Template,
} from "@ziptied/image-crop-upload";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const AVATAR_TEMPLATE: Template = {
  shape: "square",
  fit: "contain",
  fitBackground: "transparent",
  output: { width: 400, height: 400 },
  circleAlphaOutput: false,
};

const MAX_BYTES = 5 * 1024 * 1024;

interface AttendeeAvatarUploadProps {
  uploadUrl: string;
  removeUrl: string;
  existingUrl?: string | null;
  className?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

function ZoomSliderControl({
  id,
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  className,
  style,
  trackStyle,
  rangeStyle,
  thumbStyle,
}: SliderRenderContext) {
  const hasSetDefault = useRef(false);

  useEffect(() => {
    if (hasSetDefault.current) {
      return;
    }

    hasSetDefault.current = true;

    const range = max - min;
    const midpoint = min + range / 2;
    const stepSize = step > 0 ? step : 1;
    const snapped = Math.round((midpoint - min) / stepSize) * stepSize + min;
    const nextValue = Math.min(max, Math.max(min, snapped));

    if (!Number.isNaN(nextValue) && value !== nextValue) {
      onChange(nextValue);
    }
  }, [min, max, step, value, onChange]);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-anchorfish-700" htmlFor={id}>
        {label}
      </label>
      <SliderPrimitive.Root
        id={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={Boolean(disabled)}
        onValueChange={(next) => {
          const first = next[0];
          if (typeof first === "number" && !Number.isNaN(first)) {
            onChange(first);
          }
        }}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          className,
        )}
        style={style}
      >
        <SliderPrimitive.Track
          className="relative h-1.5 w-full grow overflow-hidden rounded-sm bg-muted"
          style={trackStyle}
        >
          <SliderPrimitive.Range
            className="absolute h-full bg-primary"
            style={rangeStyle}
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block h-4 w-4 rounded-sm border border-primary/50 bg-background shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none"
          style={thumbStyle}
        />
      </SliderPrimitive.Root>
    </div>
  );
}

function RotationSliderControl({
  id,
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  className,
  style,
  trackStyle,
  rangeStyle,
  thumbStyle,
}: SliderRenderContext) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-anchorfish-700" htmlFor={id}>
        {label}
      </label>
      <SliderPrimitive.Root
        id={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={Boolean(disabled)}
        onValueChange={(next) => {
          const first = next[0];
          if (typeof first === "number" && !Number.isNaN(first)) {
            onChange(first);
          }
        }}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          className,
        )}
        style={style}
      >
        <SliderPrimitive.Track
          className="relative h-1.5 w-full grow overflow-hidden rounded-sm bg-muted"
          style={trackStyle}
        >
          <SliderPrimitive.Range
            className="absolute h-full bg-primary"
            style={rangeStyle}
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block h-4 w-4 rounded-sm border border-primary/50 bg-background shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none"
          style={thumbStyle}
        />
      </SliderPrimitive.Root>
    </div>
  );
}

export default function AttendeeAvatarUpload({
  uploadUrl,
  removeUrl,
  existingUrl,
  className,
  onSuccess,
  onError,
}: AttendeeAvatarUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const appearance = useMemo<ImageCropUploadAppearance>(
    () => ({
      titleClassName: "text-anchorfish-800",
      descriptionClassName: "text-anchorfish-600",
      closeButtonClassName: "text-anchorfish-800 hover:text-anchorfish-900",
      sliderTrackColor:
        "color-mix(in oklch, var(--court-500) 20%, var(--background))",
      sliderRangeColor: "var(--court-500)",
      sliderThumbColor: "var(--background)",
      sliderThumbBorderColor: "var(--court-500)",
      sliderThumbRadius: "var(--radius-sm)",
    }),
    [],
  );

  const handleCropped = useCallback(
    (result: ImageCropUploadResult) => {
      setIsUploading(true);
      setError(null);

      router.post(
        uploadUrl,
        { avatar: result.file },
        {
          forceFormData: true,
          preserveScroll: true,
          onSuccess: () => {
            onSuccess?.();
          },
          onError: (errors) => {
            const message =
              errors.avatar ?? "Failed to upload photo. Please try again.";
            setError(message);
            onError?.(message);
          },
          onFinish: () => {
            setIsUploading(false);
          },
        },
      );
    },
    [onError, onSuccess, uploadUrl],
  );

  const handleRemove = useCallback(() => {
    setIsUploading(true);
    setError(null);

    router.delete(removeUrl, {
      preserveScroll: true,
      onSuccess: () => {
        onSuccess?.();
      },
      onError: () => {
        const message = "Failed to remove photo. Please try again.";
        setError(message);
        onError?.(message);
      },
      onFinish: () => {
        setIsUploading(false);
      },
    });
  }, [onError, onSuccess, removeUrl]);

  return (
    <div className={cn("space-y-3", className)}>
      <ImageCropUpload
        template={AVATAR_TEMPLATE}
        maxBytes={MAX_BYTES}
        imageUrl={existingUrl ?? undefined}
        disabled={isUploading}
        onCropped={handleCropped}
        onRemove={handleRemove}
        appearance={appearance}
        renderZoomControl={(context) => <ZoomSliderControl {...context} />}
        renderRotationControl={(context) => (
          <RotationSliderControl {...context} />
        )}
      />
      {error ? <InputError message={error} /> : null}
    </div>
  );
}
