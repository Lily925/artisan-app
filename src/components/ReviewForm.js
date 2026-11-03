import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { COLORS, FONT_SANS, FONT_SERIF } from "../theme";
import { api } from "../api";
import { NotFound, PageLoadError, PageLoading } from "./Routing";
import { Stars } from "./StarRating";
import ProductImage from "./ProductImage";
import { fmtReviewDate } from "./ProductReviews";

const COMMENT_MAX = 1000;
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

const CSS = `
  .rf-star{cursor:pointer;font-size:34px;line-height:1;padding:4px 3px;color:${COLORS.border};}
  .rf-star.on{color:${COLORS.accentDark};}
  .rf-stars input:focus-visible + .rf-star{outline:2px solid ${COLORS.accentDark};outline-offset:1px;border-radius:2px;}
  .rf-thumbs{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 10px;padding:0;list-style:none;}
  .rf-thumb{position:relative;width:96px;height:96px;border:1.5px solid ${COLORS.border};border-radius:2px;overflow:hidden;background:${COLORS.bgSoft};}
  .rf-remove{position:absolute;top:4px;right:4px;width:30px;height:30px;border-radius:50%;border:none;background:rgba(59,42,50,0.78);color:#fff;font-size:16px;line-height:1;cursor:pointer;}
`;

// Stars as real radio buttons: arrow keys and screen readers work without extra code.
function StarInput({ r, value, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <fieldset className="rf-stars" style={{ border:"none", padding:0, margin:"0 0 20px" }} onMouseLeave={() => setHover(0)}>
      <legend className="a-label">{r.ratingLabel} *</legend>
      <div style={{ display:"flex" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} onMouseEnter={() => setHover(n)}>
            <input type="radio" className="a-sr-only" name="review-rating" aria-label={r.starOption(n)} checked={value === n} onChange={() => onChange(n)} />
            <span aria-hidden="true" className={`rf-star${n <= (hover || value) ? " on" : ""}`} style={{ display:"inline-block" }}>★</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// The form itself, for a new review or an open one.
function Editor({ t, lang, orderId, item, review, onDone, onApiError }) {
  const r = t.reviews;
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState(review?.comment || "");
  const [photos, setPhotos] = useState(() => (review?.photos || []).map((url) => ({ url }))); // { url } or { file, preview }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const input = useRef(null);
  const live = useRef(photos);
  live.current = photos;
  useEffect(() => () => live.current.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), []);

  const addFiles = (list) => {
    const problems = [];
    const added = [];
    for (const file of list) {
      if (!PHOTO_TYPES.includes(file.type)) { problems.push(r.photoType(file.name)); continue; }
      if (file.size > MAX_PHOTO_BYTES) { problems.push(r.photoTooBig(file.name)); continue; }
      if (photos.length + added.length >= MAX_PHOTOS) { problems.push(r.photoLimit(MAX_PHOTOS)); break; }
      added.push({ file, preview: URL.createObjectURL(file) });
    }
    if (added.length) setPhotos([...photos, ...added]);
    setError([...new Set(problems)].join(" · "));
  };
  const removePhoto = (photo) => {
    if (photo.preview) URL.revokeObjectURL(photo.preview);
    setPhotos(photos.filter((p) => p !== photo));
  };
  const showError = (err) => {
    if (err.status === 401) onApiError(err);
    else setError(r.errors[err.code] || r.errors.generic);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { setError(r.errors.BAD_RATING); return; }
    const form = new FormData();
    form.append("rating", String(rating));
    form.append("comment", comment);
    photos.filter((p) => p.file).forEach((p) => form.append("photos", p.file));
    setBusy(true);
    setError("");
    try {
      if (review) {
        form.append("keepPhotos", JSON.stringify(photos.filter((p) => p.url).map((p) => p.url)));
        await api.updateReview(review.id, form);
        onDone(r.updated);
      } else {
        form.append("orderId", orderId);
        form.append("itemIndex", String(item.index));
        await api.createReview(form);
        onDone(r.saved);
      }
    } catch (err) {
      showError(err);
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await api.deleteReview(review.id);
      onDone(r.deleted);
    } catch (err) {
      showError(err);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <StarInput r={r} value={rating} onChange={setRating} />

      <div style={{ marginBottom:20 }}>
        <label className="a-label" htmlFor="review-comment">{r.commentLabel}</label>
        <textarea id="review-comment" className="a-textarea" style={{ minHeight:120 }} maxLength={COMMENT_MAX} value={comment} placeholder={r.commentPlaceholder}
          onChange={(e) => setComment(e.target.value)} aria-describedby="review-comment-count" />
        <div id="review-comment-count" style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:6, textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{r.counter(comment.length, COMMENT_MAX)}</div>
      </div>

      <div style={{ marginBottom:20 }}>
        <div className="a-label">{r.photosLabel}</div>
        {photos.length > 0 && (
          <ul className="rf-thumbs">
            {photos.map((photo, i) => (
              <li key={photo.url || photo.preview} className="rf-thumb">
                <ProductImage src={photo.url || photo.preview} alt={r.photoAlt(i + 1)} eager />
                <button type="button" className="rf-remove" aria-label={r.photoRemove(i + 1)} onClick={() => removePhoto(photo)}>×</button>
              </li>
            ))}
          </ul>
        )}
        {photos.length < MAX_PHOTOS && (
          <>
            <input ref={input} type="file" accept={PHOTO_TYPES.join(",")} multiple className="a-sr-only" id="review-photos" tabIndex={-1} aria-describedby="review-photos-hint"
              onChange={(e) => { addFiles([...e.target.files]); e.target.value = ""; }} />
            <button type="button" className="a-btn-outline" style={{ padding:"8px 16px", fontSize:13, minHeight:40 }} onClick={() => input.current?.click()}>{r.photoAdd}</button>
          </>
        )}
        <div id="review-photos-hint" style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:6 }}>{r.photosHint}</div>
      </div>

      <p style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, lineHeight:1.5, marginBottom:16 }}>
        {r.publicNote}{review && <> {r.editNote(fmtReviewDate(review.editableUntil, lang))}</>}
      </p>
      {error && <p role="alert" style={{ fontFamily:FONT_SANS, fontSize:13, fontWeight:600, color:"#B3261E", marginBottom:12 }}>{error}</p>}

      {confirming ? (
        <div role="alertdialog" aria-labelledby="review-delete-q" className="a-callout">
          <p id="review-delete-q" style={{ fontFamily:FONT_SANS, fontSize:13, fontWeight:700, color:COLORS.ink, marginBottom:10 }}>{r.deleteConfirm}</p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button type="button" className="a-btn-primary" style={{ padding:"8px 16px", minHeight:40, background:"#B3261E", color:"#fff" }} disabled={busy} onClick={remove}>{busy ? r.deleting : r.deleteYes}</button>
            <button type="button" className="a-btn-outline" style={{ padding:"8px 16px", minHeight:40 }} disabled={busy} onClick={() => setConfirming(false)} autoFocus>{r.cancel}</button>
          </div>
        </div>
      ) : (
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button type="submit" className="a-btn-primary" disabled={busy}>{busy ? r.saving : review ? r.save : r.submit}</button>
          {review && <button type="button" className="a-btn-outline" style={{ color:"#B3261E", borderColor:"#B3261E" }} disabled={busy} onClick={() => setConfirming(true)}>{r.delete}</button>}
        </div>
      )}
    </form>
  );
}

