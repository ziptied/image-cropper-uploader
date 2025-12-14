export type CropShape = "circle" | "square" | "rect";

export type Template = {
  shape: CropShape;
  aspect?: number;
  output: {
    width: number;
    height: number;
  };
  viewport?: {
    width: number;
    height: number;
  };
  circleAlphaOutput?: boolean;
};

export type ImageCropUploadResult = {
  blob: Blob;
  file: File;
  fileName: string;
  mimeType: "image/webp";
  width: number;
  height: number;
  originalFile: File;
  transform: {
    zoom: number;
    rotation: number;
    panX: number;
    panY: number;
  };
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type ImageCropUploadAppearance = {
  dropzoneBackground?: string;
  dropzoneBackgroundActive?: string;
  dropzoneBorder?: string;
  dropzoneBorderActive?: string;
  iconBackground?: string;
  iconColor?: string;
};

export type ImageCropUploadProps = {
  template: Template;
  onCropped: (result: ImageCropUploadResult) => void | Promise<void>;
  onCancel?: () => void;
  validateFile?: (file: File) => { ok: true } | { ok: false; reason: string };
  accept?: string;
  maxBytes?: number;
  webpQuality?: number;
  initialImageUrl?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  allowTemplateSwitch?: boolean;
  templatePresets?: Template[];
  appearance?: ImageCropUploadAppearance;
};
