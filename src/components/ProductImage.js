import { useState } from "react";
import { COLORS } from "../theme";
import { assetUrl } from "../api";

// One product photo (pass a product's cover, images[0], for cards/cart/orders). Fills its
// parent (give the parent a size), lazy-loads unless `eager`, and falls back to a neutral
// placeholder (soft box + picture icon) when there's no photo or it fails to load.
export default function ProductImage({ src, alt = "", eager = false, fit = "cover", style }) {
  const [failed, setFailed] = useState(false);
  const url = assetUrl(src);
  const box = { position:"absolute", inset:0, width:"100%", height:"100%" };

  if (!url || failed) {
    return (
      <span role="img" aria-label={alt || undefined} aria-hidden={alt ? undefined : true}
        style={{ ...box, display:"flex", alignItems:"center", justifyContent:"center", background:`linear-gradient(135deg, ${COLORS.card}, ${COLORS.bgSoft})`, ...style }}>
        <svg viewBox="0 0 24 24" width="30%" height="30%" style={{ maxWidth:56, maxHeight:56 }} fill="none" stroke={COLORS.accentDark} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" opacity="0.55">
          <rect x="3" y="4" width="18" height="16" rx="1.5" />
          <circle cx="9" cy="10" r="1.8" />
          <path d="M3.5 18l5.5-5.5 4 4 3-3 4.5 4.5" />
        </svg>
      </span>
    );
  }
  return (
    <img src={url} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)}
      style={{ ...box, objectFit:fit, display:"block", ...style }} />
  );
}
