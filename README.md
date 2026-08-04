# Image Crop Upload (React)

Drop in an image, adjust it, get a WebP out. Crop, zoom, free rotation, 90° steps,
horizontal/vertical flips, ratio presets and avatar (circular) crops — the crop half
of a [Pintura](https://pqina.nl/pintura/)-style editor, with none of the filters,
annotation or image-editing surface.

- No cropping libraries — Canvas 2D, Pointer Events and an SVG overlay
- WYSIWYG: the preview and the export run through the same renderer
- Theming is two knobs: a base colour and a corner shape
- React 18+, no framework assumptions

---

## Install

```sh
bun add @ziptied/image-crop-upload
```

Peer deps your app must already have: `react` `>=18`, `react-dom` `>=18`.

### Tailwind

The components use Tailwind utility classes for layout only (colours and radii are
inline styles driven by `theme`). Tailwind v4 doesn't scan dependencies by default,
so point it at the package:

```css
@import "tailwindcss";
@source "../node_modules/@ziptied/image-crop-upload/dist";
```

You do **not** need shadcn, or any CSS variables of your own.

---

## Usage

### All-in-one — dropzone + modal

```tsx
import { ImageCropUpload } from "@ziptied/image-crop-upload";

<ImageCropUpload
  crop={{ output: { width: 1024, height: 1024 }, shape: "avatar" }}
  theme={{ color: "#6366f1", radius: "sm" }}
  maxBytes={10 * 1024 * 1024}
  onCropped={async ({ file }) => {
    const body = new FormData();
    body.append("avatar", file);
    await fetch("/api/avatar", { method: "POST", body });
  }}
/>;
```

`onCropped` is awaited — the editor shows its processing state until your upload
resolves, then closes.

### Bring your own dialog

`ImageCropper` is the editor on its own: no dropzone, no modal. Give it a `File`,
`Blob` or URL.

```tsx
import { useRef } from "react";
import { ImageCropper, type ImageCropperHandle } from "@ziptied/image-crop-upload";

const cropper = useRef<ImageCropperHandle>(null);

<Dialog>
  <ImageCropper
    ref={cropper}
    image={file}
    crop={{ output: { width: 512, height: 512 } }}
    presets={[
      { label: "Avatar", ratio: 1, shape: "avatar" },
      { label: "16:9", ratio: 16 / 9 },
    ]}
    hideFooter
    onExport={handleResult}
  />
  <DialogFooter>
    <button onClick={() => cropper.current?.reset()}>Reset</button>
    <button onClick={() => cropper.current?.export()}>Save</button>
  </DialogFooter>
</Dialog>;
```

---

## `crop`

```ts
type CropConfig = {
  output: { width: number; height: number }; // required — the exported size
  ratio?: number;          // width / height. Defaults to the output's aspect.
  shape?: "rect" | "avatar";               // default "rect"
  fit?: "cover" | "contain";               // initial fit, default "cover"
  background?: string;     // painted where the image doesn't reach. Default transparent.
  limitToImage?: boolean;  // default: fit === "cover"
  alphaMask?: boolean;     // avatar only: bake the circle into alpha. Default true.
  viewport?: { width: number; height: number }; // fixed px, else responsive
};
```

**Aspect ratio is enforced.** The crop frame is locked to `ratio` and can't be
resized — the image pans, zooms and rotates underneath it. Without `presets` there's
no way for the user to change it. `ratio` is optional because it defaults to the
output's own aspect, so `output: { width: 1920, height: 1080 }` already crops 16:9;
set it explicitly only when you want a frame that differs from the exported size.

**`limitToImage`** is Pintura's `imageCropLimitToImage` — "can the crop go outside
the image?". When `true` (the default for `cover`), pan and zoom are constrained so
the crop frame can never leave the image at any rotation, and the zoom slider's floor
rises as you rotate. When `false`, you can crop past the edge and the gap is filled
with `background`.

### `presets`

Pass two or more and a ratio picker appears above the viewport. `crop` still defines
the starting state; a preset matching it is highlighted.

```ts
presets={[
  { label: "Avatar", ratio: 1, shape: "avatar" },
  { label: "1:1", ratio: 1 },
  { label: "4:3", ratio: 4 / 3 },
  { label: "16:9", ratio: 16 / 9 },
]}
```

---

## Props

### `<ImageCropUpload>`

| Prop | Type | Default |
|---|---|---|
| `crop` **(req)** | `CropConfig` | — |
| `onCropped` **(req)** | `(r: CropResult) => void \| Promise<void>` | — |
| `onCancel` | `() => void` | — |
| `presets` | `RatioPreset[]` | — |
| `theme` | `Theme` | indigo / `sm` |
| `quality` | `number` (0–1) | `0.9` |
| `maxOutputBytes` | `number` | — |
| `minQuality` | `number` (0–1) | `0.35` |
| `labels` | `Partial<Labels>` | English defaults |
| `validateFile` | `(f: File) => {ok:true} \| {ok:false; reason:string}` | — |
| `accept` | `string` | `"image/*"` |
| `maxBytes` | `number` | — |
| `initialImageUrl` | `string` | — |
| `onRemoveExisting` | `() => void` | — |
| `disabled` | `boolean` | `false` |
| `className` | `string` | — |
| `children` | `ReactNode` | replaces the dropzone body |

### `<ImageCropper>`

Same `crop`, `presets`, `theme`, `quality`, `maxOutputBytes`, `minQuality`,
`labels`, `className`, plus:

| Prop | Type | Default |
|---|---|---|
| `image` **(req)** | `File \| Blob \| string` | — |
| `onExport` **(req)** | `(r: CropResult) => void \| Promise<void>` | — |
| `onCancel` | `() => void` | hides the cancel button when omitted |
| `onError` | `(e: Error) => void` | — |
| `hideFooter` | `boolean` | `false` |
| `ref` | `ImageCropperHandle` | `{ export(), reset() }` |

### `CropResult`

```ts
{
  blob: Blob;
  file: File;              // ready for FormData
  fileName: string;        // original name, .webp extension
  mimeType: "image/webp";
  width: number; height: number;
  originalFile: File;
  transform: { zoom, rotation, flipX, flipY, panX, panY };
}
```

---

## Theming

```ts
type Theme = {
  color?: string;                        // any CSS colour. Default "#4f46e5".
  radius?: "none" | "sm" | "full";       // default "sm"
  foreground?: string;                   // text on `color`. Default: white.
  scheme?: "auto" | "light" | "dark";    // default "auto" (inherit the page)
};
```

Every other tone — dropzone tint, borders, slider track, crop guide, icon chips — is
derived from `color`. `radius` maps to two values internally so `"full"` gives you
pill-shaped controls without a pill-shaped dialog.

Text and icons drawn *on* the accent, including the confirm button, default to
white. Override `foreground` only when your accent needs a different pairing. The
accent used *as* text is bent toward the page's text colour so a pale brand colour
stays legible.

### Wiring it to your app's colours

You send **one** colour, not one per theme:

```tsx
<ImageCropUpload theme={{ color: "var(--brand)" }} … />
```

`color` is never parsed in JS, so it can be a CSS variable — which means your own
stylesheet keeps owning the theming and React never has to know which mode you're
in:

```css
:root      { color-scheme: light; --brand: #4f46e5; }
.dark      { color-scheme: dark;  --brand: #a5b4fc; }  /* lighter for dark bg */
```

Flip `--brand` however you already do it and the editor follows. Passing a plain
`"#4f46e5"`, `"hsl(250 84% 54%)"` or `"rebeccapurple"` works just as well if you
only have one brand colour.

### Light and dark

Surfaces are translucent tints, so they sit on whatever is behind them and adapt on
their own. The opaque surfaces take their colours from the `Canvas` / `CanvasText`
system colours, which follow `color-scheme`.

`scheme: "auto"` **inherits** — so set `color-scheme` on `:root` and the editor
follows your app:

```css
:root { color-scheme: light dark; }   /* or just: dark */
```

If you theme with a `.dark` class or `data-theme` attribute and don't set
`color-scheme`, there's nothing to inherit, so say it explicitly:

```tsx
theme={{ color: brand, scheme: isDark ? "dark" : "light" }}
```

There is deliberately no `dark:` variant anywhere in the package, so none of this
depends on how your Tailwind dark mode is configured.

If you need finer control, style the wrapper via `className` or use `ImageCropper`
inside your own chrome.

---

## Export quality

The crop region is rendered at `output.width / cropFrame.width` canvas pixels per CSS
pixel, so a 2048px output from a 400px on-screen frame is drawn from source pixels
rather than upscaled from the preview.

Use `maxOutputBytes` when your upload endpoint has a hard byte cap. The cropper
first exports at `quality`, then retries at lower quality down to `minQuality`
until the WebP fits or the floor is reached. `maxBytes` still validates the
source file selected by the user.

---

## Dev

```sh
bun install
bun run dev            # playground at localhost:5173
bun test               # crop clamping + ratio maths
bun run typecheck
bun run lint
bun run build
bun run validate       # typecheck + tests + lint + build
bun run pack:dry       # inspect the npm tarball before publishing
bunx react-doctor      # React health check
```

The playground (`examples/`) deliberately ships no design-system CSS variables — if
the editor looks right there, its theming is genuinely self-contained.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the transform model, the containment
maths behind `limitToImage`, and why the modal uses `showModal()`.

## Release

Publish `1.0.0` from a clean tag named `v1.0.0`.

1. Configure npm trusted publishing for
   `ziptied/image-cropper-uploader`, workflow `publish.yml`, environment `npm`.
2. Run `bun run validate` and `bun run pack:dry` locally.
3. Create and publish the GitHub release for `v1.0.0`; the workflow validates,
   inspects the tarball and runs `npm publish`.

Manual fallback:

```sh
bun run validate
bun run pack:dry
npm publish --access public
```

`prepublishOnly` also runs `bun run validate`, so a direct publish fails before it
uploads if typecheck, tests, lint or build fail.

---

## Upgrading from 0.x

1.0.0 is a clean break — every 0.x call site fails to compile.

**→ [MIGRATION.md](./MIGRATION.md) is the step-by-step guide**, including the
changes that *don't* fail to compile but do change your output: circle crops are
alpha-masked by default now, pan/zoom is constrained by default, exported files are
larger, and errors thrown from `onCropped` are shown to the user. It's written to be
followed directly by a coding agent.

The renames at a glance:

| 0.x | 1.0 |
|---|---|
| `template={{ shape, aspect, output, ... }}` | `crop={{ shape, ratio, output, ... }}` |
| `shape: "circle" \| "square" \| "rect"` | `shape: "rect" \| "avatar"` + `ratio` |
| `aspect` | `ratio` |
| `appearance` (21 keys) | `theme` (`color`, `radius`) |
| `allowTemplateSwitch` + `templatePresets` | `presets` |
| `webpQuality` | `quality` |
| `label` | `labels.dropzone` |
| `renderZoomControl` / `renderRotationControl` | removed — use `theme`, or `ImageCropper` |
| `circleAlphaOutput` | `alphaMask` |
| `fitBackground` | `background` (applies to both fits) |
| `result.crop` (never populated) | removed |

New in 1.0: horizontal/vertical flips, ratio presets in the UI, wheel and pinch zoom,
pan/zoom clamping (`limitToImage`), output-resolution export, a headless
`<ImageCropper>`, working Escape/focus-trap on the modal, and unique DOM ids so two
instances can coexist on a page.
