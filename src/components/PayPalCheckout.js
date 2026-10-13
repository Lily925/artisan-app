import { useEffect, useRef, useState } from "react";
import { COLORS, FONT_SANS } from "../theme";
import { api } from "../api";
import { loadPaypalSdk, PAYPAL_CLIENT_ID } from "../paypal";

// PayPal buttons for the cart. The server builds the PayPal order from the buyer's cart
// (amounts are never sent from here) and creates our order only after capturing the payment.
// getShippingAddress(): the validated address, or null (the cart then shows what's missing).
export default function PayPalCheckout({ t, onPaid, onApiError, getShippingAddress }) {
  const p = t.paypal;
  const container = useRef(null);
  const [state, setState] = useState(PAYPAL_CLIENT_ID ? "loading" : "unavailable");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [mode, setMode] = useState(null);
  // Latest props/text for PayPal's callbacks, which are created once.
  const latest = useRef({});
  latest.current = { p, t, onPaid, onApiError, getShippingAddress };

  useEffect(() => {
    if (!PAYPAL_CLIENT_ID) return undefined;
    let cancelled = false;
    let buttons = null;
    let reported = false; // our own error message wins over PayPal's generic onError

    const explain = (err) => {
      const { p: text, t: all, onApiError: apiError } = latest.current;
      reported = true;
      if (err?.status === 401) { apiError(err); return; }
      if (err?.code === "OTHER_SHOP") setMessage(all.orders.otherShop);
      else if (err?.code === "CART_EMPTY") setMessage(text.cartEmpty);
      else if (err?.code === "PATRON_UNAVAILABLE") setMessage(err.message);
      else if (err?.code === "BAD_ADDRESS") setMessage(all.shipping.fixAddress);
      else setMessage(text.failed);
    };

    api.getPaypalConfig().then((c) => { if (!cancelled) setMode(c.mode); }).catch(() => {});
    loadPaypalSdk()
      .then((paypal) => {
        if (cancelled || !container.current) return;
        buttons = paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "pay", height: 44 },
          // Runs before PayPal's window opens: no window without a complete address.
          onClick: (data, actions) => {
            setMessage("");
            if (latest.current.getShippingAddress()) return actions.resolve();
            setMessage(latest.current.t.shipping.fixAddress);
            return actions.reject();
          },
          createOrder: () => {
            reported = false;
            setMessage("");
            const address = latest.current.getShippingAddress();
            return api.createPaypalOrder(address).then((r) => r.id).catch((err) => { explain(err); throw err; });
          },
          onApprove: (data) => {
            setConfirming(true);
            return api.capturePaypalOrder(data.orderID)
              .then((r) => latest.current.onPaid(r.orderId))
              .catch(explain)
              .finally(() => { if (!cancelled) setConfirming(false); });
          },
          onCancel: () => setMessage(latest.current.p.cancelled),
          onError: () => { if (!reported) setMessage(latest.current.p.failed); },
        });
        return buttons.render(container.current).then(() => { if (!cancelled) setState("ready"); });
      })
      .catch(() => { if (!cancelled) setState("error"); });

    return () => {
      cancelled = true;
      if (buttons?.close) buttons.close().catch(() => {});
    };
  }, []);

  const note = { fontFamily: FONT_SANS, fontSize: 12, color: COLORS.inkSoft, lineHeight: 1.5 };
  if (state === "unavailable") return <p style={{ ...note, marginBottom: 14 }}>{p.unavailable}</p>;
  return (
    <div style={{ marginBottom: 14 }}>
      {mode === "sandbox" && (
        <div style={{ ...note, color: COLORS.ink, background: COLORS.bgSoft, border: `1px dashed ${COLORS.accentDark}`, borderRadius: 2, padding: "6px 10px", marginBottom: 10 }}>
          {p.sandbox}
        </div>
      )}
      {state === "loading" && <p style={note}>{p.loading}</p>}
      {state === "error" && <p role="alert" style={{ ...note, color: "#B3261E" }}>{p.loadError}</p>}
      {/* PayPal renders its buttons (in iframes) into this element */}
      <div ref={container} aria-busy={confirming} style={{ opacity: confirming ? 0.4 : 1, pointerEvents: confirming ? "none" : "auto" }} />
      {confirming && <p role="status" style={{ ...note, color: COLORS.ink, fontWeight: 700 }}>{p.confirming}</p>}
      {message && <p role="alert" style={{ ...note, color: "#B3261E", marginTop: 6 }}>{message}</p>}
    </div>
  );
}
