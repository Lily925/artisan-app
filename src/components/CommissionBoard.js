import { useEffect, useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api } from "../api";

const MAX_BID_USD = 10000;

export function categoryLabel(t, key) {
  return t.productCategories.find((c) => c.key === key)?.label || key;
}

export function RequestSummary({ t, request, children }) {
  const c = t.commissions;
  const facts = [
    request.budgetRange && `${c.budget}: ${request.budgetRange}`,
    request.timeline && `${c.timeline}: ${request.timeline}`,
  ].filter(Boolean);
  return (
    <div className="a-info-block">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:12, flexWrap:"wrap", marginBottom:10 }}>
        <span className="a-label" style={{ marginBottom:0 }}>{categoryLabel(t, request.category)}</span>
        <span style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>
          {request.buyer?.name ? `${c.by(request.buyer.name)} · ` : ""}{new Date(request.createdAt).toLocaleDateString()}
        </span>
      </div>
      <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.ink, lineHeight:1.6, whiteSpace:"pre-wrap", overflowWrap:"anywhere", margin:"0 0 10px" }}>
        {request.description}
      </p>
      {facts.length > 0 && (
        <div style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginBottom:4 }}>{facts.join(" · ")}</div>
      )}
      {children}
    </div>
  );
}

function BidForm({ t, request, onSent, onApiError }) {
  const c = t.commissions;
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const value = Number(price);
    if (!Number.isFinite(value) || value <= 0 || value > MAX_BID_USD) { setError(c.priceInvalid); return; }
    setBusy(true);
    setError("");
    try {
      const { bid, bidCount } = await api.submitBid(request._id, value, message.trim());
      onSent(request._id, bid, bidCount);
    } catch (err) {
      if (err.status === 401) onApiError(err);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const priceId = `bid-price-${request._id}`;
  const msgId = `bid-msg-${request._id}`;
  return (
    <form onSubmit={submit} style={{ marginTop:14, paddingTop:14, borderTop:`1px solid ${COLORS.border}` }}>
      <div style={{ display:"grid", gridTemplateColumns:"minmax(120px,160px) 1fr", gap:12, marginBottom:12 }}>
        <div>
          <label className="a-label" htmlFor={priceId}>{c.priceLabel}</label>
          <input
            id={priceId} className="a-input" type="number" inputMode="decimal" min="0.01" max={MAX_BID_USD} step="0.01"
            value={price} onChange={(e) => setPrice(e.target.value)} required
          />
        </div>
        <div>
          <label className="a-label" htmlFor={msgId}>{c.messageLabel}</label>
          <input
            id={msgId} className="a-input" type="text" maxLength={1000} placeholder={c.messagePlaceholder}
            value={message} onChange={(e) => setMessage(e.target.value)}
          />
        </div>
      </div>
      {error && <div role="alert" style={{ fontFamily:FONT_SANS, fontSize:12, color:"#B3261E", marginBottom:10 }}>{error}</div>}
      <button type="submit" className="a-btn-primary" disabled={busy}>{busy ? c.sending : c.sendBid}</button>
    </form>
  );
}

// Open commission requests, for artisans to bid on.
export default function CommissionBoard({ t, fmtAmt, canBid, onApiError, showToast }) {
  const c = t.commissions;
  const [category, setCategory] = useState("");
  const [requests, setRequests] = useState(null); // null = loading
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    setRequests(null);
    setLoadFailed(false);
    api.getCommissions(category)
      .then((list) => { if (!stale) setRequests(list); })
      .catch((err) => {
        if (stale) return;
        if (err.status === 401) onApiError(err);
        setLoadFailed(true);
        setRequests([]);
      });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const handleSent = (id, bid, bidCount) => {
    setRequests((list) => list.map((r) => (r._id === id ? { ...r, myBid: bid, bidCount } : r)));
    showToast(c.bidSent);
  };

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page">
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:28, fontWeight:600, color:COLORS.ink, marginBottom:10 }}>{c.boardTitle}</h1>
        <p className="a-readable" style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, lineHeight:1.6, marginBottom:20 }}>{c.boardIntro}</p>

        <div role="group" aria-label={t.auctionPage.categoryLabel} style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, marginBottom:24 }}>
          {[{ key:"", label:c.all }, ...t.productCategories].map((cat) => (
            <button
              key={cat.key} type="button" className={`a-chip${category === cat.key ? " selected" : ""}`}
              aria-pressed={category === cat.key} onClick={() => setCategory(cat.key)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {!canBid && (
          <div className="a-callout" style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, marginBottom:20 }}>{c.noShop}</div>
        )}

        <div aria-live="polite" className="a-card-grid">
          {requests === null ? (
            <div style={{ gridColumn:"1 / -1", fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft }}>…</div>
          ) : requests.length === 0 ? (
            <div style={{ gridColumn:"1 / -1", fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>{loadFailed ? c.loadError : c.boardEmpty}</div>
          ) : requests.map((r) => (
            <RequestSummary key={r._id} t={t} request={r}>
              <div style={{ fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:COLORS.accentDark }}>{c.bidCount(r.bidCount)}</div>
              {r.isMine ? (
                <div style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, marginTop:12 }}>{c.ownRequest}</div>
              ) : r.myBid ? (
                <div className="a-callout" style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, marginTop:14 }}>
                  <strong>{c.yourBid}: {fmtAmt(r.myBid.price)}</strong> · {c.bidStatus[r.myBid.status] || r.myBid.status}
                  {r.myBid.message && <div style={{ color:COLORS.inkSoft, marginTop:4, overflowWrap:"anywhere" }}>{r.myBid.message}</div>}
                </div>
              ) : canBid ? (
                <BidForm t={t} request={r} onSent={handleSent} onApiError={onApiError} />
              ) : null}
            </RequestSummary>
          ))}
        </div>
      </div>
    </div>
  );
}
