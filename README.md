# Image Cropper Uploader (React)

Reusable `ImageCropUpload` component that provides:
- drag & drop + file picker
- pan / zoom / rotation editing in a modal
- client-side WYSIWYG export to `image/webp`

This repo intentionally contains **no Next.js** and **no cropping libraries**.

## Install

```sh
bun add @ziptied/image-cropper-uploader
```

## Usage

```tsx
import { ImageCropUpload } from "@ziptied/image-cropper-uploader";

export function AvatarField() {
  return (
    <ImageCropUpload
      template={{
        shape: "circle",
        output: { width: 512, height: 512 },
        viewport: { width: 360, height: 360 },
        circleAlphaOutput: false,
      }}
      onCropped={({ file }) => {
        const fd = new FormData();
        fd.append("image", file);
        // router.post("/upload", fd); // Inertia example (parent decides)
      }}
      maxBytes={5 * 1024 * 1024}
    />
  );
}
```

## Dev

```sh
bun install
bun run build
bun run typecheck
bun lint
```

## Notes
- Styling uses Tailwind utility classes (shadcn-like). Your project needs Tailwind set up.
- `initialImageUrl` expects the image URL to be fetchable (so the component can provide a real `originalFile` in the result).
