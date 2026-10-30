import { useEffect, useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api } from "../api";

// Artisan: orders placed with their own shop, newest first. Opens the order detail page.
export default function ShopOrders({ t, fmtAmt, navigate, openOrder, onApiError }) {
  const o = t.orders;
  const [orders, setOrders] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    api.getShopOrders()
      .then((res) => { if (!stale) setOrders(res); })
      .catch((err) => { if (stale) return; if (err.status === 401) onApiError(err); setFailed(true); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const muted = { fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft };
  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page">
        <button type="button" className="a-shop-link" style={{ fontFamily:FONT_SANS, fontSize:13, marginBottom:16 }} onClick={() => navigate("profile")}>‹ {o.back}</button>
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:6 }}>{o.shopTitle}</h1>
        <p style={{ ...muted, fontSize:13, marginBottom:24 }}>{o.shopIntro}</p>

        {failed ? <p style={muted}>{o.loadError}</p>
          : !orders ? <p style={muted}>…</p>
          : orders.length === 0 ? <p style={muted}>{o.shopNone}</p>
          : (
            <ul className="a-info-block" style={{ listStyle:"none", margin:0, padding:0 }}>
              {orders.map((order, i) => (
                <li key={order.id} style={{ borderTop: i ? `1px solid ${COLORS.border}` : "none" }}>
                  <button type="button" onClick={() => openOrder(order.id, "shop-orders")}
                    style={{ display:"flex", width:"100%", justifyContent:"space-between", alignItems:"center", gap:12, padding:"14px 18px", background:"none", border:"none", cursor:"pointer", textAlign:"left", minHeight:44 }}>
                    <span>
                      <span style={{ display:"block", fontFamily:FONT_SANS, fontSize:14, fontWeight:700, color:COLORS.ink }}>
                        {new Date(order.createdAt).toLocaleDateString([], { dateStyle:"medium" })} · {o.status[order.status]}
                      </span>
                      <span style={{ display:"block", fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:2 }}>
                        {o.units(order.units)} · {order.tiers.map((k) => o.tierName[k]).join(", ")}
                        {order.videosMissing > 0 && !["completed", "cancelled"].includes(order.status) && (
                          <span style={{ marginLeft:8, fontWeight:700, color:COLORS.ink, background:COLORS.accentSoft, borderRadius:2, padding:"1px 6px" }}>
                            {o.videosMissing(order.videosMissing)}
                          </span>
                        )}
                      </span>
                    </span>
                    <span style={{ fontFamily:FONT_SANS, fontSize:14, fontWeight:700, color:COLORS.ink, whiteSpace:"nowrap" }}>{fmtAmt(order.subtotal)} ›</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}
