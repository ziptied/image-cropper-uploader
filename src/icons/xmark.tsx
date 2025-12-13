import * as React from "react";

export type IconProps = React.SVGProps<SVGSVGElement> & {
  secondaryFill?: string;
  title?: string;
};

export const Xmark = React.forwardRef<SVGSVGElement, IconProps>(function Xmark(
  { fill = "currentColor", secondaryFill, title, ...props },
  ref,
) {
  const secondary = secondaryFill ?? fill;
  const strokeWidth = props.strokeWidth ?? 2;
  const resolvedTitle = title ?? "Close";

  return (
    <svg
      ref={ref}
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>{resolvedTitle}</title>
      <g fill={fill}>
        <line
          fill="none"
          stroke={secondary}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          x1="5"
          x2="15"
          y1="5"
          y2="15"
        />
        <line
          fill="none"
          stroke={fill}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          x1="5"
          x2="15"
          y1="15"
          y2="5"
        />
      </g>
    </svg>
  );
});

export default Xmark;
