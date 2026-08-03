# Migrating 0.x → 1.0

`@ziptied/image-crop-upload` 1.0.0 is a complete API rewrite with **no
compatibility shims**. Every 0.x call site fails to compile.

This document is written to be executed. Work top to bottom: §1 is mechanical
and TypeScript will catch anything you miss; **§2 is the dangerous part** —
those changes compile cleanly and silently change the image your users get.

---

## 0. Scope check

Find every call site first:

```sh
rg -l "image-crop-upload|ImageCropUpload" --type ts --type tsx
```

For each one you need: the `template` object, the `appearance` object, the
`onCropped` handler, and any stored `result.transform`.

---

## 1. Mechanical renames (TypeScript catches these)

### 1.1 `template` → `crop`

The prop is renamed and reshaped.

```tsx
// 0.x
<ImageCropUpload
  template={{
    shape: "rect",
    aspect: 16 / 9,
    output: { width: 1600, height: 900 },
    fit: "cover",
    fitBackground: "#fff",
    circleAlphaOutput: false,
    viewport: { width: 520, height: 292 },
  }}
/>

// 1.0
<ImageCropUpload
  crop={{
    ratio: 16 / 9,
    output: { width: 1600, height: 900 },
    fit: "cover",
    background: "#fff",
    alphaMask: false,
    viewport: { width: 520, height: 292 },
  }}
/>
```

