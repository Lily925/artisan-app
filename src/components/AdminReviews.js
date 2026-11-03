import { useEffect, useState } from "react";
import { COLORS, FONT_SANS, FONT_SERIF } from "../theme";
import { api } from "../api";
import { Stars } from "./StarRating";
import ProductImage from "./ProductImage";
import { fmtReviewDate } from "./ProductReviews";

const REASON_MAX = 300;

function Row({ t, lang, review, onChange }) {
  const r = t.reviews;
  const a = r.admin;
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const id = `hide-${review.id}`;
  const btn = { padding:"8px 16px", fontSize:13, minHeight:40 };
  const title = review.product ? (lang === "mn" ? review.product.title : review.product.titleEn || review.product.title) : a.productGone;

  const run = async (action) => {
    if (action === "hide" && !reason.trim()) { setError(a.reasonRequired); return; }
    setBusy(true);
    setError("");
    try {
      await onChange(review, action, reason.trim());
      setAsking(false);
      setReason("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="a-info-block" style={{ marginBottom:12, fontFamily:FONT_SANS }}>
      <div style={{ display:"flex", justifyContent:"space-between", gap:10, flexWrap:"wrap", alignItems:"baseline" }}>
        <h2 style={{ fontFamily:FONT_SERIF, fontSize:19, fontWeight:600, color:COLORS.ink, overflowWrap:"anywhere" }}>{title}</h2>
        {review.hidden && <span style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.4, color:COLORS.accentDark, background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"3px 10px" }}>{a.hiddenTag}</span>}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:"4px 10px", fontSize:12, color:COLORS.inkSoft, marginTop:4 }}>
        <span role="img" aria-label={r.starsAria(review.rating)}><Stars value={review.rating} size={14} /></span>
        <span>{review.displayName || r.anonymous}</span>
        <span>{fmtReviewDate(review.createdAt, lang)}</span>
        {review.shopName && <span>{a.shop}: {review.shopName}</span>}
      </div>
      {review.comment && <p style={{ fontSize:14, color:COLORS.ink, lineHeight:1.55, marginTop:10, whiteSpace:"pre-line", overflowWrap:"anywhere" }}>{review.comment}</p>}
      {review.photos.length > 0 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:10 }}>
          {review.photos.map((url, i) => (
            <span key={url} style={{ position:"relative", display:"block", width:72, height:72, border:`1px solid ${COLORS.border}`, borderRadius:2, overflow:"hidden" }}><ProductImage src={url} alt={r.photoAlt(i + 1)} /></span>
          ))}
        </div>
      )}
      {review.reply && <p style={{ fontSize:13, color:COLORS.inkSoft, lineHeight:1.5, marginTop:10, whiteSpace:"pre-line", overflowWrap:"anywhere" }}><strong>{r.replyFrom}:</strong> {review.reply.text}</p>}
      {review.hidden && review.hiddenReason && <p style={{ fontSize:13, color:COLORS.accentDark, marginTop:8, overflowWrap:"anywhere" }}>{r.hiddenReason}: {review.hiddenReason}</p>}

      {asking ? (
        <div style={{ marginTop:12 }}>
          <label className="a-label" htmlFor={id}>{a.reasonLabel} *</label>
          <textarea id={id} className="a-textarea" style={{ minHeight:72 }} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby={`${id}-hint`} />
          <div id={`${id}-hint`} style={{ fontSize:12, color:COLORS.inkSoft, marginTop:4 }}>{a.reasonHint} · {r.counter(reason.length, REASON_MAX)}</div>
          {error && <p role="alert" style={{ fontSize:13, color:"#B3261E", marginTop:6 }}>{error}</p>}
          <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
            <button type="button" className="a-btn-primary" style={btn} disabled={busy} onClick={() => run("hide")}>{a.confirmHide}</button>
            <button type="button" className="a-btn-outline" style={btn} disabled={busy} onClick={() => { setAsking(false); setReason(""); setError(""); }}>{r.cancel}</button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop:12 }}>
          {review.hidden
            ? <button type="button" className="a-btn-outline" style={btn} disabled={busy} onClick={() => run("unhide")}>{a.unhide}</button>
            : <button type="button" className="a-btn-outline" style={btn} onClick={() => setAsking(true)}>{a.hide}</button>}
        </div>
      )}
    </li>
  );
}

// /admin/reviews: hide a review, with a reason. The server checks the admin role on every call.
export default function AdminReviews({ t, lang, onApiError, showToast }) {
  const r = t.reviews;
  const a = r.admin;
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let stale = false;
    setData(null);
    setFailed(false);
    api.getAdminReviews(tab === "hidden" ? "hidden" : undefined, page)
      .then((res) => { if (!stale) setData(res); })
      .catch((err) => { if (stale) return; if (err.status === 401) onApiError(err); setFailed(true); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, version]);

  const change = async (review, action, reason) => {
    try {
      const updated = action === "hide" ? await api.hideReview(review.id, reason) : await api.unhideReview(review.id);
      setData((d) => ({ ...d, reviews: tab === "hidden" && !updated.hidden ? d.reviews.filter((x) => x.id !== review.id) : d.reviews.map((x) => (x.id === review.id ? updated : x)) }));
      showToast(a.done[action]);
    } catch (err) {
      if (err.status === 401) return onApiError(err);
      showToast(a.error);
      setVersion((v) => v + 1); // someone else may have changed it: reload
    }
    return undefined;
  };
  const muted = { fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft };

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page page" style={{ maxWidth:860 }}>
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:6 }}>{a.title}</h1>
        <p style={{ ...muted, marginBottom:20 }}>{a.intro}</p>

        <div role="tablist" aria-label={a.title} style={{ display:"flex", background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:3, marginBottom:20, maxWidth:420 }}>
          {[["all", a.tabAll], ["hidden", a.tabHidden]].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setPage(1); }}
              style={{ flex:1, padding:"10px 0", minHeight:44, border:"none", borderRadius:2, fontFamily:FONT_SANS, fontWeight:700, fontSize:14, cursor:"pointer", background: tab === key ? COLORS.card : "transparent", color: tab === key ? COLORS.accentDark : COLORS.inkSoft }}>
              {label}
            </button>
          ))}
        </div>

        {failed ? (
          <div role="alert" style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.accentDark }}>
            {r.loadError}{" "}
            <button type="button" className="a-shop-link" style={{ color:COLORS.accentDark, fontWeight:700 }} onClick={() => setVersion((v) => v + 1)}>{r.retry}</button>
          </div>
        ) : !data ? (
          <p role="status" style={muted}>…</p>
        ) : data.reviews.length === 0 ? (
          <p style={muted}>{tab === "hidden" ? a.emptyHidden : a.empty}</p>
        ) : (
          <ul style={{ listStyle:"none", margin:0, padding:0 }}>
            {data.reviews.map((review) => <Row key={review.id} t={t} lang={lang} review={review} onChange={change} />)}
          </ul>
        )}

        {data?.pages > 1 && (
          <nav aria-label={r.paginationAria} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginTop:20, fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink }}>
            <button type="button" className="a-btn-outline" style={{ padding:"8px 16px", fontSize:13, minHeight:40 }} disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ {r.prev}</button>
            <span aria-current="page">{r.pageOf(data.page, data.pages)}</span>
            <button type="button" className="a-btn-outline" style={{ padding:"8px 16px", fontSize:13, minHeight:40 }} disabled={page >= data.pages} onClick={() => setPage(page + 1)}>{r.next} ›</button>
          </nav>
        )}
      </div>
    </div>
  );
}
