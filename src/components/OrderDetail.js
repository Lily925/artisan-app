import { useEffect, useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api } from "../api";
import { bonusText } from "../tiers";
import ProductImage from "./ProductImage";
import { NotFound } from "./Routing";

const fmtDate = (d) => new Date(d).toLocaleDateString([], { dateStyle: "medium" });

// Ordered -> In production -> Shipped -> Completed, with the date each step was reached.
function Timeline({ o, milestones }) {
  return (
    <ol style={{ listStyle:"none", display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:12, margin:0, padding:0 }}>
      {milestones.map((m, i) => (
        <li key={m.status} aria-current={m.reached && !milestones[i + 1]?.reached ? "step" : undefined}
          style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
          <span aria-hidden="true" style={{
            width:22, height:22, flexShrink:0, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
            fontFamily:FONT_SANS, fontSize:12, fontWeight:700,
            background: m.reached ? COLORS.accentDark : COLORS.card, color: m.reached ? "#fff" : COLORS.inkSoft,
            border:`1.5px solid ${m.reached ? COLORS.accentDark : COLORS.border}`,
          }}>{m.reached ? "✓" : i + 1}</span>
          <div>
            <div style={{ fontFamily:FONT_SANS, fontSize:13, fontWeight:700, color: m.reached ? COLORS.ink : COLORS.inkSoft }}>{o.status[m.status]}</div>
            <div style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>{m.at ? fmtDate(m.at) : m.reached ? "—" : o.notYet}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Artisan only: attach or replace the video link for one Story/Patron item.
function VideoForm({ o, order, item, onSaved, onApiError, showToast }) {
  const [url, setUrl] = useState(item.deliveryVideoUrl);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const id = `video-${item.index}`;

  const save = (e) => {
    e.preventDefault();
    if (!/^https:\/\/\S+\.\S+/i.test(url.trim())) { setError(o.videoInvalid); return; }
    setError("");
    setSaving(true);
    api.setOrderItemVideo(order.id, item.index, url.trim())
      .then((updated) => { onSaved(updated); showToast(o.videoSaved); })
      .catch((err) => {
        if (err.status === 401) onApiError(err);
        else setError(err.code === "BAD_URL" ? o.videoInvalid : err.message);
      })
      .finally(() => setSaving(false));
  };

  return (
    <form onSubmit={save} noValidate style={{ marginTop:10 }}>
      <label className="a-label" htmlFor={id}>{o.videoLabel}</label>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <input id={id} className="a-input" type="url" inputMode="url" placeholder="https://" autoComplete="off"
          style={{ flex:"1 1 240px" }} value={url} onChange={(e) => setUrl(e.target.value)}
          aria-describedby={`${id}-hint`} aria-invalid={Boolean(error)} />
        <button type="submit" className="a-btn-outline" style={{ padding:"10px 18px", fontSize:13 }} disabled={saving}>
          {saving ? o.videoSaving : o.videoSave}
        </button>
      </div>
      <div id={`${id}-hint`} style={{ fontFamily:FONT_SANS, fontSize:12, color: error ? "#B3261E" : COLORS.inkSoft, marginTop:6 }} role={error ? "alert" : undefined}>
        {error || o.videoHint}
      </div>
    </form>
  );
}

function ItemRow({ o, lang, order, item, fmtAmt, shopName, onSaved, onApiError, showToast }) {
  const name = lang === "mn" ? item.title : item.titleEn || item.title;
  const bonus = item.patronBonus ? bonusText(item.patronBonus, lang) : "";
  const { isArtisan, isBuyer } = order.viewer;
  return (
    <div style={{ display:"flex", gap:14, padding:"16px 0", borderTop:`1px solid ${COLORS.border}` }}>
      <div style={{ position:"relative", width:64, height:64, flexShrink:0, border:`1px solid ${COLORS.border}`, borderRadius:2, overflow:"hidden" }}>
        <ProductImage src={item.image} alt={name} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontFamily:FONT_SERIF, fontSize:18, fontWeight:600, color:COLORS.ink, overflowWrap:"anywhere" }}>{name}</span>
          <span style={{ fontFamily:FONT_SANS, fontSize:14, fontWeight:700, color:COLORS.ink, fontVariantNumeric:"tabular-nums" }}>{item.qty} × {fmtAmt(item.unitPrice)}</span>
        </div>
        <div style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:2 }}>
          {o.tierName[item.tier]}{item.tier === "story" && ` · ${o.videoLabel}`}{item.tier === "patron" && ` · ${o.videoLabel} + ${o.bonusLabel}`}
        </div>

        {item.tier === "patron" && (
          <div className="a-callout" style={{ marginTop:10, padding:"10px 12px", fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, lineHeight:1.5 }}>
            <strong>{isArtisan ? o.bonusForArtisan : `${o.bonusLabel}:`}</strong>{" "}
            {bonus || <span style={{ color:COLORS.inkSoft }}>{o.bonusMissing}</span>}
          </div>
        )}

        {item.needsVideo && (
          <div style={{ marginTop:10 }}>
            {item.deliveryVideoUrl ? (
              <div style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink }}>
                {isBuyer && !isArtisan && <div style={{ fontWeight:700, marginBottom:4 }}>{o.videoFrom(shopName)}</div>}
                <a href={item.deliveryVideoUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color:COLORS.accentDark, fontWeight:700, overflowWrap:"anywhere" }}>
                  ▶ {isArtisan ? item.deliveryVideoUrl : o.watch}
                </a>
              </div>
            ) : isBuyer && !isArtisan ? (
              <div style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>{o.videoPending}</div>
            ) : (
              <span style={{ display:"inline-block", fontFamily:FONT_SANS, fontSize:11, fontWeight:700, color:COLORS.ink, background:COLORS.accentSoft, borderRadius:2, padding:"3px 8px" }}>{o.videoNeeded}</span>
            )}
            {order.actions.canEditVideo && (
              <VideoForm key={item.deliveryVideoUrl} o={o} order={order} item={item} onSaved={onSaved} onApiError={onApiError} showToast={showToast} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// The next-step button with an inline "can't be undone" confirmation.
function StepButton({ o, label, warn, yes, busy, onConfirm }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" className="a-btn-primary" onClick={() => setAsking(true)}>{label}</button>;
  return (
    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
      <span style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink }}>{warn}</span>
      <button type="button" className="a-btn-primary" disabled={busy} onClick={onConfirm}>{busy ? o.saving : yes}</button>
      <button type="button" className="a-btn-outline" disabled={busy} onClick={() => setAsking(false)}>{o.cancel}</button>
    </div>
  );
}

const PAYOUT_TONE = { paid: "ok", sent: "ok", held: "muted", due: "wait", pending_payout: "wait", sending: "wait", failed: "bad" };

function ShippingAddress({ o, address, forArtisan }) {
  return (
    <section className="a-info-block" style={{ marginBottom:20 }} aria-labelledby="order-ship-title">
      <h2 id="order-ship-title" style={{ fontFamily:FONT_SERIF, fontSize:22, fontWeight:600, color:COLORS.ink, margin:"0 0 8px" }}>{forArtisan ? o.shipTo : o.shippingAddress}</h2>
      {address ? (
        <address style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.ink, lineHeight:1.6, fontStyle:"normal", overflowWrap:"anywhere" }}>
          {address.name}<br />{address.address}<br />{address.city}, {address.country}<br />{address.phone}
        </address>
      ) : <p style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, margin:0 }}>{o.noAddress}</p>}
      {forArtisan && address && <p style={{ fontFamily:FONT_SANS, fontSize:11, color:COLORS.inkSoft, margin:"8px 0 0" }}>{o.addressPrivacy}</p>}
    </section>
  );
}

