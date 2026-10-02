import { useEffect, useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api, assetUrl } from "../api";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Edit mode starts in USD: that's the exact stored price (a ₮ round-trip would show
// e.g. 79,002 instead of 79,000). The artisan can switch to ₮ and type a new price.
const initialForm = (product) => product
  ? { title: product.title || "", titleEn: product.titleEn || "", category: product.category || "",
      description: product.description || "", price: String(product.pricingTiers.basic.price), currency: "USD" }
  : { title: "", titleEn: "", category: "", description: "", price: "", currency: "MNT" };

// Artisan self-service product form: adds a product, or edits one when `product`
// is given (photo optional then). Prices can be typed in ₮ and are converted to USD
// at the live rate, the same way seeded shop prices were; the server derives Story/Patron.
export default function AddProductForm({ t, product, rateMnt, onBack, onSaved, onApiError }) {
  const a = t.addProduct;
  const editing = Boolean(product);
  const currentPhoto = editing ? assetUrl(product.images?.[0]) : "";
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(currentPhoto);
  const [dragOver, setDragOver] = useState(false);
  const [form, setForm] = useState(() => initialForm(product));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Local preview URL for the chosen photo, released when it changes or the page closes.
  useEffect(() => {
    if (!photo) { setPreview(currentPhoto); return undefined; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo, currentPhoto]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const pickPhoto = (file) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) { setError(a.photoType); return; }
    if (file.size > MAX_PHOTO_BYTES) { setError(a.photoTooBig); return; }
    setError("");
    setPhoto(file);
  };

  const priceNumber = Number(form.price.replace(/[\s,]/g, ""));
  const usd = form.price.trim() && priceNumber > 0
    ? Math.round((form.currency === "MNT" ? priceNumber / rateMnt : priceNumber) * 100) / 100
    : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!photo && !editing) { setError(a.photoRequired); return; }
    if (!form.title.trim() || !form.titleEn.trim() || !form.category) { setError(a.required); return; }
    if (!usd) { setError(a.priceInvalid); return; }

    const data = new FormData();
    if (photo) data.append("photo", photo);
    data.append("title", form.title.trim());
    data.append("titleEn", form.titleEn.trim());
    data.append("category", form.category);
    data.append("description", form.description.trim());
    data.append("price", String(usd));

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
      <div className="a-page" style={{ maxWidth:640 }}>
        <div className="a-breadcrumb">
          <button type="button" className="a-shop-link" onClick={onBack} style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>
            ‹ {a.back}
          </button>
        </div>
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:6 }}>{editing ? a.editTitle : a.title}</h1>
        <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, marginBottom:24 }}>{editing ? a.editIntro : a.intro}</p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom:20 }}>
            <label className="a-label" htmlFor="ap-photo">{a.photo}</label>
            <label
              htmlFor="ap-photo"
              className={`a-dropzone${dragOver ? " dragover" : ""}`}
              style={{ display:"block", padding: preview ? 12 : undefined }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pickPhoto(e.dataTransfer.files[0]); }}
            >
              {preview ? (
                <>
                  <img src={preview} alt="" style={{ display:"block", width:"100%", maxHeight:320, objectFit:"contain", marginBottom:8 }} />
                  <span style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.accentDark, fontWeight:600 }}>{a.photoChange}</span>
                </>
              ) : (
                <>
                  <div aria-hidden="true" style={{ fontSize:20, marginBottom:6 }}>⬆</div>
                  <div style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft }}>{a.photoDrop}</div>
                </>
              )}
            </label>
            <input id="ap-photo" type="file" accept="image/jpeg,image/png,image/webp" className="a-sr-only"
              aria-describedby="ap-photo-hint" onChange={(e) => pickPhoto(e.target.files[0])} />
            <div id="ap-photo-hint" style={hint}>{photo ? photo.name : editing ? `${a.photoKeep} · ${a.photoHint}` : a.photoHint}</div>
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
