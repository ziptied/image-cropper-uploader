import * as React from "react";

export type IconProps = React.SVGProps<SVGSVGElement> & {
  /**
   * Optional second stroke color for multi-tone icons.
   * Defaults to `fill` (which defaults to `currentColor`).
   */
  secondaryFill?: string;
  title?: string;
};

export const ShareLeft4 = React.forwardRef<SVGSVGElement, IconProps>(
  function ShareLeft4(
    { fill = "currentColor", secondaryFill, title, ...props },
    ref,
  ) {
    const secondary = secondaryFill ?? fill;
    const strokeWidth = props.strokeWidth ?? 1.5;
    const resolvedTitle = title ?? "Share left";

    return (
      <svg
        ref={ref}
        viewBox="0 0 18 18"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <title>{resolvedTitle}</title>
        <g fill={fill}>
          <path
            d="M15.25,10.75v2.5c0,1.105-.895,2-2,2H2.75"
            fill="none"
            stroke={fill}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <path
            d="M3,6H7c2.347,0,4.25,1.903,4.25,4.25h0"
            fill="none"
            stroke={secondary}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
          <polyline
            fill="none"
            points="6 2.75 2.75 6 6 9.25"
            stroke={secondary}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={strokeWidth}
          />
        </g>
      </svg>
    );
  },
);

export default ShareLeft4;
