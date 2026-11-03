import { COLORS, FONT_SANS } from "../theme";

// Five stars, filled up to the (rounded) value. Decorative: give the meaning as text nearby.
export function Stars({ value, size = 15 }) {
  const filled = Math.round(value);
  return (
    <span aria-hidden="true" style={{ fontSize:size, letterSpacing:1, lineHeight:1, whiteSpace:"nowrap" }}>
      <span style={{ color:COLORS.accentDark }}>{"★".repeat(filled)}</span>
      <span style={{ color:COLORS.border }}>{"★".repeat(5 - filled)}</span>
    </span>
  );
}

// "★ 4.5 (12)" for product cards, the product page and the shop page. Nothing without reviews.
export function RatingBadge({ avg, count, aria, size = 12, style }) {
  if (!count) return null;
  const shown = Number(avg).toFixed(1);
  return (
    <span role="img" aria-label={aria(shown, count)} style={{ display:"inline-flex", alignItems:"center", gap:4, fontFamily:FONT_SANS, fontSize:size, fontWeight:700, color:COLORS.ink, ...style }}>
      <span aria-hidden="true" style={{ color:COLORS.accentDark }}>★</span>
      <span aria-hidden="true">{shown}</span>
      <span aria-hidden="true" style={{ fontWeight:400, color:COLORS.inkSoft }}>({count})</span>
    </span>
  );
}
