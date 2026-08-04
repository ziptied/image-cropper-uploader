import * as React from "react";

export type IconProps = React.SVGProps<SVGSVGElement> & {
  title?: string;
};

export const Trash2 = React.forwardRef<SVGSVGElement, IconProps>(
  function Trash2({ fill = "none", title, ...props }, ref) {
    const resolvedTitle = title ?? "Remove";

    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <title>{resolvedTitle}</title>
        <g
          fill={fill}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={props.strokeWidth ?? 2}
        >
          <path d="M3 6h18" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <path d="M19 6l-1 14c-.1 1.1-1 2-2.1 2H8.1c-1.1 0-2-.9-2.1-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </g>
      </svg>
    );
  },
);

export default Trash2;
