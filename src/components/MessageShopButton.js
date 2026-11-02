import { useState } from "react";

// Who sees what on a shop or product page: `viewer` is the signed-in user, or null.
//   logged out -> "Sign in to message"; a buyer -> "Message shop"; anyone else (the shop's own
//   artisan, other artisans, admins) -> nothing. The server enforces the same rules.
export function messageShopMode(viewer, isOwner) {
  if (!viewer) return "signin";
  return viewer.role === "buyer" && !isOwner ? "message" : null;
}

export default function MessageShopButton({ t, viewer, isOwner, onMessage, onSignIn, className = "a-btn-primary", style }) {
  const [busy, setBusy] = useState(false);
  const mode = messageShopMode(viewer, isOwner);
  if (!mode) return null;
  if (mode === "signin") return <button type="button" className={className} style={style} onClick={onSignIn}>{t.messages.signInToMessage}</button>;
  const start = async () => {
    setBusy(true);
    try { await onMessage(); } finally { setBusy(false); }
  };
  return <button type="button" className={className} style={style} disabled={busy} onClick={start}>{t.messages.messageShop}</button>;
}
