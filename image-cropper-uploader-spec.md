# Image Cropper Uploader (ShadCN + React + Inertia)
**Document version:** 1.0  
**Last updated:** 2025-12-13  
**Target environment:** Laravel + Inertia.js + React  
**UI:** shadcn/ui (Dialog, Button, Slider, etc.)

---

## 1. Purpose
Build a reusable, framework-agnostic **React component** (usable inside Inertia pages) that allows users to:

1. Browse or drag & drop an image file
2. Edit it inside a **shadcn Dialog** with:
   - **pan**
   - **zoom**
   - **rotation**
   - a fixed **crop template overlay** (circle / square / rectangle) matching the final display shape
3. Confirm to produce a **cropped WebP** (client-side) and return it to the parent for upload

The component must be installable and reusable across multiple projects, without coupling to a specific app’s routing, Next.js APIs, or server actions.

---

## 2. Hard Constraints
- **No Next.js**
- **No cropping libraries** (e.g., react-easy-crop, cropperjs) — implement interactions using browser APIs only
- Component must work in:
  - **React 18** (Inertia React adapter typical)
  - Modern browsers including **iOS Safari**
- Export output must be **image/webp** via Canvas
- Use shadcn/ui components for modal and controls (or accept equivalent shadcn wrappers if projects differ)

---

## 3. Component Deliverables
### Primary component
- `ImageCropUpload` — dropzone + modal editor + WebP output

### Supporting utilities (recommended)
- `decodeImage(fileOrUrl)` — decode into a drawable image source
- `renderViewportCanvas(...)` — draw the transformed image into an offscreen canvas sized to the editor viewport
- `exportCroppedWebP(...)` — slice crop region from viewport canvas, scale to output size, and export as WebP

### Optional supporting components
- `CropOverlay` — overlay + dimming mask (circle/rect)
- `Dropzone` — drag & drop + browse input (can live inside ImageCropUpload)

---

## 4. Public API

### 4.1 Types
```ts
export type CropShape = "circle" | "square" | "rect";

export type Template = {
  shape: CropShape;

  /**
   * Aspect ratio for rect/square. Circle implies 1.
   * Example: 16/9, 4/3, 1.
   */
  aspect?: number;

  /**
   * Final output pixel size
   */
  output: {
    width: number;
    height: number;
  };

  /**
   * Modal viewport size in CSS pixels.
   * If omitted, viewport is responsive; crop frame scales accordingly.
   */
  viewport?: {
    width: number;
    height: number;
  };

  /**
   * If true + shape=circle, output WebP uses transparency outside the circle.
   * If false, output is a square WebP (still visually circle in UI).
   */
  circleAlphaOutput?: boolean;
};

export type ImageCropUploadResult = {
  blob: Blob;                 // type: image/webp
  file: File;                 // File([blob], name, { type: "image/webp" })
  fileName: string;
  mimeType: "image/webp";
  width: number;
  height: number;
  originalFile: File;

  transform: {
    zoom: number;             // 1..N
    rotation: number;         // degrees (-180..180)
    panX: number;             // px in viewport space
    panY: number;             // px in viewport space
  };

  /**
   * Crop rectangle in source-image pixel space.
   * Note: If using the recommended "render viewport then extract" approach,
   * this can be derived approximately; exactness is optional unless needed downstream.
   */
  crop?: {
    x: number; y: number;
    width: number; height: number;
  };
};
```

### 4.2 Props
```ts
export type ImageCropUploadProps = {
  template: Template;

  onCropped: (result: ImageCropUploadResult) => void | Promise<void>;
  onCancel?: () => void;

  /**
   * Validate before opening editor.
   * Return { ok: false, reason } to prevent editing and show message.
   */
  validateFile?: (file: File) => { ok: true } | { ok: false; reason: string };

  accept?: string;          // default: "image/*"
  maxBytes?: number;        // optional file size limit
  webpQuality?: number;     // default: 0.9 (0..1)

  /**
   * Optionally allow editing an existing image.
   * If provided, component should open editor with this image loaded.
   */
  initialImageUrl?: string;

  label?: string;           // dropzone label
  disabled?: boolean;
  className?: string;

  /**
   * If true, the user can choose between templates in the UI.
   * If false, template is fixed from props.
   */
  allowTemplateSwitch?: boolean;

  /**
   * Optional set of presets if allowTemplateSwitch is true.
   */
  templatePresets?: Template[];
};
```