| 0.x | 1.0 | Note |
|---|---|---|
| `template` | `crop` | |
| `aspect` | `ratio` | now optional — defaults to `output.width / output.height` |
| `fitBackground` | `background` | **also applies to `cover` now** — see §2.2 |
| `circleAlphaOutput` | `alphaMask` | **default flipped** — see §2.1 |
| `shape: "circle"` | `shape: "avatar"` | |
| `shape: "square"` | *delete it*, use `ratio: 1` | |
| `shape: "rect"` | *delete it* (it's the default) | |
| `output`, `viewport`, `fit` | unchanged | |

`shape` is now only `"rect" | "avatar"`. Aspect comes from `ratio`, not `shape`.

### 1.2 `appearance` → `theme`

Delete the whole `appearance` object. All 21 keys are gone; there is no
per-element colour API.

```tsx
// 0.x
appearance={{
  dropzoneBackground: "hsl(var(--accent)/0.08)",
  dropzoneBorder: "hsl(var(--accent)/0.4)",
  iconColor: "hsl(var(--accent))",
  sliderRangeColor: "hsl(var(--accent))",
  sliderThumbRadius: "0.25rem",
  /* …16 more… */
}}

// 1.0 — every tone is derived from one colour
theme={{ color: "hsl(var(--accent))", radius: "sm" }}
```

`radius` is `"none" | "sm" | "full"`. If you need something the two knobs can't
express, use `<ImageCropper>` inside your own chrome rather than reaching for
per-element overrides.

### 1.3 Other props

| 0.x | 1.0 |
|---|---|
| `webpQuality={0.9}` | `quality={0.9}` |
| `label="Upload"` | `labels={{ dropzone: "Upload" }}` |
| `allowTemplateSwitch` + `templatePresets={[...]}` | `presets={[{ label, ratio, shape? }]}` |
| `renderZoomControl` / `renderRotationControl` | **removed** — use `theme`, or compose `<ImageCropper>` |

`presets` renders a ratio picker whenever you pass two or more. It no longer
takes whole templates — just `{ label, ratio, shape? }`.

### 1.4 Types

```ts
// 0.x
import type {
  Template, ImageCropUploadResult, ImageCropUploadAppearance, SliderRenderContext,
} from "@ziptied/image-crop-upload";

// 1.0
import type {
  CropConfig, CropResult, Theme, RatioPreset, Labels, Transform,
} from "@ziptied/image-crop-upload";
```

`Template` → `CropConfig`. `ImageCropUploadResult` → `CropResult`.
`ImageCropUploadAppearance` and `SliderRenderContext` have no replacement.

### 1.5 Result shape

`result.transform` gained `flipX: boolean` and `flipY: boolean`. If you persist
the transform, widen the stored schema.

`result.crop` was **removed**. It was declared in 0.x but never populated, so any
code reading it was already reading `undefined` — delete that code rather than
porting it.

---

## 2. Silent behaviour changes ⚠️

**These compile without error and change the exported image.** Read every one.

### 2.1 Circle crops are now alpha-masked by default

`circleAlphaOutput` defaulted to `false`; `alphaMask` defaults to `true`.

A 0.x `shape: "circle"` produced an **opaque square WebP**. The direct 1.0
translation (`shape: "avatar"`) produces a WebP with **transparent corners**.

If anything downstream composites the image, converts it to JPEG, or assumes an
opaque rectangle, it will change visually.

```tsx
// preserve exact 0.x output
crop={{ shape: "avatar", alphaMask: false, output: { width: 512, height: 512 } }}
```

### 2.2 `background` now paints in `cover` mode

0.x only applied `fitBackground` when `fit === "contain"` and ignored it
otherwise. 1.0 applies `background` whenever pixels are missing, in both fits.

If you set `fitBackground` alongside `fit: "cover"` in 0.x it did nothing. It
does something now. Drop it unless you want it.

### 2.3 Pan and zoom are constrained by default

0.x had no clamping at all — a user could drag the image completely out of frame
and export blank space. 1.0 defaults `limitToImage` to `true` for `fit: "cover"`,
which means:

- the image can never be positioned away from the crop frame
- **the zoom slider's minimum is now dynamic** and rises as the image rotates
- rotating an already-minimum-zoom image nudges zoom up instead of exposing a corner

This is a UX change your users will notice. To restore 0.x's free positioning:

```tsx
crop={{ limitToImage: false, output: { … } }}
```

### 2.4 Exports are larger

0.x rendered the viewport at `devicePixelRatio` and scaled that to `output`, so a
large `output` was upscaled from however many pixels happened to be on screen.
1.0 renders at `output.width / cropFrame.width`, drawing from source pixels.

Same `quality` value, genuinely more detail, **noticeably bigger files**. Re-tune
`quality` if you have size budgets.

### 2.5 `ratio` defaults to the output aspect, not 1

A 0.x `template` with a mismatched shape and output — e.g.
`shape: "square", output: { width: 1920, height: 1080 }` — cropped a square and
squashed it into 16:9. In 1.0, omitting `ratio` gives you a 16:9 crop frame that
matches the file.

If you were relying on the squash (unlikely, but check), set `ratio: 1`
explicitly.

### 2.6 Errors thrown from `onCropped` are shown to the user

0.x always displayed a fixed string: `"Processing failed. Please try a different
image."` 1.0 renders `error.message` from whatever you throw.

**If your upload handler throws raw server or network errors, that text now
appears in the UI.** Catch and rethrow something user-safe:

```tsx
onCropped={async ({ file }) => {
  try {
    await upload(file);
  } catch (cause) {
    console.error(cause);                       // keep the detail for you
    throw new Error("Upload failed. Please try again.");  // shown to the user
  }
}}
```

Use `onError` on `<ImageCropper>` if you want to report failures without
depending on the displayed message.

---

## 3. Environment requirements

### 3.1 Tailwind must scan the package ⚠️

**Most likely thing to break the UI on upgrade.** 0.x leaned on shadcn tokens
your app already had. 1.0 uses Tailwind utilities for layout, and Tailwind v4
does not scan dependencies by default. Without this the layout collapses:

```css
@import "tailwindcss";
@source "../node_modules/@ziptied/image-crop-upload/dist";
```

You no longer need shadcn or any CSS variables of your own.

### 3.2 Browser floor

The palette is derived in CSS rather than hardcoded, so two modern colour
features are load-bearing: `color-mix()` for every tint, and **relative colour
syntax** (`oklch(from …)`) to pick readable text against your accent.

**Chrome 119+ · Safari 16.4+ · Firefox 128+**

0.x used `color-mix()` in one optional default and hardcoded everything else, so
it had no effective floor beyond React 18.

### 3.3 The modal is in the top layer

0.x portalled a `<div>` at `z-index: 500`. 1.0 uses `<dialog>` + `showModal()`,
which paints in the browser's top layer above **everything**, regardless of
z-index. Your own toasts or overlays can no longer appear above the cropper
unless they are also in the top layer.

You gain a real focus trap and working Escape, neither of which 0.x had.

### 3.4 Dark mode

1.0 derives its surfaces and text from the `Canvas` / `CanvasText` system
colours, which follow `color-scheme`. The default `scheme: "auto"` **inherits**,
so if your app sets `color-scheme` on `:root` it just works:

```css
:root { color-scheme: dark; }
```

If your app themes itself with a `.dark` class or a `data-theme` attribute and
**doesn't** set `color-scheme`, there is nothing to inherit — the editor will
render light on your dark page. Tell it explicitly:

```tsx
theme={{ color: brand, scheme: isDark ? "dark" : "light" }}
```

### 3.5 The default accent changed

`#6366f1` (indigo-500) → `#4f46e5` (indigo-600). The old default put white text
on the confirm button at 4.47:1, just under WCAG AA. Pass `theme.color` if you
were relying on the previous shade.

Related: `theme.foreground` no longer defaults to white. It now resolves to black
or white from your accent's lightness, so a light brand colour gets readable dark
text instead of invisible white text. Set it explicitly to pin a pairing.

---

## 4. Unchanged

No action needed for any of these:

- ESM-only, `"type": "module"`
- Peers: `react` / `react-dom` `>=18`
- One runtime dependency: `@radix-ui/react-slider`
- `onCropped` is still awaited, and the editor stays open if it throws
- `accept`, `maxBytes`, `validateFile`, `initialImageUrl`, `disabled`,
  `className`, `onCancel` — same names, same semantics
- The emitted `.d.ts` imports only from `react`

---

## 5. Checklist

- [ ] `template` → `crop`, `aspect` → `ratio`, `shape` values remapped (§1.1)
- [ ] `appearance` deleted, `theme={{ color, radius }}` added (§1.2)
- [ ] `webpQuality` → `quality`, `label` → `labels.dropzone` (§1.3)
- [ ] `allowTemplateSwitch`/`templatePresets` → `presets` (§1.3)
- [ ] Type imports updated; any `result.crop` reader deleted (§1.4, §1.5)
- [ ] **Decided on `alphaMask` for every circle/avatar crop** (§2.1)
- [ ] **Decided on `limitToImage`** (§2.3)
- [ ] Checked output file sizes against any budget (§2.4)
- [ ] **`onCropped` throws user-safe messages only** (§2.6)
- [ ] `@source` added to the Tailwind entry CSS (§3.1)
- [ ] Browser support floor confirmed (§3.2)
- [ ] `theme.scheme` set if the app doesn't set `color-scheme` (§3.4)
