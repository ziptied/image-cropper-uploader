import * as React from "react";
import { createRoot } from "react-dom/client";

import { ImageCropUpload } from "../src";
import type { CropConfig, CropResult, RatioPreset, Theme } from "../src";

import "./main.css";

const PRESETS: RatioPreset[] = [
  { label: "Avatar", ratio: 1, shape: "avatar" },
  { label: "1:1", ratio: 1 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "16:9", ratio: 16 / 9 },
  { label: "3:4", ratio: 3 / 4 },
];

function Playground() {
  const [color, setColor] = React.useState("#6366f1");
  const [radius, setRadius] = React.useState<Theme["radius"]>("sm");
  const [dark, setDark] = React.useState(false);
  const [limitToImage, setLimitToImage] = React.useState(true);
  const [fit, setFit] = React.useState<"cover" | "contain">("cover");
  const [useVar, setUseVar] = React.useState(false);
  const [result, setResult] = React.useState<CropResult | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // What a real dark-mode app does: flip `color-scheme`, the page colours, and
  // its own brand token — typically a lighter shade for dark backgrounds.
  React.useEffect(() => {
    const root = document.documentElement;
    root.style.colorScheme = dark ? "dark" : "light";
    root.style.setProperty("--brand", dark ? "#a5b4fc" : "#4f46e5");
    document.body.style.backgroundColor = dark ? "#0b0b0f" : "#ffffff";
    document.body.style.color = dark ? "#f4f4f5" : "#18181b";
  }, [dark]);

  const crop: CropConfig = {
    output: { width: 1024, height: 1024 },
    fit,
    limitToImage,
    background: "#ffffff",
  };

  function onCropped(next: CropResult) {
    setResult(next);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(next.blob);
    });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">image-crop-upload playground</h1>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          Colour
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2">
          Radius
          <select
            className="border px-2 py-1"
            value={radius}
            onChange={(e) => setRadius(e.target.value as Theme["radius"])}
          >
            <option value="none">none</option>
            <option value="sm">sm</option>
            <option value="full">full</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          Fit
          <select
            className="border px-2 py-1"
            value={fit}
            onChange={(e) => setFit(e.target.value as "cover" | "contain")}
          >
            <option value="cover">cover</option>
            <option value="contain">contain</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={limitToImage}
            onChange={(e) => setLimitToImage(e.target.checked)}
          />
          limitToImage
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={dark}
            onChange={(e) => setDark(e.target.checked)}
          />
          dark mode
        </label>

        {/* The recommended integration: hand over a CSS variable and let your
            own stylesheet flip it per theme. No React state involved. */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useVar}
            onChange={(e) => setUseVar(e.target.checked)}
          />
          color: var(--brand)
        </label>
      </div>

      <ImageCropUpload
        crop={crop}
        presets={PRESETS}
        theme={{
          color: useVar ? "var(--brand)" : color,
          ...(radius ? { radius } : {}),
        }}
        maxBytes={10 * 1024 * 1024}
        onCropped={onCropped}
      />

      {result && previewUrl ? (
        <div className="flex items-start gap-4 border p-4">
          <img
            alt="Cropped result"
            src={previewUrl}
            className="h-40 w-40 object-contain"
            style={{
              background:
                "repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 0 0 / 16px 16px",
            }}
          />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-sm">
            <dt>size</dt>
            <dd>
              {result.width}×{result.height}
            </dd>
            <dt>bytes</dt>
            <dd>{(result.blob.size / 1024).toFixed(1)} KB</dd>
            <dt>rotation</dt>
            <dd>{result.transform.rotation.toFixed(1)}°</dd>
            <dt>zoom</dt>
            <dd>{result.transform.zoom.toFixed(3)}×</dd>
            <dt>flips</dt>
            <dd>
              {result.transform.flipX ? "x" : "–"} /{" "}
              {result.transform.flipY ? "y" : "–"}
            </dd>
          </dl>
          <a
            className="ml-auto underline"
            download={result.fileName}
            href={previewUrl}
          >
            download
          </a>
        </div>
      ) : null}
    </div>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<Playground />);
