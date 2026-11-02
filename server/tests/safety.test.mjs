// The tests' own safety: every script must refuse the production database and NODE_ENV=production
// before it connects to anything. Starts no database or API.  npm run test:safety
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { unsafeReason } from "./guard.mjs";

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, x = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${x ? "  — " + x : ""}`); };

// ── the rule ──
const REAL = "mongodb+srv://u:p@cluster.example.net/artisan?retryWrites=true";
const refused = (uri, options = { realUri: REAL }) => unsafeReason(uri, options) !== null;
check("the production name is refused", refused("mongodb://127.0.0.1:27017/artisan"));
check("…in any case", refused("mongodb://127.0.0.1:27017/ARTISAN"));
check("…on any host, with options", refused("mongodb+srv://u:p@other.example.net/artisan?w=majority"));
check("…even if MONGODB_URI isn't set", refused("mongodb://127.0.0.1/artisan", {}));
check("the database in MONGODB_URI is refused, whatever it's called", refused("mongodb://h/shop_test", { realUri: "mongodb://h/shop_test" }));
check("a name without \"test\" is refused", refused("mongodb://127.0.0.1/shop"));
check("no database name is refused", refused("mongodb://127.0.0.1:27017/") && refused("mongodb://127.0.0.1:27017"));
check("NODE_ENV=production is refused, even with a test name", refused("mongodb://127.0.0.1/artisan_test", { nodeEnv: "production", realUri: REAL }));
check("artisan_test is allowed", !refused("mongodb://127.0.0.1:27017/artisan_test"));
check("…also with a cluster and options", !refused("mongodb+srv://u:p@cluster.example.net/artisan_test?retryWrites=true"));

// ── every script, for real ──
const scripts = fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith(".test.mjs") && f !== "safety.test.mjs");
check("found the test scripts", scripts.length >= 7, scripts.join(" "));
const run = (script, env) => spawnSync(process.execPath, [path.join(TESTS_DIR, script)], { cwd: path.join(TESTS_DIR, ".."), env: { ...process.env, ...env }, encoding: "utf8", timeout: 60000 });
for (const script of scripts) {
  // Port 1 closed: if the check were missing, connecting would fail instead of "Refusing".
  let r = run(script, { NODE_ENV: "production", MONGODB_URI_TEST: "mongodb://127.0.0.1:1/artisan_test" });
  check(`${script}: refuses NODE_ENV=production`, r.status !== 0 && /Refusing to run/.test(r.stderr) && !/PASS/.test(r.stdout), r.stderr.slice(0, 120));
  r = run(script, { NODE_ENV: "", MONGODB_URI_TEST: "mongodb://127.0.0.1:1/artisan" });
  check(`${script}: refuses the production database`, r.status !== 0 && /Refusing to run/.test(r.stderr) && !/PASS/.test(r.stdout), r.stderr.slice(0, 120));
}

// ── nothing in the scripts leads back to the real data ──
for (const file of [...scripts, "helpers.mjs"]) {
  const source = fs.readFileSync(path.join(TESTS_DIR, file), "utf8");
  check(`${file}: no seeded accounts or seed password`, !/artisan123|@artisan\.mn|noon\.handmade|@example\.com/.test(source));
  check(`${file}: connects only through setup.mjs`, !source.includes('require("../src/config/db")'));
  if (file !== "helpers.mjs") {
    const first = /^import\s.*from\s+"([^"]+)"/m.exec(source.split("\n").filter((l) => !l.startsWith("//")).join("\n"))?.[1];
    check(`${file}: loads setup.mjs before anything else`, first === "./setup.mjs" || first === "./helpers.mjs", first);
  }
}
check("helpers.mjs loads setup.mjs first", /^import\s.*from\s+"\.\/setup\.mjs"/m.test(fs.readFileSync(path.join(TESTS_DIR, "helpers.mjs"), "utf8")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
