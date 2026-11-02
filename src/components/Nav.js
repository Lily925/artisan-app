import { COLORS, FONT_SERIF } from "../theme";
import { CartIcon, ChatIcon, HeartIcon } from "./NavIcons";
import CountBadge from "./CountBadge";
import NotificationBell from "./NotificationBell";

const LOCALES = [["en", "$"], ["mn", "₮"], ["ko", "₩"]];

export default function Nav({
  lang, setLang, searchQuery, setSearchQuery, onSearchSubmit,
  cartCount, wishlistCount, currentUser, navigate, t,
  notifications, fmtAmt, onOpenLink, onOpenInbox, compact = false,
}) {
  const nav = t.nav;

  return (
    <header style={{ position:"sticky", top:0, zIndex:200, background:COLORS.card, borderBottom:`1px solid ${COLORS.border}` }}>
      <div className={`a-container a-nav-row${compact ? " compact" : ""}`}>
        <a
          href="/"
          className="a-nav-brand"
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

        <div className="a-nav-group a-nav-icons" style={{ gap:0 }}>
          {notifications && <NotificationBell t={t} notifications={notifications} fmtAmt={fmtAmt} onOpenLink={onOpenLink} />}

          {/* Admins take no part in chats. */}
          {notifications && currentUser?.role !== "admin" && (
            <button type="button" className="a-icon-btn a-nav-icon" aria-label={nav.messagesAria(notifications.unreadMessages)} onClick={onOpenInbox}>
              <ChatIcon />
              <CountBadge count={notifications.unreadMessages} />
            </button>
          )}

          <button type="button" className="a-icon-btn a-nav-icon" aria-label={nav.wishlistAria(wishlistCount)} onClick={() => navigate("saved")}>
            <HeartIcon />
            <CountBadge count={wishlistCount} />
          </button>

          <button type="button" className="a-icon-btn a-nav-icon" aria-label={nav.cartAria(cartCount)} onClick={() => navigate("cart")}>
            <CartIcon />
            <CountBadge count={cartCount} />
          </button>
        </div>

        {currentUser ? (
          <button type="button" className="a-btn-outline a-nav-user" style={{ padding:"9px 18px", fontSize:12, minHeight:40 }} onClick={() => navigate("profile")}>
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
