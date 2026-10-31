import { useEffect, useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api } from "../api";

const REASON_MAX = 300;
// Which buttons each status gets. Reject / suspend first ask for an optional reason.
const ACTIONS_BY_STATUS = { pending: ["approve", "reject"], rejected: ["approve"], approved: ["suspend"], suspended: ["unsuspend"] };
const NEEDS_REASON = ["reject", "suspend"];

function ShopRow({ shop, a, reasonName, lang, onChange }) {
  const [asking, setAsking] = useState(null); // "reject" | "suspend" while the reason box is open
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    try {
      await onChange(shop, action, NEEDS_REASON.includes(action) ? reason.trim() : "");
      setAsking(null);
      setReason("");
    } finally {
      setBusy(false);
    }
  };

  const btn = { padding:"8px 16px", fontSize:13, minHeight:40 };
  const chipColor = shop.status === "approved" ? COLORS.ink : COLORS.accentDark;

  return (
    <li className="a-info-block" style={{ padding:"16px 18px", marginBottom:12, fontFamily:FONT_SANS }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:10, flexWrap:"wrap" }}>
        <h3 style={{ fontFamily:FONT_SERIF, fontSize:20, fontWeight:600, color:COLORS.ink, overflowWrap:"anywhere" }}>{shop.shopName || "—"}</h3>
        <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.4, color:chipColor, background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"3px 10px" }}>
          {a.status[shop.status] || shop.status}
        </span>
      </div>
      <div style={{ fontSize:12, color:COLORS.inkSoft, marginTop:4, display:"flex", gap:12, flexWrap:"wrap" }}>
        <span>{a.owner}: {shop.owner}</span>
        <span>{a.created}: {new Date(shop.createdAt).toLocaleDateString(lang === "mn" ? "mn-MN" : lang === "ko" ? "ko-KR" : "en-US", { dateStyle:"medium" })}</span>
        <span>{a.products(shop.productCount)}</span>
        {shop.slug && <span>/{shop.slug}</span>}
      </div>
      <p style={{ fontSize:14, color: shop.description ? COLORS.ink : COLORS.inkSoft, lineHeight:1.55, marginTop:10, whiteSpace:"pre-wrap", overflowWrap:"anywhere" }}>
        {shop.description || a.noDescription}
      </p>
      {shop.statusReason && (
        <p style={{ fontSize:13, color:COLORS.accentDark, marginTop:8 }}>{reasonName}: {shop.statusReason}</p>
      )}

      {asking ? (
        <div style={{ marginTop:12 }}>
          <label className="a-label" htmlFor={`reason-${shop.id}`}>{a.reasonLabel}</label>
          <textarea id={`reason-${shop.id}`} className="a-textarea" style={{ minHeight:72 }} maxLength={REASON_MAX}
            value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby={`reason-${shop.id}-hint`} />
          <div id={`reason-${shop.id}-hint`} style={{ fontSize:12, color:COLORS.inkSoft, marginTop:4 }}>{a.reasonHint} · {reason.length} / {REASON_MAX}</div>
          <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
            <button type="button" className="a-btn-primary" style={btn} disabled={busy} onClick={() => run(asking)}>
              {asking === "reject" ? a.confirmReject : a.confirmSuspend}
            </button>
            <button type="button" className="a-btn-outline" style={{ ...btn, borderColor:COLORS.border }} disabled={busy} onClick={() => { setAsking(null); setReason(""); }}>
              {a.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
          {(ACTIONS_BY_STATUS[shop.status] || []).map((action) => (
            <button key={action} type="button" className={action === "approve" || action === "unsuspend" ? "a-btn-primary" : "a-btn-outline"} style={btn} disabled={busy}
              onClick={() => (NEEDS_REASON.includes(action) ? setAsking(action) : run(action))}>
              {a[action]}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

// Admin: the pending-shop review queue, and all shops (suspend / unsuspend).
// The server checks the admin role on every call.
export default function AdminShops({ t, lang, onApiError, showToast }) {
  const a = t.adminShops;
  const [tab, setTab] = useState("pending");
  const [shops, setShops] = useState(null); // null = loading
  const [loadFailed, setLoadFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let stale = false;
    setShops(null);
    setLoadFailed(false);
    api.getAdminShops(tab === "pending" ? "pending" : undefined)
      .then((list) => { if (!stale) setShops(list); })
      .catch((err) => { if (stale) return; if (err.status === 401) onApiError(err); setLoadFailed(true); setShops([]); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, version]);

  const change = async (shop, action, reason) => {
    try {
      const updated = await api.changeShopStatus(shop.id, action, reason);
      // Approved/rejected shops leave the pending queue; elsewhere the row updates in place.
      setShops((list) => (tab === "pending" ? list.filter((s) => s.id !== shop.id) : list.map((s) => (s.id === shop.id ? updated : s))));
      showToast(a.done[action]);
    } catch (err) {
      if (err.status === 401) return onApiError(err);
      showToast(err.code === "BAD_TRANSITION" ? err.message : a.error);
      setVersion((v) => v + 1); // someone else may have changed it: reload
    }
  };

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page page" style={{ maxWidth:860 }}>
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:6 }}>{a.title}</h1>
        <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, marginBottom:20 }}>{a.intro}</p>

        <div role="tablist" aria-label={a.title} style={{ display:"flex", background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:3, marginBottom:20, maxWidth:420 }}>
          {[["pending", a.tabPending], ["all", a.tabAll]].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              style={{ flex:1, padding:"10px 0", minHeight:44, border:"none", borderRadius:2, fontFamily:FONT_SANS, fontWeight:700, fontSize:14, cursor:"pointer", background: tab === key ? COLORS.card : "transparent", color: tab === key ? COLORS.accentDark : COLORS.inkSoft }}>
              {label}{key === "pending" && tab === "pending" && shops ? ` (${shops.length})` : ""}
            </button>
          ))}
        </div>

        {shops === null ? (
          <p style={{ fontFamily:FONT_SANS, color:COLORS.inkSoft }}>…</p>
        ) : loadFailed ? (
          <div role="alert" style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.accentDark }}>
            {a.loadError}{" "}
            <button type="button" className="a-shop-link" style={{ color:COLORS.accentDark, fontWeight:700 }} onClick={() => setVersion((v) => v + 1)}>{a.reload}</button>
          </div>
        ) : shops.length === 0 ? (
          <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>{tab === "pending" ? a.empty : a.emptyAll}</p>
        ) : (
          <ul style={{ listStyle:"none", margin:0, padding:0 }}>
            {shops.map((shop) => <ShopRow key={shop.id} shop={shop} a={a} reasonName={t.shopStatus.reason} lang={lang} onChange={change} />)}
          </ul>
        )}
      </div>
    </div>
  );
}
