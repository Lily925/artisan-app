import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import ProductCard from "./ProductCard";
import Footer from "./Footer";

const CATEGORY_ICONS = ["🧶", "👜", "💍", "🐐", "🏺"];

export default function Shop({ lang, t, filtered, savedItems, toggleSave, openProduct, fmt, navigate }) {
  const shop = t.shopPage;
  const home = t.homePage;

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:24, flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", color:COLORS.accentDark, marginBottom:6 }}>
              {shop.eyebrow}
            </div>
            <h1 style={{ fontFamily:FONT_SERIF, fontSize:32, fontWeight:600, color:COLORS.ink }}>
              {t.results(filtered.length)}
            </h1>
          </div>
          <span style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft }}>{t.sort}</span>
        </div>

        <div className="a-product-grid" style={{ marginBottom:64 }}>
          {filtered.map((p) => {
            return (
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
            );
          })}
        </div>

        <section style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:40, background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"48px 40px", marginBottom:56 }}>
          <div style={{ flex:"1 1 400px" }}>
            <h2 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:14, lineHeight:1.2 }}>
              {shop.bannerTitle}
            </h2>
            <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, lineHeight:1.6, marginBottom:22, maxWidth:480 }}>
              {shop.bannerSub}
            </p>
            <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
              <button type="button" className="a-btn-primary" onClick={() => navigate("shop")}>{shop.bannerCtaBrowse}</button>
              <button type="button" className="a-btn-outline" onClick={() => navigate("commission")}>{shop.bannerCtaCommission}</button>
            </div>
          </div>
          <div style={{ flex:"0 0 220px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }} aria-hidden="true">
            <div style={{ gridRow:"span 2", background:COLORS.accent, borderRadius:2, minHeight:140 }} />
            <div style={{ background:COLORS.accentSoft, borderRadius:2, minHeight:65 }} />
            <div style={{ background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:2, minHeight:65 }} />
          </div>
        </section>

        <nav aria-label={home.categoriesAria} style={{ display:"flex", justifyContent:"center", gap:40, flexWrap:"wrap", marginBottom:16 }}>
          {shop.categories.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate("shop")}
              style={{ background:"none", border:"none", cursor:"pointer", fontFamily:FONT_SANS, fontSize:12, fontWeight:600, color:COLORS.ink, textAlign:"center", minHeight:44 }}
            >
              <span className="a-category-icon" aria-hidden="true">{CATEGORY_ICONS[i]}</span>
              {label}
            </button>
          ))}
        </nav>
      </div>

      <Footer t={t} navigate={navigate} />
    </div>
  );
}
