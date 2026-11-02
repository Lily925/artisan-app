import { useEffect, useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api } from "../api";
import ProfileCard from "./ProfileCard";
import ChangePasswordForm from "./ChangePasswordForm";
import ProductCard from "./ProductCard";
import CountBadge from "./CountBadge";

const RECENT_SHOP_ORDERS = 5;

function Section({ title, action, children }) {
  return (
    <section className="a-info-block" style={{ marginBottom:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:12, flexWrap:"wrap", marginBottom:14 }}>
        <h2 style={{ fontFamily:FONT_SERIF, fontSize:22, fontWeight:600, color:COLORS.ink }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// New artisans: the steps to a working shop. Hidden once every step is done.
function Onboarding({ t, steps }) {
  const ob = t.onboarding;
  const done = steps.filter((st) => st.done).length;
  if (done === steps.length) return null;
  return (
    <section className="a-info-block" aria-labelledby="onboarding-title" style={{ marginBottom:20, borderColor:COLORS.accent, background:COLORS.bgSoft }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:12, flexWrap:"wrap", marginBottom:12 }}>
        <h2 id="onboarding-title" style={{ fontFamily:FONT_SERIF, fontSize:22, fontWeight:600, color:COLORS.ink }}>🧶 {ob.title}</h2>
        <span style={{ fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:COLORS.accentDark }}>{ob.progress(done, steps.length)}</span>
      </div>
      <div aria-hidden="true" style={{ height:6, background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:3, marginBottom:14, overflow:"hidden" }}>
        <div style={{ width:`${(done / steps.length) * 100}%`, height:"100%", background:COLORS.accentDark, transition:"width 0.3s" }} />
      </div>
      <ol style={{ listStyle:"none", margin:0, padding:0, display:"grid", gap:8 }}>
        {steps.map((st, i) => (
          <li key={st.key} style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"10px 14px" }}>
            <span className="a-step-badge" aria-hidden="true" style={st.done ? { background:COLORS.accentDark, color:"#fff" } : undefined}>{st.done ? "✓" : i + 1}</span>
            <span style={{ flex:"1 1 180px", minWidth:0, fontFamily:FONT_SANS }}>
              <span style={{ display:"block", fontSize:14, fontWeight:700, color: st.done ? COLORS.inkSoft : COLORS.ink, textDecoration: st.done ? "line-through" : "none" }}>{st.label}</span>
              {!st.done && st.hint && <span style={{ display:"block", fontSize:12, color:COLORS.inkSoft, marginTop:2 }}>{st.hint}</span>}
            </span>
            {st.done
              ? <span className="a-sr-only">{ob.done}</span>
              : st.action && <button type="button" className="a-btn-primary" style={{ padding:"8px 16px", fontSize:13, minHeight:40 }} onClick={st.action}>{ob.start}</button>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function OrderRow({ first, title, sub, amount, onOpen }) {
  return (
    <li style={{ borderTop: first ? "none" : `1px solid ${COLORS.border}` }}>
      <button type="button" onClick={onOpen}
        style={{ display:"flex", width:"100%", justifyContent:"space-between", alignItems:"center", gap:12, padding:"12px 0", background:"none", border:"none", cursor:"pointer", textAlign:"left", minHeight:44 }}>
        <span style={{ minWidth:0 }}>
          <span style={{ display:"block", fontFamily:FONT_SANS, fontSize:14, fontWeight:700, color:COLORS.ink }}>{title}</span>
          <span style={{ display:"block", fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:2 }}>{sub}</span>
        </span>
        <span style={{ fontFamily:FONT_SANS, fontSize:14, fontWeight:700, color:COLORS.accentDark, whiteSpace:"nowrap" }}>{amount} ›</span>
      </button>
    </li>
  );
}

// Own profile page. >= 1024px: the profile card (photo, bio, actions) sticks on the left
// and the user's content fills the right; below that it is one column.
// Artisans: stats, My products, recent shop orders, order history, liked items.
// Buyers: stats, order history, liked items.
export default function ProfilePage({
  t, lang, user, emoji, products, savedItems, toggleSave, openProduct, fmtBasic, fmtAmt,
  cartLines, orders, openOrder, navigate, logout, onUpdated, onApiError, shopSetupNeeded, shopLive = false, unreadMessages = 0,
}) {
  const pp = t.profilePage;
  const o = t.orders;
  const isArtisan = user.role === "artisan";
  const [shopOrders, setShopOrders] = useState(null);
  const [payoutEmail, setPayoutEmail] = useState(null); // null = not loaded yet

  useEffect(() => {
    if (!isArtisan) return undefined;
    let stale = false;
    api.getShopOrders()
      .then((res) => { if (!stale) setShopOrders(res); })
      .catch((err) => { if (stale) return; if (err.status === 401) onApiError(err); setShopOrders([]); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArtisan]);

  useEffect(() => {
    if (!isArtisan || shopSetupNeeded) return undefined;
    let stale = false;
    api.getMyArtisan()
      .then((a) => { if (!stale) setPayoutEmail(a.payoutEmail || ""); })
      .catch(() => {});
    return () => { stale = true; };
  }, [isArtisan, shopSetupNeeded]);

  const myProducts = isArtisan ? products.filter((p) => String(p.artisan?.user?._id) === String(user.id)) : [];
  const liked = products.filter((p) => savedItems.includes(p.id));
  const likesOnMine = myProducts.reduce((sum, p) => sum + (p.likeCount || 0), 0);

  const stats = isArtisan
    ? [[myProducts.length, pp.statProducts], [likesOnMine, pp.statLikes], [shopOrders ? shopOrders.length : "…", pp.statShopOrders], [orders.length, pp.statOrders]]
    : [[orders.length, pp.statOrders], [cartLines, t.cart], [savedItems.length, t.saved]];

  const card = (p) => (
    <div key={p.id} style={{ position:"relative", opacity: p.isHidden ? 0.7 : 1 }}>
      {p.isHidden && (
        <span style={{ position:"absolute", top:8, left:8, zIndex:2, fontFamily:FONT_SANS, fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, color:"#fff", background:COLORS.ink, padding:"3px 8px", borderRadius:2 }}>
          {t.portfolio.hidden}
        </span>
      )}
      <ProductCard
      product={p} nameMn={p.title} nameEn={p.titleEn} lang={lang}
      isSaved={savedItems.includes(p.id)} onToggleSave={toggleSave} onOpen={openProduct} price={fmtBasic(p)}
      certifiedLabel={t.homePage.certified} wishlistAddLabel={t.homePage.wishlistAdd} wishlistRemoveLabel={t.homePage.wishlistRemove}
    />
    </div>
  );
  const muted = { fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft };
  const linkBtn = (label, onClick) => (
    <button type="button" className="a-shop-link" style={{ fontFamily:FONT_SANS, fontSize:13, fontWeight:700, color:COLORS.accentDark }} onClick={onClick}>{label}</button>
  );
  const actionBtn = { padding:"10px 18px", fontSize:13 };

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page page">
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:20 }}>{t.profile}</h1>

        {/* First thing a new artisan sees, at every width (on phones the profile card is long). */}
        {isArtisan && (shopSetupNeeded || payoutEmail !== null) && (
          <Onboarding t={t} steps={[
            { key:"setup", label:t.onboarding.setup, done:!shopSetupNeeded, action:() => navigate("shop-setup") },
            { key:"photo", label:t.onboarding.photo, hint:t.onboarding.photoHint, done:Boolean(user.avatarUrl) },
            { key:"product", label:t.onboarding.product, hint:shopSetupNeeded || shopLive ? null : t.shopStatus.cantPublish, done:myProducts.length > 0, action:shopSetupNeeded || !shopLive ? null : () => navigate("add-product") },
            { key:"payout", label:t.onboarding.payout, done:Boolean(payoutEmail), action:shopSetupNeeded ? null : () => navigate("shop-settings") },
          ]} />
        )}

        <div className="a-profile-layout">
          <aside className="a-profile-side">
            <ProfileCard t={t} user={user} emoji={emoji} onUpdated={onUpdated} onApiError={onApiError}>
              {isArtisan && (
                <div style={{ marginTop:20, display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                  <button type="button" className="a-btn-primary" style={actionBtn} onClick={() => navigate("dashboard")}>{t.dashboard.open}</button>
                  <button type="button" className="a-btn-primary" style={actionBtn} onClick={() => navigate("shop-orders")}>{o.shopOpen}</button>
                  {shopLive && <button type="button" className="a-btn-primary" style={actionBtn} onClick={() => navigate("add-product")}>{t.addProduct.open}</button>}
                  <button type="button" className="a-btn-outline" style={actionBtn} onClick={() => navigate("shop-settings")}>{t.shopSettings.open}</button>
                  <button type="button" className="a-btn-outline" style={actionBtn} onClick={() => navigate("commission-board")}>{t.commissions.boardOpen}</button>
                </div>
              )}
              {user.role === "admin" && (
                <div style={{ marginTop:20 }}>
                  <button type="button" className="a-btn-primary" style={actionBtn} onClick={() => navigate("admin-shops")}>🛡 {t.adminShops.open}</button>
                </div>
              )}
              <div style={{ marginTop:12, display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                <button type="button" className="a-btn-outline" style={actionBtn} onClick={() => navigate("my-commissions")}>{t.commissions.mineOpen}</button>
                {user.role !== "admin" && (
                  <button type="button" className="a-btn-outline" style={{ ...actionBtn, position:"relative" }} aria-label={t.nav.messagesAria(unreadMessages)} onClick={() => navigate("messages")}>
                    {t.messages.title}
                    <CountBadge count={unreadMessages} />
                  </button>
                )}
              </div>
            </ProfileCard>
            <ChangePasswordForm t={t} onApiError={onApiError} />
            <button type="button" className="a-btn-outline" style={{ width:"100%", borderColor:COLORS.accentDark, color:COLORS.accentDark }} onClick={logout}>
              {t.logout}
            </button>
          </aside>

          <div style={{ minWidth:0 }}>
            <section aria-label={pp.overview} className="a-stat-grid" style={{ marginBottom:20 }}>
              {stats.map(([value, label]) => (
                <div key={label} className="a-info-block" style={{ textAlign:"center", padding:"16px 12px" }}>
                  <div style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:700, color:COLORS.accentDark, fontVariantNumeric:"tabular-nums" }}>{value}</div>
                  <div style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:2 }}>{label}</div>
                </div>
              ))}
            </section>

            {isArtisan && (
              <Section title={pp.myProducts} action={shopLive && linkBtn(t.addProduct.open, () => navigate("add-product"))}>
                {myProducts.length === 0
                  ? <p style={muted}>{pp.myProductsEmpty}</p>
                  : <div className="a-product-grid">{myProducts.map(card)}</div>}
              </Section>
            )}

            {isArtisan && (
              <Section title={pp.recentShopOrders} action={shopOrders?.length > RECENT_SHOP_ORDERS && linkBtn(pp.viewAll, () => navigate("shop-orders"))}>
                {!shopOrders ? <p style={muted}>…</p>
                  : shopOrders.length === 0 ? <p style={muted}>{o.shopNone}</p>
                  : (
                    <ul style={{ listStyle:"none", margin:0, padding:0 }}>
                      {shopOrders.slice(0, RECENT_SHOP_ORDERS).map((order, i) => (
                        <OrderRow key={order.id} first={i === 0} onOpen={() => openOrder(order.id)}
                          title={`${new Date(order.createdAt).toLocaleDateString([], { dateStyle:"medium" })} · ${o.status[order.status] || order.status}`}
                          sub={`${o.units(order.units)} · ${order.tiers.map((k) => o.tierName[k]).join(", ")}`}
                          amount={fmtAmt(order.subtotal)} />
                      ))}
                    </ul>
                  )}
              </Section>
            )}

            <Section title={o.historyTitle}>
              {orders.length === 0 ? <p style={muted}>{o.none}</p> : (
                <ul style={{ listStyle:"none", margin:0, padding:0 }}>
                  {orders.map((order, i) => (
                    <OrderRow key={order._id} first={i === 0} onOpen={() => openOrder(order._id)}
                      title={o.items(order.items.length)}
                      sub={`${new Date(order.createdAt).toLocaleDateString()} · ${o.status[order.status] || order.status}`}
                      amount={fmtAmt(order.total)} />
                  ))}
                </ul>
              )}
            </Section>

            <Section title={`${t.saved} (${savedItems.length})`}>
              {liked.length === 0
                ? <p style={muted}>{t.savedEmpty} · {t.savedHint}</p>
                : <div className="a-product-grid">{liked.map(card)}</div>}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
