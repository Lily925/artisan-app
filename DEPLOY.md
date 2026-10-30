# Deploying Artisan

Backend (`server/`, Express + MongoDB Atlas) → **Render**. Frontend (repo root, Create React
App) → **Vercel**. Photos → **Cloudinary**. Payments → **PayPal** (sandbox first).

Follow the sections in order. Each URL you get in one step is needed by a later one.

---

## 1. Environment variables

Real values go only into the Render / Vercel dashboards and your local `.env` files, never
into git. Templates: `server/.env.example` and `.env.example`.

### Server (Render → your service → Environment)

| Variable | Required in production | Example / format | Notes |
|---|---|---|---|
| `NODE_ENV` | yes | `production` | Turns on the production checks, HSTS, strict CORS, demo-password block. |
| `MONGODB_URI` | yes | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/artisan?retryWrites=true&w=majority` | From Atlas → Connect → Drivers. |
| `JWT_SECRET` | yes | 64+ random hex characters | At least 32 characters. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Use a **new** value for production, not your local one. |
| `JWT_EXPIRES_IN` | no (default `7d`) | `7d` | How long a login lasts. |
| `PORT` | set by Render | — | Don't set it yourself on Render; the server listens on whatever Render provides. |
| `CLIENT_URL` | yes | `https://your-app.vercel.app` | The Vercel site's origin: https, no path, no trailing slash, no `*`. Several allowed, comma-separated. Only these origins may call the API from a browser. |
| `PAYPAL_CLIENT_ID` | yes | sandbox client id | PayPal app credentials (section 5). |
| `PAYPAL_CLIENT_SECRET` | yes | sandbox secret | Server only. |
| `PAYPAL_MODE` | yes | `sandbox` | `live` only with live credentials. |
| `CLOUDINARY_CLOUD_NAME` | yes | `your-cloud-name` | Cloudinary → Settings → API Keys. |
| `CLOUDINARY_API_KEY` | yes | — | |
| `CLOUDINARY_API_SECRET` | yes | — | Server only. |
| `TRUST_PROXY` | no (default `1` in production) | `1` | Proxy hops in front of the app, so rate limits see each visitor's own address. |

If any required variable is missing or malformed, the server exits at startup with a list
of the variable **names** that need fixing (values are never printed). Check the Render logs.

### Frontend (Vercel → Project → Settings → Environment Variables)

| Variable | Required | Example | Notes |
|---|---|---|---|
| `REACT_APP_API_URL` | yes | `https://your-api.onrender.com/api` | The Render URL **plus `/api`**. Must be https. |
| `REACT_APP_PAYPAL_CLIENT_ID` | yes | sandbox client id | Same PayPal app as the server's `PAYPAL_CLIENT_ID` (it's public). |

These are compiled into the site at **build time**, so you must redeploy after changing one.
On Vercel the build stops with a clear message if either is missing, isn't https, or points
at localhost (`scripts/check-build-env.js`).

---

## 2. Before the first deploy (one time, from your computer)

The production site uses the same Atlas database as now (it already holds the shop's
products, and the photos are on Cloudinary).

1. **Remove the fake dashboard data:**
   ```
   cd server
   npm run seed:demo -- --remove
   ```
2. **Change every seeded password.** All seeded accounts have the public password
   `artisan123`. In production the API refuses that password, so these accounts can't log in
   until you give them new ones. Run this for each account you want to keep using. It prints
   a random password once; save it in a password manager.
   ```
   npm run set-password -- admin@artisan.mn
   npm run set-password -- noon.handmade@example.com
   npm run set-password -- buyer@artisan.mn
   npm run set-password -- narantsetseg@artisan.mn
   npm run set-password -- enkhjargal@artisan.mn
   npm run set-password -- boldbaatar@artisan.mn
   npm run set-password -- oyuntsetseg@artisan.mn
   npm run set-password -- gantulga@artisan.mn
   npm run set-password -- tserenpuntsag@artisan.mn
   ```
   To choose a password yourself instead: `NEW_PASSWORD='...' npm run set-password -- <email>`.
   `noon.handmade@example.com` is the real shop's login. Consider changing it to the owner's
   real email address too (directly in Atlas → Browse Collections → `users`).
3. Make sure no photos still point at local disk: `npm run migrate:images -- --dry-run`
   should report `0 local photo path(s)`. If it doesn't, run `npm run migrate:images`.

`npm run seed` and `npm run seed:demo` refuse to run with `NODE_ENV=production` unless you
add `--allow-production`. Don't run them against production.

---

## 3. MongoDB Atlas: network access

1. Atlas → **Database Access** → Add New Database User. Choose a password user with a long
   random password and the role **Read and write to any database** (or `readWrite` on the
   `artisan` database only). Use this user in the production `MONGODB_URI`, not the one you
   use locally.
2. Atlas → **Network Access** → Add IP Address:
   - If your Render service lists outbound IP addresses (Render → service → **Connect** →
     **Outbound**), add each of them.
   - Otherwise (e.g. the free plan), add `0.0.0.0/0` (allow from anywhere). The database is
     then protected only by the user and password from step 1, so keep that password strong
     and private.
3. Atlas → Connect → Drivers → copy the `mongodb+srv://...` string. Put in the user and
   password, and keep `/artisan` as the database name.