// /orders/:orderId/review/:itemIndex. The server decides everything again; this only explains.
export default function ReviewForm({ t, lang, onDone, onBack, onApiError }) {
  const r = t.reviews;
  const { orderId, itemIndex } = useParams();
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | missing | failed
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stale = false;
    setStatus("loading");
    api.getOrder(orderId)
      .then((res) => { if (!stale) { setOrder(res); setStatus("ready"); } })
      .catch((err) => {
        if (stale) return;
        if (err.status === 401) onApiError(err);
        else setStatus(err.status === 404 || err.status === 400 ? "missing" : "failed");
      });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, attempt]);

  if (status === "failed") return <PageLoadError t={t} onRetry={() => setAttempt((n) => n + 1)} />;
  if (status === "missing") return <NotFound t={t} />;
  if (status === "loading" || !order) return <PageLoading />;
  const item = /^\d+$/.test(itemIndex) ? order.items[Number(itemIndex)] : null;
  // Only the buyer has a review state; the order's artisan can see the order but not this form.
  if (!item?.reviewState) return <NotFound t={t} />;

  const { canReview, block, review } = item.reviewState;
  const name = lang === "mn" ? item.title : item.titleEn || item.title;
  const muted = { fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, lineHeight:1.6 };
  const open = canReview || review?.editable;

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <style>{CSS}</style>
      <div className="a-page page a-page-form">
        <button type="button" className="a-shop-link" style={{ fontFamily:FONT_SANS, fontSize:13, marginBottom:16 }} onClick={onBack}>‹ {r.back}</button>
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:16 }}>{review ? r.editTitle : r.formTitle}</h1>

        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
          <div style={{ position:"relative", width:64, height:64, flexShrink:0, border:`1px solid ${COLORS.border}`, borderRadius:2, overflow:"hidden" }}>
            <ProductImage src={item.image} alt="" />
          </div>
          <span style={{ fontFamily:FONT_SERIF, fontSize:20, fontWeight:600, color:COLORS.ink, overflowWrap:"anywhere" }}>{name}</span>
        </div>

        {open ? (
          <Editor t={t} lang={lang} orderId={orderId} item={item} review={review} onDone={onDone} onApiError={onApiError} />
        ) : review ? (
          <div className="a-info-block" style={{ fontFamily:FONT_SANS }}>
            <span role="img" aria-label={r.starsAria(review.rating)}><Stars value={review.rating} size={18} /></span>
            {review.comment && <p style={{ fontSize:14, color:COLORS.ink, lineHeight:1.6, marginTop:10, whiteSpace:"pre-line", overflowWrap:"anywhere" }}>{review.comment}</p>}
            <p role="status" style={{ ...muted, fontSize:13, marginTop:12 }}>
              {review.hidden ? <>{r.hiddenNote}{review.hiddenReason && <> {r.hiddenReason}: {review.hiddenReason}</>}</> : r.locked}
            </p>
          </div>
        ) : (
          <p role="status" style={muted}>{r.blocked[block] || r.errors.generic}</p>
        )}
      </div>
    </div>
  );
}
