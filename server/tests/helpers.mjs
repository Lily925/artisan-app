// Shared by the photo tests: real (decodable) test images, and a probe that checks whether
// a stored photo exists in whichever storage the API uses (local disk or Cloudinary).
// Cloudinary credentials come from server/.env and are never printed.
import { createRequire } from "module";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import zlib from "zlib";
const require = createRequire(import.meta.url);
require("dotenv").config();

const SERVER_DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
export const API = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}/api`;
const ORIGIN = new URL(API).origin;
const CLOUD = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].every((k) => process.env[k]?.trim());
export const STORAGE = CLOUD ? "cloudinary" : "local";

// ── images ──
// A valid 8x8 PNG with random pixels (so every call is a different file).
export function PNG() {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.from([0, 0, 0, 8, 0, 0, 0, 8, 8, 2, 0, 0, 0]); // 8x8, 8-bit RGB
  const rows = Buffer.concat(Array.from({ length: 8 }, () => Buffer.concat([Buffer.from([0]), crypto.randomBytes(24)])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}
// A real JPEG from the repo (about 0.5 MB).
const JPEG_FILE = fs.readFileSync(path.join(SERVER_DIR, "..", "public", "images", "products", "crystal-pearl-necklace.jpeg"));
export const JPG = () => JPEG_FILE;
// 1x1 lossless WebP.
export const WEBP = () => Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");
// Not images: a Windows .exe header and plain text.
export const EXE = () => Buffer.concat([Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "latin1"), crypto.randomBytes(300)]);
// A valid PNG made larger than the 2 MB limit.
export const BIG_PNG = () => Buffer.concat([PNG(), Buffer.alloc(3 * 1024 * 1024)]);

// URL shape each storage returns for a kind ("products" / "avatars").
export const storedUrl = (kind) => (CLOUD
  ? new RegExp(`^https://res\\.cloudinary\\.com/[^/]+/image/upload/v\\d+/artisan/${kind}/[0-9a-f]{32}\\.(png|jpg|webp)$`)
  : new RegExp(`^/uploads/${kind}/[0-9a-f]{32}\\.(png|jpg|webp)$`));

// ── storage probe ──
let cloudinary = null;
if (CLOUD) {
  cloudinary = require("cloudinary").v2;
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(), api_key: process.env.CLOUDINARY_API_KEY.trim(), api_secret: process.env.CLOUDINARY_API_SECRET.trim(), secure: true });
}
const publicIdOf = (url) => /\/image\/upload\/v\d+\/(.+)\.[a-z]+$/.exec(url)?.[1];

// Does the photo behind this URL exist in storage? (Cloudinary: asked through the Admin
// API, not the CDN, which may keep serving a deleted image from cache for a while.)
export async function exists(url) {
  if (!CLOUD || url.startsWith("/")) return (await fetch(ORIGIN + url)).status === 200;
  try {
    await cloudinary.api.resource(publicIdOf(url));
    return true;
  } catch (err) {
    if (err?.error?.http_code === 404 || err?.http_code === 404) return false;
    throw new Error(`Cloudinary lookup failed: ${err?.error?.message || err?.message}`);
  }
}

// Is the photo actually downloadable by a browser (correct public URL)?
export const served = async (url) => (await fetch(url.startsWith("/") ? ORIGIN + url : url)).status === 200;

// How many photos of this kind are stored (to spot orphans and stray uploads).
export async function count(kind) {
  if (!CLOUD) return fs.readdirSync(path.join(SERVER_DIR, "uploads", kind)).length;
  let n = 0, next_cursor;
  do {
    const r = await cloudinary.api.resources({ type: "upload", resource_type: "image", prefix: `artisan/${kind}/`, max_results: 500, next_cursor });
    n += r.resources.length; next_cursor = r.next_cursor;
  } while (next_cursor);
  return n;
}
