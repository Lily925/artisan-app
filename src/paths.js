// Every address in the app. Components ask for a page by name (navigate("cart")) or build
// a link with one of the helpers below, so a URL only ever changes here.
// /my-commissions, /commission-board, /profile, /admin/shops and /orders/:id are also what
// the server stores as notification links.
export const PAGE_PATHS = {
  home: "/",
  shop: "/shops",
  cart: "/cart",
  checkout: "/checkout",
  orders: "/orders",
  messages: "/messages",
  notifications: "/notifications",
  saved: "/favorites",
  commission: "/commission",
  "my-commissions": "/my-commissions",
  "commission-board": "/commission-board",
  profile: "/profile",
  dashboard: "/dashboard",
  "shop-orders": "/dashboard/orders",
  "shop-settings": "/dashboard/settings",
  "add-product": "/dashboard/products/new",
  "shop-setup": "/shop-setup",
  "admin-shops": "/admin/shops",
  "admin-reviews": "/admin/reviews",
  login: "/signin",
  signup: "/signup",
};

export const productPath = (id) => `/product/${encodeURIComponent(id)}`;
export const editProductPath = (id) => `${productPath(id)}/edit`;
export const orderPath = (id) => `/orders/${encodeURIComponent(id)}`;
export const reviewPath = (orderId, itemIndex) => `${orderPath(orderId)}/review/${itemIndex}`;
export const chatPath = (id) => `/messages/${encodeURIComponent(id)}`;
export const categoryPath = (name) => (name ? `/category/${encodeURIComponent(name)}` : PAGE_PATHS.shop);
// Shops from before slugs existed have none; the API finds a shop by id as well.
export const shopPath = (artisan) => `/shop/${encodeURIComponent(artisan.slug || artisan._id)}`;
export const artisanAboutPath = (artisan) => `${shopPath(artisan)}/about`;
