const mongoose = require("mongoose");
const User = require("../models/User");
const { saveAvatarPhoto, deleteAvatarPhoto } = require("../utils/imageStorage");

const BIO_MAX = 300;

// The caller's own profile. Email is included because it's their own account.
function toOwnProfile(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl || "", bio: user.bio || "" };
}

async function getMe(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "Account not found" });
  res.json(toOwnProfile(user));
}

// PATCH /api/users/:id — own profile only. JSON or multipart (form fields + optional
// "photo" file, parsed by avatarUpload). Fields, all optional:
//   bio: string, max 300 ("" clears it)
//   photo: JPEG/PNG/WebP file, max 2 MB (replaces the current photo)
//   removePhoto: true / "true" (removes the current photo; ignored when a photo is sent)
async function updateProfile(req, res) {
  if (!mongoose.isValidObjectId(req.params.id) || req.params.id !== req.user.id) {
    return res.status(403).json({ error: "You can only edit your own profile" });
  }
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "Account not found" });

  const body = req.body || {};
  if (body.bio !== undefined) {
    if (typeof body.bio !== "string") return res.status(400).json({ error: "bio must be a string" });
    const bio = body.bio.trim();
    if (bio.length > BIO_MAX) return res.status(400).json({ error: `Bio must be ${BIO_MAX} characters or fewer` });
    user.bio = bio;
  }
  const removePhoto = body.removePhoto === true || body.removePhoto === "true";

  // Validate everything before touching files; the new file is written only now.
  const oldAvatar = user.avatarUrl;
  if (req.file) user.avatarUrl = await saveAvatarPhoto(req.file);
  else if (removePhoto) user.avatarUrl = "";

  try {
    await user.save();
  } catch (err) {
    // Don't leave an orphaned upload behind if the save fails.
    if (req.file) await deleteAvatarPhoto(user.avatarUrl);
    throw err;
  }
  if (oldAvatar && oldAvatar !== user.avatarUrl) await deleteAvatarPhoto(oldAvatar);

  res.json(toOwnProfile(user));
}

module.exports = { getMe, updateProfile, toOwnProfile };
