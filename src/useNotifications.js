import { useCallback, useEffect, useRef, useState } from "react";
import { api, USER_ACTED_EVENT } from "./api";
import { useVisiblePolling } from "./usePolling";

const POLL_MS = 45000;
const AFTER_ACTION_MS = 400; // an action can be several requests: refresh once, after the last

// The signed-in user's notifications for the header: refreshed every 45 seconds while the
// tab is visible and right after the user does something. A failed refresh keeps the last
// list; only an expired login (401) is passed on.
export function useNotifications(enabled, onApiError) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [failed, setFailed] = useState(false);
  const onError = useRef(onApiError);
  useEffect(() => { onError.current = onApiError; });

  const handleError = useCallback((err) => {
    if (err.status === 401) onError.current(err);
    else setFailed(true);
  }, []);

  // After logging out, an answer still on its way must not show up for the next account.
  const session = useRef(0);
  const refresh = useCallback(() => {
    const started = session.current;
    return api.getNotifications()
      .then((res) => {
        if (started !== session.current) return;
        setItems(res.items || []);
        setUnreadCount(res.unreadCount || 0);
        setFailed(false);
      })
      .catch((err) => { if (started === session.current) handleError(err); });
  }, [handleError]);

  useVisiblePolling(refresh, POLL_MS, enabled);

  useEffect(() => {
    if (!enabled) { session.current += 1; setItems([]); setUnreadCount(0); setFailed(false); return undefined; }
    let timer = null;
    const onAct = () => { clearTimeout(timer); timer = setTimeout(refresh, AFTER_ACTION_MS); };
    window.addEventListener(USER_ACTED_EVENT, onAct);
    return () => { clearTimeout(timer); window.removeEventListener(USER_ACTED_EVENT, onAct); };
  }, [enabled, refresh]);

  // Shown as read at once; the server's answer then corrects the count.
  const markRead = useCallback((id) => {
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: now } : n)));
    setUnreadCount((count) => Math.max(0, count - 1));
    return api.markNotificationRead(id).then((res) => setUnreadCount(res.unreadCount)).catch(handleError);
  }, [handleError]);

  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnreadCount(0);
    return api.markAllNotificationsRead().catch((err) => { handleError(err); refresh(); });
  }, [handleError, refresh]);

  return { items, unreadCount, failed, refresh, markRead, markAllRead };
}
