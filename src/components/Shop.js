import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { placeholderEmoji } from "../placeholders";
import ProductCard from "./ProductCard";
import { isOwnProduct } from "../artisanInfo";
import Footer from "./Footer";

export default function Shop({ currentUserId, lang, t, filtered, loading, category, searchQuery, clearSearch, openShop, savedItems, toggleSave, fmt, navigate }) {
  const shop = t.shopPage;
  const home = t.homePage;
  const chips = [{ key: "", label: shop.allCategories }, ...t.productCategories];
  const categoryLabel = t.productCategories.find((c) => c.key === category)?.label;
  const query = searchQuery?.trim();
  // The search and the selected category both narrow the list, so name both.
  const emptyTitle = query ? shop.emptySearch(query, category ? categoryLabel || category : "") : category ? shop.emptyCategory(categoryLabel || category) : shop.emptyAll;

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:24, flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", color:COLORS.accentDark, marginBottom:6 }}>
              {shop.eyebrow}
            </div>
            <h1 style={{ fontFamily:FONT_SERIF, fontSize:32, fontWeight:600, color:COLORS.ink }}>
              {loading ? "…" : t.results(filtered.length)}
            </h1>
          </div>
          <span style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft }}>{t.sort}</span>
        </div>

        <nav aria-label={home.categoriesAria} style={{ display:"flex", gap:10, overflowX:"auto", marginBottom:24 }}>
          {chips.map((c) => (
            <button
              key={c.key || "all"}
              type="button"
              className={`a-chip${category === c.key ? " selected" : ""}`}
              aria-pressed={category === c.key}
              onClick={() => openShop(c.key)}
            >
              {c.label}
            </button>
          ))}
        </nav>

        {!loading && filtered.length === 0 && (
          <section className="a-info-block" role="status" style={{ textAlign:"center", padding:"48px 24px", marginBottom:48 }}>
            <div aria-hidden="true" style={{ fontSize:44, marginBottom:12 }}>{placeholderEmoji(category || "crafts")}</div>
            <h2 style={{ fontFamily:FONT_SERIF, fontSize:26, fontWeight:600, color:COLORS.ink, marginBottom:8, overflowWrap:"anywhere" }}>{emptyTitle}</h2>
            <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, marginBottom:20 }}>{shop.emptySub}</p>
            <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
              {query && <button type="button" className="a-btn-primary" onClick={clearSearch}>{shop.clearSearch}</button>}
              {category && <button type="button" className={query ? "a-btn-outline" : "a-btn-primary"} onClick={() => openShop()}>{shop.showAll}</button>}
              <button type="button" className="a-btn-outline" onClick={() => navigate("commission")}>{shop.bannerCtaCommission}</button>
            </div>
          </section>
        )}

        <div className="a-product-grid" style={{ marginBottom: filtered.length ? 64 : 0 }}>
          {filtered.map((p) => {
            return (
              <ProductCard
                key={p.id}
                product={p}
                nameMn={p.title}
                nameEn={p.titleEn}
                lang={lang}
                isSaved={savedItems.includes(p.id)}
                isOwn={isOwnProduct(p, currentUserId)}
                onToggleSave={toggleSave}
                price={fmt(p)}
                certifiedLabel={home.certified}
                wishlistAddLabel={home.wishlistAdd}
                wishlistRemoveLabel={home.wishlistRemove}
                ratingAria={t.reviews.ratingAria}
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
              <button type="button" className="a-btn-primary" onClick={() => { openShop(); window.scrollTo(0, 0); }}>{shop.bannerCtaBrowse}</button>
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
          {t.productCategories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => { openShop(c.key); window.scrollTo(0, 0); }}
              style={{ background:"none", border:"none", cursor:"pointer", fontFamily:FONT_SANS, fontSize:12, fontWeight:600, color:COLORS.ink, textAlign:"center", minHeight:44 }}
            >
              <span className="a-category-icon" aria-hidden="true">{placeholderEmoji(c.key)}</span>
              {c.label}
            </button>
          ))}
        </nav>
      </div>

      <Footer t={t} />
    </div>
  );
}
