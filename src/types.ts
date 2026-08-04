import type { ReactNode } from "react";

/** `avatar` is a circular crop (ratio is forced to 1). */
export type CropShape = "rect" | "avatar";

export type ThemeRadius = "none" | "sm" | "full";

export type CropConfig = {
  /**
   * width / height. Defaults to `output.width / output.height`, so the crop
   * frame always matches the file you get out. Ignored (forced to 1) when
   * `shape` is `"avatar"`.
   */
  ratio?: number;
  /** Default `"rect"`. */
  shape?: CropShape;
  output: { width: number; height: number };
  /** How the image is sized when it first loads. Default `"cover"`. */
  fit?: "cover" | "contain";
  /** Painted where the image doesn't cover the crop frame. Default `"transparent"`. */
  background?: string;
  /**
   * Pintura's `imageCropLimitToImage`. When true the image can never be panned
   * or zoomed away from the crop frame. When false you can crop outside the
   * image and the gap is filled with `background`.
   *
   * Defaults to `fit === "cover"` — `contain` starts letterboxed, so clamping
   * it would immediately contradict the initial fit.
   */
  limitToImage?: boolean;
  /** Avatar only: bake the circular mask into the WebP's alpha. Default true. */
  alphaMask?: boolean;
  /** Fixed viewport size in px. Omit for a responsive viewport. */
  viewport?: { width: number; height: number };
};

export type RatioPreset = {
  label: string;
  ratio: number;
  shape?: CropShape;
};

export type Transform = {
  zoom: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  panX: number;
  panY: number;
};

export type CropResult = {
  blob: Blob;
  file: File;
  fileName: string;
  mimeType: "image/webp";
  width: number;
  height: number;
  originalFile: File;
  transform: Transform;
};

export type Theme = {
  /** Base colour. Any CSS colour. Every other tone is derived from it. */
  color?: string;
  radius?: ThemeRadius;
  /**
   * Text/icon colour drawn on top of `color`. Defaults to white; override only
   * when your accent needs a different foreground.
   */
  foreground?: string;
  /**
   * Light/dark appearance. Default `"auto"`, which inherits the page's
   * `color-scheme` — set one on `:root` and the editor follows it.
   *
   * Set this explicitly only if your app themes itself with a class or data
   * attribute and does *not* set `color-scheme`, since there is then nothing
   * for the editor to inherit.
   */
  scheme?: "auto" | "light" | "dark";
};

export type Labels = {
  title: string;
  description: string;
  zoom: string;
  rotation: string;
  confirm: string;
  processing: string;
  cancel: string;
  reset: string;
  rotateLeft: string;
  rotateRight: string;
  flipHorizontal: string;
  flipVertical: string;
  ratio: string;
  dropzone: string;
  dropzoneHint: string;
  dropzoneDrag: string;
  editExisting: string;
  removeExisting: string;
  close: string;
};

/** Imperative handle so a consumer's own dialog footer can drive the editor. */
export type ImageCropperHandle = {
  export: () => Promise<void>;
  reset: () => void;
};

export type ImageCropperProps = {
  /** A `File`/`Blob` to edit, or a URL string. */
  image: File | Blob | string;
  crop: CropConfig;
  /** Renders a ratio picker when more than one entry is given. */
  presets?: RatioPreset[];
  theme?: Theme;
  /** WebP quality, 0–1. Default 0.9. */
  quality?: number;
  /**
   * Optional byte budget for the exported WebP. When set, export retries at
   * lower quality before returning.
   */
  maxOutputBytes?: number;
  /** Lowest quality to try when `maxOutputBytes` requires compression. */
  minQuality?: number;
  labels?: Partial<Labels>;
  className?: string;
  /** Hide the built-in confirm/cancel row and drive the editor via its ref. */
  hideFooter?: boolean;
  onExport: (result: CropResult) => void | Promise<void>;
  onCancel?: () => void;
  onError?: (error: Error) => void;
};

export type ImageCropUploadProps = {
  crop: CropConfig;
  onCropped: (result: CropResult) => void | Promise<void>;
  onCancel?: () => void;
  presets?: RatioPreset[];
  theme?: Theme;
  quality?: number;
  maxOutputBytes?: number;
  minQuality?: number;
  labels?: Partial<Labels>;
  validateFile?: (file: File) => { ok: true } | { ok: false; reason: string };
  accept?: string;
  maxBytes?: number;
  /** Shows an "edit existing" affordance that loads this URL into the editor. */
  initialImageUrl?: string;
  /** Optional app-owned remove action shown alongside the edit-existing action. */
  onRemoveExisting?: () => void;
  disabled?: boolean;
  className?: string;
  /** Replaces the default dropzone body. */
  children?: ReactNode;
};
