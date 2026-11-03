import { useEffect, useRef, useState } from "react";

// For browsers without the clipboard API (or plain http outside localhost).
function legacyCopy(text) {
  const box = document.createElement("textarea");
  box.value = text;
  box.setAttribute("readonly", "");
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.appendChild(box);
  box.select();
  try { return document.execCommand("copy"); } catch { return false; } finally { box.remove(); }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return legacyCopy(text);
  }
}

// Copies the address of the current page. The label says what happened, then goes back.
export default function CopyLinkButton({ t, style }) {
  const r = t.routing;
  const [result, setResult] = useState(null); // null | "copied" | "failed"
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    const copied = await copyText(window.location.href);
    setResult(copied ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setResult(null), 2400);
  };

  return (
    <button type="button" className="a-btn-outline" style={style} onClick={copy} aria-live="polite">
      {result === "copied" ? `✓ ${r.linkCopied}` : result === "failed" ? r.copyFailed : `🔗 ${r.copyLink}`}
    </button>
  );
}
