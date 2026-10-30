// Startup check of the server's environment variables. Problems are listed by variable
// name only (values are never printed) and the process exits before anything else runs.
// Production = NODE_ENV=production (set it on the host, e.g. Render).

const isProduction = process.env.NODE_ENV === "production";

// Variables production can't run without. (PORT is set by the host; JWT_EXPIRES_IN and
// TRUST_PROXY have defaults.)
const REQUIRED_IN_PRODUCTION = [
  "MONGODB_URI", "JWT_SECRET", "CLIENT_URL",
  "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_MODE",
  "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
];

const DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

// CLIENT_URL: the deployed frontend's origin, e.g. https://artisan.vercel.app (several may be
// given, comma-separated). Returns { origins, problems }.
function readClientUrls(raw) {
  const origins = [], problems = [];
  for (const entry of (raw || "").split(",").map((s) => s.trim()).filter(Boolean)) {
    if (entry.includes("*")) { problems.push("CLIENT_URL can't contain a wildcard (*)"); continue; }
    let url;
    try { url = new URL(entry); } catch { problems.push(`CLIENT_URL has an entry that isn't a URL ("${entry}")`); continue; }
    if (isProduction && url.protocol !== "https:") { problems.push(`CLIENT_URL must use https:// in production ("${entry}")`); continue; }
    if (url.pathname !== "/" || url.search || url.hash) { problems.push(`CLIENT_URL must be just the origin, without a path ("${entry}" → "${url.origin}")`); continue; }
    origins.push(url.origin);
  }
  return { origins, problems };
}

function checkEnv() {
  const env = process.env;
  const problems = [];
  if (isProduction) {
    const missing = REQUIRED_IN_PRODUCTION.filter((name) => !env[name]?.trim());
    if (missing.length) problems.push(`Missing: ${missing.join(", ")}`);
  }
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) problems.push("JWT_SECRET must be at least 32 characters long");
  if (env.MONGODB_URI && !/^mongodb(\+srv)?:\/\//.test(env.MONGODB_URI.trim())) problems.push("MONGODB_URI must start with mongodb:// or mongodb+srv://");
  if (env.PAYPAL_MODE && !["sandbox", "live"].includes(env.PAYPAL_MODE.trim())) problems.push('PAYPAL_MODE must be "sandbox" or "live"');
  const { origins, problems: urlProblems } = readClientUrls(env.CLIENT_URL);
  problems.push(...urlProblems);

  if (problems.length) {
    console.error(`Server configuration error${isProduction ? " (NODE_ENV=production)" : ""}:\n  - ${problems.join("\n  - ")}\nSee server/.env.example and DEPLOY.md.`);
    process.exit(1);
  }

  // Browsers may call the API only from these origins: CLIENT_URL, plus the local dev
  // frontend outside production. Never a wildcard.
  return { isProduction, allowedOrigins: isProduction ? origins : [...new Set([...origins, ...DEV_ORIGINS])] };
}

module.exports = { checkEnv, REQUIRED_IN_PRODUCTION };
