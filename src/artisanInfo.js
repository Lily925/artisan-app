// Normalizes a populated Product.artisan into what the UI shows: the shop name
// (falling back to the artisan's own name) plus optional Instagram/contact info
// and the public personal-profile fields.
const IG_HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const PHOTO_URL = /^https?:\/\/\S+$|^\/\S*$/;

export function artisanInfo(artisan) {
  const ownerName = artisan?.user?.name || "";
  const shopName = artisan?.shopName || "";
  const instagramHandle = (artisan?.instagramHandle || "").replace(/^@+/, "");
  const years = artisan?.yearsExperience;
  return {
    ownerName,
    shopName,
    displayName: shopName || ownerName,
    instagramHandle,
    instagramUrl: IG_HANDLE.test(instagramHandle) ? `https://www.instagram.com/${instagramHandle}/` : null,
    contactInfo: artisan?.contactInfo || "",
    photoUrl: PHOTO_URL.test(artisan?.photoUrl || "") ? artisan.photoUrl : "",
    yearsExperience: Number.isFinite(years) && years >= 0 ? years : null,
    location: artisan?.location || "",
  };
}
