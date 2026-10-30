import { useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api } from "../api";
import PhotoPicker, { existingPhotos } from "./PhotoPicker";

// Edit mode starts in USD: that's the exact stored price (a ₮ round-trip would show
// e.g. 79,002 instead of 79,000). The artisan can switch to ₮ and type a new price.
const initialForm = (product) => product
  ? { title: product.title || "", titleEn: product.titleEn || "", category: product.category || "",
      description: product.description || "", price: String(product.pricingTiers.basic.price), currency: "USD",
      patronBonusMn: product.patronBonus?.mn || "", patronBonusEn: product.patronBonus?.en || "" }
  : { title: "", titleEn: "", category: "", description: "", price: "", currency: "MNT", patronBonusMn: "", patronBonusEn: "" };

const MAX_BONUS_CHARS = 100;

// Artisan self-service product form: adds a product, or edits one when `product`
// is given. 1-5 photos (PhotoPicker); the first is the cover. Prices can be typed in ₮ and are converted to USD
// at the live rate, the same way seeded shop prices were; the server derives Story/Patron.
export default function AddProductForm({ t, product, rateMnt, onBack, onSaved, onApiError }) {
  const a = t.addProduct;
  const editing = Boolean(product);
  const [photos, setPhotos] = useState(() => existingPhotos(product?.images));
  const [form, setForm] = useState(() => initialForm(product));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const priceNumber = Number(form.price.replace(/[\s,]/g, ""));
  const usd = form.price.trim() && priceNumber > 0
    ? Math.round((form.currency === "MNT" ? priceNumber / rateMnt : priceNumber) * 100) / 100
    : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (photos.length === 0) { setError(a.photoRequired); return; }
    if (!form.title.trim() || !form.titleEn.trim() || !form.category) { setError(a.required); return; }
    if (!usd) { setError(a.priceInvalid); return; }

    const data = new FormData();
    // New files in display order, plus the full order (kept URLs and "new:<i>") for the server.
    let n = 0;
    const imageOrder = photos.map((ph) => (ph.file ? `new:${n++}` : ph.url));
    photos.forEach((ph) => { if (ph.file) data.append("photos", ph.file); });
    if (editing) data.append("imageOrder", JSON.stringify(imageOrder));
    data.append("title", form.title.trim());
    data.append("titleEn", form.titleEn.trim());
    data.append("category", form.category);
    data.append("description", form.description.trim());
    data.append("price", String(usd));
    // Always sent, so clearing both fields on edit removes the Patron tier.
    data.append("patronBonusMn", form.patronBonusMn.trim());
    data.append("patronBonusEn", form.patronBonusEn.trim());

    setError("");
    setSaving(true);
    (editing ? api.updateProduct(product._id, data) : api.createProduct(data))
      .then((saved) => onSaved(saved))
      .catch((err) => {
        if (err.status === 401) onApiError(err);
        else setError(err.message);
        setSaving(false);
      });
  };

  const hint = { fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:6 };

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page a-page-form">
        <div className="a-breadcrumb">
          <button type="button" className="a-shop-link" onClick={onBack} style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>
            ‹ {a.back}
          </button>
        </div>
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:6 }}>{editing ? a.editTitle : a.title}</h1>
        <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, marginBottom:24 }}>{editing ? a.editIntro : a.intro}</p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom:24 }}>
            <PhotoPicker a={a} items={photos} onChange={setPhotos} onError={setError} inputId="ap-photo" />
          </div>

          <div style={{ display:"flex", flexWrap:"wrap", gap:"0 16px" }}>
            <div style={{ flex:"1 1 240px", marginBottom:20 }}>
              <label className="a-label" htmlFor="ap-title">{a.titleMn}</label>
              <input id="ap-title" className="a-input" type="text" maxLength={120} value={form.title} onChange={update("title")} />
            </div>
            <div style={{ flex:"1 1 240px", marginBottom:20 }}>
              <label className="a-label" htmlFor="ap-title-en">{a.titleEn}</label>
              <input id="ap-title-en" className="a-input" type="text" maxLength={120} value={form.titleEn} onChange={update("titleEn")} />
            </div>
          </div>

          <div style={{ marginBottom:20 }}>
            <label className="a-label" htmlFor="ap-category">{a.category}</label>
            <select id="ap-category" className="a-select" value={form.category} onChange={update("category")}>
              <option value="" disabled>{a.categoryPick}</option>
              {t.productCategories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>

          <div style={{ marginBottom:20 }}>
            <label className="a-label" htmlFor="ap-description">{a.description}</label>
            <textarea id="ap-description" className="a-textarea" rows={4} maxLength={2000} aria-describedby="ap-description-hint"
              value={form.description} onChange={update("description")} />
            <div id="ap-description-hint" style={hint}>{a.descriptionHint}</div>
          </div>

          <div style={{ display:"flex", flexWrap:"wrap", gap:"0 16px" }}>
            <div style={{ flex:"2 1 200px", marginBottom:8 }}>
              <label className="a-label" htmlFor="ap-price">{a.price}</label>
              <input id="ap-price" className="a-input" type="text" inputMode="decimal" autoComplete="off"
                aria-describedby="ap-price-hint" value={form.price} onChange={update("price")} />
            </div>
            <div style={{ flex:"1 1 120px", marginBottom:8 }}>
              <label className="a-label" htmlFor="ap-currency">{a.priceIn}</label>
              <select id="ap-currency" className="a-select" value={form.currency} onChange={update("currency")}>
                <option value="MNT">₮ MNT</option>
                <option value="USD">$ USD</option>
              </select>
            </div>
          </div>
          <div id="ap-price-hint" style={{ ...hint, marginTop:0, marginBottom:24 }}>
            {usd && form.currency === "MNT" && <div>{a.usdPreview(usd.toFixed(2), Math.round(rateMnt).toLocaleString())}</div>}
            <div>{a.tiersNote}</div>
          </div>

          <fieldset style={{ border:"none", padding:0, margin:"0 0 24px" }} aria-describedby="ap-bonus-hint">
            <legend className="a-label">{a.patronBonusTitle}</legend>
            <div id="ap-bonus-hint" style={{ ...hint, marginTop:0, marginBottom:10 }}>{a.patronBonusHint}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"0 16px" }}>
              <div style={{ flex:"1 1 240px", marginBottom:8 }}>
                <label className="a-label" htmlFor="ap-bonus-mn" style={{ fontWeight:600 }}>{a.patronBonusMn}</label>
                <input id="ap-bonus-mn" className="a-input" type="text" maxLength={MAX_BONUS_CHARS} value={form.patronBonusMn} onChange={update("patronBonusMn")} />
                <div style={{ ...hint, textAlign:"right", marginTop:4 }}>{form.patronBonusMn.length}/{MAX_BONUS_CHARS}</div>
              </div>
              <div style={{ flex:"1 1 240px", marginBottom:8 }}>
                <label className="a-label" htmlFor="ap-bonus-en" style={{ fontWeight:600 }}>{a.patronBonusEn}</label>
                <input id="ap-bonus-en" className="a-input" type="text" maxLength={MAX_BONUS_CHARS} value={form.patronBonusEn} onChange={update("patronBonusEn")} />
                <div style={{ ...hint, textAlign:"right", marginTop:4 }}>{form.patronBonusEn.length}/{MAX_BONUS_CHARS}</div>
              </div>
            </div>
          </fieldset>

          {error && (
            <div role="alert" style={{ fontFamily:FONT_SANS, fontSize:12, color:"#B3261E", marginBottom:14 }}>{error}</div>
          )}
          <button type="submit" className="a-btn-primary" style={{ width:"100%" }} disabled={saving}>
            {editing ? (saving ? a.saving : a.save) : (saving ? a.submitting : a.submit)}
          </button>
        </form>
      </div>
    </div>
  );
}
