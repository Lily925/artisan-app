import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { artisanInfo } from "../artisanInfo";
import ProductCard from "./ProductCard";
import InstagramIcon from "./InstagramIcon";
import ArtisanAvatar from "./ArtisanAvatar";
import Footer from "./Footer";

// One artisan's shop: header (shop name, owner, certified, Instagram, contact),
// bio, and a grid of every product they sell.
export default function Storefront({ lang, t, artisan, products, savedItems, toggleSave, openProduct, fmt, navigate, onBack, openArtisanProfile }) {
  const s = t.storefront;
  const home = t.homePage;
  const { ownerName, shopName, displayName, instagramHandle, instagramUrl, contactInfo, photoUrl } = artisanInfo(artisan);

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page">
        <div className="a-breadcrumb">
          <button type="button" className="a-shop-link" onClick={onBack} style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>
            ‹ {s.back}
          </button>
        </div>

        <header style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:24, background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"32px 28px", marginBottom:32 }}>
          <ArtisanAvatar name={displayName} photoUrl={photoUrl} size={88} />
          <div style={{ flex:"1 1 260px", minWidth:0 }}>
            <div style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", color:COLORS.accentDark, marginBottom:6 }}>
              {s.eyebrow}
            </div>
            <h1 style={{ fontFamily:FONT_SERIF, fontSize:34, fontWeight:600, color:COLORS.ink, lineHeight:1.15, marginBottom:6, overflowWrap:"anywhere" }}>
              {displayName}
            </h1>
            {/* Specialty gets its own line: it may already contain "·" separators of its own. */}
            {artisan.specialty && (
              <div style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, marginBottom:8 }}>{artisan.specialty}</div>
            )}
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:"8px 12px" }}>
              {ownerName && (
                <button type="button" className="a-shop-link" onClick={() => openArtisanProfile(artisan)}
                  aria-label={t.artisanProfile.view(ownerName)}
                  style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>
                  {shopName ? t.byArtisan(ownerName) : `${t.artisanProfile.viewShort} ›`}
                </button>
              )}
              {artisan.certified && (
                <span style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, color:COLORS.accentDark, background:COLORS.accentSoft, padding:"3px 8px", borderRadius:2 }}>
                  ✓ {home.certified}
                </span>
              )}
            </div>
            {(instagramUrl || contactInfo) && (
              <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:"6px 16px", marginTop:14 }}>
                {instagramUrl && (
                  <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label={`@${instagramHandle} on Instagram`}
                    style={{ display:"inline-flex", alignItems:"center", gap:6, fontFamily:FONT_SANS, fontSize:14, fontWeight:600, color:COLORS.accentDark, textDecoration:"none" }}>
                    <InstagramIcon />@{instagramHandle}
                  </a>
                )}
                {contactInfo && <span style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft }}>{contactInfo}</span>}
              </div>
            )}
          </div>
        </header>

        {artisan.bio && (
          <section style={{ maxWidth:720, marginBottom:40 }}>
            <h2 className="a-label" style={{ marginBottom:10 }}>{s.about}</h2>
            <p style={{ fontFamily:FONT_SANS, fontSize:15, color:COLORS.ink, lineHeight:1.7, whiteSpace:"pre-line" }}>{artisan.bio}</p>
          </section>
        )}

        <section style={{ marginBottom:64 }}>
          <h2 style={{ fontFamily:FONT_SERIF, fontSize:26, fontWeight:600, color:COLORS.ink, marginBottom:20 }}>
            {s.products(products.length)}
          </h2>
          {products.length === 0 ? (
            <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>{s.empty}</p>
          ) : (
            <div className="a-product-grid">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  nameMn={p.title}
                  nameEn={p.titleEn}
                  lang={lang}
                  isSaved={savedItems.includes(p.id)}
                  onToggleSave={toggleSave}
                  onOpen={openProduct}
                  price={fmt(p)}
                  certifiedLabel={home.certified}
                  wishlistAddLabel={home.wishlistAdd}
                  wishlistRemoveLabel={home.wishlistRemove}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <Footer t={t} navigate={navigate} />
    </div>
  );
}
