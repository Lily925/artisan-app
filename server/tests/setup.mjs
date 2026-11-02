// Every API test imports this first. It gives the script its own throwaway world:
//  - a database: in-memory (mongodb-memory-server), or MONGODB_URI_TEST if that is set;
//  - its own API process on a free port, connected to that database (so a dev server on
//    port 5000, which would use the real database, is never touched, and rate limits start fresh);
//  - local photo storage in a temporary folder, and no PayPal credentials: Cloudinary and
//    PayPal can't be reached from a test.
// It refuses to start with NODE_ENV=production or a database that isn't clearly a test one
// (see guard.mjs). The real MONGODB_URI is replaced before anything can connect with it.
import { createRequire } from "module";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import net from "net";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { dbNameOf, unsafeReason } from "./guard.mjs";

const require = createRequire(import.meta.url);
const SERVER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
require("dotenv").config({ path: path.join(SERVER_DIR, ".env") });

const refuse = (reason) => {
  console.error(`Refusing to run the tests: ${reason}.`);
  process.exit(1);
};

const realUri = process.env.MONGODB_URI;
if (process.env.NODE_ENV === "production") refuse("NODE_ENV is production");

let memoryServer = null;
let uri = process.env.MONGODB_URI_TEST?.trim();
if (uri) {
  const reason = unsafeReason(uri, { nodeEnv: process.env.NODE_ENV, realUri });
  if (reason) refuse(reason);
} else {
  const { MongoMemoryServer } = await import("mongodb-memory-server-core");
  memoryServer = await MongoMemoryServer.create({ instance: { dbName: "artisan_test" } });
  uri = memoryServer.getUri("artisan_test");
  const reason = unsafeReason(uri, { nodeEnv: process.env.NODE_ENV, realUri });
  if (reason) { await memoryServer.stop(); refuse(reason); }
}

// Free port for this script's API.
const port = await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.on("error", reject);
  probe.listen(0, "127.0.0.1", () => { const p = probe.address().port; probe.close(() => resolve(p)); });
});

const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), "artisan-test-uploads-"));
// Set before dotenv runs anywhere else: dotenv never overrides a variable that already exists,
// even an empty one, so the values in server/.env can't come back. Shared with this process,
// which also uses the models directly.
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGODB_URI: uri,
  PORT: String(port),
  JWT_SECRET: crypto.randomBytes(48).toString("hex"),
  UPLOAD_ROOT: uploadRoot,
  CLIENT_URL: "",
  CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "",
  PAYPAL_CLIENT_ID: "", PAYPAL_CLIENT_SECRET: "", PAYPAL_MODE: "sandbox",
});

export const API = `http://127.0.0.1:${port}/api`;
export const ORIGIN = `http://127.0.0.1:${port}`;
export const UPLOAD_ROOT = uploadRoot;

const apiProcess = spawn(process.execPath, ["src/server.js"], { cwd: SERVER_DIR, env: process.env, stdio: ["ignore", "ignore", "pipe"] });
let apiErrors = "";
apiProcess.stderr.on("data", (d) => { apiErrors = (apiErrors + d).slice(-2000); });
let apiExited = false;
apiProcess.on("exit", () => { apiExited = true; });
// A script that dies early must not leave its API behind (mongod stops with this process too).
process.on("exit", () => { if (!apiExited) apiProcess.kill(); });

for (let i = 0; ; i++) {
  if (apiExited) throw new Error(`The test API didn't start:\n${apiErrors}`);
  if (i > 300) throw new Error(`The test API didn't answer in time:\n${apiErrors}`);
  const healthy = await fetch(`${ORIGIN}/health`).then((r) => r.ok).catch(() => false);
  if (healthy) break;
  await new Promise((r) => setTimeout(r, 100));
}

// The only way the tests connect. Checks the name of the database actually connected to.
export async function connectDB() {
  const mongoose = require("mongoose");
  await mongoose.connect(uri);
  const reason = unsafeReason(`mongodb://x/${mongoose.connection.name}`, { realUri });
  if (reason) {
    await mongoose.disconnect();
    refuse(reason);
  }
}

// Ends the script's API and database. Call it last.
export async function stopTestEnv() {
  const mongoose = require("mongoose");
  await mongoose.disconnect();
  if (!apiExited) {
    const gone = new Promise((resolve) => apiProcess.once("exit", resolve));
    apiProcess.kill();
    await gone;
  }
  if (memoryServer) await memoryServer.stop();
  fs.rmSync(uploadRoot, { recursive: true, force: true });
  console.log(`Ran against the throwaway database "${dbNameOf(uri)}"${memoryServer ? " (in memory)" : ""}.`);
}
