import { useEffect, useMemo, useRef, useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { artisanInfo } from "../artisanInfo";
import { offeredTiers } from "../tiers";
import ArtisanAvatar from "./ArtisanAvatar";
import InstagramIcon from "./InstagramIcon";
import Footer from "./Footer";
import ProductImage from "./ProductImage";
import MessageShopButton, { messageShopMode } from "./MessageShopButton";
import CopyLinkButton from "./CopyLinkButton";
import { RatingBadge } from "./StarRating";

// Filter + sort only pay off once there's a real list to look through.
const FILTER_SORT_MIN = 7;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const CSS = `
  .pf-header{display:grid;grid-template-columns:auto minmax(0,1fr);gap:32px;align-items:center;}
  @media (max-width:720px){.pf-header{grid-template-columns:1fr;justify-items:center;text-align:center;gap:20px;}
    .pf-header .pf-row{justify-content:center;}}
  .pf-bio{margin:0 0 16px;}
  @media (max-width:720px){.pf-bio{margin:0 auto 16px;}}
  .pf-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;}
  .pf-stat{font-family:${FONT_SANS};font-size:13px;font-weight:700;color:${COLORS.ink};background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:2px;padding:6px 12px;}
  .pf-ig{display:inline-flex;align-items:center;gap:8px;text-decoration:none;}

  .pf-band{background:${COLORS.bgSoft};border-top:1px solid ${COLORS.border};border-bottom:1px solid ${COLORS.border};}
  .pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr));gap:24px;}
  .pf-card{background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:2px;overflow:hidden;display:flex;flex-direction:column;transition:transform 0.18s ease,box-shadow 0.18s ease;}
  .pf-card:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(59,42,50,0.14);}
  .pf-card-open{display:block;width:100%;border:none;padding:0;background:none;cursor:pointer;text-align:left;color:inherit;font:inherit;}
  .pf-card-open:focus-visible{outline:3px solid ${COLORS.accentDark};outline-offset:-3px;}
  .pf-badge{font-family:${FONT_SANS};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${COLORS.accentDark};background:${COLORS.accentSoft};padding:3px 8px;border-radius:2px;}

  .pf-toolbar{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;margin-bottom:24px;}
  .pf-chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;max-width:100%;}

  .pf-about{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:40px;align-items:start;}
  @media (max-width:860px){.pf-about{grid-template-columns:1fr;gap:24px;}}
  .pf-facts{display:grid;gap:14px;margin:0;}
  .pf-facts dt{font-family:${FONT_SANS};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:${COLORS.inkSoft};}
  .pf-facts dd{font-family:${FONT_SERIF};font-size:20px;color:${COLORS.ink};margin:2px 0 0;overflow-wrap:anywhere;}
  .pf-how{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px;margin:0;padding:0;list-style:none;}
`;

// The first row is visible right away, so it loads eagerly; the rest lazily.
function ProductTile({ product, name, price, tiers, tierName, liked, likeLabel, onToggleSave, onOpen, eager, canLike, ratingAria }) {
  const likeCount = product.likeCount || 0;
  return (
    <article className="pf-card">
      <div style={{ position:"relative", aspectRatio:"1", background:COLORS.bgSoft }}>
        <button type="button" className="pf-card-open" style={{ position:"absolute", inset:0 }} onClick={() => onOpen(product)} aria-label={name}>
          <span style={{ position:"absolute", inset:0, overflow:"hidden" }}>
            <ProductImage src={product.images?.[0]} alt={name} eager={eager} />
          </span>
        </button>
        {canLike && <button type="button" className="a-wishlist-btn" aria-label={`${likeLabel} (${likeCount})`} aria-pressed={liked}
          onClick={(e) => { e.stopPropagation(); onToggleSave(product.id, e); }}>
          <span aria-hidden="true">{liked ? "❤️" : "🤍"}</span>
          {likeCount > 0 && <span aria-hidden="true" className="a-like-count">{likeCount}</span>}
        </button>}
      </div>
      <button type="button" className="pf-card-open" onClick={() => onOpen(product)} tabIndex={-1} aria-hidden="true"
        style={{ padding:"16px 16px 18px", display:"flex", flexDirection:"column", gap:10, flex:1 }}>
        <span style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:12 }}>
          <span style={{ fontFamily:FONT_SERIF, fontSize:20, fontWeight:600, color:COLORS.ink, lineHeight:1.25, overflowWrap:"anywhere" }}>{name}</span>
          <span style={{ fontFamily:FONT_SERIF, fontSize:20, fontWeight:700, color:COLORS.ink, whiteSpace:"nowrap" }}>{price}</span>
        </span>
        <RatingBadge avg={product.ratingAvg} count={product.ratingCount} aria={ratingAria} size={13} />
        <span style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {tiers.map((k) => <span key={k} className="pf-badge">{tierName[k]}</span>)}
        </span>
      </button>
    </article>
  );
}

