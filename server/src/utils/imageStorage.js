const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

// Product photo storage. This is LOCAL DISK storage for development: most hosts
// wipe the local disk on restart/redeploy, so at deployment this module is the one
// piece to swap for cloud storage (e.g. Cloudinary). Everything else (routes,
// validation, the upload form) stays the same as long as saveProductPhoto keeps
// returning a URL and deleteProductPhoto accepts one.
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");
const PRODUCT_DIR = path.join(UPLOAD_ROOT, "products");
const PUBLIC_PREFIX = "/uploads/products/";
const MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_TYPE = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const TYPE_ERROR = "Photo must be a JPEG, PNG or WebP image";

fs.mkdirSync(PRODUCT_DIR, { recursive: true });

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// Holds one optional "photo" field in memory; nothing is written to disk until the
// rest of the request has been validated by the controller.
const parseProductPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => (EXT_BY_TYPE[file.mimetype] ? cb(null, true) : cb(badRequest(TYPE_ERROR))),
}).single("photo");

// Express middleware: multipart parsing with upload errors turned into 400 responses.
function productPhotoUpload(req, res, next) {
  parseProductPhoto(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message = err.code === "LIMIT_FILE_SIZE" ? "Photo must be 5 MB or smaller" : `Upload error: ${err.message}`;
      return res.status(400).json({ error: message });
    }
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  });
}

// The browser-supplied mimetype can't be trusted, so check the file's magic bytes too.
function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

// Saves an uploaded photo under a random name and returns its public URL path.
async function saveProductPhoto(file) {
  const type = sniffImageType(file?.buffer);
  if (!type) throw badRequest(TYPE_ERROR);
  const name = crypto.randomBytes(16).toString("hex") + EXT_BY_TYPE[type];
  await fs.promises.writeFile(path.join(PRODUCT_DIR, name), file.buffer, { flag: "wx" });
  return PUBLIC_PREFIX + name;
}

// Removes a photo previously returned by saveProductPhoto (no-op for anything else).
async function deleteProductPhoto(url) {
  if (typeof url !== "string" || !url.startsWith(PUBLIC_PREFIX)) return;
  await fs.promises.unlink(path.join(PRODUCT_DIR, path.basename(url))).catch(() => {});
}

module.exports = { UPLOAD_ROOT, productPhotoUpload, saveProductPhoto, deleteProductPhoto };
