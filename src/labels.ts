import type { Labels } from "./types";

/**
 * Lives outside the component files so Fast Refresh can preserve editor state
 * when either of them changes.
 */
export const DEFAULT_LABELS: Labels = {
  title: "Adjust image",
  description: "Drag to reposition. Scroll or pinch to zoom.",
  zoom: "Zoom",
  rotation: "Rotation",
  confirm: "Done",
  processing: "Processing…",
  cancel: "Cancel",
  reset: "Reset",
  rotateLeft: "Rotate 90° left",
  rotateRight: "Rotate 90° right",
  flipHorizontal: "Flip horizontal",
  flipVertical: "Flip vertical",
  ratio: "Ratio",
  dropzone: "Choose a file to upload",
  dropzoneHint: "PNG, JPG or WebP",
  dropzoneDrag: "or drag and drop",
  editExisting: "Edit existing image",
  removeExisting: "Remove existing image",
  close: "Close",
};
