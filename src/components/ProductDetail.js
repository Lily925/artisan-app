import { useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { materialsByCat } from "../data";
import { artisanInfo } from "../artisanInfo";
import InstagramIcon from "./InstagramIcon";
import ArtisanAvatar from "./ArtisanAvatar";
import ProductGallery from "./ProductGallery";
import { bonusText, offeredTiers } from "../tiers";

const TIER_DISPLAY = { basic: "Basic", story: "Story", patron: "Patron" };

export default function ProductDetail({ lang, t, selected, savedItems, toggleSave, addToCart, fmtAmt, navigate, openStorefront, openArtisanProfile, currentUserId, onEdit, onDelete }) {
  const [selectedTier, setSelectedTier] = useState("basic");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const d = t.detailPage;
  const ap = t.addProduct;
  // Only the artisan who owns this product gets Edit/Delete (the API enforces this too).
  const isOwner = Boolean(currentUserId) && selected.artisan?.user?._id === currentUserId;
  const isSaved = savedItems.includes(selected.id);
  const likeCount = selected.likeCount || 0;
  // The product's own description wins; the generic per-category text is only a fallback
  // (it can be wrong for a specific piece, e.g. "sterling silver" on a beaded necklace).
  const description = selected.description?.trim() || "";
  const materials = materialsByCat[selected.category]?.[lang] || materialsByCat.crafts[lang];
  const categoryLabel = t.productCategories.find((c) => c.key === selected.category)?.label || selected.category;
  const { ownerName, shopName, displayName, instagramHandle, instagramUrl, contactInfo, photoUrl: shopPhotoUrl, avatarUrl } = artisanInfo(selected.artisan);
  const primaryName = lang === "mn" ? selected.title : selected.titleEn || selected.title;

  const tiers = offeredTiers(selected);
  // A tier picked on another product may not be offered here (no Patron bonus).
  const tier = tiers.includes(selectedTier) ? selectedTier : "basic";
  const tierPrice = (key) => selected.pricingTiers[key].price;
  const selectedTierPrice = fmtAmt(tierPrice(tier));
  const tierText = (key) => (key === "patron" ? t.tierText.patron(bonusText(selected.patronBonus, lang)) : t.tierText[key]);

  const handleAddToCart = () => {
    addToCart(selected.id, tier, 1);
  };

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page">
        <div className="a-breadcrumb">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate("shop"); }}>{d.breadcrumbShop}</a>
          {" / "}{categoryLabel}{" / "}
          <span style={{ color:COLORS.ink }}>{primaryName}</span>
        </div>

        <div className="a-two-col">
          <ProductGallery images={selected.images} name={primaryName} labels={d} />

          <div>
            {isOwner && (
              <div className="a-callout" style={{ marginBottom:20 }}>
                {!confirmingDelete ? (
                  <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                    <span style={{ fontFamily:FONT_SANS, fontSize:13, fontWeight:700, color:COLORS.ink }}>{ap.yourProduct}</span>
                    <div style={{ display:"flex", gap:8 }}>
                      <button type="button" className="a-btn-outline" style={{ padding:"8px 16px", minHeight:40 }} onClick={() => onEdit(selected)}>{ap.edit}</button>
                      <button type="button" className="a-btn-outline" style={{ padding:"8px 16px", minHeight:40, color:"#B3261E", borderColor:"#B3261E" }} onClick={() => setConfirmingDelete(true)}>{ap.delete}</button>
                    </div>
                  </div>
                ) : (
                  <div role="alertdialog" aria-labelledby="pd-delete-q">
                    <div id="pd-delete-q" style={{ fontFamily:FONT_SANS, fontSize:13, fontWeight:700, color:COLORS.ink, marginBottom:10 }}>{ap.deleteConfirm}</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button type="button" className="a-btn-primary" style={{ padding:"8px 16px", minHeight:40, background:"#B3261E", color:"#fff" }} disabled={deleting}
                        onClick={() => { setDeleting(true); onDelete(selected).finally(() => setDeleting(false)); }}>
                        {deleting ? ap.deleting : ap.deleteYes}
                      </button>
                      <button type="button" className="a-btn-outline" style={{ padding:"8px 16px", minHeight:40 }} disabled={deleting} onClick={() => setConfirmingDelete(false)} autoFocus>
                        {ap.cancel}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", color:COLORS.accentDark, marginBottom:8 }}>
              {categoryLabel}
            </div>
            <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, lineHeight:1.2, marginBottom:16 }}>
              {primaryName}
            </h1>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom: instagramUrl || contactInfo ? 10 : 18 }}>
              <ArtisanAvatar name={displayName} photoUrl={avatarUrl || shopPhotoUrl} size={32} />
              {shopName ? (
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", minWidth:0 }}>
                  <button type="button" className="a-shop-link" onClick={() => openStorefront(selected.artisan)}
                    aria-label={t.storefront.visit(displayName)}
                    style={{ fontFamily:FONT_SERIF, fontSize:17, fontWeight:600, overflowWrap:"anywhere" }}>
                    {shopName}
                  </button>
                  {ownerName && (
                    <button type="button" className="a-shop-link" onClick={() => openArtisanProfile(selected.artisan)}
                      aria-label={t.artisanProfile.view(ownerName)}
                      style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>
                      {t.byArtisan(ownerName)}
                    </button>
                  )}
                </div>
              ) : (
                <button type="button" className="a-shop-link" onClick={() => openStorefront(selected.artisan)}
                  aria-label={t.storefront.visit(displayName)}
                  style={{ fontFamily:FONT_SANS, fontSize:13 }}>
                  {t.byArtisan(ownerName)}
                </button>
              )}
              {selected.artisan?.certified && (
                <span style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, color:COLORS.accentDark, background:COLORS.accentSoft, padding:"3px 8px", borderRadius:2 }}>
                  ✓ {t.homePage.certified}
                </span>
              )}
            </div>
            {(instagramUrl || contactInfo) && (
              <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:"6px 14px", marginBottom:18, marginLeft:42 }}>
                {instagramUrl && (
                  <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label={`@${instagramHandle} on Instagram`}
                    style={{ display:"inline-flex", alignItems:"center", gap:6, fontFamily:FONT_SANS, fontSize:13, fontWeight:600, color:COLORS.accentDark, textDecoration:"none" }}>
                    <InstagramIcon />@{instagramHandle}
                  </a>
                )}
                {contactInfo && <span style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>{contactInfo}</span>}
              </div>
            )}

            <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.ink, lineHeight:1.7, marginBottom:24, whiteSpace:"pre-line" }}>
              {description || materials}
            </p>

            <div style={{ marginBottom:20 }}>
              <div className="a-label">{d.tierSectionTitle}</div>
              <div style={{ display:"grid", gridTemplateColumns:`repeat(${tiers.length},1fr)`, gap:10 }}>
                {tiers.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`a-tier-card${tier === key ? " selected" : ""}`}
                    aria-pressed={tier === key}
                    onClick={() => setSelectedTier(key)}
                  >
                    <div style={{ fontWeight:700, fontSize:13, color:COLORS.ink, marginBottom:2 }}>{TIER_DISPLAY[key]}</div>
                    <div style={{ fontWeight:700, fontSize:15, color:COLORS.ink, marginBottom:4 }}>{fmtAmt(tierPrice(key))}</div>
                    <div style={{ fontSize:11, color:COLORS.inkSoft, lineHeight:1.4, overflowWrap:"anywhere" }}>{tierText(key)}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", gap:10, marginBottom:20 }}>
              <button type="button" className="a-btn-primary" style={{ flex:1 }} onClick={handleAddToCart}>
                {d.addToCart(selectedTierPrice)}
              </button>
              <button
                type="button"
                className="a-icon-only-btn"
                aria-label={`${isSaved ? t.homePage.wishlistRemove : t.homePage.wishlistAdd} (${likeCount})`}
                aria-pressed={isSaved}
                onClick={(e) => toggleSave(selected.id, e)}
                style={likeCount > 0 ? { width:"auto", padding:"0 14px", gap:6 } : undefined}
              >
                <span aria-hidden="true">{isSaved ? "❤️" : "🤍"}</span>
                {likeCount > 0 && <span aria-hidden="true" className="a-like-count">{likeCount}</span>}
              </button>
            </div>

            <div className="a-callout" style={{ marginBottom:24 }}>
              <div style={{ fontFamily:FONT_SANS, fontSize:13, fontWeight:700, color:COLORS.ink, marginBottom:4 }}>{d.customCalloutTitle}</div>
              <div style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, lineHeight:1.5, marginBottom:8 }}>{d.customCalloutBody}</div>
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); navigate("commission"); }}
                style={{ fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:COLORS.accentDark, textDecoration:"none" }}
              >
                {d.customCalloutCta}
              </a>
            </div>

            <div className="a-two-col" style={{ gap:16 }}>
              {/* generic category materials would contradict a product's own description */}
              {!description && (
                <div className="a-info-block">
                  <div className="a-label">{d.materialsTitle}</div>
                  <div style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, lineHeight:1.6 }}>{materials}</div>
                </div>
              )}
              <div className="a-info-block">
                <div className="a-label">{d.shippingTitle}</div>
                <div style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, lineHeight:1.6 }}>{d.shippingBody}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
