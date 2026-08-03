import * as React from "react";

import type { Transform } from "./types";
import { clamp } from "./utils/clamp";

export type CropGestureInput = {
  viewportRef: React.RefObject<HTMLElement | null>;
  viewport: { width: number; height: number };
  /** The *clamped* pan/zoom currently on screen — gestures must seed from this. */
  view: { pan: { x: number; y: number }; zoom: number; minZoom: number };
  maxZoom: number;
  enabled: boolean;
  setTransform: React.Dispatch<React.SetStateAction<Transform>>;
};

export type CropGestures = {
  isDragging: boolean;
  /** Zoom around a point relative to the viewport centre. Defaults to centre. */
  setZoomAt: (zoom: number, anchorX?: number, anchorY?: number) => void;
  handlers: Pick<
    React.DOMAttributes<HTMLElement>,
    "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel"
  >;
};

type Gesture = {
  x: number;
  y: number;
  panX: number;
  panY: number;
  distance: number;
  zoom: number;
};

/**
 * Drag to pan, two fingers to pinch-zoom, wheel to zoom at the cursor.
 *
 * Pointer Events are used directly (rather than mouse + touch) so pinch and
 * drag share one code path and `setPointerCapture` keeps a drag alive when the
 * cursor leaves the viewport.
 */
export function useCropGestures({
  viewportRef,
  viewport,
  view,
  maxZoom,
  enabled,
  setTransform,
}: CropGestureInput): CropGestures {
  // Pointer id -> current position. Two entries means a pinch.
  // `useState` with an initializer allocates the Map once; `useRef(new Map())`
  // would rebuild and discard one on every render.
  const [pointers] = React.useState(
    () => new Map<number, { x: number; y: number }>(),
  );
  const gestureRef = React.useRef<Gesture | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const setZoomAt = React.useCallback(
    (nextZoom: number, anchorX = 0, anchorY = 0) => {
      setTransform((prev) => {
        if (prev.zoom <= 0) return { ...prev, zoom: nextZoom };
        const k = nextZoom / prev.zoom;
        return {
          ...prev,
          zoom: nextZoom,
          panX: anchorX + (prev.panX - anchorX) * k,
          panY: anchorY + (prev.panY - anchorY) * k,
        };
      });
    },
    [setTransform],
  );

  /** Anchor coordinates are relative to the viewport centre, matching `pan`. */
  const toAnchor = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: clientX - rect.left - viewport.width / 2,
        y: clientY - rect.top - viewport.height / 2,
      };
    },
    [viewportRef, viewport.width, viewport.height],
  );

  const beginGesture = React.useCallback(() => {
    const [a, b] = [...pointers.values()];
    if (!a) {
      gestureRef.current = null;
      return;
    }

    gestureRef.current = {
      x: b ? (a.x + b.x) / 2 : a.x,
      y: b ? (a.y + b.y) / 2 : a.y,
      // Seed from the *clamped* pan, otherwise a drag that hit the edge would
      // feel dead until the raw value wandered back into range.
      panX: view.pan.x,
      panY: view.pan.y,
      distance: b ? Math.hypot(a.x - b.x, a.y - b.y) : 0,
      zoom: view.zoom,
    };
  }, [pointers, view.pan.x, view.pan.y, view.zoom]);

  function onPointerDown(event: React.PointerEvent) {
    if (!enabled) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setIsDragging(true);
    beginGesture();
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const start = gestureRef.current;
    if (!start || !enabled) return;

    const [a, b] = [...pointers.values()];
    if (!a) return;

    const cx = b ? (a.x + b.x) / 2 : a.x;
    const cy = b ? (a.y + b.y) / 2 : a.y;

    if (b && start.distance > 0) {
      const k = Math.hypot(a.x - b.x, a.y - b.y) / start.distance;
      const anchor = toAnchor(start.x, start.y);
      setTransform((prev) => ({
        ...prev,
        zoom: start.zoom * k,
        panX: anchor.x + (start.panX - anchor.x) * k + (cx - start.x),
        panY: anchor.y + (start.panY - anchor.y) * k + (cy - start.y),
      }));
      return;
    }

    setTransform((prev) => ({
      ...prev,
      panX: start.panX + (cx - start.x),
      panY: start.panY + (cy - start.y),
    }));
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!pointers.delete(event.pointerId)) return;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);

    if (pointers.size === 0) {
      gestureRef.current = null;
      setIsDragging(false);
      return;
    }
    // Lifting one finger of a pinch: re-seed so the remaining finger keeps panning.
    beginGesture();
  }

  // Read inside the wheel listener so it doesn't re-attach on every zoom tick.
  // Written after commit, never during render — React may discard a render, and
  // a mutation from one that never commits would leak into the next gesture.
  const boundsRef = React.useRef({ zoom: 1, min: 1, max: 5 });
  React.useEffect(() => {
    boundsRef.current = { zoom: view.zoom, min: view.minZoom, max: maxZoom };
  }, [view.zoom, view.minZoom, maxZoom]);

  // React's onWheel is passive, so `preventDefault` needs a native listener.
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el || !enabled) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const anchor = toAnchor(event.clientX, event.clientY);
      const bounds = boundsRef.current;
      const next = bounds.zoom * Math.exp(-event.deltaY / 300);
      setZoomAt(clamp(next, bounds.min, bounds.max), anchor.x, anchor.y);
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [viewportRef, enabled, toAnchor, setZoomAt]);

  return {
    isDragging,
    setZoomAt,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
