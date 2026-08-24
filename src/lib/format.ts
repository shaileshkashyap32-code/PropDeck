// ─── Formatting helpers ─────────────────────────────────────────────────────

/**
 * Indian price shorthand: ₹1.4Cr, ₹85L. Values at/above ₹1Cr show one decimal
 * in crore; below that, whole lakh. The sub-lakh fallback never triggers on
 * real listings but keeps the output sane for any input.
 *
 * Home's budget slider has its own formatter (it also renders an "8Cr+" cap),
 * so it deliberately doesn't use this one.
 */
export function formatPrice(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`
  if (n >= 100000) return `₹${(n / 100000).toFixed(0)}L`
  return `₹${n}`
}

/**
 * Per-sqft rate with Indian digit grouping, e.g. "₹13,000/sqft". Rounded to a
 * clean ₹100 step so derived rates (price ÷ area) don't show noisy figures.
 */
export function formatRate(n: number): string {
  return `₹${(Math.round(n / 100) * 100).toLocaleString('en-IN')}/sqft`
}
