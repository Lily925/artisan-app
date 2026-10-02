// Presentational-only: the real Product schema has no icon/photo field yet
// (images: [] is empty for every seeded product). This just picks a stand-in
// emoji per category so cards don't render blank until real photos exist.
export const CATEGORY_EMOJI = {
  jewelry: "💎",
  ceramics: "☕",
  art: "🎨",
  textile: "🧶",
  crafts: "🪆",
  leather: "👜",
  wood: "🪵",
};

export function placeholderEmoji(category) {
  return CATEGORY_EMOJI[category] || "🎁";
}
