# Architecture

How the cropper works internally. For the public API see [README.md](./README.md).

> This replaces `image-cropper-uploader-spec.md`, the 0.x design document
> (shadcn `Dialog`, `Template` objects, `appearance`, no pan clamping). None of
> that API survives in 1.0 — see the upgrade table in the README.

---

## Layout

```
src/
  index.ts               public exports
  types.ts               every public type
  labels.ts              DEFAULT_LABELS (kept out of component files for Fast Refresh)
  theme.ts               { color, radius } -> CSS custom properties

  ImageCropper.tsx       the editor: geometry, preview, export wiring, layout
  ImageCropUpload.tsx    dropzone + <dialog> wrapper around the editor
  CropOverlay.tsx        SVG dimming mask + crop guide

  useDecodedImage.ts     async decode + release lifecycle
  useElementSize.ts      ResizeObserver, or a fixed size when pinned
  useCropGestures.ts     drag-pan, pinch-zoom, wheel-zoom

  components/
    Dropzone.tsx         file input, drag & drop, "edit existing"
    CropToolbar.tsx      reset / rotate / flip buttons
    RatioPicker.tsx      preset pills
    SliderControl.tsx    Radix slider themed from --icu-* vars

  utils/
    decodeImage.ts            createImageBitmap w/ HTMLImageElement fallback
    cropFrame.ts              ratio resolution + centred frame geometry
    clampTransform.ts         the containment math (below)
    renderViewportCanvas.ts   the single renderer
    exportCroppedWebP.ts      crop region -> WebP blob
    exportCrop.ts             blob -> public CropResult
    presets.ts, clamp.ts, cn.ts

  icons/                 vendored Nucleo exports, verbatim
```

No crop library. Canvas 2D, Pointer Events and an SVG overlay. One runtime
dependency (`@radix-ui/react-slider`).

### Icons

