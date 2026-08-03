import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

type SliderControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** Rendered on the right of the label, e.g. "1.4×" or "45°". */
  hint?: string;
};

/**
 * All colours come from the `--icu-*` custom properties set by the editor root,
 * so a consumer only ever sets `theme={{ color, radius }}`.
 */
export function SliderControl({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  hint,
}: SliderControlProps) {
  const labelId = React.useId();

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium" id={labelId}>
          {label}
        </span>
        {hint ? (
          <span className="text-xs tabular-nums opacity-60">{hint}</span>
        ) : null}
      </div>
      <SliderPrimitive.Root
        aria-labelledby={labelId}
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
        className="relative flex w-full touch-none select-none items-center disabled:opacity-50"
      >
        <SliderPrimitive.Track
          className="relative h-1.5 w-full grow overflow-hidden"
          style={{
            backgroundColor: "var(--icu-line)",
            borderRadius: "var(--icu-radius)",
          }}
        >
          <SliderPrimitive.Range
            className="absolute h-full"
            style={{ backgroundColor: "var(--icu-color)" }}
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block h-4 w-4 border-2 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none"
          style={{
            backgroundColor: "var(--icu-surface)",
            borderColor: "var(--icu-color)",
            borderRadius: "var(--icu-radius)",
          }}
        />
      </SliderPrimitive.Root>
    </div>
  );
}