---

## 5. User Stories
- As a user, I can drop a photo and crop it for an avatar (circle).
- As a user, I can zoom, drag, and rotate to get the best framing.
- As a user, I can confirm and the system outputs a WebP file ready to upload.
- As a developer, I can install this component into multiple Inertia projects and get a consistent result, without any app-specific assumptions.

---

## 6. UX and Layout Requirements

### 6.1 Dropzone
- Visual area with:
  - icon
  - short instruction text: “Drop image here or click to browse”
  - accepted formats hint (optional)
- Behaviors:
  - click opens file picker
  - drag enter highlights dropzone
  - drop loads file and opens editor dialog
- Shows validation errors inline (max size, unsupported type, decode failure)

### 6.2 Editor Dialog
Use shadcn `Dialog`.

#### Header
- Title: “Crop image”
- Subtitle: “Drag to reposition. Use sliders to zoom and rotate.”

#### Body
- Main area: **Viewport**
  - Contains the image (interactive)
  - Contains crop overlay (frame + dimming)
- Controls area:
  - Zoom slider (Label + Slider)
  - Rotation slider (Label + Slider)
  - Buttons:
    - Reset (zoom=1, rotation=0, panX=0, panY=0)
    - Optional: rotate -90 / +90

#### Footer
- Cancel button
- OK button
- During export:
  - disable controls + OK
  - show “Processing…”

---

## 7. Crop Template Requirements

### 7.1 Shapes
- **circle**: overlay is circle; crop frame is square in pixel terms
- **square**: 1:1 aspect
- **rect**: arbitrary aspect from template (e.g., 16/9)

### 7.2 Crop Frame Sizing
Crop frame is centered within the viewport and sized to fit comfortably.

Rules:
- It MUST preserve the template aspect ratio.
- It MUST be smaller than viewport by padding (e.g., 24px each side).
- If viewport is responsive, compute crop frame size from current viewport dimensions.

Suggested algorithm:
- Let `pad = 24`.
- Available w/h: `aw = viewportW - 2*pad`, `ah = viewportH - 2*pad`.
- Target aspect: `a = template.aspect ?? 1`.
- If `aw/ah > a`: `cropH = ah`, `cropW = ah * a`
- Else: `cropW = aw`, `cropH = aw / a`

Circle uses aspect=1 for sizing.

### 7.3 Outside Dimming
- Outside crop frame is dimmed with a semi-transparent overlay.
- Use CSS masking or layered divs:
  - Rect: one overlay with `clip-path` or 4 overlay divs around the frame.
  - Circle: overlay with `mask-image: radial-gradient(...)` or SVG mask.

### 7.4 Circle Output
Two modes:
- `circleAlphaOutput=false` (default): output is square WebP; circle only affects UI framing.
- `circleAlphaOutput=true`: output is WebP with alpha where outside the circle is transparent.

---

## 8. Interaction Requirements (Pan / Zoom / Rotation)

### 8.1 Pointer Interaction (Pan)
- Panning uses Pointer Events to support mouse + touch.
- Implement:
  - `onPointerDown`: set dragging, store start pointer and start pan
  - `onPointerMove`: if dragging, update panX/panY
  - `onPointerUp/Cancel`: end dragging
- Apply `touch-action: none;` to viewport to avoid scroll interference while dragging.

### 8.2 Zoom
- Slider controls `zoom` (float)
- Default range:
  - min: 1
  - max: 5
  - step: 0.01 (or 0.05 for simpler)
- Must feel smooth on mobile.

### 8.3 Rotation
- Slider controls degrees:
  - range: -180..180
  - step: 1
- Optional quick buttons:
  - -90° / +90° (clamp or wrap)
- Rotation should be around the image center in the rendered viewport.

### 8.4 Transform Application
The image element is positioned and transformed via CSS transform:

`transform: translate(panX, panY) scale(zoom) rotate(rotationDeg);`  
`transform-origin: center center;`

The transform must match what the exporter uses (WYSIWYG).

---

## 9. Export Requirements (Crop + WebP)

### 9.1 WYSIWYG Export Strategy (Recommended)
To ensure what the user sees is exactly what’s exported (especially with rotation), use a **two-canvas approach**:

1. **Viewport render canvas** (offscreen)
   - Size matches the viewport in device pixels (`cssSize * devicePixelRatio`)
   - Draw the transformed image exactly as displayed
2. **Output canvas**
   - Size equals `template.output.width/height`
   - Copy the crop frame region from viewport canvas
   - Scale it into output canvas
   - Optionally apply circle alpha mask
3. Export output canvas as WebP using `toBlob("image/webp", quality)`

This avoids complex inverse-rotation math and keeps export matched to UI.

### 9.2 Export Steps (Detailed)
Given:
- viewport CSS size: `vwCss`, `vhCss`
- devicePixelRatio: `dpr`
- viewport canvas size: `vw = vwCss*dpr`, `vh = vhCss*dpr`
- crop frame in viewport CSS coords: `{ cxCss, cyCss, cwCss, chCss }` (top-left + size)
- crop frame in viewport canvas coords: `cx = cxCss*dpr` (etc.)

Steps:
1. Decode the image into a drawable source:
   - Prefer `createImageBitmap(file, { imageOrientation: "from-image" })` when available
   - Fallback: HTMLImageElement with ObjectURL
2. Create `viewportCanvas` sized `(vw, vh)` and get `ctx`
3. Clear canvas
4. Draw transformed image:
   - `ctx.save()`
   - `ctx.translate(vw/2, vh/2)`  (center of viewport)
   - `ctx.translate(panX*dpr, panY*dpr)`
   - `ctx.rotate(rotationDeg * Math.PI/180)`
   - `ctx.scale(zoom, zoom)`
   - Draw image centered using a baseScale that matches the UI (see 9.3)
   - `ctx.restore()`
5. Create `outputCanvas` sized `(outW, outH)` and `outCtx`
6. Copy crop frame area from `viewportCanvas` into `outputCanvas` scaled:
   - `outCtx.drawImage(viewportCanvas, cx, cy, cw, ch, 0, 0, outW, outH)`
7. If `shape === "circle"` and `circleAlphaOutput === true`:
   - Apply a circular alpha mask to the output canvas
8. Export:
   - `outputCanvas.toBlob((blob)=>..., "image/webp", webpQuality)`
9. Return result object with Blob + File wrapper

### 9.3 Base Scale Definition (Important)
To ensure the crop frame can be filled without showing empty space by default, use **cover** scaling on load:

- `baseScale = max(vw / imgW, vh / imgH)`

Then the user’s `zoom` multiplies it.

### 9.4 Preventing Empty Areas (Optional Enhancement)
Clamping pan to prevent empty space is significantly harder with rotation.
For v1:
- Allow free panning, and optionally warn if empty pixels appear in the crop.
For v1.1+:
- Add clamping logic (must account for rotation bounds).

---

## 10. Inertia Integration Requirements

### 10.1 Output for Upload
Parent components should upload via `FormData`:

```js
function onCropped({ file }) {
  const fd = new FormData();
  fd.append("image", file);

  // fetch example
  fetch("/upload", { method: "POST", body: fd });

  // or Inertia router example (depends on adapter)
  // router.post("/upload", fd);
}
```

### 10.2 No Routing Assumptions
- The component must not import or call Inertia routing directly.
- It must only emit the cropped result via `onCropped`.

---

## 11. Multi-Project Installability

### 11.1 Packaging Options
Support at least one of these strategies:

#### Option A: Local Shared Package (Recommended)
- Create a private package (monorepo or separate repo) e.g. `@your-org/ui-image-cropper`
- Publish to:
  - private npm registry, **or**
  - GitHub Packages, **or**
  - install via git URL
- Projects install it and import:
  - `import { ImageCropUpload } from "@your-org/ui-image-cropper";`

#### Option B: Copy-in Module
- Provide the component as a small folder `components/ImageCropUpload/`
- Copy into each project
- Keep it dependency-minimal and self-contained

### 11.2 Dependency Policy
- Only require:
  - `react`, `react-dom`
  - shadcn/ui primitives (which projects already have)
- Ensure shadcn imports are configurable:
  - Some projects use `@/components/ui/...`
  - Packaging must allow either:
    - re-exporting shadcn components via adapters, or
    - passing shadcn components in as props, or
    - documenting a required import path convention

**Requirement:** The component must not hardcode project-specific absolute aliases unless documented and adjustable.

