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

### Styling Notes

This package uses Tailwind utility classes (shadcn-like). Your app should already have Tailwind and CSS variables like `--primary` if you want theme-aware colors.

---

## LLM Documentation (How To Use This Package Without Wasting Time)

Key facts:
- This package exports **one main component**: `ImageCropUpload`, and types like `Template`.
- This package **does not ship preset constants** like `avatarTemplate` / `logoTemplate`. Those live in the consuming app.
- If you are changing crop behavior, you almost always only need to change the `template={...}` object at the `ImageCropUpload` call site.
- Do not search `node_modules/@ziptied/image-crop-upload` for `avatarTemplate` (it won’t exist).

Recommended instruction format to an LLM (consumer app):

1) Find the `ImageCropUpload` usage for the target field (e.g. “logo image”).  
2) Add/update a local `const avatarTemplate: Template = { shape: "circle", output: { width: 512, height: 512 }, viewport: { width: 360, height: 360 }, circleAlphaOutput: false }`.  
3) Replace `template={logoUploadTemplate}` with `template={avatarTemplate}`.  
4) Don’t modify this package unless the behavior is missing/buggy.

---

## Dev (This Repo)

```sh
bun install
bun run build
bun run typecheck
bun lint
```
