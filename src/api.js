const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const API_ORIGIN = new URL(API_URL).origin;
const TOKEN_KEY = "artisan-token";

// Photos uploaded through the API are stored as "/uploads/..." paths on the API
// server; seeded photos ("/images/...") are served by this app. Resolve either.
export function assetUrl(path) {
  return typeof path === "string" && path.startsWith("/uploads/") ? API_ORIGIN + path : path;
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code; // machine-readable reason sent by some endpoints, e.g. "OTHER_SHOP"
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Random id for this browser tab session, so logged-out product views aren't counted
// twice within 24h. Kept in sessionStorage; never tied to an account.
const SESSION_KEY = "artisan-viewer-session";
function viewerSession() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

// Fired after a signed-in change succeeds, so the unread counts refresh right away (see
// useNotifications). Not for requests that can't produce a notification for this user.
export const USER_ACTED_EVENT = "artisan:user-acted";
const NOT_AN_ACTION = /^\/notifications|^\/cart|\/view$|\/like$/;

async function request(path, { method = "GET", body, formData, auth = false, headers: extraHeaders } = {}) {
  // multipart: let the browser set Content-Type (with the boundary) itself
  const headers = { ...(formData ? {} : { "Content-Type": "application/json" }), ...extraHeaders };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || res.statusText, res.status, data.code);
  if (auth && method !== "GET" && !NOT_AN_ACTION.test(path)) window.dispatchEvent(new Event(USER_ACTED_EVENT));
  return data;
}

export const api = {
  // role: "buyer" | "artisan". Artisans also send shop: { shopName, shopDescription }; the
  // shop starts "pending" until an admin approves it.
  signup: (name, email, password, role, shop) =>
    request("/auth/signup", { method: "POST", body: { name, email, password, role, ...(role === "artisan" && shop) } }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),
  // Own account. Returns { token, user }: earlier tokens stop working, so store the new one.
  changePassword: (currentPassword, newPassword) =>
    request("/auth/password", { method: "PUT", auth: true, body: { currentPassword, newPassword } }),

  // Own profile only (the server refuses any other id). data: { bio } as JSON, or a
  // FormData with "photo" (File, JPG/PNG/WebP up to 2 MB) and/or "removePhoto" = "true".
  getMe: () => request("/users/me", { auth: true }),
  updateProfile: (userId, data) =>
    request(`/users/${userId}`, { method: "PATCH", auth: true, ...(data instanceof FormData ? { formData: data } : { body: data }) }),

  // Sent with the login token (if any) so an artisan also gets their own hidden products.
  getProducts: (category) =>
    request(`/products${category ? `?category=${encodeURIComponent(category)}` : ""}`, { auth: true }),
  getProduct: (id) => request(`/products/${id}`, { auth: true }),
  // formData fields: title, titleEn, category, description, price (USD),
  // patronBonusMn, patronBonusEn (optional), photo (File)
  createProduct: (formData) => request("/products", { method: "POST", auth: true, formData }),
  // same fields as createProduct; "photo" optional (replaces the current one)
  updateProduct: (id, formData) => request(`/products/${id}`, { method: "PUT", auth: true, formData }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE", auth: true }),
  getArtisans: (category) =>
    request(`/artisans${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  getMyArtisan: () => request("/artisans/me", { auth: true }),
  updateMyArtisan: (data) => request("/artisans/me", { method: "PUT", auth: true, body: data }),
  // "Set up your shop" after an artisan signs up: { shopName, location, bio, instagramHandle }
  setupMyShop: (data) => request("/artisans/me", { method: "POST", auth: true, body: data }),

  // Product page opened. Counted at most once per viewer per 24h (decided by the server).
  recordView: (id) => {
    const session = viewerSession();
    return request(`/products/${id}/view`, { method: "POST", auth: true, headers: session ? { "X-Viewer-Session": session } : {} });
  },
  getMyDashboard: () => request("/artisans/me/dashboard", { auth: true }),

  getMyLikes: () => request("/products/liked", { auth: true }),
  likeProduct: (id) => request(`/products/${id}/like`, { method: "PUT", auth: true }),
  unlikeProduct: (id) => request(`/products/${id}/like`, { method: "DELETE", auth: true }),

  getCart: () => request("/cart", { auth: true }),
  addCartItem: (productId, tier, qty = 1) =>
    request("/cart", { method: "POST", auth: true, body: { productId, tier, qty } }),
  updateCartItem: (productId, tier, qty) =>
    request("/cart", { method: "PUT", auth: true, body: { productId, tier, qty } }),
  removeCartItem: (productId, tier) =>
    request("/cart", { method: "DELETE", auth: true, body: { productId, tier } }),

  // PayPal checkout: the server builds the PayPal order from the cart, then captures it
  // and creates the paid order. Returns { id } / { orderId }.
  getPaypalConfig: () => request("/payments/paypal/config"),
  // shippingAddress: { name, address, city, country, phone }
  createPaypalOrder: (shippingAddress) =>
    request("/payments/paypal/orders", { method: "POST", auth: true, body: { shippingAddress } }),
  capturePaypalOrder: (paypalOrderId) =>
    request(`/payments/paypal/orders/${encodeURIComponent(paypalOrderId)}/capture`, { method: "POST", auth: true }),
  getOrders: () => request("/orders", { auth: true }),
  // Buyer or the order's artisan only
  getOrder: (id) => request(`/orders/${id}`, { auth: true }),
  getShopOrders: () => request("/orders/shop", { auth: true }),
  // status: the next milestone ("in_production" / "shipped" for the artisan, "completed" for the buyer)
  advanceOrder: (id, status) => request(`/orders/${id}/status`, { method: "PUT", auth: true, body: { status } }),
  setOrderItemVideo: (id, index, url) =>
    request(`/orders/${id}/items/${index}/video`, { method: "PUT", auth: true, body: { url } }),

  createCommission: (data) => request("/commissions", { method: "POST", auth: true, body: data }),
  getCommissions: (category) =>
    request(`/commissions${category ? `?category=${encodeURIComponent(category)}` : ""}`, { auth: true }),
  getMyCommissions: () => request("/commissions/mine", { auth: true }),
  submitBid: (id, price, message) =>
    request(`/commissions/${id}/bids`, { method: "POST", auth: true, body: { price, message } }),
  acceptBid: (id, bidId) =>
    request(`/commissions/${id}/accept-bid`, { method: "PUT", auth: true, body: { bidId } }),

  // Own notifications only: { items (latest 30), unreadCount }.
  getNotifications: () => request("/notifications", { auth: true }),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "POST", auth: true }),
  markAllNotificationsRead: () => request("/notifications/read-all", { method: "POST", auth: true }),

  // Admin only. status: "pending" | "approved" | "rejected" | "suspended" (omit for all).
  getAdminShops: (status) => request(`/admin/shops${status ? `?status=${status}` : ""}`, { auth: true }),
  // action: "approve" | "reject" | "suspend" | "unsuspend"; reason (optional) for reject / suspend
  changeShopStatus: (id, action, reason) =>
    request(`/admin/shops/${id}/${action}`, { method: "PUT", auth: true, body: reason ? { reason } : {} }),
};
