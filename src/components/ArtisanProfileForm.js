import { useEffect, useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api } from "../api";

// Form state is all strings; yearsExperience is converted back to a number (or null) on save.
const toForm = (a) => ({
  bio: a.bio || "",
  instagramHandle: a.instagramHandle || "",
  contactInfo: a.contactInfo || "",
  location: a.location || "",
  yearsExperience: a.yearsExperience === null || a.yearsExperience === undefined ? "" : String(a.yearsExperience),
  payoutEmail: a.payoutEmail || "",
});

// Lets a logged-in artisan edit the self-service parts of their own shop profile.
// The API only ever touches the caller's own record (PUT /api/artisans/me).
export default function ArtisanProfileForm({ t, navigate, onSaved, onApiError }) {
  const s = t.shopSettings;
  const [artisan, setArtisan] = useState(null);
  const [form, setForm] = useState(toForm({}));
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getMyArtisan()
      .then((a) => {
        setArtisan(a);
        setForm(toForm(a));
      })
      .catch((err) => { setLoadError(true); onApiError(err); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    const yearsText = form.yearsExperience.trim();
    if (yearsText !== "" && !/^\d{1,3}$/.test(yearsText)) { setError(s.yearsInvalid); return; }
    setSaving(true);
    api.updateMyArtisan({
      ...form,
      instagramHandle: form.instagramHandle.trim().replace(/^@+/, ""),
      payoutEmail: form.payoutEmail.trim(),
      yearsExperience: yearsText === "" ? null : Number(yearsText),
    })
      .then((a) => {
        setArtisan(a);
        setForm(toForm(a));
        onSaved();
      })
      .catch((err) => {
        if (err.status === 401) onApiError(err);
        else setError(err.message);
      })
      .finally(() => setSaving(false));
  };

  const back = (
    <a href="/" onClick={(e) => { e.preventDefault(); navigate("profile"); }}
      style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, textDecoration:"none" }}>
      ‹ {s.back}
    </a>
  );

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page a-page-form">
        <div style={{ marginBottom:16 }}>{back}</div>
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:6 }}>
          <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink }}>{s.title}</h1>
          <button type="button" className="a-btn-primary" style={{ padding:"10px 18px" }} onClick={() => navigate("add-product")}>
            {t.addProduct.open}
          </button>
        </div>

        {loadError ? (
          <p role="alert" style={{ fontFamily:FONT_SANS, fontSize:14, color:"#B3261E" }}>{s.loadError}</p>
        ) : !artisan ? (
          <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>…</p>
        ) : (
          <>
            <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, marginBottom:24 }}>
              {artisan.shopName ? `${artisan.shopName} · ` : ""}{artisan.user?.name}. {s.intro}
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div style={{ marginBottom:20 }}>
                <label className="a-label" htmlFor="sp-bio">{s.bio}</label>
                <textarea id="sp-bio" className="a-textarea" rows={5} maxLength={1000}
                  value={form.bio} onChange={update("bio")} />
                <div style={{ fontFamily:FONT_SANS, fontSize:11, color:COLORS.inkSoft, textAlign:"right", marginTop:4 }}>{form.bio.length}/1000</div>
              </div>

              <div style={{ marginBottom:20 }}>
                <label className="a-label" htmlFor="sp-instagram">{s.instagram}</label>
                <div style={{ display:"flex", alignItems:"stretch" }}>
                  <span aria-hidden="true" style={{ display:"flex", alignItems:"center", padding:"0 12px", border:`1.5px solid ${COLORS.border}`, borderRight:"none", borderRadius:"2px 0 0 2px", fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, background:COLORS.bgSoft }}>@</span>
                  <input id="sp-instagram" className="a-input" type="text" maxLength={31} autoComplete="off" autoCapitalize="none" spellCheck={false}
                    aria-describedby="sp-instagram-hint" style={{ borderRadius:"0 2px 2px 0" }}
                    value={form.instagramHandle} onChange={update("instagramHandle")} />
                </div>
                <div id="sp-instagram-hint" style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:6 }}>{s.instagramHint}</div>
              </div>

              <div style={{ display:"flex", flexWrap:"wrap", gap:"0 16px" }}>
                <div style={{ flex:"1 1 140px", marginBottom:20 }}>
                  <label className="a-label" htmlFor="sp-years">{s.years}</label>
                  <input id="sp-years" className="a-input" type="text" inputMode="numeric" maxLength={3} autoComplete="off"
                    aria-describedby="sp-years-hint"
                    value={form.yearsExperience} onChange={update("yearsExperience")} />
                  <div id="sp-years-hint" style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:6 }}>{s.yearsHint}</div>
                </div>
                <div style={{ flex:"2 1 240px", marginBottom:20 }}>
                  <label className="a-label" htmlFor="sp-location">{s.location}</label>
                  <input id="sp-location" className="a-input" type="text" maxLength={100} autoComplete="off"
                    aria-describedby="sp-location-hint"
                    value={form.location} onChange={update("location")} />
                  <div id="sp-location-hint" style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:6 }}>{s.locationHint}</div>
                </div>
              </div>

              <div style={{ marginBottom:24 }}>
                <label className="a-label" htmlFor="sp-contact">{s.contact}</label>
                <input id="sp-contact" className="a-input" type="text" maxLength={200}
                  aria-describedby="sp-contact-hint"
                  value={form.contactInfo} onChange={update("contactInfo")} />
                <div id="sp-contact-hint" style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:6 }}>{s.contactHint}</div>
              </div>

              <div style={{ marginBottom:24 }}>
                <label className="a-label" htmlFor="sp-payout">{s.payoutEmail}</label>
                <input id="sp-payout" className="a-input" type="email" autoComplete="email" maxLength={254}
                  aria-describedby="sp-payout-hint" value={form.payoutEmail} onChange={update("payoutEmail")} />
                <div id="sp-payout-hint" style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:6 }}>{s.payoutEmailHint}</div>
              </div>

              {error && (
                <div role="alert" style={{ fontFamily:FONT_SANS, fontSize:12, color:"#B3261E", marginBottom:14 }}>{error}</div>
              )}
              <button type="submit" className="a-btn-primary" style={{ width:"100%" }} disabled={saving}>
                {saving ? s.saving : s.save}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
