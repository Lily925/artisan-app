const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const StoredImage = require("../models/StoredImage");

// Photo storage (product, profile and review photos): the one place every upload goes
// through. Controllers only see URLs: save*Photo returns one, delete*Photo accepts one.
//
// Storage backend, chosen once at startup from server/.env:
//   - Cloudinary when CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET
//     are all set. Photos are stored as https URLs; each upload's public_id is kept in the
//     StoredImage collection so it can be deleted when replaced/removed.
//   - Local disk (server/uploads, "/uploads/..." URLs) when none are set, in development
//     only. In production (NODE_ENV=production) the server refuses to start instead,
//     because most hosts wipe the local disk on restart/redeploy.
// The credentials are only ever passed to the Cloudinary SDK, never logged or returned.
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || path.join(__dirname, "..", "..", "uploads"); // UPLOAD_ROOT: a temporary folder in the tests
const EXT_BY_TYPE = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const TYPE_ERROR = "Photo must be a JPEG, PNG or WebP image";
const MB = 1024 * 1024;
const CLOUDINARY_ENV = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
const CLOUDINARY_ROOT = "artisan"; // assets go to artisan/products, artisan/avatars, artisan/reviews, artisan/migrated

// One entry per kind of photo: local folder and URL prefix, Cloudinary folder, size limit
// per file, and the multipart field (with how many files it takes).
const KINDS = {
  product: { dir: path.join(UPLOAD_ROOT, "products"), prefix: "/uploads/products/", folder: `${CLOUDINARY_ROOT}/products`, maxBytes: 2 * MB, field: "photos", maxFiles: 5 },
  avatar: { dir: path.join(UPLOAD_ROOT, "avatars"), prefix: "/uploads/avatars/", folder: `${CLOUDINARY_ROOT}/avatars`, maxBytes: 2 * MB, field: "photo", maxFiles: 1 },
  review: { dir: path.join(UPLOAD_ROOT, "reviews"), prefix: "/uploads/reviews/", folder: `${CLOUDINARY_ROOT}/reviews`, maxBytes: 2 * MB, field: "photos", maxFiles: 3 },
};

