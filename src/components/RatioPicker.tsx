import type { RatioPreset } from "../types";
import { presetKey } from "../utils/presets";

export type RatioPickerProps = {
  label: string;
  presets: RatioPreset[];
  disabled: boolean;
  isActive: (preset: RatioPreset) => boolean;
  onSelect: (preset: RatioPreset) => void;
};

export function RatioPicker({
  label,
  presets,
  disabled,
  isActive,
  onSelect,
}: RatioPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">{label}</span>
      {presets.map((preset) => {
        const active = isActive(preset);
        return (
          <button
            key={presetKey(preset)}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            className="border px-3 py-1 text-sm transition-colors disabled:opacity-50"
            style={{
              borderRadius: "var(--icu-radius)",
              borderColor: active ? "var(--icu-color)" : "var(--icu-line)",
              backgroundColor: active
                ? "var(--icu-tint-strong)"
                : "transparent",
              color: active ? "var(--icu-accent-text)" : "inherit",
            }}
            onClick={() => onSelect(preset)}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
