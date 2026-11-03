import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { COLORS, FONT_SANS, FONT_SERIF } from "../theme";
import { api, assetUrl } from "../api";
import { Stars } from "./StarRating";
import ProductImage from "./ProductImage";

const REPLY_MAX = 1000;
const LOCALES = { mn: "mn-MN", ko: "ko-KR", en: "en-US" };
export const fmtReviewDate = (date, lang) => new Date(date).toLocaleDateString(LOCALES[lang] || "en-US", { dateStyle:"medium" });

const CSS = `
  .rv-top{display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr);gap:32px;align-items:center;}
  @media (max-width:640px){.rv-top{grid-template-columns:1fr;gap:20px;}}
  .rv-bar{flex:1;height:8px;background:${COLORS.bgSoft};border:1px solid ${COLORS.border};border-radius:4px;overflow:hidden;}
  .rv-photos{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;}
  .rv-photo{position:relative;display:block;width:88px;height:88px;border:1px solid ${COLORS.border};border-radius:2px;overflow:hidden;background:${COLORS.bgSoft};}
  .rv-verified{font-family:${FONT_SANS};font-size:11px;font-weight:700;color:${COLORS.accentDark};background:${COLORS.accentSoft};padding:3px 8px;border-radius:2px;white-space:nowrap;}
`;

function ReplyForm({ t, review, onReplied, onApiError }) {
  const r = t.reviews;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = `reply-${review.id}`;

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) { setError(r.errors.EMPTY_REPLY); return; }
    setBusy(true);
    setError("");
    try {
      const { reply } = await api.replyToReview(review.id, text);
      onReplied(review.id, reply);
    } catch (err) {
      if (err.status === 401) onApiError(err);
      else setError(r.errors[err.code] || r.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate style={{ marginTop:14 }}>
      <label className="a-label" htmlFor={id}>{r.replyLabel}</label>
      <textarea id={id} className="a-textarea" style={{ minHeight:72 }} maxLength={REPLY_MAX} value={text} onChange={(e) => setText(e.target.value)} aria-describedby={`${id}-hint`} />
      <div id={`${id}-hint`} style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:4 }}>{r.replyHint} · {r.counter(text.length, REPLY_MAX)}</div>
      {error && <p role="alert" style={{ fontFamily:FONT_SANS, fontSize:13, color:"#B3261E", marginTop:6 }}>{error}</p>}
      <button type="submit" className="a-btn-outline" style={{ padding:"8px 16px", fontSize:13, minHeight:40, marginTop:10 }} disabled={busy}>{busy ? r.replySending : r.replySend}</button>
    </form>
  );
}

function ReviewCard({ t, lang, review, onEdit, onReplied, onApiError }) {
  const r = t.reviews;
  return (
    <li className="a-info-block" style={{ marginBottom:12, fontFamily:FONT_SANS }}>
      <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:"6px 10px" }}>
        <span role="img" aria-label={r.starsAria(review.rating)}><Stars value={review.rating} /></span>
        <span style={{ fontSize:14, fontWeight:700, color:COLORS.ink, overflowWrap:"anywhere" }}>{review.displayName || r.anonymous}</span>
        <span className="rv-verified">✓ {r.verified}</span>
        <span style={{ fontSize:12, color:COLORS.inkSoft }}>{fmtReviewDate(review.createdAt, lang)}{review.edited && ` · ${r.edited}`}</span>
        {review.own?.editable && (
          <button type="button" className="a-shop-link" style={{ marginLeft:"auto", fontSize:13, fontWeight:700, color:COLORS.accentDark }} onClick={() => onEdit(review.own.orderId, review.own.itemIndex)}>{r.editYours}</button>
        )}
      </div>
      {review.comment && <p className="a-readable" style={{ fontSize:14, color:COLORS.ink, lineHeight:1.6, marginTop:10, whiteSpace:"pre-line", overflowWrap:"anywhere" }}>{review.comment}</p>}
      {review.photos.length > 0 && (
        <div className="rv-photos">
          {review.photos.map((url, i) => (
            <a key={url} className="rv-photo" href={assetUrl(url)} target="_blank" rel="noopener noreferrer">
              <ProductImage src={url} alt={r.photoAlt(i + 1)} />
            </a>
          ))}
        </div>
      )}
      {review.reply && (
        <div className="a-callout" style={{ marginTop:14, padding:"10px 14px" }}>
          <div style={{ fontSize:12, fontWeight:700, color:COLORS.ink, marginBottom:4 }}>{r.replyFrom} · <span style={{ fontWeight:400, color:COLORS.inkSoft }}>{fmtReviewDate(review.reply.at, lang)}</span></div>
          <p style={{ fontSize:13, color:COLORS.ink, lineHeight:1.55, whiteSpace:"pre-line", overflowWrap:"anywhere", margin:0 }}>{review.reply.text}</p>
        </div>
      )}
      {review.canReply && <ReplyForm t={t} review={review} onReplied={onReplied} onApiError={onApiError} />}
    </li>
  );
}

