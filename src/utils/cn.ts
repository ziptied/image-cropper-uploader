/**
 * Tiny `className` helper.
 * Keeps this package dependency-free (no clsx/twMerge).
 */
export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
