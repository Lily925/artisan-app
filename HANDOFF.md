# Artisan marketplace: project state (2026-10-12)

**Location:** `C:\Users\saraa\artisan-app`. Git repo, branch `main`, remote `origin` = `github.com/Lily925/artisan-app`.

## Feature status

| Feature | Status | What's missing |
|---|---|---|
| Auth (register, login, JWT) | Partial | Frontend registers buyers only; signing up as `artisan` via the API creates no `Artisan` record. No password rules, password reset or server-side logout. |
| Products and artisans API | Done | Artisans can't set their own photo, shop name or specialty; no admin endpoints. |
| Cart | Done | Cart rows show a category emoji, not the product photo. |
| Orders, milestones, video | Done (no payments) | One shop per cart/order. Milestones Ordered → In production → Shipped → Completed: the artisan advances one step at a time up to Shipped (Shipped needs a video link on every Story/Patron item); the buyer's "Confirm received" completes it (escrow release will hook in there). Order History (profile) and Shop orders (artisans) open an order detail page. No shipping address, no cancel flow, no notifications. |
| Reverse auction (commissions + bids) | Done (basic) | Buyers submit requests and accept a bid on **My requests**; artisans bid on **Commission requests**. After acceptance the buyer is pointed to the artisan's Instagram; nothing tracks the job further (`in_progress` / `completed` are never set). Reference image stores only the filename. |
| 15% commission | Done (server) | `server/src/utils/orderTotals.js` computes subtotal, 15% fee, $12 shipping and total in integer cents (rounded once) from `config/constants.js`. Checkout, the cart preview (`totals` on every `/api/cart` response) and the demo seed all use it; the frontend does no fee math. |
| Artisan dashboard | Done | Own-shop sales and engagement stats (see below). Demo orders/views are loaded for noon_handmade_ and labelled on the page (banner + DEMO tags). |
| PayPal | Done (sandbox) | Checkout is PayPal only (Orders v2, intent CAPTURE, no SDK dependency). The order is created only after the server captures the payment and checks the captured amount. Shipping address collected at checkout. No refunds, no webhooks. |
| Artisan payouts | Done (sandbox) | Net = order total − 15% fee (items + shipping), released 30% at In production, 30% at Shipped, 40% at Completed via PayPal Payouts to the shop's private `payoutEmail`; without one it waits as "pending payout" and is sent when the email is saved. Never pays twice (see `utils/payouts.js`). No automatic retry of payouts PayPal accepted and later returned/failed; no admin screen for failed payouts. |
| Email verification | Not started | |

## How to run

| Part | Where | Command | Port |
|---|---|---|---|
| Frontend (React, Create React App) | `artisan-app/` | `npm start` | 3000 |
| API (Express + MongoDB Atlas) | `artisan-app/server/` | `npm start` | 5000 |
| Seed | `artisan-app/server/` | `npm run seed` | – |
| Demo dashboard data | `artisan-app/server/` | `npm run seed:demo` (add or refresh) / `npm run seed:demo -- --remove` | – |

- **Database:** MongoDB Atlas; the connection string is in `server/.env` as `MONGODB_URI`.
- **PayPal:** `server/.env` has `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` (`sandbox` or `live`). The frontend needs `REACT_APP_PAYPAL_CLIENT_ID` (the same public client id, never the secret) in the root `.env`; Create React App reads it only when `npm start` starts, so restart it after changing `.env`.
- **IP allowlist:** Atlas only accepts connections from allowed IPs. This machine's IP was `203.246.85.195`. If it changes, add the new one under Atlas → Network Access.

**Seeded test accounts** (all use the password `artisan123`):
- `admin@artisan.mn` (admin)
- `buyer@artisan.mn` (buyer)
- `noon.handmade@example.com` (**Bolorsaran**, the real shop noon_handmade_)
- 6 mock artisans at `@artisan.mn`, for example `narantsetseg@artisan.mn`

## Database models (`server/src/models/`)

