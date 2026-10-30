import { COLORS, FONT_SERIF } from "../theme";

const LOCALES = [["en", "$"], ["mn", "₮"], ["ko", "₩"]];

function CountBadge({ count }) {
  return (
    <span aria-hidden="true" style={{ position:"absolute", top:2, right:2, background:COLORS.accentDark, color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:9, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
      {count}
    </span>
  );
}

export default function Nav({
  lang, setLang, searchQuery, setSearchQuery, onSearchSubmit,
  cartCount, wishlistCount, currentUser, navigate, t,
}) {
  const nav = t.nav;

  return (
    <header style={{ position:"sticky", top:0, zIndex:200, background:COLORS.card, borderBottom:`1px solid ${COLORS.border}` }}>
      <div className="a-container a-nav-row">
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); navigate("home"); }}
          style={{ fontFamily:FONT_SERIF, fontSize:26, fontWeight:700, color:COLORS.ink, textDecoration:"none", flexShrink:0 }}
        >
          Artisan
        </a>

        <form role="search" className="a-search-form" onSubmit={(e) => { e.preventDefault(); onSearchSubmit(); }}>
          <label htmlFor="artisan-nav-search" className="a-sr-only">{nav.searchLabel}</label>
          <input
            id="artisan-nav-search"
            className="a-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={nav.searchPlaceholder}
          />
        </form>

        {/* One switcher: language + the currency shown with it (EN $, MN ₮, KO ₩). */}
        <div role="group" aria-label={nav.langAria} className="a-nav-group a-locale-switch">
          {LOCALES.map(([code, symbol]) => (
            <button key={code} type="button" className={`a-locale-btn${lang===code?" active":""}`} aria-pressed={lang===code} onClick={() => setLang(code)}>
              {code.toUpperCase()} <span aria-hidden="true" className="a-locale-sym">{symbol}</span>
            </button>
          ))}
        </div>

        <button type="button" className="a-icon-btn" aria-label={nav.wishlistAria(wishlistCount)} onClick={() => navigate("saved")}>
          <span aria-hidden="true" style={{ fontSize:20 }}>♡</span>
          {wishlistCount > 0 && <CountBadge count={wishlistCount} />}
        </button>

        <button type="button" className="a-icon-btn" aria-label={nav.cartAria(cartCount)} onClick={() => navigate("cart")}>
          <span aria-hidden="true" style={{ fontSize:20 }}>🛍</span>
          {cartCount > 0 && <CountBadge count={cartCount} />}
        </button>

        {currentUser ? (
          <button type="button" className="a-btn-outline" style={{ padding:"9px 18px", fontSize:12, minHeight:40 }} onClick={() => navigate("profile")}>
            {currentUser.name}
          </button>
        ) : (
          <button type="button" className="a-btn-primary" style={{ padding:"9px 18px", fontSize:12, minHeight:40 }} onClick={() => navigate("login")}>
            {nav.login}
          </button>
        )}
      </div>
    </header>
  );
}