All icons are [Nucleo](https://nucleoapp.com/premium-icons) premium icons,
**outline-duo** style on the **18px grid** — the same set and style throughout, so
they sit together visually. Each is vendored as a component exposing `fill`,
`secondaryFill`, `strokeWidth` and `title`, with the duo layer at
`fillOpacity="0.3"`.

Keep the path data **verbatim from the Nucleo export**. Don't reformat or round
coordinates: a re-export then produces a clean diff instead of noise. (An earlier
pass rounded them to save ~100 bytes and was reverted for exactly this reason.)

To add one, find it in the local library and convert it — the SVGs live in
`~/Library/Application Support/Nucleo/icons/sets/<set>/<id>.svg`, indexed by
`data.sqlite3`:

```sh
sqlite3 ~/Library/Application\ Support/Nucleo/icons/data.sqlite3 \
  "SELECT id, name, set_id FROM icons
   WHERE name = 'crop' AND grid = 18 AND klass = 'outline-duo';"
```

Match the existing component shape in `src/icons/` when wrapping it.

---

## The transform

One affine transform maps image pixels to screen pixels:

```
screen = C + P + R(θ) · (F ⊙ (p_image · s))
```

| | |
|---|---|
| `C` | viewport centre |
| `P` | pan, in CSS px |
| `R(θ)` | rotation |
| `F` | flips, `(±1, ±1)` |
| `s` | `baseScale · zoom` |

`baseScale` fits the image to the **crop frame**, not the viewport — `max` of the
two axis ratios for `cover`, `min` for `contain`. So `zoom: 1` always means
"exactly as the chosen fit placed it", whatever the image's dimensions.

Flips are applied after the rotation, about the image's own centre, so mirroring
doesn't move the framing.

### Clamped state is derived, never stored

`ImageCropper` keeps a raw, unclamped `transform` in state. What gets drawn is:

```ts
const view = useMemo(() => clampTransform({ ...geometry, ...transform }), [...]);
```

Because the clamp is a `useMemo` rather than a write-back, changing the ratio or
resizing the window re-constrains the image for free — no extra render pass, no
risk of an update loop. Gestures seed from `view` (the clamped value), so a drag
that hit the edge stays responsive instead of going dead while a raw value
wanders back into range.

---

## `clampTransform` — keeping the frame on the image

The only non-obvious maths here, and the reason `src/utils/clampTransform.test.ts`
exists.

Flips drop out immediately: the image's bounds are symmetric about its centre, so
containment depends only on rotation, scale and pan.

Rotate the four crop-frame corners `q_k` into image-aligned axes:

```
a_k = R(-θ) · (q_k - C)          d = R(-θ) · P
```

Corner `k` is inside the image when `|a_k.x - d.x| ≤ W·s/2` (and likewise for y),
so *every* corner is inside when

```
d.x ∈ [ max_k(a_k.x) - W·s/2 ,  min_k(a_k.x) + W·s/2 ]
```

— a plain interval clamp per axis, then `P = R(θ) · d`.

Two consequences worth knowing:

- All four corners inside ⇒ the whole convex frame is inside. The clamp is
  **tight**, not conservative — you can still pan into a corner at 45°.
- The interval is non-empty exactly when `spread_x ≤ W·s`. `spread` depends only
  on the frame and θ, never on pan or zoom, so `minZoom` is a **direct formula**
  rather than a search:

  ```
  minZoom = max(spread_x / W, spread_y / H) / baseScale
  ```

  That's why the zoom floor rises as you rotate, and why rotating an
  already-minimum-zoom image nudges zoom up instead of exposing a corner.

With `limitToImage: false` the whole function is a no-op and `minZoom` drops to
`0.1` — that is what "crop outside the image" means.

---

## Rendering: one function, two consumers

`renderViewportCanvas` draws the image into a canvas exactly as the viewport
shows it. The preview and the export both call it, which is what makes the result
WYSIWYG under rotation.

The only difference is `pixelRatio`:

| | `pixelRatio` |
|---|---|
| preview | `window.devicePixelRatio` |
| export | `output.width / cropFrame.width` |

The export ratio lands the crop region on the output canvas 1:1, so a 2048px
output from a 400px on-screen frame is drawn from source pixels. 0.x rendered at
device ratio and upscaled the difference.

`exportCroppedWebP` then fills `background`, blits the crop sub-rect into an
`output`-sized canvas, applies the circular alpha mask for `avatar`, and calls
`toBlob("image/webp", quality)`. `exportCrop` wraps that into the public
`CropResult` (including synthesising a real `File` when the source was a Blob or
a URL), and is deliberately React-free so it can be tested on its own.

---

## Modal

`ImageCropUpload` portals a `<dialog>` to `document.body` and calls
**`showModal()`**. That single call provides the top layer, a real focus trap and
working Escape — 0.x used `<dialog open>`, which provides none of them and left
Escape silently dead.

Consequences handled in `useShowModal`:

- Escape fires the dialog's `cancel` event; it's `preventDefault()`ed so React
  owns the unmount rather than the browser closing the element behind React's back.
- A modal dialog's backdrop is part of the dialog's own hit area, so
  click-outside is an `event.target === dialog` test on a DOM listener.
- A CSS reset (Tailwind preflight included) zeroes the `margin: auto` that
  normally centres a modal dialog, so it is set explicitly.

---

## Styling

Tailwind utilities are used for **layout only**. Every colour and radius is an
inline style reading a `--icu-*` custom property set on the component root by
`resolveTheme`:

```
--icu-color        the base colour
--icu-fg           text on top of it
--icu-radius       small controls
--icu-radius-lg    panels (so radius: "full" isn't a pill-shaped dialog)
--icu-tint         color-mix(… 6%)     surfaces
--icu-tint-strong  color-mix(… 12%)    hover / active surfaces
--icu-line         color-mix(… 30%)    borders, slider track
--icu-line-strong  color-mix(… 70%)    active borders
--icu-surface      Canvas              opaque surface (modal, slider thumb)
--icu-text         CanvasText          text on --icu-surface
--icu-fg           auto black/white    text ON the accent
--icu-accent-text  accent 60% + text   accent used AS text on the page
--icu-danger       red bent toward CanvasText
```

This is why there are no `bg-primary` / `text-muted-foreground` classes anywhere,
and why the package needs no design-system variables from the host app. The
structural classes still have to exist in the consumer's Tailwind build — see the
`@source` note in the README.

### Light and dark, without a `dark:` variant

The tint tokens are `color-mix(… , transparent)`, so they composite over whatever
is behind them and adapt to either theme for free. Only genuinely opaque surfaces
need a decision, and there are two: the modal and the slider thumb.

Those use the `Canvas` / `CanvasText` system colours, resolved by the
`color-scheme` that `resolveTheme` sets on the component root (`light dark` when
`theme.scheme` is `"auto"`). No Tailwind `dark:` variant is involved anywhere,
which matters because that variant's behaviour depends on the *consumer's*
config — and a package can't rely on that.

**The rule this encodes: never paint a background without also setting the text
colour.** The dark-mode bug this replaced was exactly that — the dialog set
`bg-white dark:bg-neutral-900` but left `text-inherit`, so the background flipped
via the consumer's Tailwind config while the text came from `<body>` through the
portal. Two mechanisms, guaranteed to desync.

`--icu-danger` is `color-mix(in oklch, #ef4444 75%, CanvasText)` — mixing toward
the text colour darkens it on light backgrounds and lightens it on dark ones,
keeping it legible in both without a media query.

**`scheme: "auto"` omits `color-scheme` rather than declaring `light dark`.**
Declaring it announces "this subtree supports both", which lets the UA re-pick
from the OS preference — and so *overrides* an app that set `color-scheme: dark`
on `:root` while the OS is light, leaving dark text on a dark page. Inheriting is
what actually follows the page. Only an explicit `"light"` / `"dark"` sets it.

### Contrast is derived, never assumed

Two distinct jobs, easily conflated:

| | token | rule |
|---|---|---|
| text **on** the accent | `--icu-fg` | black or white, from the accent's lightness |
| the accent **as** text | `--icu-accent-text` | accent bent 60% toward `CanvasText` |

`--icu-fg` is `oklch(from var(--icu-color) clamp(0, (0.57 - l) * 1000, 1) 0 0)`:
lightness collapses to 1 or 0 depending on which side of L 0.57 the accent sits.
It has to be CSS, not JS — `color` may be `var(--brand)` or `hsl(var(--accent))`,
which can't be parsed before the browser resolves them.

Both constants were measured, not guessed:

- **0.57** is where black overtakes white for WCAG contrast, found by sweeping
  hue and chroma. (A first pass used 0.62 and picked white for colours in the
  0.57–0.62 band where black scores better.)
- **60%** is the highest accent share that holds 4.5:1 in both schemes across a
  range of brand colours; 70% drops to 3.4:1 on lime and 4.1:1 on navy.

Chroma shifts the true black/white crossover by about ±0.02, so accents inside
that band land near 4.5:1 either way — `theme.foreground` pins it if needed.

---

## Verification

| | |
|---|---|
| `bun test` | `clampTransform` containment and `minZoom`; `getCropRatio` defaults and frame geometry |
| `bun run dev` | the `examples/` playground — the only way to check the canvas by eye |
| `bunx react-doctor` | React health (currently 96/100, 0 errors) |

The playground deliberately defines no design-system CSS variables, so if the
editor looks right there, the theming really is self-contained.

The playground has a **dark mode** toggle that flips `color-scheme` and the page
colours the way a real app would, and a colour picker — check both schemes
against a *light* accent (e.g. `#bef264`) and a *dark* one (`#1e3a8a`) after any
theme change. Both failure modes this codebase has already shipped were only
visible in that particular combination, and neither was caught by a unit test.

Things worth checking by hand in the playground after touching the transform:
drag hard against the edge at several rotations with `limitToImage` on (the
image must never leave the frame), the same with it off plus a `background`
colour (the gap must fill, not go transparent), an avatar export (corners must be
transparent), and a ratio switch mid-edit (the frame re-fits and the transform
re-clamps without jumping).

### Known react-doctor warning

`no-giant-component` on `ImageCropper` (~330 lines). Accepted deliberately. The
genuinely separable parts have been extracted — `useDecodedImage`,
`useElementSize`, `useCropGestures`, `exportCrop`, `CropToolbar`, `RatioPicker`.
What remains is a chain of mutually dependent geometry (`cropFrame` → `baseScale`
→ `view` → `drawn`) plus the layout that consumes it; splitting further would
mean a component whose only job is forwarding a dozen props.

---

## Deliberately not implemented

- **Draggable / resizable crop selection.** Output is scaled to a fixed `output`
  size, so a resizable frame wouldn't change the result. It only becomes
  meaningful with free-ratio crop, where output derives from the selection.
- **Filters, annotation, image editing.** Out of scope — this is the crop half of
  Pintura only.
- **Rule-of-thirds guides, crop info indicator, zoom auto-hide.** Chrome, not
  capability.
- **`renderZoomControl` / `renderRotationControl` (0.x).** `theme` covers styling;
  anyone needing a genuinely different widget can compose `ImageCropper` instead.