// Public portfolio page of one artisan (shop + personal profile in one): header, all
// products (filter/sort when there are many), about, how it works, closing call to action. Only public data: no email, phone, address or contact note.
// `products` must already exclude hidden ones. `focus="about"` scrolls to the About section.
export default function Portfolio({ lang, t, artisan, products, savedItems, toggleSave, openProduct, fmtBasic, navigate, onBack, focus, viewer = null, onMessageShop, onSignIn }) {
  const pf = t.portfolio;
  const isOwner = Boolean(viewer) && String(artisan.user?._id) === String(viewer.id);
  const { ownerName, shopName, displayName, instagramHandle, instagramUrl, photoUrl, avatarUrl, personalBio, yearsExperience, location } = artisanInfo(artisan);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const aboutRef = useRef(null);
  const allRef = useRef(null);

  useEffect(() => {
    if (focus === "about") aboutRef.current?.scrollIntoView({ block:"start" });
  }, [focus, artisan?._id]);

  const nameOf = (p) => (lang === "mn" ? p.title : p.titleEn || p.title);
  const newestFirst = useMemo(() => [...products].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [products]);
  const likes = products.reduce((sum, p) => sum + (p.likeCount || 0), 0);
  const many = products.length >= FILTER_SORT_MIN;

  const categories = t.productCategories.filter((c) => products.some((p) => p.category === c.key));
  const shown = useMemo(() => {
    const list = many && category ? newestFirst.filter((p) => p.category === category) : newestFirst;
    if (!many || sort === "newest") return list;
    const price = (p) => p.pricingTiers.basic.price;
    return [...list].sort((a, b) => (sort === "priceLow" ? price(a) - price(b) : price(b) - price(a)));
  }, [newestFirst, many, category, sort]);

  const specialties = (artisan.specialty || "").split(/\s*[·,&/]\s*/).filter(Boolean);
  const facts = [
    yearsExperience !== null && [pf.years, pf.yearsValue(yearsExperience)],
    location && [pf.region, location],
    specialties.length > 0 && [pf.specialties, specialties.join(" · ")],
  ].filter(Boolean);
  const story = artisan.bio?.trim() || personalBio;
  // Scroll the page itself (not every scrollable ancestor), leaving room for the sticky header.
  const scrollToAll = () => {
    const el = allRef.current;
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  const sectionTitle = { fontFamily:FONT_SERIF, fontSize:"clamp(26px,3vw,34px)", fontWeight:600, color:COLORS.ink, lineHeight:1.15 };
  const igButton = (label, primary) => instagramUrl && (
    <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className={`${primary ? "a-btn-primary" : "a-btn-outline"} pf-ig`} aria-label={`${label}: @${instagramHandle}`}>
      <InstagramIcon />{label}
    </a>
  );

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <style>{CSS}</style>

      {/* ── Header, then straight into the products ── */}
      <div className="a-page">
        <button type="button" className="a-shop-link" onClick={onBack} style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginBottom:24 }}>
          ‹ {pf.back}
        </button>
        <header className="pf-header" style={{ marginBottom:48 }}>
          <ArtisanAvatar name={ownerName || displayName} photoUrl={avatarUrl || photoUrl} size={152} />
          <div style={{ minWidth:0 }}>
            <div style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, letterSpacing:0.6, textTransform:"uppercase", color:COLORS.accentDark, marginBottom:6 }}>{pf.eyebrow}</div>
            <h1 style={{ fontFamily:FONT_SERIF, fontSize:"clamp(34px,5vw,56px)", fontWeight:600, color:COLORS.ink, lineHeight:1.05, marginBottom:8, overflowWrap:"anywhere" }}>{displayName}</h1>
            <p className="pf-row" style={{ fontFamily:FONT_SANS, fontSize:15, color:COLORS.inkSoft, marginBottom:12 }}>
              {shopName && ownerName && <span>{pf.by(ownerName)}</span>}
              {location && <span>📍 {location}</span>}
              {artisan.certified && <span className="pf-badge">✓ {t.homePage.certified}</span>}
            </p>
            {personalBio && (
              <p className="a-readable pf-bio" style={{ fontFamily:FONT_SERIF, fontSize:20, fontStyle:"italic", color:COLORS.ink, lineHeight:1.45, whiteSpace:"pre-line", overflowWrap:"anywhere" }}>
                “{personalBio}”
              </p>
            )}
            <div className="pf-row">
              <MessageShopButton t={t} viewer={viewer} isOwner={isOwner} onMessage={onMessageShop} onSignIn={onSignIn} />
              {igButton(pf.instagram, !messageShopMode(viewer, isOwner))}
              <CopyLinkButton t={t} />
              <span className="pf-stat">{pf.statProducts(products.length)}</span>
              <span className="pf-stat">♡ {pf.statLikes(likes)}</span>
              {artisan.ratingCount > 0 && <span className="pf-stat"><RatingBadge avg={artisan.ratingAvg} count={artisan.ratingCount} aria={t.reviews.ratingAria} size={13} /></span>}
            </div>
          </div>
        </header>

        {/* ── No products yet ── */}
        {products.length === 0 && (
          <section className="a-info-block" aria-labelledby="pf-empty-title" style={{ textAlign:"center", padding:"48px 24px", marginBottom:72 }}>
            <div aria-hidden="true" style={{ fontSize:56, marginBottom:12 }}>🧶</div>
            <h2 id="pf-empty-title" style={{ ...sectionTitle, marginBottom:8 }}>{pf.emptyTitle}</h2>
            <p className="a-readable" style={{ fontFamily:FONT_SANS, fontSize:15, color:COLORS.inkSoft, lineHeight:1.6, margin:"0 auto 20px" }}>{pf.emptySub}{instagramUrl && <> {pf.emptyFollow}</>}</p>
            <div className="pf-row" style={{ justifyContent:"center" }}>
              {igButton(pf.follow, true)}
              <button type="button" className="a-btn-outline" onClick={() => navigate("shop")}>{pf.backToMarket}</button>
            </div>
          </section>
        )}

        {/* ── All products ── */}
        {products.length > 0 && (
          <section ref={allRef} aria-labelledby="pf-all-title" style={{ marginBottom:72, scrollMarginTop:96 }}>
            <div className="pf-toolbar">
              <h2 id="pf-all-title" style={sectionTitle}>
                {pf.allTitle} <span style={{ fontFamily:FONT_SANS, fontSize:16, fontWeight:400, color:COLORS.inkSoft }}>({shown.length})</span>
              </h2>
              {many && (
                <label style={{ display:"flex", alignItems:"center", gap:8, fontFamily:FONT_SANS, fontSize:13, fontWeight:700, color:COLORS.inkSoft }}>
                  {pf.sortLabel}
                  <select className="a-select" style={{ width:"auto", minWidth:180 }} value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="newest">{pf.sortNewest}</option>
                    <option value="priceLow">{pf.sortPriceLow}</option>
                    <option value="priceHigh">{pf.sortPriceHigh}</option>
                  </select>
                </label>
              )}
            </div>
            {many && categories.length > 1 && (
              <div role="group" aria-label={pf.filterAria} className="pf-chips" style={{ marginBottom:24 }}>
                {[{ key:"", label:pf.all }, ...categories].map((c) => (
                  <button key={c.key} type="button" className={`a-chip${category === c.key ? " selected" : ""}`} aria-pressed={category === c.key} onClick={() => setCategory(c.key)}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {shown.length === 0 ? (
              <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>{pf.noMatch}</p>
            ) : (
              <div className="pf-grid">
                {shown.map((p, i) => {
                  const liked = savedItems.includes(p.id);
                  return (
                    <ProductTile key={p.id} product={p} name={nameOf(p)} price={fmtBasic(p)} tiers={offeredTiers(p)} tierName={t.orders.tierName}
                      liked={liked} likeLabel={liked ? t.homePage.wishlistRemove : t.homePage.wishlistAdd}
                      onToggleSave={toggleSave} onOpen={openProduct} eager={i < 4} canLike={!isOwner} ratingAria={t.reviews.ratingAria} />
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── About the artisan ── */}
        <section ref={aboutRef} aria-labelledby="pf-about-title" style={{ marginBottom:48, scrollMarginTop:96 }}>
          <h2 id="pf-about-title" style={{ ...sectionTitle, marginBottom:20 }}>{pf.aboutTitle}</h2>
          <div className="pf-about">
            <div style={{ minWidth:0 }}>
              {story && <p className="a-readable" style={{ fontFamily:FONT_SANS, fontSize:16, color:COLORS.ink, lineHeight:1.75, whiteSpace:"pre-line", overflowWrap:"anywhere" }}>{story}</p>}
            </div>
            {facts.length > 0 && (
              <dl className="pf-facts a-info-block">
                {facts.map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
            )}
          </div>
        </section>

        {/* ── How it works ── */}
        <section aria-labelledby="pf-how-title" style={{ marginBottom:24 }}>
          <h2 id="pf-how-title" className="a-label" style={{ marginBottom:12 }}>{pf.howTitle}</h2>
          <ul className="pf-how">
            {[["basic", t.orders.tierName.basic], ["story", t.orders.tierName.story], ["patron", t.orders.tierName.patron], ["payments", pf.paymentsName]].map(([key, title]) => (
              <li key={key} className="a-callout" style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.ink, lineHeight:1.55 }}>
                <strong style={{ display:"block", fontFamily:FONT_SERIF, fontSize:19, marginBottom:4 }}>{title}</strong>
                {pf.how[key]}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ── Closing call to action (the empty state already has its own) ── */}
      {products.length > 0 && (
      <section className="pf-band" aria-labelledby="pf-cta-title">
        <div className="a-container" style={{ paddingTop:56, paddingBottom:56, textAlign:"center" }}>
          <h2 id="pf-cta-title" style={{ ...sectionTitle, marginBottom:8 }}>{pf.ctaTitle}</h2>
          {instagramUrl && <p style={{ fontFamily:FONT_SANS, fontSize:15, color:COLORS.inkSoft, marginBottom:24 }}>{pf.ctaSub}</p>}
          <div className="pf-row" style={{ justifyContent:"center", marginTop: instagramUrl ? 0 : 16, marginBottom:20 }}>
            {igButton(pf.follow, true)}
            <button type="button" className={instagramUrl ? "a-btn-outline" : "a-btn-primary"} onClick={scrollToAll}>{pf.browseAll}</button>
          </div>
          <button type="button" className="a-shop-link" style={{ fontFamily:FONT_SANS, fontSize:14, fontWeight:700, color:COLORS.accentDark }} onClick={() => navigate("shop")}>
            {pf.backToMarket}
          </button>
        </div>
      </section>
      )}

      <Footer t={t} />
    </div>
  );
}
