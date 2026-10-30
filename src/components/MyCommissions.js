import { useEffect, useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api } from "../api";
import { artisanInfo } from "../artisanInfo";
import ArtisanAvatar from "./ArtisanAvatar";
import InstagramIcon from "./InstagramIcon";
import { RequestSummary } from "./CommissionBoard";

const STATUS_COLORS = {
  accepted: { background:COLORS.accentSoft, color:COLORS.ink },
  rejected: { background:"transparent", color:COLORS.inkSoft },
  pending: { background:COLORS.bgSoft, color:COLORS.inkSoft },
};

function Pill({ children, tone = "pending" }) {
  return (
    <span style={{ ...STATUS_COLORS[tone], border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"3px 8px", fontFamily:FONT_SANS, fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}

function BidRow({ t, bid, fmtAmt, canAccept, confirming, busy, onAsk, onCancel, onConfirm }) {
  const c = t.commissions;
  const { displayName, photoUrl } = artisanInfo(bid.artisan);
  return (
    <div style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"12px 0", borderTop:`1px solid ${COLORS.border}`, opacity: bid.status === "rejected" ? 0.6 : 1 }}>
      <ArtisanAvatar name={displayName} photoUrl={photoUrl} size={40} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap", alignItems:"baseline" }}>
          <span style={{ fontFamily:FONT_SANS, fontSize:14, fontWeight:700, color:COLORS.ink, overflowWrap:"anywhere" }}>
            {displayName || "—"}
            {bid.artisan?.certified && <span title={t.homePage.certified} aria-label={t.homePage.certified} style={{ color:COLORS.accentDark, marginLeft:6 }}>✓</span>}
          </span>
          <span style={{ fontFamily:FONT_SERIF, fontSize:20, fontWeight:600, color:COLORS.ink }}>{fmtAmt(bid.price)}</span>
        </div>
        {bid.artisan?.specialty && <div style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>{bid.artisan.specialty}</div>}
        {bid.message && (
          <p style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, lineHeight:1.5, margin:"6px 0 0", whiteSpace:"pre-wrap", overflowWrap:"anywhere" }}>{bid.message}</p>
        )}
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginTop:8 }}>
          {!canAccept && <Pill tone={bid.status}>{c.bidStatus[bid.status] || bid.status}</Pill>}
          {canAccept && !confirming && (
            <button type="button" className="a-btn-primary" style={{ padding:"8px 18px", fontSize:13 }} onClick={onAsk}>{c.accept}</button>
          )}
          {canAccept && confirming && (
            <>
              <span style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>{c.acceptWarn}</span>
              <button type="button" className="a-btn-primary" style={{ padding:"8px 18px", fontSize:13 }} disabled={busy} onClick={onConfirm}>
                {busy ? c.accepting : c.confirmAccept}
              </button>
              <button type="button" className="a-btn-outline" style={{ padding:"8px 18px", fontSize:13 }} disabled={busy} onClick={onCancel}>{c.cancel}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NextStep({ t, bid }) {
  const { displayName, instagramHandle, instagramUrl } = artisanInfo(bid.artisan);
  return (
    <div className="a-callout" style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, lineHeight:1.5, marginTop:12 }}>
      {t.commissions.nextStep(displayName)}
      {instagramUrl && (
        <a href={instagramUrl} target="_blank" rel="noopener noreferrer"
          style={{ display:"inline-flex", alignItems:"center", gap:6, marginLeft:8, color:COLORS.accentDark, fontWeight:700 }}>
          <InstagramIcon />@{instagramHandle}
        </a>
      )}
    </div>
  );
}

// The current user's own commission requests, with the bids to compare and accept.
export default function MyCommissions({ t, fmtAmt, navigate, onApiError, showToast }) {
  const c = t.commissions;
  const [requests, setRequests] = useState(null); // null = loading
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirming, setConfirming] = useState(null); // bid id awaiting confirmation
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stale = false;
    api.getMyCommissions()
      .then((list) => { if (!stale) setRequests(list); })
      .catch((err) => {
        if (stale) return;
        if (err.status === 401) onApiError(err);
        setLoadFailed(true);
        setRequests([]);
      });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = async (requestId, bidId) => {
    setBusy(true);
    try {
      const updated = await api.acceptBid(requestId, bidId);
      setRequests((list) => list.map((r) => (r._id === requestId ? updated : r)));
      setConfirming(null);
      showToast(c.accepted);
    } catch (err) {
      onApiError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, flexWrap:"wrap", marginBottom:24 }}>
          <div>
            <h1 style={{ fontFamily:FONT_SERIF, fontSize:28, fontWeight:600, color:COLORS.ink, marginBottom:10 }}>{c.mineTitle}</h1>
            <p className="a-readable" style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, lineHeight:1.6, margin:0 }}>{c.mineIntro}</p>
          </div>
          <button type="button" className="a-btn-outline" onClick={() => navigate("commission")}>{c.newRequest}</button>
        </div>

        <div aria-live="polite" className="a-card-grid">
          {requests === null ? (
            <div style={{ gridColumn:"1 / -1", fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft }}>…</div>
          ) : requests.length === 0 ? (
            <div style={{ gridColumn:"1 / -1", fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>{loadFailed ? c.loadError : c.mineEmpty}</div>
          ) : requests.map((r) => {
            const open = r.status === "open";
            const acceptedBid = r.bids.find((b) => b.status === "accepted");
            // Accepted first, then cheapest.
            const bids = [...r.bids].sort((a, b) => (b.status === "accepted") - (a.status === "accepted") || a.price - b.price);
            return (
              <RequestSummary key={r._id} t={t} request={{ ...r, buyer: null }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, margin:"14px 0 4px" }}>
                  <span className="a-label" style={{ marginBottom:0 }}>{c.bidsTitle(r.bids.length)}</span>
                  <Pill tone={open ? "pending" : "accepted"}>{c.status[r.status] || r.status}</Pill>
                </div>
                {bids.length === 0 ? (
                  <div style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, paddingTop:8 }}>{c.noBids}</div>
                ) : bids.map((b) => (
                  <BidRow
                    key={b._id} t={t} bid={b} fmtAmt={fmtAmt} canAccept={open}
                    confirming={confirming === b._id} busy={busy}
                    onAsk={() => setConfirming(b._id)} onCancel={() => setConfirming(null)}
                    onConfirm={() => accept(r._id, b._id)}
                  />
                ))}
                {acceptedBid && <NextStep t={t} bid={acceptedBid} />}
              </RequestSummary>
            );
          })}
        </div>
      </div>
    </div>
  );
}