// The artisan's milestone payouts: released (handed to PayPal) vs held, per milestone.
function Payouts({ o, payout, fmtAmt, forArtisan }) {
  const tone = { ok: COLORS.ink, muted: COLORS.inkSoft, wait: COLORS.ink, bad: "#B3261E" };
  const box = { flex:"1 1 120px", background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"10px 12px" };
  const label = { fontFamily:FONT_SANS, fontSize:11, fontWeight:700, color:COLORS.inkSoft, textTransform:"uppercase", letterSpacing:0.4 };
  const value = { fontFamily:FONT_SANS, fontSize:18, fontWeight:700, color:COLORS.ink, fontVariantNumeric:"tabular-nums" };
  return (
    <section className="a-info-block" style={{ marginBottom:20 }} aria-labelledby="order-payout-title">
      <h2 id="order-payout-title" style={{ fontFamily:FONT_SERIF, fontSize:22, fontWeight:600, color:COLORS.ink, margin:"0 0 4px" }}>{o.payoutTitle}</h2>
      <p style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, margin:"0 0 12px", lineHeight:1.5 }}>{o.payoutIntro(fmtAmt(payout.net))}</p>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:12 }}>
        <div style={box}><div style={label}>{o.released}</div><div style={value}>{fmtAmt(payout.released)}</div></div>
        <div style={box}><div style={label}>{o.held}</div><div style={value}>{fmtAmt(payout.held)}</div></div>
        {payout.waiting > 0 && <div style={box}><div style={label}>{o.waiting}</div><div style={value}>{fmtAmt(payout.waiting)}</div></div>}
      </div>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <tbody>
          {payout.releases.map((r) => (
            <tr key={r.milestone} style={{ borderTop:`1px solid ${COLORS.border}` }}>
              <td style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, padding:"8px 0" }}>{o.status[r.milestone]} · {r.percent}%</td>
              <td style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, padding:"8px 8px", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{fmtAmt(r.amount)}</td>
              <td style={{ fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:tone[PAYOUT_TONE[r.status]], padding:"8px 0", textAlign:"right" }}>
                {o.releaseStatus[r.status]}
                {forArtisan && r.status === "pending_payout" && <div style={{ fontWeight:400, color:COLORS.inkSoft }}>{o.addPayoutEmail}</div>}
                {forArtisan && r.status === "failed" && r.error && <div style={{ fontWeight:400, color:COLORS.inkSoft }}>{r.error}</div>}
                {forArtisan && r.status === "sent" && r.payoutItemStatus && <div style={{ fontWeight:400, color:COLORS.inkSoft }}>PayPal: {r.payoutItemStatus}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function OrderDetail({ t, lang, orderId, fmtAmt, onBack, onApiError, showToast, onChanged, onMessage }) {
  const o = t.orders;
  const [order, setOrder] = useState(null);
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stepError, setStepError] = useState("");

  useEffect(() => {
    let stale = false;
    api.getOrder(orderId)
      .then((res) => { if (!stale) setOrder(res); })
      .catch((err) => {
        if (stale) return;
        if (err.status === 401) onApiError(err);
        // Someone else's order is a 404 as well, so it reads the same as one that doesn't exist.
        if (err.status === 404 || err.status === 400) setMissing(true);
        else setFailed(true);
      });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const advance = (status) => {
    setBusy(true);
    setStepError("");
    api.advanceOrder(order.id, status)
      .then((updated) => { setOrder(updated); showToast(o.updated); onChanged?.(); })
      .catch((err) => {
        if (err.status === 401) { onApiError(err); return; }
        setStepError(err.code === "MISSING_VIDEO" ? o.needVideo : err.message);
        api.getOrder(order.id).then(setOrder).catch(() => {});
      })
      .finally(() => setBusy(false));
  };

  const page = (children) => (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page">
        <button type="button" className="a-shop-link" style={{ fontFamily:FONT_SANS, fontSize:13, marginBottom:16 }} onClick={onBack}>‹ {o.back}</button>
        {children}
      </div>
    </div>
  );
  if (missing) return <NotFound t={t} />;
  if (failed) return page(<p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>{o.loadError}</p>);
  if (!order) return page(<p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>…</p>);

  const { actions, viewer } = order;
  const shopName = order.shop?.shopName || order.shop?.ownerName || "—";
  const cancelled = order.status === "cancelled";
  const sectionTitle = { fontFamily:FONT_SERIF, fontSize:22, fontWeight:600, color:COLORS.ink, margin:"0 0 12px" };
  const showShipping = (viewer.isArtisan || viewer.isBuyer) && (order.shippingAddress || order.payment?.paid);
  const hasAside = Boolean(showShipping || order.payout);
  const row = { display:"flex", justifyContent:"space-between", fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, padding:"4px 0", fontVariantNumeric:"tabular-nums" };

  return page(
    <>
      <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:4 }}>{o.title}</h1>
      <p style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, marginBottom:24 }}>
        {o.placed(fmtDate(order.createdAt))} · {o.from(shopName)}
        {viewer.isArtisan && <> · {o.privacy}</>}
      </p>
      <p style={{ fontFamily:FONT_SANS, fontSize:13, color: order.payment?.paid ? COLORS.ink : COLORS.inkSoft, margin:"-16px 0 24px" }}>
        {order.payment?.paid
          ? <>{o.paidWith(fmtDate(order.payment.capturedAt))}{order.payment.reference && <> · {o.reference}: {order.payment.reference}</>}</>
          : o.notPaid}
      </p>
      {/* Not for an artisan's order from their own shop: there is nobody else to message. */}
      {onMessage && order.shop && viewer.isBuyer !== viewer.isArtisan && (
        <button type="button" className="a-btn-outline" style={{ padding:"9px 18px", fontSize:13, minHeight:44, marginBottom:20 }} onClick={onMessage}>
          {viewer.isBuyer ? t.messages.messageArtisan : t.messages.messageBuyer}
        </button>
      )}

      {/* >= 1024px: status + items left, shipping + payout right (when there is any). */}
      <div className={`a-order-layout${hasAside ? " has-aside" : ""}`}>
      <section className="a-info-block a-order-status" style={{ marginBottom:20 }} aria-label={o.status[order.status]}>
        {cancelled
          ? <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.ink, margin:0 }}>{o.cancelledNote}</p>
          : <Timeline o={o} milestones={order.milestones} />}

        {!cancelled && (actions.artisanNext || actions.buyerNext || order.status !== "completed") && (
          <div style={{ borderTop:`1px solid ${COLORS.border}`, marginTop:16, paddingTop:16 }}>
            {actions.artisanNext && (actions.artisanBlockedBy === "missing_video"
              ? <p role="note" style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, margin:"0 0 10px" }}>{o.needVideo}</p>
              : <StepButton key={actions.artisanNext} o={o} label={o.advance[actions.artisanNext]} warn={o.advanceWarn} yes={o.yes}
                  busy={busy} onConfirm={() => advance(actions.artisanNext)} />)}
            {actions.artisanBlockedBy === "missing_video" && (
              // Still clickable: the server refuses it, and the note above says why.
              <button type="button" className="a-btn-outline" disabled={busy} onClick={() => advance("shipped")}>{o.advance.shipped}</button>
            )}
            {actions.buyerNext === "completed" && (
              <StepButton o={o} label={o.confirmReceived} warn={o.confirmReceivedWarn} yes={o.confirmYes} busy={busy} onConfirm={() => advance("completed")} />
            )}
            {!actions.artisanNext && !actions.buyerNext && order.status !== "completed" && (
              <p style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, margin:0 }}>
                {actions.artisanWaitingForPayment ? o.waitingPayment : order.status === "shipped" ? o.waitingBuyer : o.waitingArtisan}
              </p>
            )}
            {/* the missing-video note is already shown above; don't repeat it */}
            {stepError && !(stepError === o.needVideo && actions.artisanBlockedBy) && <p role="alert" style={{ fontFamily:FONT_SANS, fontSize:13, color:"#B3261E", margin:"10px 0 0" }}>{stepError}</p>}
          </div>
        )}
      </section>

      {hasAside && (
        <div className="a-order-aside">
          {showShipping && <ShippingAddress o={o} address={order.shippingAddress} forArtisan={viewer.isArtisan} />}
          {order.payout && <Payouts o={o} payout={order.payout} fmtAmt={fmtAmt} forArtisan={viewer.isArtisan} />}
        </div>
      )}

      <section className="a-info-block a-order-items" style={{ marginBottom:20 }} aria-labelledby="order-items-title">
        <h2 id="order-items-title" style={sectionTitle}>{o.itemsTitle}</h2>
        {order.items.map((item) => (
          <ItemRow key={item.index} o={o} lang={lang} order={order} item={item} fmtAmt={fmtAmt} shopName={shopName}
            onSaved={setOrder} onApiError={onApiError} showToast={showToast} />
        ))}
        <div style={{ borderTop:`1px solid ${COLORS.border}`, paddingTop:10 }}>
          <div style={row}><span>{o.subtotal}</span><span>{fmtAmt(order.subtotal)}</span></div>
          <div style={row}><span>{o.fee}</span><span>{fmtAmt(order.commissionFee)}</span></div>
          <div style={row}><span>{o.shipping}</span><span>{fmtAmt(order.shipping)}</span></div>
          <div style={{ ...row, fontWeight:700, fontSize:15 }}><span>{o.total}</span><span>{fmtAmt(order.total)}</span></div>
        </div>
      </section>
      </div>
    </>
  );
}
