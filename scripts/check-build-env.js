// Runs before `npm run build` (prebuild). On Vercel (VERCEL=1) or with CHECK_BUILD_ENV=1 it
// stops the build when a required REACT_APP_* variable is missing or wrong, instead of
// shipping a site that calls http://localhost. Local builds are not checked (they read .env).
// Values are never printed.
const strict = process.env.VERCEL === "1" || process.env.CHECK_BUILD_ENV === "1";
if (!strict) process.exit(0);

const problems = [];
const api = process.env.REACT_APP_API_URL || "";
let url = null;
try { url = new URL(api); } catch { /* reported below */ }
if (!api) problems.push("REACT_APP_API_URL is not set (e.g. https://your-api.onrender.com/api)");
else if (!url) problems.push("REACT_APP_API_URL is not a valid URL");
else if (url.protocol !== "https:") problems.push("REACT_APP_API_URL must start with https://");
else if (/^(localhost|127\.)/.test(url.hostname)) problems.push("REACT_APP_API_URL points at localhost");
if (!process.env.REACT_APP_PAYPAL_CLIENT_ID) problems.push("REACT_APP_PAYPAL_CLIENT_ID is not set (checkout would show PayPal as unavailable)");

if (problems.length) {
  console.error(`Build environment error:\n  - ${problems.join("\n  - ")}\nSet them in Vercel → Project → Settings → Environment Variables, then redeploy (see DEPLOY.md).`);
  process.exit(1);
}
console.log("Build environment OK.");
