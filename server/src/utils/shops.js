const Artisan = require("../models/Artisan");

// Shop approval. New shops start "pending"; an admin approves or rejects them and can
// suspend an approved one. Only approved shops (and shops from before approval existed,
// which have no status until `npm run migrate:shops` sets it) are public or can sell.
const SHOP_STATUSES = ["pending", "approved", "rejected", "suspended"];
const NOT_LIVE = ["pending", "rejected", "suspended"];
const isShopLive = (artisan) => Boolean(artisan) && !NOT_LIVE.includes(artisan.status);
const LIVE_SHOP_FILTER = { status: { $nin: NOT_LIVE } };
// Ids of shops whose products must not be shown or sold (a short list in practice).
const notLiveShopIds = () => Artisan.distinct("_id", { status: { $in: NOT_LIVE } });
const shopIsLive = async (artisanId) => Boolean(artisanId && (await Artisan.exists({ _id: artisanId, ...LIVE_SHOP_FILTER })));

// Shop names: unique (case-insensitive) so nobody can pose as an existing shop.
const SHOP_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._&'-]{1,59}$/u;
const SHOP_DESCRIPTION_MAX = 500;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const shopNameTaken = (shopName) => Artisan.exists({ shopName: new RegExp(`^${escapeRegex(shopName)}$`, "i") });

// ── slugs ──
// Mongolian Cyrillic → Latin (the common Mongolian romanization: ө/ү → u, х → kh).
const CYRILLIC = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "ye", ё: "yo", ж: "j", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m",
  н: "n", о: "o", ө: "u", п: "p", р: "r", с: "s", т: "t", у: "u", ү: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ъ: "", ы: "y", ь: "i", э: "e", ю: "yu", я: "ya",
};
// Korean Hangul syllables → Revised Romanization (per syllable, without sound-change rules).
const HANGUL_INITIAL = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const HANGUL_VOWEL = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const HANGUL_FINAL = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

function romanize(ch) {
  const code = ch.codePointAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const i = code - 0xac00;
    return `${HANGUL_INITIAL[Math.floor(i / 588)]}${HANGUL_VOWEL[Math.floor((i % 588) / 28)]}${HANGUL_FINAL[i % 28]}`;
  }
  return CYRILLIC[ch] ?? ch;
}

const SLUG_MAX = 50;
// "Noon Handmade" → "noon-handmade", "Нар Эсгий" → "nar-esgii", "한지 공방" → "hanji-gongbang".
// Anything that can't be romanized is dropped; an empty result becomes "shop".
function slugify(name) {
  const latin = [...String(name).toLowerCase()].map(romanize).join("")
    .normalize("NFKD").replace(/\p{M}/gu, ""); // é → e
  const slug = latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, SLUG_MAX).replace(/-+$/, "");
  return slug || "shop";
}

// A slug no other shop uses: "name", then "name-2", "name-3", …
async function uniqueSlug(name, excludeId) {
  const base = slugify(name).slice(0, SLUG_MAX - 4).replace(/-+$/, "") || "shop";
  const taken = new Set(await Artisan.distinct("slug", {
    slug: new RegExp(`^${escapeRegex(base)}(-\\d+)?$`),
    ...(excludeId && { _id: { $ne: excludeId } }),
  }));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

// Creates a shop with a unique slug (from the shop name, else from slugName, e.g. the
// owner's name); retries once if another shop took the slug meanwhile.
async function createShop(fields, slugName = "") {
  for (let attempt = 0; ; attempt++) {
    try {
      return await Artisan.create({ ...fields, slug: await uniqueSlug(fields.shopName || slugName) });
    } catch (err) {
      if (attempt === 0 && err.code === 11000 && err.keyPattern?.slug) continue;
      throw err;
    }
  }
}

module.exports = {
  SHOP_STATUSES, isShopLive, shopIsLive, LIVE_SHOP_FILTER, notLiveShopIds,
  SHOP_NAME, SHOP_DESCRIPTION_MAX, shopNameTaken, slugify, uniqueSlug, createShop,
};
