import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { placeholderEmoji } from "../placeholders";
import { artisanInfo } from "../artisanInfo";

const TIER_DISPLAY = { basic: "Basic", story: "Story", patron: "Patron" };

export default function Cart({ lang, t, cart, onUpdateQty, onRemove, onCheckout, fmtAmt, navigate }) {
  const c = t.cartPage;
  const items = cart?.items || [];
  const isEmpty = items.length === 0;

  const lineTotal = (item) => item.product.pricingTiers[item.tier].price * item.qty;
  const subtotalUSD = items.reduce((s, i) => s + lineTotal(i), 0);
  const feeUSD = subtotalUSD * 0.15;
  const shippingUSD = isEmpty ? 0 : 12;
  const totalUSD = subtotalUSD + feeUSD + shippingUSD;

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page">
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:32, fontWeight:600, color:COLORS.ink, marginBottom:32 }}>
          {c.title}
        </h1>

        {isEmpty ? (
          <div style={{ textAlign:"center", padding:"64px 0" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🛍</div>
            <div style={{ fontFamily:FONT_SERIF, fontSize:20, color:COLORS.ink, marginBottom:6 }}>{t.cartEmpty}</div>
            <div style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, marginBottom:24 }}>{t.cartHint}</div>
            <button type="button" className="a-btn-primary" onClick={() => navigate("shop")}>{t.startShopping}</button>
          </div>
        ) : (
          <div className="a-layout-side">
            <div>
              {items.map((item, idx) => {
                const p = item.product;
                const name = lang === "mn" ? p.title : p.titleEn || p.title;
                const artisanName = artisanInfo(p.artisan).displayName;
                return (
                  <div
                    key={`${p._id}-${item.tier}`}
                    style={{ display:"flex", gap:16, alignItems:"center", padding:"20px 0", borderBottom: idx < items.length - 1 ? `1px solid ${COLORS.border}` : "none" }}
                  >
                    <div style={{ width:80, height:80, flexShrink:0, background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, overflow:"hidden" }}>
                      {placeholderEmoji(p.category)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:FONT_SERIF, fontSize:17, fontWeight:600, color:COLORS.ink, marginBottom:4 }}>{name}</div>
                      <div style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>{c.by(artisanName)} · {TIER_DISPLAY[item.tier]}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <button type="button" className="a-qty-btn" aria-label={`Decrease quantity of ${name}`} onClick={() => onUpdateQty(p._id, item.tier, Math.max(1, item.qty - 1))}>−</button>
                      <input className="a-qty-input" type="text" inputMode="numeric" readOnly value={item.qty} aria-label={`Quantity of ${name}`} />
                      <button type="button" className="a-qty-btn" aria-label={`Increase quantity of ${name}`} onClick={() => onUpdateQty(p._id, item.tier, item.qty + 1)}>+</button>
                    </div>
                    <div style={{ width:80, textAlign:"right", fontFamily:FONT_SANS, fontWeight:700, fontSize:15, color:COLORS.ink }}>
                      {fmtAmt(lineTotal(item))}
                    </div>
                    <button
                      type="button"
                      className="a-icon-btn"
                      aria-label={`Remove ${name} from cart`}
                      onClick={() => onRemove(p._id, item.tier)}
                    >
                      <span aria-hidden="true">🗑</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="a-info-block">
              <div className="a-label" style={{ marginBottom:16 }}>{c.summaryTitle}</div>
              <div style={{ display:"flex", justifyContent:"space-between", fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, marginBottom:10 }}>
                <span>{c.subtotal}</span><span>{fmtAmt(subtotalUSD)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, marginBottom:10 }}>
                <span>{c.fee}</span><span>{fmtAmt(feeUSD)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, marginBottom:14, paddingBottom:14, borderBottom:`1px solid ${COLORS.border}` }}>
                <span>{c.shipping}</span><span>{fmtAmt(shippingUSD)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontFamily:FONT_SERIF, fontSize:20, fontWeight:700, color:COLORS.ink, marginBottom:20 }}>
                <span>{c.total}</span><span>{fmtAmt(totalUSD)}</span>
              </div>
              <button type="button" className="a-btn-primary" style={{ width:"100%", marginBottom:14 }} onClick={onCheckout}>{c.checkout}</button>
              <div style={{ display:"flex", gap:8, fontFamily:FONT_SANS, fontSize:11, color:COLORS.inkSoft, lineHeight:1.5 }}>
                <span aria-hidden="true">🔒</span>
                <span>{c.escrowNote}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