// The product page's reviews: public. Average, 5-to-1 breakdown, then the newest first, by page.
export default function ProductReviews({ t, lang, productId, viewerId, onEdit, onApiError, showToast }) {
  const r = t.reviews;
  const { hash } = useLocation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const section = useRef(null);
  const scrolled = useRef(false);

  useEffect(() => {
    let stale = false;
    setFailed(false);
    api.getProductReviews(productId, page)
      .then((res) => { if (!stale) setData(res); })
      .catch(() => { if (!stale) setFailed(true); });
    return () => { stale = true; };
  }, [productId, page, viewerId, attempt]);

  // Notification links end in #reviews, and the section only has its height once loaded.
  useEffect(() => {
    if (data && hash === "#reviews" && !scrolled.current) {
      scrolled.current = true;
      section.current?.scrollIntoView?.({ block:"start" });
    }
  }, [data, hash]);

  const goTo = (next) => { setPage(next); section.current?.scrollIntoView?.({ block:"start" }); };
  const onReplied = (id, reply) => {
    setData((d) => ({ ...d, reviews: d.reviews.map((x) => (x.id === id ? { ...x, reply, canReply: false } : x)) }));
    showToast(r.replySaved);
  };

  const summary = data?.summary;
  const count = summary?.count || 0;
  const reviews = data?.reviews || [];

  return (
    <section ref={section} id="reviews" aria-labelledby="reviews-title" className="a-page" style={{ paddingTop:0, scrollMarginTop:96 }}>
      <style>{CSS}</style>
      <h2 id="reviews-title" style={{ fontFamily:FONT_SERIF, fontSize:"clamp(24px,3vw,30px)", fontWeight:600, color:COLORS.ink, marginBottom:20 }}>
        {r.title}{count > 0 && <span style={{ fontFamily:FONT_SANS, fontSize:16, fontWeight:400, color:COLORS.inkSoft }}> ({count})</span>}
      </h2>

      {failed ? (
        <div role="alert" style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>
          {r.loadError}{" "}
          <button type="button" className="a-shop-link" style={{ fontWeight:700, color:COLORS.accentDark }} onClick={() => setAttempt((n) => n + 1)}>{r.retry}</button>
        </div>
      ) : !data ? (
        <p role="status" style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>…</p>
      ) : count === 0 ? (
        <div className="a-info-block" style={{ textAlign:"center", padding:"32px 24px", fontFamily:FONT_SANS }}>
          <p style={{ fontFamily:FONT_SERIF, fontSize:20, color:COLORS.ink, marginBottom:6 }}>{r.none}</p>
          <p style={{ fontSize:13, color:COLORS.inkSoft }}>{r.noneHint}</p>
        </div>
      ) : (
        <>
          <div className="a-info-block rv-top" style={{ marginBottom:20, fontFamily:FONT_SANS }}>
            <div role="img" aria-label={r.ratingAria(summary.average.toFixed(1), count)} style={{ textAlign:"center" }}>
              <div aria-hidden="true" style={{ fontFamily:FONT_SERIF, fontSize:48, fontWeight:700, color:COLORS.ink, lineHeight:1.1 }}>{summary.average.toFixed(1)}</div>
              <Stars value={summary.average} size={20} />
              <div aria-hidden="true" style={{ fontSize:13, color:COLORS.inkSoft, marginTop:6 }}>{r.count(count)}</div>
            </div>
            <ul aria-label={r.breakdownAria} style={{ listStyle:"none", margin:0, padding:0, display:"grid", gap:6 }}>
              {[5, 4, 3, 2, 1].map((stars) => {
                const n = summary.breakdown[stars] || 0;
                return (
                  <li key={stars} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, color:COLORS.ink }}>
                    <span className="a-sr-only">{r.breakdownRow(stars, n)}</span>
                    <span aria-hidden="true" style={{ width:28, whiteSpace:"nowrap" }}>{stars} <span style={{ color:COLORS.accentDark }}>★</span></span>
                    <span aria-hidden="true" className="rv-bar"><span style={{ display:"block", height:"100%", width:`${(n / count) * 100}%`, background:COLORS.accentDark }} /></span>
                    <span aria-hidden="true" style={{ width:32, textAlign:"right", fontVariantNumeric:"tabular-nums", color:COLORS.inkSoft }}>{n}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <ul style={{ listStyle:"none", margin:0, padding:0 }}>
            {reviews.map((review) => (
              <ReviewCard key={review.id} t={t} lang={lang} review={review} onEdit={onEdit} onReplied={onReplied} onApiError={onApiError} />
            ))}
          </ul>

          {data.pages > 1 && (
            <nav aria-label={r.paginationAria} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginTop:20, fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink }}>
              <button type="button" className="a-btn-outline" style={{ padding:"8px 16px", fontSize:13, minHeight:40 }} disabled={data.page <= 1} onClick={() => goTo(data.page - 1)}>‹ {r.prev}</button>
              <span aria-current="page">{r.pageOf(data.page, data.pages)}</span>
              <button type="button" className="a-btn-outline" style={{ padding:"8px 16px", fontSize:13, minHeight:40 }} disabled={data.page >= data.pages} onClick={() => goTo(data.page + 1)}>{r.next} ›</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
