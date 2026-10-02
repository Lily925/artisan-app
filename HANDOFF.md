# Artisan marketplace: project state (2026-09-29)

**Location:** `C:\Users\saraa\artisan-app`. This is **not a git repo**, so there's no history to fall back on.

## How to run

| Part | Where | Command | Port |
|---|---|---|---|
| Frontend (React, Create React App) | `artisan-app/` | `npm start` | 3000 |
| API (Express + MongoDB Atlas) | `artisan-app/server/` | `npm start` | 5000 |
| Seed | `artisan-app/server/` | `npm run seed` | – |

- **Database:** MongoDB Atlas; the connection string is in `server/.env` as `MONGODB_URI`.
- **IP allowlist:** Atlas only accepts connections from allowed IPs. This machine's IP was `203.246.85.195`. If it changes, add the new one under Atlas → Network Access.

**Seeded test accounts** (all use the password `artisan123`):
- `admin@artisan.mn` (admin)
- `buyer@artisan.mn` (buyer)
- `noon.handmade@example.com` (**Bolorsaran**, the real shop noon_handmade_)
- 6 mock artisans at `@artisan.mn`, for example `narantsetseg@artisan.mn`

## Database models (`server/src/models/`)

- **User:** name, email, passwordHash, role (buyer / artisan / admin).
- **Artisan:** user, bio (max 1000), certified, specialty, shopName, instagramHandle (stored without "@"), contactInfo (max 200), photoUrl (`http(s)://…` or `/…`), yearsExperience (whole number 0–100 or empty), location (max 100). There are deliberately **no email or phone** fields: public contact is Instagram-only.
- **Product:** title (Mongolian), titleEn, description, category, artisan, pricingTiers {basic, story, patron}, images[], likeCount, likedBy (never sent to the frontend).
- **Cart / Order:** orders keep their own copy of each item's name and price, so deleting a product doesn't affect past orders.
- **Pricing** (`server/src/utils/pricing.js`): prices are stored in **USD**. Story = Basic +30%, Patron = Basic +65%, calculated on the server and rounded to cents.

## API endpoints

- **Login and security:**
  - `POST /api/auth/signup`, `POST /api/auth/login`.
  - The login check (`requireAuth`) confirms the user still exists in the database and reads their role from there. Logins from accounts deleted by a re-seed are refused ("Account no longer exists").
- **Products:**
  - `GET /api/products`, `GET /api/products/:id`.
  - Artisan only: `POST /api/products` (form upload: title, titleEn, category, description, price in USD, required `photo`).
  - Artisan only, owner only: `PUT /api/products/:id` (same fields, photo optional; a new photo replaces the old one) and `DELETE /api/products/:id` (also removes the product's photo and removes it from all carts).
  - Likes: `PUT` / `DELETE /api/products/:id/like`, `GET /api/products/liked`.
- **Artisans:**
  - `GET /api/artisans`, `GET /api/artisans/:id` are public and return the artisan's name only, no email.
  - Artisan only: `GET` / `PUT /api/artisans/me`. Editable: bio, instagramHandle, contactInfo, location, yearsExperience. Not editable by artisans: shopName, specialty, certified, photoUrl.
- **Cart, orders, commissions:** `/api/cart`, `/api/orders`, `/api/commissions` (reverse auction with bids).
- **Uploads:** `/uploads/...` serves photos from `server/uploads/products/` (with `nosniff`, no folder listing). JPEG, PNG or WebP only, up to 5 MB, file type checked from the contents, random filenames. All file handling is in `server/src/utils/imageStorage.js`.

## Frontend pages

Navigation is done in code (`navigate("…")`, see `src/App.js`); **there's no React Router and no page addresses in the URL.**

- **Shopping:** home, shop, product detail (owners see a "Your product · Edit · Delete" bar), cart, commission (reverse auction).
- **Artisan pages:**
  - **storefront:** shop name, specialty, Instagram, contact note, bio and a product grid. Reached by clicking the shop name on a product page.
  - **artisan-profile:** photo or initial circle, name, specialty, years and location, bio. No email or phone. Reached by clicking "by <name>".
  - "Back" retraces your steps between these two pages (`backStack` in `App.js`).
- **Artisan self-service:** shop-settings (profile form, `ArtisanProfileForm.js`), add-product and edit-product (one form for both, `AddProductForm.js`; prices can be typed in ₮ or $ and are converted at the live rate).
- **Account:** saved (now "Liked"; the heart is a like stored on the server), profile (an artisan's profile page shows "+ Add product" and "Edit shop profile").
- **Text:** all new text exists in MN / EN / KO (`src/data.js`).
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

## ⚠️ Important caveats

1. **Re-seeding deletes products artisans added themselves.** The seed wipes all users, artisans and products, then recreates only what's in `server/src/seed/seedData.js`. It also leaves their photos behind in `server/uploads/` and logs everyone out. Add real products to `seedData.js`, or stop re-seeding.
2. **Uploaded photos are on local disk.** Swap `server/src/utils/imageStorage.js` for Cloudinary (or similar) before deploying; nothing else needs to change.
3. **Browser-test issues on this machine:** the **Dark Reader** extension recolors localhost (turn it off for localhost to see the real pink design), and screenshots and mouse clicks from browser automation were unreliable here.
4. **The test scripts are temporary.** They were in the session scratchpad, not the repo, and are not saved in the project.
5. **`purple-cluster-necklace.png` is actually a JPEG** with a `.png` name. It displays fine.

## Pending / deferred

- **Deployment:** PayPal (not started), the Cloudinary swap, real credentials (don't ship `artisan123`; the `@example.com` email is a placeholder), `REACT_APP_API_URL`, tighter CORS (it currently allows any site), and `server/uploads/` in `.gitignore`.
- **Deferred by the owner:** comments (needs moderation/spam handling/UI design); product descriptions in Mongolian and Korean (English only for now).
- **Waiting on the owner:** a cleaner purple necklace photo (the current one shows Instagram's arrow and dots); optionally a higher-resolution logo (the current one is 189 px).
- **Known gaps:**
  - No URL routing: shop and profile pages can't be linked to, and refreshing goes to home.
  - One photo per product; the four gallery thumbnails on the detail page are placeholder emoji.
  - Artisans can't set their own photo, shop name or specialty.
  - Admins can't add products (they have no shop).
  - If the live exchange rate fails to load, the add/edit form falls back to 3,450₮/$ (the rate used is always shown under the price).
  - The "saved" and "profile" pages still use the older mobile styling.
  - Lint warnings (0 errors): `href="#"` links and an unused `ratesUpdated` in `App.js`.