### 11.3 Styling
- Use Tailwind utility classes consistent with shadcn patterns.
- Avoid relying on global CSS beyond what shadcn/tailwind already provides.

### 11.4 Files and Entry Points (Suggested)
```
image-crop-upload/
  src/
    ImageCropUpload.jsx
    CropOverlay.jsx
    utils/
      decodeImage.js
      renderViewport.js
      exportWebp.js
    index.js
  package.json
  README.md
```
- Export `ImageCropUpload` from `src/index.js`

---

## 12. Accessibility Requirements
- Dialog must trap focus (shadcn default)
- Buttons and sliders must be keyboard accessible
- Provide labels:
  - Zoom slider: `aria-label="Zoom"`
  - Rotation slider: `aria-label="Rotation"`
- ESC closes dialog (Cancel path)
- Provide visible focus states

---

## 13. Performance & Quality Requirements
- Use `devicePixelRatio` when drawing viewportCanvas to avoid blurry exports
- Avoid re-decoding image on every slider change:
  - decode once per loaded image
  - keep drawable reference in state/ref
- Export should show processing state and avoid double-submits
- Revoke ObjectURLs on cleanup

---

## 14. Validation & Error Handling
### Validation rules (default)
- If `maxBytes` set and `file.size > maxBytes` -> show “File too large”
- If file type not starting with `image/` -> show “Unsupported file type”
- If image cannot be decoded -> show “Could not read image”

### HEIC / iOS photos
- Some browsers may not decode HEIC.
- If decode fails, show:
  - “This image format isn’t supported in your browser. Please upload JPG, PNG, or WebP.”

### EXIF orientation
- Prefer `createImageBitmap(..., { imageOrientation: "from-image" })` when supported
- Ensure exported output matches displayed orientation

---

## 15. State Machine
- `idle`
- `selected` (file chosen)
- `editing` (dialog open)
- `processing` (exporting)
- `done` (onCropped fired)
- `error` (message shown, user can retry)

Transitions:
- idle → selected → editing → processing → done → idle
- editing → idle (cancel)
- selected/editing/processing → error (decode/export failure)

---

## 16. Acceptance Criteria
1. Drag & drop and file browse both work.
2. Editor supports **pan + zoom + rotation** and feels usable on iOS.
3. Overlay accurately reflects selected template shape/aspect.
4. Clicking OK returns:
   - a WebP Blob (`type === "image/webp"`)
   - a File wrapper with correct name/type
   - dimensions exactly equal to `template.output`
5. Export visually matches what the user sees (WYSIWYG), including rotation.
6. Component can be installed into multiple projects with minimal friction and no app-coupling.

---

## 17. Recommended Defaults
- zoom: 1.0
- zoom range: 1..5
- rotation: 0
- rotation range: -180..180
- webpQuality: 0.9
- crop frame padding: 24px
- baseScale on load: `cover` (max of dimension ratios)

---

## 18. Template Examples

### Avatar (circle)
```js
{
  shape: "circle",
  output: { width: 512, height: 512 },
  viewport: { width: 360, height: 360 },
  circleAlphaOutput: false
}
```

### Square thumbnail
```js
{
  shape: "square",
  output: { width: 1024, height: 1024 },
  viewport: { width: 420, height: 420 }
}
```

### Banner (16:9)
```js
{
  shape: "rect",
  aspect: 16/9,
  output: { width: 1600, height: 900 },
  viewport: { width: 520, height: 292 }
}
```

---

## 19. Customization / Appearance API
- Empty state uses shadcn/baseui tokens (accent) by default.
- Consumers can override via `appearance?: { dropzoneBackground?, dropzoneBackgroundActive?, dropzoneBorder?, dropzoneBorderActive?, iconBackground?, iconColor? }`.
- Each property accepts any CSS color (hex, rgb, hsl, CSS var string). Unset keys use the defaults above.

---

## 20. Notes for Implementation Handoff
- The simplest, most reliable exporter is the **viewport-canvas render** approach.
- Keep transforms consistent:
  - the same baseScale math used in UI must be used in viewportCanvas render.
- Avoid exotic CSS masking that differs across browsers; prefer SVG masks or layered overlays.
- Rotation complicates “clamp to avoid empty areas”; treat that as a future enhancement.
