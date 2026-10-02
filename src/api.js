const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";
const API_ORIGIN = new URL(API_URL).origin;
const TOKEN_KEY = "artisan-token";

// Photos uploaded through the API are stored as "/uploads/..." paths on the API
// server; seeded photos ("/images/...") are served by this app. Resolve either.
export function assetUrl(path) {
  return typeof path === "string" && path.startsWith("/uploads/") ? API_ORIGIN + path : path;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = "GET", body, formData, auth = false } = {}) {
  // multipart: let the browser set Content-Type (with the boundary) itself
  const headers = formData ? {} : { "Content-Type": "application/json" };
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
  if (!res.ok) throw new ApiError(data.error || res.statusText, res.status);
  return data;
}

export const api = {
  signup: (name, email, password, role) =>
    request("/auth/signup", { method: "POST", body: { name, email, password, role } }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),

  getProducts: () => request("/products"),
  getProduct: (id) => request(`/products/${id}`),
  // formData fields: title, titleEn, category, description, price (USD), photo (File)
  createProduct: (formData) => request("/products", { method: "POST", auth: true, formData }),
  // same fields as createProduct; "photo" optional (replaces the current one)
  updateProduct: (id, formData) => request(`/products/${id}`, { method: "PUT", auth: true, formData }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE", auth: true }),
  getArtisans: () => request("/artisans"),
  getMyArtisan: () => request("/artisans/me", { auth: true }),
  updateMyArtisan: (data) => request("/artisans/me", { method: "PUT", auth: true, body: data }),

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

  createOrder: () => request("/orders", { method: "POST", auth: true }),
  getOrders: () => request("/orders", { auth: true }),

  createCommission: (data) => request("/commissions", { method: "POST", auth: true, body: data }),
  getCommissions: (category) =>
    request(`/commissions${category ? `?category=${encodeURIComponent(category)}` : ""}`, { auth: true }),
  submitBid: (id, price, message) =>
    request(`/commissions/${id}/bids`, { method: "POST", auth: true, body: { price, message } }),
  acceptBid: (id, bidId) =>
    request(`/commissions/${id}/accept-bid`, { method: "PUT", auth: true, body: { bidId } }),
};
