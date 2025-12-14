# Image Crop Upload (React)

A reusable React component for drag-and-drop image selection + modal editing (pan/zoom/rotation) with **WYSIWYG WebP export**.

- No Next.js
- No cropping libraries (Canvas + browser APIs only)
- Designed for React 18 apps (including Inertia pages)

---

## Developer Documentation

### Install

```sh
bun add @ziptied/image-crop-upload
```

Peer deps (your app must already have these):
- `react` `>=18`
- `react-dom` `>=18`

### Basic Usage

```tsx
import { ImageCropUpload, type Template } from "@ziptied/image-crop-upload";

const avatarTemplate: Template = {
  shape: "circle",
  output: { width: 512, height: 512 },
  viewport: { width: 360, height: 360 },
  circleAlphaOutput: false,
};

export function AvatarField() {
  return (
    <ImageCropUpload
      template={avatarTemplate}
      maxBytes={5 * 1024 * 1024}
      onCropped={({ file }) => {
        const fd = new FormData();
        fd.append("image", file);
        // router.post("/upload", fd); // Inertia example (parent decides)
      }}
    />
  );
}
```

### Templates (Crop Guides)

The crop “guide” is driven entirely by the `template` prop.

`template.shape` options:
- `"circle"`: circular guide (internally crops a square region)
- `"square"`: 1:1 guide
- `"rect"`: custom aspect guide using `template.aspect` (width / height)

Common templates:

```ts
// Circle avatar
{
  shape: "circle",
  output: { width: 512, height: 512 },
  viewport: { width: 360, height: 360 },
  circleAlphaOutput: false
}
```

```ts
// Square thumbnail
{
  shape: "square",
  output: { width: 1024, height: 1024 },
  viewport: { width: 420, height: 420 }
}
```

```ts
// 16:9 banner
{
  shape: "rect",
  aspect: 16 / 9,
  output: { width: 1600, height: 900 },
  viewport: { width: 520, height: 292 }
}
```

### Props

`ImageCropUpload` props (high level):
- `template` (required): guide + output sizing.
- `onCropped` (required): receives `{ blob, file, width, height, originalFile, transform, ... }` where `file.type` is `image/webp`.
- `onCancel`: called when the modal closes without exporting.
- `validateFile`: optional pre-validation hook returning `{ ok: true }` or `{ ok: false, reason }`.
- `accept` (default `image/*`): forwarded to the file input.
- `maxBytes`: optional size limit (shows an inline error if exceeded).
- `webpQuality` (default `0.9`): WebP encoder quality `0..1`.
- `initialImageUrl`: optionally open the editor with an existing image.
- `label`: dropzone label text.
- `disabled`, `className`: standard UI controls.
- `allowTemplateSwitch`: lets users choose templates in the modal.
- `templatePresets`: template list used when `allowTemplateSwitch` is enabled.
- `appearance`: optional object for overriding default colors (see below).

### Customization & Theming

The component is designed to pick up shared shadcn/baseui tokens out of the box.  
By default the drop zone and icons use `--accent` for tone and `--muted-foreground` for text.

If you need tighter control, pass the `appearance` prop. All fields are optional:

| Key | Description | Default |
| --- | ----------- | ------- |
| `dropzoneBackground` | Idle background color for the dashed area. | `hsl(var(--accent)/0.08)` |
| `dropzoneBackgroundActive` | Background while a file is dragged over. | `hsl(var(--accent)/0.16)` |
| `dropzoneBorder` | Idle dashed border color. | `hsl(var(--accent)/0.4)` |
| `dropzoneBorderActive` | Border color while dragging. | `hsl(var(--accent)/0.8)` |
| `iconBackground` | Circle background behind the upload/edit glyphs. | `hsl(var(--accent)/0.16)` |
| `iconColor` | Icon foreground color. | `hsl(var(--accent))` |
| `dialogScrimColor` | Modal scrim color. | `rgba(0,0,0,0.6)` |
| `closeButtonColor` | Close button foreground. | `hsl(var(--muted-foreground))` |
| `closeButtonHoverColor` | Close button hover color. | `hsl(var(--foreground))` |
| `toolbarButtonBackground` | Reset/Rotate background. | `rgba(0,0,0,0.35)` |
| `toolbarButtonBorder` | Reset/Rotate border color. | `rgba(255,255,255,0.5)` |
| `toolbarButtonColor` | Reset/Rotate icon color. | `#fff` |
| `confirmButtonClassName` | Extra classes appended to the OK button. | `""` |
| `confirmButtonStyle` | Inline style object for the OK button. | `undefined` |

Example:

```tsx
<ImageCropUpload
  template={avatarTemplate}
  appearance={{
    dropzoneBackground: "rgba(15, 23, 42, 0.04)",
    dropzoneBorder: "rgba(15, 23, 42, 0.35)",
    iconBackground: "rgba(15, 23, 42, 0.08)",
    iconColor: "rgb(15, 23, 42)",
  }}
/>
```

This pattern mirrors other design systems (Radix, shadcn/ui, BaseUI): we rely on the shared palette by default, but expose a small override surface so consumers (and automation/LLMs) can align the component with any design system without forking.  
`confirmButtonClassName` is appended to the default OK button classes, so you can keep the base layout but inject your own tone/variant. `confirmButtonStyle` is applied directly via inline styles for theming systems that prefer CSS variables.

### Styling Notes

This package uses Tailwind utility classes (shadcn-like). Your app should already have Tailwind and CSS variables like `--primary` if you want theme-aware colors.

---

## LLM Documentation (How To Use This Package Without Wasting Time)

Key facts:
- This package exports **one main component**: `ImageCropUpload`, and types like `Template`.
- Optional `appearance` prop controls the empty state, modal scrim, toolbar buttons, and OK button without forking.
- This package **does not ship preset constants** like `avatarTemplate` / `logoTemplate`. Those live in the consuming app.
- If you are changing crop behavior, you almost always only need to change the `template={...}` object at the `ImageCropUpload` call site.
- Do not search `node_modules/@ziptied/image-crop-upload` for `avatarTemplate` (it won’t exist).

Recommended instruction format to an LLM (consumer app):

1) Find the `ImageCropUpload` usage for the target field (e.g. “logo image”).  
2) Add/update a local `const avatarTemplate: Template = { shape: "circle", output: { width: 512, height: 512 }, viewport: { width: 360, height: 360 }, circleAlphaOutput: false }`.  
3) Replace `template={logoUploadTemplate}` with `template={avatarTemplate}`.  
4) Need branded drop zone / scrim / OK button? Pass `appearance={{ dropzoneBackground: "hsl(var(--primary)/0.1)", dialogScrimColor: "rgba(9,9,11,0.7)", confirmButtonClassName: "bg-emerald-600 hover:bg-emerald-500" }}` (no fork required).  
5) Don’t modify this package unless the behavior is missing/buggy.

---

## Dev (This Repo)

```sh
bun install
bun run build
bun run typecheck
bun lint
```
