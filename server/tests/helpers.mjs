// Shared by the photo tests: real (decodable) test images, and a probe that checks whether a
// stored photo exists. setup.mjs makes the API store photos on disk in a temporary folder.
import { API, ORIGIN, UPLOAD_ROOT, connectDB, stopTestEnv } from "./setup.mjs";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import zlib from "zlib";

const SERVER_DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
export { API, connectDB, stopTestEnv };
export const STORAGE = "local";

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

// URL shape stored photos have, for a kind ("products" / "avatars").
export const storedUrl = (kind) => new RegExp(`^/uploads/${kind}/[0-9a-f]{32}\\.(png|jpg|webp)$`);

// Does the photo behind this URL exist in storage?
export const exists = async (url) => (await fetch(ORIGIN + url)).status === 200;
export const served = exists;

// How many photos of this kind are stored (to spot orphans and stray uploads).
export const count = (kind) => fs.readdirSync(path.join(UPLOAD_ROOT, kind)).length;
