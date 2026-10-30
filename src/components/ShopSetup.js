import { useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api } from "../api";

const BIO_MAX = 1000;
const SHOP_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._&'-]{1,59}$/u; // same rule as the server
const IG_HANDLE = /^@?[A-Za-z0-9._]{0,30}$/;

// First step for a new artisan: creates their shop profile (POST /api/artisans/me).
// Shown right after an artisan signs up, and instead of any shop page until it's done.
export default function ShopSetup({ t, onDone, onApiError }) {
  const s = t.shopSetup;
  const [form, setForm] = useState({ shopName: "", location: "", bio: "", instagramHandle: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const shopName = form.shopName.trim();
    if (!shopName) return setError(s.required);
    if (!SHOP_NAME.test(shopName)) return setError(s.nameInvalid);
    if (!IG_HANDLE.test(form.instagramHandle.trim())) return setError(t.shopSettings.instagramHint);
    setBusy(true);
    setError("");
    try {
      const artisan = await api.setupMyShop({ ...form, shopName });
      onDone(artisan);
    } catch (err) {
      if (err.status === 401) return onApiError(err);
      if (err.code === "SHOP_EXISTS") return onDone(null); // already set up (e.g. another tab)
      setError(err.code === "SHOP_NAME_TAKEN" ? s.nameTaken : err.code === "BAD_SHOP_NAME" ? s.nameInvalid : err.message);
    } finally {
      setBusy(false);
    }
  };

  const hint = { fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:6, lineHeight:1.5 };
  const field = { marginBottom:20 };

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page a-page-form page">
        <div style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, letterSpacing:0.6, textTransform:"uppercase", color:COLORS.accentDark, marginBottom:6 }}>🧶 {t.onboarding.title}</div>
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:34, fontWeight:600, color:COLORS.ink, marginBottom:8 }}>{s.title}</h1>
        <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, lineHeight:1.6, marginBottom:28 }}>{s.intro}</p>

        <form onSubmit={submit} noValidate className="a-info-block" style={{ padding:"28px 24px" }}>
          <div style={field}>
            <label className="a-label" htmlFor="setup-shop">{s.shopName} *</label>
            <input id="setup-shop" className="a-input" required maxLength={60} autoComplete="organization"
              value={form.shopName} onChange={update("shopName")} aria-describedby="setup-shop-hint" />
            <div id="setup-shop-hint" style={hint}>{s.shopNameHint}</div>
          </div>
          <div style={field}>
            <label className="a-label" htmlFor="setup-region">{s.region}</label>
            <input id="setup-region" className="a-input" maxLength={100} autoComplete="address-level1"
              value={form.location} onChange={update("location")} placeholder={s.regionHint} />
          </div>
          <div style={field}>
            <label className="a-label" htmlFor="setup-bio">{s.bio}</label>
            <textarea id="setup-bio" className="a-textarea" maxLength={BIO_MAX} value={form.bio} onChange={update("bio")}
              placeholder={s.bioHint} aria-describedby="setup-bio-count" />
            <div id="setup-bio-count" aria-live="polite" style={{ ...hint, textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{form.bio.length} / {BIO_MAX}</div>
          </div>
          <div style={field}>
            <label className="a-label" htmlFor="setup-ig">{s.instagram}</label>
            <input id="setup-ig" className="a-input" maxLength={31} autoCapitalize="none" spellCheck={false}
              value={form.instagramHandle} onChange={update("instagramHandle")} placeholder="noon_handmade_" aria-describedby="setup-ig-hint" />
            <div id="setup-ig-hint" style={hint}>{s.instagramHint}</div>
          </div>

          {error && (
            <div role="alert" style={{ background:COLORS.bgSoft, border:`1px solid ${COLORS.accentSoft}`, borderRadius:2, padding:"10px 14px", fontFamily:FONT_SANS, fontSize:13, fontWeight:600, color:COLORS.accentDark, marginBottom:16 }}>
              {error}
            </div>
          )}
          <button type="submit" className="a-btn-primary" disabled={busy} style={{ width:"100%" }}>{busy ? s.saving : s.submit}</button>
        </form>
      </div>
    </div>
  );
}
