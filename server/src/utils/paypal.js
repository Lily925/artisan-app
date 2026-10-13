// Minimal PayPal REST client (Orders v2) using Node's built-in fetch: no SDK dependency.
// Credentials come from server/.env (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_MODE)
// and are never logged or returned to the client.
const MODE = process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";
const BASE = MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

class PayPalError extends Error {
  constructor(message, status, details = {}) {
    super(message);
    this.status = status;
    this.issue = details.issue || null; // e.g. "ORDER_NOT_APPROVED"
    this.debugId = details.debugId || null; // quote this to PayPal support
  }
}

let cachedToken = null; // { value, expiresAt }

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new PayPalError("PayPal is not configured on the server", 503);
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new PayPalError("Couldn't authenticate with PayPal", 502);
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in || 300) * 1000 };
  return cachedToken.value;
}

// requestId makes retries idempotent: PayPal returns the original result for a repeated id.
async function call(method, path, body, requestId) {
  const headers = { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" };
  if (requestId) headers["PayPal-Request-Id"] = requestId;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body && JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issue = data.details?.[0]?.issue || data.name || null;
    throw new PayPalError(data.details?.[0]?.description || data.message || `PayPal request failed (${res.status})`,
      res.status, { issue, debugId: data.debug_id || res.headers.get("paypal-debug-id") });
  }
  return data;
}

const createOrder = (payload, requestId) => call("POST", "/v2/checkout/orders", payload, requestId);
const captureOrder = (orderId, requestId) => call("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, requestId);
const getOrder = (orderId) => call("GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
// Payouts v1: PayPal refuses a sender_batch_id it has seen before, and the request id makes
// a retried request return the original response, so one release can't be paid twice.
const createPayout = (payload, requestId) => call("POST", "/v1/payments/payouts", payload, requestId);
const getPayoutBatch = (batchId) => call("GET", `/v1/payments/payouts/${encodeURIComponent(batchId)}`);

module.exports = { MODE, PayPalError, createOrder, captureOrder, getOrder, createPayout, getPayoutBatch };
