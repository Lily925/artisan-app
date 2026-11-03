import { Link } from "react-router-dom";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { artisanInfo } from "../artisanInfo";
import { productPath } from "../paths";
import ProductImage from "./ProductImage";
import { RatingBadge } from "./StarRating";

export default function ProductCard({
  product, nameMn, nameEn, lang, isSaved, onToggleSave, price,
  certifiedLabel, wishlistAddLabel, wishlistRemoveLabel, ratingAria, isOwn = false,
}) {
  const primaryName = lang === "mn" ? nameMn : nameEn;
  const secondaryName = lang === "mn" ? nameEn : nameMn;
  const fullTitle = primaryName === secondaryName ? primaryName : `${primaryName} (${secondaryName})`;
  const artisanName = artisanInfo(product.artisan).displayName;
  const likeCount = product.likeCount || 0;
  const href = productPath(product.id);

  return (
    <div className="a-product-card">
      <div style={{ position:"relative", paddingBottom:"100%", background:COLORS.bgSoft }}>
        <Link to={href} className="a-card-link" aria-label={fullTitle}>
          <ProductImage src={product.images?.[0]} alt={fullTitle} />
        </Link>
        {!isOwn && <button
          type="button"
          className="a-wishlist-btn"
          aria-label={`${isSaved ? wishlistRemoveLabel : wishlistAddLabel} (${likeCount})`}
          aria-pressed={isSaved}
          onClick={(e) => { e.stopPropagation(); onToggleSave(product.id, e); }}
        >
          <span aria-hidden="true">{isSaved ? "❤️" : "🤍"}</span>
          {likeCount > 0 && <span aria-hidden="true" className="a-like-count">{likeCount}</span>}
        </button>}
        {product.artisan?.certified && <span className="a-badge-certified">✓ {certifiedLabel}</span>}
      </div>

      <Link to={href} className="a-card-link" style={{ padding:"14px 14px 16px", display:"flex", flexDirection:"column", gap:4, flex:1 }}>
        <span style={{ fontFamily:FONT_SERIF, fontSize:17, fontWeight:600, color:COLORS.ink, lineHeight:1.3 }}>{primaryName}</span>
        {secondaryName !== primaryName && (
          <span style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, fontStyle:"italic" }}>{secondaryName}</span>
        )}
        <span style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:4 }}>{artisanName}</span>
        <RatingBadge avg={product.ratingAvg} count={product.ratingCount} aria={ratingAria} />
        <span style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:8 }}>
          <span style={{ fontFamily:FONT_SANS, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, color:COLORS.accentDark, background:COLORS.accentSoft, padding:"3px 8px", borderRadius:2 }}>
            Basic
          </span>
          <span style={{ fontFamily:FONT_SERIF, fontSize:18, fontWeight:700, color:COLORS.ink }}>{price}</span>
        </span>
      </Link>
    </div>
  );
}
