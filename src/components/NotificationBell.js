import { useEffect, useRef, useState } from "react";
import { COLORS, FONT_SANS, FONT_SERIF } from "../theme";
import { notificationText, timeAgo } from "../notificationHelpers";
import { BellIcon } from "./NavIcons";
import CountBadge from "./CountBadge";

// Header bell: a dropdown under the header on wide screens, a bottom sheet on phones
// (.a-notif-panel in theme.js).
export default function NotificationBell({ t, notifications, fmtAmt, onOpenLink }) {
  const n = t.notifications;
  const { items, unreadCount, failed, refresh, markRead, markAllRead } = notifications;
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(0);
  const wrapper = useRef(null);
  const button = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    const onPointer = (e) => { if (!wrapper.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onPointer); };
  }, [open]);

  const toggle = () => {
    if (!open) {
      setTop(button.current.getBoundingClientRect().bottom + 6);
      refresh();
    }
    setOpen(!open);
  };

  const follow = (item) => {
    setOpen(false);
    if (!item.readAt) markRead(item.id);
    onOpenLink(item.link);
  };

  return (
    <div ref={wrapper} style={{ position:"relative", flexShrink:0 }}>
      <button ref={button} type="button" className="a-icon-btn a-nav-icon" aria-label={t.nav.bellAria(unreadCount)} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
        <BellIcon />
        <CountBadge count={unreadCount} />
      </button>

      {open && (
        <>
          <div className="a-notif-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="a-notif-panel" role="dialog" aria-label={n.title} style={{ top }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"12px 16px", borderBottom:`1px solid ${COLORS.border}` }}>
              <h2 style={{ fontFamily:FONT_SERIF, fontSize:20, fontWeight:600, color:COLORS.ink }}>{n.title}</h2>
              {unreadCount > 0 && (
                <button type="button" className="a-shop-link" style={{ fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:COLORS.accentDark, minHeight:32 }} onClick={markAllRead}>{n.markAll}</button>
              )}
            </div>
            {failed && items.length === 0 ? (
              <p role="alert" style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, padding:"32px 16px", textAlign:"center" }}>{n.loadError}</p>
            ) : items.length === 0 ? (
              <p style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, padding:"32px 16px", textAlign:"center" }}>{n.empty}</p>
            ) : (
              <ul style={{ listStyle:"none", margin:0, padding:0, overflowY:"auto", overscrollBehavior:"contain" }}>
                {items.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={`a-notif-item${item.readAt ? "" : " unread"}`} onClick={() => follow(item)}>
                      <span aria-hidden="true" className="a-notif-dot" style={{ visibility: item.readAt ? "hidden" : "visible" }} />
                      <span style={{ minWidth:0, flex:1 }}>
                        {!item.readAt && <span className="a-sr-only">{n.unread}: </span>}
                        <span style={{ display:"block", fontSize:13, lineHeight:1.45, color:COLORS.ink, fontWeight: item.readAt ? 400 : 700, overflowWrap:"anywhere" }}>{notificationText(t, item, fmtAmt)}</span>
                        <span style={{ display:"block", fontSize:11, color:COLORS.inkSoft, marginTop:3 }}>{timeAgo(item.createdAt, n)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