---

## 4. Render (backend)

1. render.com → **New** → **Web Service** → connect GitHub and pick `Lily925/artisan-app`.
   The repo is private, so allow Render access to it when asked.
2. Settings:
   - **Name:** e.g. `artisan-api`. The URL becomes `https://artisan-api.onrender.com` (Render
     may add a suffix; use the one it shows).
   - **Region:** the one closest to your Atlas cluster.
   - **Branch:** `main`
   - **Root Directory:** `server`
   - **Runtime:** Node (Node 20 or newer; `package.json` asks for `>=20`)
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start`
   - **Instance type:** Free works for testing. It sleeps after about 15 minutes without
     traffic, and the next request then takes up to a minute.
3. **Environment:** add every server variable from the table in section 1. For `CLIENT_URL`,
   use the Vercel URL you plan to use (`https://<project-name>.vercel.app`; pick the project
   name now and use it in step 5). You can correct it after Vercel deploys.
4. **Advanced → Health Check Path:** `/health`
5. **Create Web Service.** In the logs, look for:
   `Artisan API listening on port ... (production; photo storage: Cloudinary; allowed origins: https://...)`
6. Check: open `https://<your-render-url>/health`. It should show `{"ok":true,"db":"connected"}`.

---

## 5. PayPal (sandbox)

1. developer.paypal.com → log in → **Apps & Credentials** → make sure **Sandbox** is
   selected → **Create App** (type: Merchant), or use your existing sandbox app.
2. Copy its **Client ID** (→ `PAYPAL_CLIENT_ID` on Render and `REACT_APP_PAYPAL_CLIENT_ID`
   on Vercel) and **Secret** (→ `PAYPAL_CLIENT_SECRET` on Render only).
3. In the app's settings under **Features**, make sure **Payouts** is enabled (needed for
   artisan payouts).
4. **Testing Tools → Sandbox Accounts:** note a **Personal** account (to pay as the buyer
   and to receive payouts) and its password (View/Edit account).
5. Nothing else is needed: checkout opens PayPal in a popup on your own page (PayPal's
   JavaScript SDK), so there are **no return/cancel URLs or redirects** to configure, and the
   app uses no webhooks.
6. Going live later: create a **Live** app, set `PAYPAL_MODE=live` and the live
   id/secret on Render, the live id on Vercel, then redeploy both.

---

## 6. Vercel (frontend)

1. vercel.com → **Add New** → **Project** → import `Lily925/artisan-app` (allow access to the
   private repo).
2. Settings:
   - **Project Name:** the name you used for `CLIENT_URL` in section 4.
   - **Framework Preset:** Create React App
   - **Root Directory:** `./` (the repo root, **not** `server`)
   - **Build Command:** `npm run build` (default). It runs the env check first.
   - **Output Directory:** `build` (default)
3. **Environment Variables:** `REACT_APP_API_URL` = `https://<your-render-url>/api` and
   `REACT_APP_PAYPAL_CLIENT_ID`, for Production (and Preview if you use previews).
4. **Deploy.** `vercel.json` sends every path to `index.html`, so reloading any page works.
5. If the final domain differs from what you put in `CLIENT_URL`, update `CLIENT_URL` on
   Render (it redeploys). Vercel **preview** deployments have other URLs, so the API blocks
   them (CORS) unless you add them to `CLIENT_URL`. Test on the production URL.

---

## 7. Post-deploy checklist

Open the Vercel URL in a private window, with the browser's developer tools (Console and
Network) open.

- [ ] **Health:** `https://<render-url>/health` → `{"ok":true,"db":"connected"}`.
- [ ] **No demo logins:** the login page has no "Demo" buttons.
- [ ] **Seed password blocked:** logging in as `admin@artisan.mn` with `artisan123` fails.
- [ ] **Register:** create a buyer account with a new email. It logs you in.
- [ ] **Login / logout:** log out, then log in again with that account.
- [ ] **Artisan sign-up:** register a second account as "I want to sell", then set up the
      shop (name, region).
- [ ] **Profile photo:** upload a JPEG/PNG under 2 MB. It shows, and its address starts with
      `https://res.cloudinary.com/`. A file over 2 MB, or a non-image, is refused.
- [ ] **Product:** as the artisan, add a product with 2-3 photos, reorder them, and
      remove one. Check the product page shows them in order.
- [ ] **CORS:** no CORS errors in the Console.
- [ ] **PayPal sandbox payment:** as the buyer, add the product to the cart, fill in the
      shipping address, pay with the sandbox **Personal** account. The order page opens and
      shows "Paid with PayPal".
- [ ] **Milestones:** as the artisan, set the payout email (sandbox Personal account email)
      in the shop profile, then open the order and move it to In production → Shipped. As
      the buyer, confirm receipt (Completed).
- [ ] **Payout:** the order page shows each milestone's payout (30% / 30% / 40%) as Sent to
      PayPal, then Paid out. In the sandbox Personal account (sandbox.paypal.com) the
      payments arrive.
- [ ] **Reload:** reload the browser on a page other than home. The app loads (no 404).
- [ ] **Render logs:** no errors, and nothing that looks like a secret.

If something fails: Render → Logs (server errors, startup configuration errors) and the
browser Console / Network tab (CORS, wrong `REACT_APP_API_URL`).
