# Artisan API (phase 1: backend foundation)

Express + Mongoose backend for the Artisan marketplace. Lives separately from the React
app — nothing in `src/` imports or depends on this.

## Setup

```
cd server
npm install
cp .env.example .env   # then fill in MONGODB_URI with your Atlas connection string
npm run seed            # populates Users, Artisans, Products from the current mock data
npm run dev              # starts the API on http://localhost:5000 (nodemon)
```

`.env` is gitignored — `MONGODB_URI` and `JWT_SECRET` never get committed. A `JWT_SECRET`
is already generated for you in `.env`; only `MONGODB_URI` needs filling in.

## Endpoints

- `GET /api/health` — liveness check
- `POST /api/auth/signup` — `{ name, email, password, role? }` → `{ token, user }`
- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`
- `GET /api/products` — optional `?category=` filter
- `GET /api/products/:id`
- `POST /api/products` — requires `Authorization: Bearer <token>` for an `artisan` or `admin`
  user that has a linked Artisan profile (all seeded artisans do)
- `GET /api/artisans`
- `GET /api/artisans/:id`

## Seeded accounts (password `artisan123` for all)

| email | role |
|---|---|
| admin@artisan.mn | admin |
| buyer@artisan.mn | buyer |
| narantsetseg@artisan.mn | artisan |
| enkhjargal@artisan.mn | artisan |
| boldbaatar@artisan.mn | artisan |
| oyuntsetseg@artisan.mn | artisan |
| gantulga@artisan.mn | artisan |
| tserenpuntsag@artisan.mn | artisan |

## Not built yet (phase 2+)

Cart, orders, and reverse-auction endpoints are intentionally out of scope this phase.
The React frontend is not wired up to this API yet — test with curl/Postman/Insomnia first.
