import { COLORS, FONT_SANS } from "../theme";

// Shown to an artisan whose shop isn't approved (pending / rejected / suspended): what's
// going on, and the admin's reason when there is one. Approved shops get nothing.
export default function ShopStatusBanner({ t, status, reason }) {
  const s = t.shopStatus;
  const text = { pending: [s.pendingTitle, s.pendingBody, "⏳"], rejected: [s.rejectedTitle, s.rejectedBody, "⚠️"], suspended: [s.suspendedTitle, s.suspendedBody, "⏸"] }[status];
  if (!text) return null;
  const [title, body, icon] = text;
  return (
    <div className="a-page" style={{ paddingTop:16, paddingBottom:0 }}>
      <div role="status" style={{ display:"flex", gap:12, alignItems:"flex-start", background:COLORS.bgSoft, border:`1.5px solid ${COLORS.accent}`, borderRadius:2, padding:"14px 16px", fontFamily:FONT_SANS, color:COLORS.ink }}>
        <span aria-hidden="true" style={{ fontSize:20, lineHeight:1.2 }}>{icon}</span>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:COLORS.accentDark }}>{title}</div>
          <div style={{ fontSize:13, lineHeight:1.55, marginTop:4 }}>{body}</div>
          {reason && status !== "pending" && (
            <div style={{ fontSize:13, lineHeight:1.55, marginTop:6, overflowWrap:"anywhere" }}><strong>{s.reason}:</strong> {reason}</div>
          )}
        </div>
      </div>
    </div>
  );
}
