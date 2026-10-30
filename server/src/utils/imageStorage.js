const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

// Photo storage (product photos and profile photos). This is LOCAL DISK storage for
// development: most hosts wipe the local disk on restart/redeploy, so at deployment
// this module is the one piece to swap for cloud storage (e.g. Cloudinary). Everything
// else (routes, validation, the upload forms) stays the same as long as save*Photo
// keeps returning a URL and delete*Photo accepts one.
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");
const EXT_BY_TYPE = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const TYPE_ERROR = "Photo must be a JPEG, PNG or WebP image";
const MB = 1024 * 1024;

// One entry per kind of photo: folder, public URL prefix, size limit per file, and the
// multipart field (with how many files it takes).
const KINDS = {
  product: { dir: path.join(UPLOAD_ROOT, "products"), prefix: "/uploads/products/", maxBytes: 2 * MB, field: "photos", maxFiles: 5 },
  avatar: { dir: path.join(UPLOAD_ROOT, "avatars"), prefix: "/uploads/avatars/", maxBytes: 2 * MB, field: "photo", maxFiles: 1 },
};
for (const kind of Object.values(KINDS)) fs.mkdirSync(kind.dir, { recursive: true });

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

// Express middleware for the kind's photo field (product: "photos", up to 5 files ->
// req.files; avatar: "photo", 1 file -> req.file), held in memory: nothing is written to
// disk until the rest of the request has been validated by the controller. Upload errors
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

// Saves an uploaded photo under a random name and returns its public URL path.
async function savePhoto(kindName, file) {
  const { dir, prefix, maxBytes } = KINDS[kindName];
  const type = sniffImageType(file?.buffer);
  if (!type) throw badRequest(TYPE_ERROR);
  if (file.buffer.length > maxBytes) throw badRequest(`Photo must be ${maxBytes / MB} MB or smaller`);
  const name = crypto.randomBytes(16).toString("hex") + EXT_BY_TYPE[type];
  await fs.promises.writeFile(path.join(dir, name), file.buffer, { flag: "wx" });
  return prefix + name;
}

// Saves several photos (all checked first, so one bad file saves none) and returns their
// URLs in the same order. If writing fails halfway, the files already written are removed.
async function savePhotos(kindName, files = []) {
  for (const file of files) {
    if (!sniffImageType(file?.buffer)) throw badRequest(TYPE_ERROR);
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

// Removes a photo previously returned by savePhoto for that kind (no-op for anything else,
// e.g. seeded "/images/..." paths).
async function deletePhoto(kindName, url) {
  const { dir, prefix } = KINDS[kindName];
  if (typeof url !== "string" || !url.startsWith(prefix)) return;
  await fs.promises.unlink(path.join(dir, path.basename(url))).catch(() => {});
}

module.exports = {
  UPLOAD_ROOT,
  MAX_PRODUCT_PHOTOS: KINDS.product.maxFiles,
  productPhotoUpload: photoUpload("product"),
  saveProductPhotos: (files) => savePhotos("product", files),
  deleteProductPhoto: (url) => deletePhoto("product", url),
  avatarUpload: photoUpload("avatar"),
  saveAvatarPhoto: (file) => savePhoto("avatar", file),
  deleteAvatarPhoto: (url) => deletePhoto("avatar", url),
};