- **User:** name, email, passwordHash, role (buyer / artisan / admin).
- **Artisan:** user, payoutEmail (private: `select: false`, only `/api/artisans/me` and the payout code read it), bio (max 1000), certified, specialty, shopName, instagramHandle (stored without "@"), contactInfo (max 200), photoUrl (`http(s)://…` or `/…`), yearsExperience (whole number 0–100 or empty), location (max 100). There are deliberately **no email or phone** fields: public contact is Instagram-only.
- **Product:** title (Mongolian), titleEn, description, category, artisan, pricingTiers {basic, story, patron}, images[], likeCount, likedBy (never sent to the frontend).
- **Cart / Order:** orders keep their own copy of each item's name and price, so deleting a product doesn't affect past orders. A cart (and so an order) holds one shop's products only. Order items also store `patronBonus` {mn, en} (Patron items: the bonus as promised at checkout) and `deliveryVideoUrl` (Story/Patron: https link set by the artisan, visible only to that order's buyer and artisan). Orders also have `shippingAddress` {name, address, city, country, phone} (from checkout; only the order's buyer and artisan see it) and `releases` [{milestone, percent, amount, status held → due → sending → sent → paid, or pending_payout / failed, senderBatchId, payoutBatchId, payoutItemStatus, receiver, sentAt, paidAt, error}] (created at capture; buyer-facing responses strip the receiver email and PayPal ids). Orders have `statusHistory` [{status, at}]; orders from before 2026-10-12 have none and show createdAt as their "Ordered" date. New order items also store the seller (`artisan`); older items don't and are matched to a shop through their product. Order status can be `pending`, `paid`, `in_production`, `shipped`, `completed` or `cancelled`, and the order milestones change it (see API endpoints → Orders). `paid` and `cancelled` are still never set by the app.
- **Product views:** `Product.viewCount` (hidden from public responses, like `likedBy`). `ProductViewMark` holds one row per product and viewer for 24h (a TTL index removes it), so a viewer is counted at most once a day. `ProductViewDaily` stores counted views per product per Ulaanbaatar calendar day for the 30-day chart (`demo: true` rows are demo data).
- **Pricing** (`server/src/utils/pricing.js`): prices are stored in **USD**. Story = Basic +30%, Patron = Basic +65%, calculated on the server and rounded to cents.
- **Tiers:** Basic = product only; Story = + a video from the artisan; Patron = Story + a bonus the artisan writes per product (`Product.patronBonus` {mn, en}, max 100 chars each, optional). With both empty the Patron tier isn't offered (product page shows Basic/Story only; the cart and checkout refuse it). Existing products have no bonus; the owner fills them in via Edit product. KO shows the EN bonus.

## API endpoints

- **Login and security:**
  - `POST /api/auth/signup`, `POST /api/auth/login`.
  - The login check (`requireAuth`) confirms the user still exists in the database and reads their role from there. Logins from accounts deleted by a re-seed are refused ("Account no longer exists").
- **Products:**
  - `GET /api/products` (optional `?category=<key>`), `GET /api/products/:id`.
  - Artisan only: `POST /api/products` (form upload: title, titleEn, category, description, price in USD, required `photo`).
  - Artisan only, owner only: `PUT /api/products/:id` (same fields, photo optional; a new photo replaces the old one) and `DELETE /api/products/:id` (also removes the product's photo and removes it from all carts).
  - Likes: `PUT` / `DELETE /api/products/:id/like`, `GET /api/products/liked`.
- **Artisans:**
  - `GET /api/artisans`, `GET /api/artisans/:id` are public and return the artisan's name only, no email.
  - `GET /api/artisans?category=<key>` returns only artisans with at least one product in that category (used by the commission page's "Matched artisans").
  - Artisan only: `GET` / `PUT /api/artisans/me`. Editable: bio, instagramHandle, contactInfo, location, yearsExperience. Not editable by artisans: shopName, specialty, certified, photoUrl.
- **Cart:** `/api/cart`. Adding a product from a different shop than what's in the cart → 409 `OTHER_SHOP`; Patron on a product without a bonus → 400 `PATRON_UNAVAILABLE`.
- **Payments (PayPal, `paymentController.js`, `utils/paypal.js`):**
  - `GET /api/payments/paypal/config` (public): `{ mode, currency }`, used for the cart's "Test mode" note.
  - `POST /api/payments/paypal/orders` (login) `{ shippingAddress }` (all five fields required, validated; 400 `BAD_ADDRESS`): builds the order from the buyer's cart on the server (same checks as before: one shop, Patron needs a bonus; `orderTotals` amounts), creates the PayPal order with an item / shipping / handling (= 15% fee) breakdown and stores a `Checkout` record (the approved items and totals). Returns `{ id }` for the PayPal buttons.
  - `POST /api/payments/paypal/orders/:id/capture` (login, only the buyer who created it): claims the checkout (double clicks get 409), captures, and only if PayPal says COMPLETED for exactly the expected USD amount creates the Order with status `paid` and `payment` {provider, paypalOrderId, captureId, amount, currency, capturedAt}, then removes the paid lines from the cart. Wrong amount / PENDING → 402, checkout kept as `failed` for a manual look. If an earlier attempt captured but its response was lost, PayPal answers ORDER_ALREADY_CAPTURED and the order is created from PayPal's record. PayPal errors are logged with PayPal's debug_id; clients only get a generic message.
- **Payouts (`utils/payouts.js`):** no endpoint of their own. Advancing a milestone (`PUT /api/orders/:id/status`) marks its release due and sends it with `POST /v1/payments/payouts` (sender_batch_id and PayPal-Request-Id = `artisan-<orderId>-<milestone>`). Each release is claimed with an atomic update before PayPal is called, PayPal rejects a reused batch id, and a release PayPal has accepted is never re-sent. A PayPal error before acceptance leaves it `failed` and it's retried at the next milestone or when the artisan saves a payout email; a payout PayPal accepted but later returned stays `failed` for a manual look. `GET /api/orders/:id` refreshes "sent" releases from PayPal (PENDING → SUCCESS/UNCLAIMED). `PUT /api/artisans/me` accepts `payoutEmail` and then sends that artisan's pending releases. The dashboard returns `payouts` {released, held, waiting, hasPayoutEmail}.
- **Orders** (all require login):
  - `POST /api/orders` is turned off (410 `USE_PAYPAL`): orders only come from a captured payment. `GET /api/orders` (my orders as a buyer).
  - `GET /api/orders/shop` (artisan): orders placed with my shop, no buyer details.
  - `GET /api/orders/:id`: only the order's buyer or the artisan whose shop it is; anyone else gets 404. Returns milestones with dates, items (bonus snapshot, video link), and the caller's allowed next step. Never includes the buyer's name/email/id.
  - `PUT /api/orders/:id/status` `{ status }`: exactly the next step. Artisan: paid → in_production → shipped (unpaid `pending` orders, i.e. the ones from before PayPal, can't be advanced) (409 `MISSING_VIDEO` until every Story/Patron item has a video). Buyer: shipped → completed. Anything else 409 `BAD_STEP`. The update is conditional on the current status, so double clicks can't skip a step.
  - `PUT /api/orders/:id/items/:index/video` `{ url }`: the order's artisan, Story/Patron items, until the order is completed. Only absolute `https://` links with a dotted host, no user:password, max 500 chars (400 `BAD_URL`).
- **Commissions (reverse auction), all require login:**
  - `POST /api/commissions`: category (one of the 7 keys), description (max 2000), optional budgetRange, timeline, referenceImage.
  - `GET /api/commissions` (optional `?category=`): open requests only. Bids are private: each request has `bidCount`, the caller's own `myBid` (or null) and `isMine`, never the `bids` array.
  - `GET /api/commissions/mine`: the caller's own requests, every status, with full bids (bidder shop name, owner name, specialty, certified, photo, Instagram; no email).
  - `POST /api/commissions/:id/bids` (artisan with an Artisan record): price in USD, $0.01–$10,000, rounded to cents; optional message (max 1000). One bid per artisan per request; not on your own request; only while `open`.
  - `PUT /api/commissions/:id/accept-bid` `{ bidId }`: request owner only, only while `open`. Marks that bid `accepted`, the rest `rejected`, and the request `matched`.
- **Views and dashboard:**
  - `POST /api/products/:id/view` (login optional): called when a product page opens. Counts once per logged-in user, or per browser session (`X-Viewer-Session` header, a random id kept in `sessionStorage`) when logged out, per 24h. The owner's own views and requests with neither a user nor a session don't count.
  - `GET /api/artisans/me/dashboard` (artisan only, always the caller's own shop): totals (orders, units, revenue in USD, views, likes, unique and repeat buyers), counts per order status, per-product rows (units, orders, revenue, views, likes, conversion = orders ÷ views) and the last 30 days per day (orders, units, revenue, views). Cancelled orders are excluded from everything except the status counts. `demo: { orders, views }` says how much of the totals is demo data (counts only; which buyers are demo stays on the server). Revenue is item prices only (not the buyer's 15% fee or shipping). Only counts and sums are returned, nothing that identifies a buyer. Totals are computed in JavaScript from every matching order, which is fine at this scale but would need a MongoDB aggregation for a large shop.
- **Uploads:** `/uploads/...` serves photos from `server/uploads/products/` (with `nosniff`, no folder listing). JPEG, PNG or WebP only, up to 5 MB, file type checked from the contents, random filenames. All file handling is in `server/src/utils/imageStorage.js`.

## Frontend pages

Navigation is done in code (`navigate("…")`, see `src/App.js`); **there's no React Router and no page addresses in the URL.**

- **Shopping:** home, shop, product detail (owners see a "Your product · Edit · Delete" bar), cart, commission (reverse auction).
  - **Commission pages:** `commission` (request form; links to My requests, and to Commission requests for artisans), `my-commissions` (`MyCommissions.js`: every user's own requests, bids sorted accepted-first then cheapest, inline "Accept → Yes, accept" confirm, Instagram link to the chosen artisan), `commission-board` (`CommissionBoard.js`: artisans and admins; category chips; per-request bid form; admins see a "only artisans with a shop can bid" note). Reached from the profile page buttons ("My requests" for everyone, "Commission requests" for artisans).
  - **Category filter:** the chips on home and shop use the real product categories (`productCategories` in `data.js`). Picking one calls `GET /api/products?category=`; the shop has an "All" chip to clear it. The selected category stays set until changed (`shopCategory` in `App.js`).
  - **Certified badge:** shown on product cards, product detail, storefront and the commission page only when `artisan.certified` is true.
  - **Commission page "Matched artisans":** loaded live from `GET /api/artisans?category=` and updates when the category dropdown changes.
- **Artisan pages:**
  - **storefront:** shop name, specialty, Instagram, contact note, bio and a product grid. Reached by clicking the shop name on a product page.
  - **artisan-profile:** photo or initial circle, name, specialty, years and location, bio. No email or phone. Reached by clicking "by <name>".
  - "Back" retraces your steps between these two pages (`backStack` in `App.js`).
- **Artisan self-service:** shop-settings (profile form, `ArtisanProfileForm.js`), add-product and edit-product (one form for both, `AddProductForm.js`; prices can be typed in ₮ or $ and are converted at the live rate).
- **Dashboard** (`Dashboard.js`, artisans only, opened from the "Dashboard" button on the profile page): PayPal/privacy note, stat tiles (revenue in the chosen currency plus ₮), buyers and status counts, a dashed **"Demo data" banner** above the stat tiles when any demo orders/views are included (e.g. "25 of 30 orders and 827 of 827 views…") with **DEMO** tags on the chart and product-table headings, a 30-day column chart with a Sales/Views toggle, hover tooltips and a "Show as table" view, and a per-product table.
- **Orders:** the profile's Order history rows open `order-detail` (`OrderDetail.js`: milestone timeline with dates, items, Patron bonus ("Include in the package:" for the artisan), video link form for the artisan, "Your video from <shop>" + Confirm received for the buyer, inline "can't be undone" confirmations). Artisans also get a **Shop orders** button on the profile (`ShopOrders.js`, flags orders with missing videos). Tier text and the bonus helper live in `src/tiers.js`.
- **Cart checkout:** a shipping address form (`ShippingAddressForm.js`; the PayPal button refuses to open until it's complete), then PayPal buttons (`PayPalCheckout.js`; SDK loaded from paypal.com by `src/paypal.js`) replace the old "Proceed to Payment". After capture the order page opens. Sandbox mode shows a "Test mode" note. The order page shows "Paid with PayPal · date" (the buyer also sees the PayPal reference) or "Not paid" for older orders. It also shows "Ship to" (the address, artisan and buyer only) and "Artisan payout": released vs held and each milestone's 30/30/40 amount and state (the artisan also sees PayPal's status and why a payout is waiting). The dashboard has Released / Held / Waiting-to-send tiles; the shop profile form has the private payout email.
- **Account:** saved (now "Liked"; the heart is a like stored on the server), profile (an artisan's profile page shows "+ Add product" and "Edit shop profile").
- **Text:** all UI text exists in MN / EN / KO (`src/data.js`). That file now holds only `i18n` and `materialsByCat` (fallback "materials" text when a product has no description); the old mock exports (`usersDB`, `productsData`, `sectionsData`, `reviewsData`) were removed.
- **Helpers:** `src/artisanInfo.js` (artisan display data), `assetUrl()` in `src/api.js` (resolves `/uploads/...` photos against the API server).

## Real data (noon_handmade_)

- **3 products:**
  - Silver Necklace: $22.08, from 79,000₮, 39+5 cm.
  - Crystal & Pearl Necklace: $15.65, from 56,000₮, 40+5 cm.
  - Purple Cluster Necklace: $14.25, from 51,000₮, 36+5 cm.
- **Exchange rate:** all three were converted at 3,578.01₮/$ (open.er-api.com, 2026-09-29).
- **Shop photo:** the NOON logo cropped out of the Instagram screenshot, at `public/images/artisans/noon-logo.png`.
- **Original photos kept:** `public/nood_logo.png`, `nood_p1.jpeg`, `nood_p2.png`. They're real product photos; don't delete them.
- **Current profile values:** specialty "Necklace · Jewelry · Crochet", contact note "DM @noon_handmade_ on Instagram to order. Custom orders take 10-14 days.", 3 years, location **"Ulaaanbaatar Mongolia"** (a likely typo, three a's).

## Demo data (dashboard)

- **Demo data was removed on 2026-10-12** (`npm run seed:demo -- --remove`); the live database has no demo buyers, orders or view rows. The banner and DEMO tags only appear while demo records exist. To bring it back for a presentation, run `npm run seed:demo` (21 fake buyers at `@demo.artisan.invalid`, 26 orders incl. one cancelled, ~825 views over 30 days).
- The dates are relative to when the script runs, so **run `npm run seed:demo` again shortly before the demo** to keep the 30-day chart full (it replaces the old demo data). Remove it before real use with `npm run seed:demo -- --remove`.
- The full `npm run seed` also adds the demo data.
- The 5 earlier test orders on noon's products (Sep 29–Oct 2, all `pending`) were left as they are (the owner's choice on 2026-10-06), so they count in the dashboard too; they're the 5 non-demo orders in the banner's "25 of 30".

## How to test PayPal (sandbox)

1. In the PayPal developer dashboard → Sandbox accounts, use a **Personal** (buyer) sandbox account. Its email/password are only for PayPal's sandbox login window.
2. Log in to the app as `buyer@artisan.mn`, add a product (one shop), open the cart, click **Pay with PayPal**, log in with the sandbox buyer account and approve.
3. The app captures the payment and opens the order (status Paid, "Paid with PayPal"). The artisan can then start production.
4. The payment shows in the sandbox business account. Sandbox orders that are never approved expire on their own.
5. Payouts: put a sandbox **Personal** account email in the artisan's shop profile (payout email) and move the order through In production / Shipped, then confirm receipt as the buyer. Each step sends one payout from the sandbox business account; the order page shows them as Sent to PayPal, then Paid out once PayPal reports SUCCESS. A made-up email gives UNCLAIMED (returned after 30 days).

## Security (review of 2026-10-12)

- **Startup:** the server refuses to start unless `JWT_SECRET` is set and at least 32 characters. Tokens are HS256 only (signed and verified with a pinned algorithm); the role is always re-read from the database.
- **Rate limits** (`middleware/rateLimit.js`, in memory, per process): login 5 failed attempts per account and 20 per IP address per 15 min (successful logins don't count); sign-up 10 per IP per hour; PayPal checkout create 10 and capture 20 per user per 10 min. 429 responses carry `Retry-After`. With several server instances, move the counters to a shared store (e.g. Redis). Behind a proxy set `TRUST_PROXY=1`, otherwise every client shares the proxy's address.
- **CORS:** only the origins in `CORS_ORIGINS` (default `http://localhost:3000`); set it to the deployed frontend URL.
- **Headers** (`middleware/securityHeaders.js`): no `X-Powered-By`; nosniff, `X-Frame-Options: DENY`, a `default-src 'none'` CSP, `no-referrer`, `Cache-Control: no-store` on `/api`, cross-origin resource policy (uploads `cross-origin`), HSTS when `NODE_ENV=production`.
- **Errors:** 500s return a generic message (details only in the server log); invalid ids → 400, malformed JSON → 400, bodies over 100 kB → 413.
- **Auth input:** login/signup accept only string fields (objects such as `{"$gt": ""}` are refused before any query); sign-up requires a valid email, a name up to 100 characters and an 8-128 character password (existing accounts are unaffected).
- **Still open (low):** tokens live in `localStorage` (an XSS bug would expose them) and can't be revoked before they expire (7 days); anyone can sign up with the `artisan` role (harmless without an Artisan record); signup reveals whether an email is registered; the artisan alone decides when a milestone is reached (and so when 60% is paid out); the commission board shows buyers' names to logged-in users; delivery video links can point to any https site; multer has no field-count limit; cart quantities aren't capped; seeded accounts share `artisan123` and the login page has demo-login buttons.

## ⚠️ Important caveats

1. **Re-seeding deletes products artisans added themselves.** The seed wipes all users, artisans and products, then recreates only what's in `server/src/seed/seedData.js`. It also leaves their photos behind in `server/uploads/` and logs everyone out. Add real products to `seedData.js`, or stop re-seeding.
2. **Uploaded photos are on local disk.** Swap `server/src/utils/imageStorage.js` for Cloudinary (or similar) before deploying; nothing else needs to change.
3. **Browser-test issues on this machine:** the **Dark Reader** extension recolors localhost (turn it off for localhost to see the real pink design), and screenshots and mouse clicks from browser automation were unreliable here.
4. **The test scripts are temporary.** They were in the session scratchpad, not the repo, and are not saved in the project.
5. **`purple-cluster-necklace.png` is actually a JPEG** with a `.png` name. It displays fine.

## Pending / deferred

- **Features:** email verification (not started); PayPal refunds and webhooks (payout status is only refreshed when an order page is opened); an admin view for failed/returned payouts; shipping address and cancel flow for orders; artisan self-registration; commission follow-through after a bid is accepted (status changes, artisan-side view of won jobs, notifications).
- **Deployment:** the Cloudinary swap, real credentials (don't ship `artisan123`; the `@example.com` email is a placeholder), `REACT_APP_API_URL`, tighter CORS (it currently allows any site), and `server/uploads/` in `.gitignore`.
- **Deferred by the owner:** comments (needs moderation/spam handling/UI design); product descriptions in Mongolian and Korean (English only for now).
- **Waiting on the owner:** a cleaner purple necklace photo (the current one shows Instagram's arrow and dots); optionally a higher-resolution logo (the current one is 189 px).
- **Known gaps:**
  - No URL routing: shop and profile pages can't be linked to, and refreshing goes to home.
  - One photo per product; the four gallery thumbnails on the detail page are placeholder emoji.
  - Still-hardcoded marketing text in `i18n`: the "How it works" steps and escrow/shipping wording describe features (escrow, milestones) that don't exist yet.
  - All seeded artisans are `certified: true`, so the certified badge only disappears if you change it in the database.
  - Artisans can't set their own photo, shop name or specialty.
  - Admins can't add products (they have no shop).
  - If the live exchange rate fails to load, the add/edit form falls back to 3,450₮/$ (the rate used is always shown under the price).
  - The "saved" and "profile" pages still use the older mobile styling.
  - Lint warnings (0 errors): `href="#"` links and an unused `ratesUpdated` in `App.js`.
  - Artisans see whether their bid was accepted only by reopening the Commission requests board, and a matched request drops off that board. There's no "my bids" list yet.
  - Dashboard: views only started being counted on 2026-10-06, so real view counts (and conversion for the app-added products) start from zero. Views of a deleted product disappear from its row, but its sales stay listed as "(deleted)".
  - Real views only count from 2026-10-06 on. The 2 views on 2026-10-12 (Silver Necklace, Crystal & Pearl) are test views by `buyer@artisan.mn`.
  - Conversion divides all-time orders by views counted since 2026-10-06, so a product with older orders and few views looks inflated (Silver Necklace: 1 order ÷ 1 view = 100%).
  - Empty states: when the selected chart metric is 0 for all 30 days, the chart is replaced by a short message ("No sales/views in the last 30 days yet…").
  - Orders: the artisan sees no buyer name or address (consistent with the dashboard's privacy rule), and there's no shipping address at checkout, so actual shipping still happens outside the app. No cancel flow, no notifications when a step changes.
  - The product page shipping box ("Milestone-based escrow…") and the commission page steps still mention escrow payments that don't exist; the cart note was replaced on 2026-10-12.
  - Demo seed (`seed:demo`) only uses Patron where a product has a bonus; shipped/completed Story/Patron demo items get a placeholder video link (`https://example.com/demo-video/order-N-M`, `DEMO_VIDEO_URL` in demoData.js).
  - Milestones were tested end to end on 2026-10-12 (51 API checks + a browser run as buyer and Narantsetseg, plus another-artisan / other-buyer isolation); the test orders and the temporary buyer were deleted afterwards. Test product views from that run remain on Narantsetseg's Felt Wallet and Jewelry Set.
  - The commission pages haven't been checked in a real browser yet; the API was tested end to end (script not kept, see caveat 4).
