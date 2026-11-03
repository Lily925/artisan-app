import { COLORS, FONT_SANS, FONT_SERIF } from "../theme";
import { OrderRow } from "./ProfilePage";

// /orders: the same order history the profile page shows, at its own address.
export default function OrdersPage({ t, orders, loaded, fmtAmt, openOrder, onReview }) {
  const o = t.orders;
  const muted = { fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft };
  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page page">
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:20 }}>{o.historyTitle}</h1>
        {!loaded ? <p role="status" style={muted}>…</p> : orders.length === 0 ? <p style={muted}>{o.none}</p> : (
          <ul className="a-info-block" style={{ listStyle:"none", margin:0 }}>
            {orders.map((order, i) => (
              <OrderRow key={order._id} first={i === 0} onOpen={() => openOrder(order._id)}
                title={o.items(order.items.length)}
                sub={`${new Date(order.createdAt).toLocaleDateString()} · ${o.status[order.status] || order.status}`}
                amount={fmtAmt(order.total)}
                action={order.nextReviewItem != null && <button type="button" className="a-btn-outline" style={{ padding:"8px 16px", fontSize:13, minHeight:40 }} onClick={() => onReview(order._id, order.nextReviewItem)}>★ {t.reviews.write}</button>} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
