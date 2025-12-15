import * as SliderPrimitive from "@radix-ui/react-slider";
import type * as React from "react";

import { cn } from "../utils/cn";

type SliderControlProps = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
  style?: React.CSSProperties;
  trackStyle?: React.CSSProperties;
  rangeStyle?: React.CSSProperties;
  thumbStyle?: React.CSSProperties;
};

export function SliderControl({
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
}: SliderControlProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={id}>
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
