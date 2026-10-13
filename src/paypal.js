// Loads PayPal's JS SDK once (no npm dependency). The client id is public by design;
// the secret only exists on the server.
export const PAYPAL_CLIENT_ID = process.env.REACT_APP_PAYPAL_CLIENT_ID || "";

let loading = null;

export function loadPaypalSdk() {
  if (window.paypal?.Buttons) return Promise.resolve(window.paypal);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const params = new URLSearchParams({ "client-id": PAYPAL_CLIENT_ID, currency: "USD", intent: "capture", components: "buttons" });
    script.src = `https://www.paypal.com/sdk/js?${params}`;
    script.async = true;
    script.onload = () => (window.paypal?.Buttons ? resolve(window.paypal) : reject(new Error("PayPal SDK missing")));
    script.onerror = () => {
      script.remove();
      loading = null; // allow another try after a network error
      reject(new Error("Couldn't load PayPal"));
    };
    document.head.appendChild(script);
  });
  return loading;
}
