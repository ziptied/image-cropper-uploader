import * as React from "react";

export type Size = { width: number; height: number };

const ZERO: Size = { width: 0, height: 0 };

/**
 * Observe an element's rendered size in CSS pixels, or report `fixed` verbatim
 * when the caller pins the size instead.
 */
export function useElementSize(
  ref: React.RefObject<HTMLElement | null>,
  fixed?: Size,
): Size {
  const [size, setSize] = React.useState<Size>(ZERO);

  React.useLayoutEffect(() => {
    if (fixed) {
      setSize({ width: fixed.width, height: fixed.height });
      return;
    }

    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      setSize({ width: rect.width, height: rect.height });
    };

    // The first measure can be 0 while a parent dialog is still laying out.
    update();
    const raf = requestAnimationFrame(update);

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [ref, fixed]);

  return size;
}
