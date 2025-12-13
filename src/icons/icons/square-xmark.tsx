import * as React from "react";

export type IconProps = React.SVGProps<SVGSVGElement> & {
  secondaryFill?: string;
  title?: string;
};

export const SquareXmark = React.forwardRef<SVGSVGElement, IconProps>(
  function SquareXmark(
    { fill = "currentColor", secondaryFill, title, ...props },
    ref,
  ) {
    const secondary = secondaryFill ?? fill;
    const strokeWidth = props.strokeWidth ?? 1.5;
    const resolvedTitle = title ?? "Close";

    return (
      <svg
        ref={ref}
        viewBox="0 0 18 18"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <title>{resolvedTitle}</title>
        <g fill={fill}>
          <rect
            height="12.5"
            width="12.5"
            fill="none"
            rx="2"
            ry="2"
            stroke={fill}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x="2.75"
            y="2.75"
          />
          <line
            fill="none"
            stroke={secondary}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="6.25"
            x2="11.75"
            y1="6.25"
            y2="11.75"
          />
          <line
            fill="none"
            stroke={secondary}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
            x1="11.75"
            x2="6.25"
            y1="6.25"
            y2="11.75"
          />
        </g>
      </svg>
    );
  },
);

export default SquareXmark;
