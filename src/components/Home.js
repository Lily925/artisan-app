import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import ProductCard from "./ProductCard";

export default function Home({ lang, t, prods, savedItems, toggleSave, openProduct, fmt, navigate, openShop }) {
  const home = t.homePage;

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <section style={{ padding:"64px 24px", textAlign:"center", background:COLORS.bgSoft, borderBottom:`1px solid ${COLORS.border}` }}>
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:"clamp(28px,5vw,48px)", fontWeight:600, color:COLORS.ink, maxWidth:720, margin:"0 auto 16px", lineHeight:1.15 }}>
          {home.heroTitle}
        </h1>
        <p style={{ fontFamily:FONT_SANS, fontSize:15, color:COLORS.inkSoft, maxWidth:560, margin:"0 auto 32px", lineHeight:1.6 }}>
          {home.heroSub}
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <button type="button" className="a-btn-primary" onClick={() => openShop()}>{home.ctaBrowse}</button>
          <button type="button" className="a-btn-outline" onClick={() => navigate("commission")}>{home.ctaCommission}</button>
        </div>
      </section>

      <nav aria-label={home.categoriesAria} style={{ display:"flex", gap:10, overflowX:"auto", padding:"24px 24px 8px" }}>
        {t.productCategories.map((c) => (
          <button key={c.key} type="button" className="a-chip" onClick={() => openShop(c.key)}>
            {c.label}
          </button>
        ))}
      </nav>

      <section style={{ padding:"16px 24px 56px" }}>
        <h2 style={{ fontFamily:FONT_SERIF, fontSize:24, fontWeight:600, color:COLORS.ink, margin:"16px 0 20px" }}>
          {home.gridTitle}
        </h2>
        <div className="a-product-grid">
          {prods.map((p) => {
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
      </section>
    </div>
  );
}
