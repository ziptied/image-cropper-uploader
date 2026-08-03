import * as React from "react";

import type { IconProps } from "./rotate-obj-clockwise";

export const RotateObjAnticlockwise = React.forwardRef<
  SVGSVGElement,
  IconProps
>(function RotateObjAnticlockwise(
  { fill = "currentColor", secondaryFill, title, ...props },
  ref,
) {
  const secondary = secondaryFill ?? fill;
  const strokeWidth = props.strokeWidth ?? 1.5;

  return (
    <svg
      ref={ref}
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>{title ?? "Rotate counter-clockwise"}</title>
      <g fill={fill}>
        <path
          d="M5.25 15.25H9.75C10.5784 15.25 11.25 14.5784 11.25 13.75V9.25C11.25 8.42157 10.5784 7.75 9.75 7.75L5.25 7.75C4.42157 7.75 3.75 8.42157 3.75 9.25L3.75 13.75C3.75 14.5784 4.42157 15.25 5.25 15.25Z"
          fill={secondary}
          fillOpacity="0.3"
          stroke="none"
        />
        <path
          d="M5.25 15.25H9.75C10.5784 15.25 11.25 14.5784 11.25 13.75V9.25C11.25 8.42157 10.5784 7.75 9.75 7.75L5.25 7.75C4.42157 7.75 3.75 8.42157 3.75 9.25L3.75 13.75C3.75 14.5784 4.42157 15.25 5.25 15.25Z"
          fill="none"
          stroke={fill}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <path
          d="M15.75 7.25C15.75 5.041 13.959 3.25 11.75 3.25H9.5"
          fill="none"
          stroke={fill}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
        <path
          d="M11.75 1L9.5 3.25L11.75 5.5"
          fill="none"
          stroke={fill}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
        />
      </g>
    </svg>
  );
});

export default RotateObjAnticlockwise;
