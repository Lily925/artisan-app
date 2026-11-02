// Decides whether a database may be used by the tests. No side effects, so it can be tested
// on its own (safety.test.mjs).

// The live database's name, even if server/.env ever stops mentioning it.
const PROTECTED_NAMES = ["artisan"];

export const dbNameOf = (uri) => /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(uri || "")?.[1] || "";

// Why the tests must not run against this URI, or null when it is safe. `realUri` is the
// application's own MONGODB_URI: its database is off limits whatever it is called.
export function unsafeReason(uri, { nodeEnv, realUri } = {}) {
  if (nodeEnv === "production") return "NODE_ENV is production";
  const name = dbNameOf(uri);
  if (!name) return "the test database URI names no database";
  const lower = name.toLowerCase();
  if (PROTECTED_NAMES.includes(lower)) return `"${name}" is the production database`;
  if (lower === dbNameOf(realUri).toLowerCase()) return `"${name}" is the database in MONGODB_URI`;
  if (!lower.includes("test")) return `the test database's name must contain "test" (got "${name}")`;
  return null;
}
