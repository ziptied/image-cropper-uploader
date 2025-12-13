import * as React from "react";

export type IconProps = React.SVGProps<SVGSVGElement> & {
  secondaryFill?: string;
  title?: string;
};

export const CheckUnderline = React.forwardRef<SVGSVGElement, IconProps>(
  function CheckUnderline(
    { fill = "currentColor", secondaryFill, title, ...props },
    ref,
  ) {
    const secondary = secondaryFill ?? fill;
    const strokeWidth = props.strokeWidth ?? 2;
    const resolvedTitle = title ?? "Check";

    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <title>{resolvedTitle}</title>
        <g fill={fill} strokeLinecap="round" strokeLinejoin="round">
          <polyline
            fill="none"
            points="5 11 9 15 19 4"
            stroke={secondary}
            strokeWidth={strokeWidth}
          />
          <line
            fill="none"
            stroke={fill}
            strokeWidth={strokeWidth}
            x1="21"
            x2="3"
            y1="20"
            y2="20"
          />
        </g>
      </svg>
    );
  },
);

export default CheckUnderline;