function chooseStorage() {
  const missing = CLOUDINARY_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length === 0) return "cloudinary";
  if (missing.length < CLOUDINARY_ENV.length) {
    throw new Error(`Cloudinary is only partly configured: also set ${missing.join(", ")} in server/.env.`);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Photo storage: set ${CLOUDINARY_ENV.join(", ")} in the server environment. Local disk storage is for development only.`);
  }
  return "local";
}

const STORAGE = chooseStorage();
if (STORAGE === "cloudinary") {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
    secure: true,
  });
} else {
  for (const kind of Object.values(KINDS)) fs.mkdirSync(kind.dir, { recursive: true });
}

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// Cloudinary errors are turned into a plain Error with just the message and HTTP code, so
// nothing from the SDK (request options, config) can end up in logs or responses.
const cloudError = (action, err) => new Error(`Cloudinary ${action} failed: ${err?.message || "unknown error"}${err?.http_code ? ` (HTTP ${err.http_code})` : ""}`);

// Express middleware for the kind's photo field (product: "photos", up to 5 files ->
// req.files; avatar: "photo", 1 file -> req.file), held in memory: nothing is stored
// until the rest of the request has been validated by the controller. Upload errors
// become 400 responses with a clear message.
function photoUpload(kindName) {
  const { maxBytes, field, maxFiles } = KINDS[kindName];
  const multi = maxFiles > 1;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: maxFiles, fields: 20 },
    // First check: the browser-declared type (the contents are checked again when saving).
    fileFilter: (req, file, cb) => (EXT_BY_TYPE[file.mimetype] ? cb(null, true) : cb(badRequest(TYPE_ERROR))),
  });
  const parse = multi ? upload.array(field, maxFiles) : upload.single(field);
  const tooMany = `You can upload at most ${maxFiles} photos`;

  return (req, res, next) => {
    parse(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        let message = `Upload error: ${err.message}`;
        if (err.code === "LIMIT_FILE_SIZE") message = `${multi ? "Each photo" : "Photo"} must be ${maxBytes / MB} MB or smaller`;
        else if (err.code === "LIMIT_FILE_COUNT" || (err.code === "LIMIT_UNEXPECTED_FILE" && err.field === field)) message = tooMany;
        else if (err.code === "LIMIT_UNEXPECTED_FILE") message = `Unexpected file field "${err.field}" (use "${field}")`;
        return res.status(400).json({ error: message, code: err.code === "LIMIT_FILE_SIZE" ? "PHOTO_TOO_BIG" : undefined });
      }
      if (err.status === 400) return res.status(400).json({ error: err.message, code: "PHOTO_TYPE" });
      next(err);
    });
  };
}

// The browser-supplied mimetype can't be trusted, so check the file's magic bytes too.
function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

// Uploads a buffer to Cloudinary under folder/publicName and records it in StoredImage.
// overwrite: false, so an existing asset with that id is reused, never replaced. Returns
// the https URL.
async function storeOnCloudinary(buffer, { folder, publicName, kind, source }) {
  let result;
  try {
    result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder, public_id: publicName, resource_type: "image", overwrite: false, allowed_formats: ["jpg", "jpeg", "png", "webp"] },
          (err, res) => (err ? reject(err) : resolve(res))
        )
        .end(buffer);
    });
  } catch (err) {
    throw cloudError("upload", err);
  }
  try {
    await StoredImage.updateOne(
      { url: result.secure_url },
      { $set: { publicId: result.public_id, kind }, ...(source && { $setOnInsert: { source } }) },
      { upsert: true }
    );
  } catch (err) {
    // Without a record it could never be deleted, so don't keep the asset either.
    if (!source) await destroyOnCloudinary(result.public_id).catch(() => {});
    throw err;
  }
  return result.secure_url;
}

async function destroyOnCloudinary(publicId) {
  let result;
  try {
    result = await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  } catch (err) {
    throw cloudError("delete", err);
  }
  if (result?.result !== "ok" && result?.result !== "not found") throw new Error(`Cloudinary delete failed: ${result?.result || "no result"}`);
}

// Stores one validated photo and returns its URL (https on Cloudinary, "/uploads/..." on
// local disk), under a random name.
async function savePhoto(kindName, file) {
  const { dir, prefix, folder, maxBytes } = KINDS[kindName];
  const type = sniffImageType(file?.buffer);
  if (!type) throw badRequest(TYPE_ERROR);
  if (file.buffer.length > maxBytes) throw badRequest(`Photo must be ${maxBytes / MB} MB or smaller`);
  const name = crypto.randomBytes(16).toString("hex");
  if (STORAGE === "cloudinary") return storeOnCloudinary(file.buffer, { folder, publicName: name, kind: kindName });
  await fs.promises.writeFile(path.join(dir, name + EXT_BY_TYPE[type]), file.buffer, { flag: "wx" });
  return prefix + name + EXT_BY_TYPE[type];
}

// Saves several photos (all checked first, so one bad file saves none) and returns their
// URLs in the same order. If saving fails halfway, the photos already saved are removed.
async function savePhotos(kindName, files = []) {
  for (const file of files) {
    if (!sniffImageType(file?.buffer)) throw badRequest(TYPE_ERROR);
    if (file.buffer.length > KINDS[kindName].maxBytes) throw badRequest(`Each photo must be ${KINDS[kindName].maxBytes / MB} MB or smaller`);
  }
  const urls = [];
  try {
    for (const file of files) urls.push(await savePhoto(kindName, file));
  } catch (err) {
    await Promise.all(urls.map((url) => deletePhoto(kindName, url)));
    throw err;
  }
  return urls;
}

// Removes a photo previously returned by savePhoto for that kind. No-op for anything else
// (e.g. seeded "/images/..." paths, migrated static files, URLs from elsewhere). Local
// "/uploads/..." files are removed in either mode, so photos from before the move to
// Cloudinary are still cleaned up. Never throws: a failed delete is logged (asset id only)
// and the record is kept so the asset can be found and removed later.
async function deletePhoto(kindName, url) {
  const { dir, prefix } = KINDS[kindName];
  if (typeof url !== "string") return;
  if (url.startsWith(prefix)) {
    await fs.promises.unlink(path.join(dir, path.basename(url))).catch(() => {});
    return;
  }
  if (STORAGE !== "cloudinary" || !url.startsWith("https://")) return;
  const record = await StoredImage.findOne({ url, kind: kindName });
  if (!record) return;
  try {
    await destroyOnCloudinary(record.publicId);
    await StoredImage.deleteOne({ _id: record._id });
  } catch (err) {
    console.warn(`Photo not deleted from Cloudinary (${record.publicId}): ${err.message}`);
  }
}

module.exports = {
  UPLOAD_ROOT,
  STORAGE,
  MAX_PRODUCT_PHOTOS: KINDS.product.maxFiles,
  productPhotoUpload: photoUpload("product"),
  saveProductPhotos: (files) => savePhotos("product", files),
  deleteProductPhoto: (url) => deletePhoto("product", url),
  avatarUpload: photoUpload("avatar"),
  saveAvatarPhoto: (file) => savePhoto("avatar", file),
  deleteAvatarPhoto: (url) => deletePhoto("avatar", url),
  MAX_REVIEW_PHOTOS: KINDS.review.maxFiles,
  reviewPhotoUpload: photoUpload("review"),
  saveReviewPhotos: (files) => savePhotos("review", files),
  deleteReviewPhoto: (url) => deletePhoto("review", url),
  // For scripts/migrate-images-to-cloudinary.js only.
  storeOnCloudinary,
  sniffImageType,
};
