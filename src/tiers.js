// Pricing tiers: Basic = product only, Story = + a video from the artisan,
// Patron = Story + a bonus the artisan defines per product (patronBonus { mn, en }).
// Prices come from the server (Story +30%, Patron +65% on Basic).
export const TIER_KEYS = ["basic", "story", "patron"];

// The bonus in the viewer's language: MN shows Mongolian, everything else English
// (Korean falls back to English), each falling back to the other if only one is filled in.
export function bonusText(bonus, lang) {
  const mn = bonus?.mn?.trim() || "";
  const en = bonus?.en?.trim() || "";
  return lang === "mn" ? mn || en : en || mn;
}

// Patron is only offered when the artisan has said what the bonus is (the server enforces this too).
export function offeredTiers(product) {
  return bonusText(product?.patronBonus, "en") ? TIER_KEYS : TIER_KEYS.filter((k) => k !== "patron");
}
