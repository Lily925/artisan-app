import { useEffect, useRef } from "react";

const isHidden = () => document.visibilityState === "hidden";

// Runs fn right away and then every `ms` while the tab is visible. Paused while the tab is
// hidden; runs again as soon as it comes back.
export function useVisiblePolling(fn, ms, enabled = true) {
  const latest = useRef(fn);
  useEffect(() => { latest.current = fn; });

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    const tick = () => latest.current();
    const stop = () => { clearInterval(timer); timer = null; };
    const start = () => { if (timer === null) timer = setInterval(tick, ms); };
    const onVisibility = () => {
      if (isHidden()) return stop();
      tick();
      return start();
    };
    if (!isHidden()) { tick(); start(); }
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [ms, enabled]);
}
