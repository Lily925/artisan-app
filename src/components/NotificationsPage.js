import { useEffect } from "react";
import { COLORS, FONT_SANS, FONT_SERIF } from "../theme";
import { NotificationList } from "./NotificationBell";

// /notifications: the bell's list at its own address.
export default function NotificationsPage({ t, notifications, fmtAmt, onOpenLink }) {
  const n = t.notifications;
  const { items, unreadCount, failed, refresh, markRead, markAllRead } = notifications;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, []);

  const follow = (item) => {
    if (!item.readAt) markRead(item.id);
    onOpenLink(item.link);
  };

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page page" style={{ maxWidth:720 }}>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:12, flexWrap:"wrap", marginBottom:20 }}>
          <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink }}>{n.title}</h1>
          {unreadCount > 0 && (
            <button type="button" className="a-shop-link" style={{ fontFamily:FONT_SANS, fontSize:13, fontWeight:700, color:COLORS.accentDark }} onClick={markAllRead}>{n.markAll}</button>
          )}
        </div>
        <div style={{ background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:2 }}>
          <NotificationList t={t} items={items} failed={failed} fmtAmt={fmtAmt} onFollow={follow} />
        </div>
      </div>
    </div>
  );
}
