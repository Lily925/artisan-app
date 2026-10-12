import { useEffect, useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api } from "../api";
import { artisanInfo } from "../artisanInfo";
import ArtisanAvatar from "./ArtisanAvatar";

export default function ReverseAuction({ t, navigate, onSubmit, isArtisan }) {
  const a = t.auctionPage;
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState(t.productCategories[0].key);
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [timeline, setTimeline] = useState(a.timelineOptions[0]);
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Artisans who sell in the chosen category (null = loading).
  const [matched, setMatched] = useState(null);

  useEffect(() => {
    let stale = false;
    setMatched(null);
    api.getArtisans(category)
      .then((list) => { if (!stale) setMatched(list); })
      .catch(() => { if (!stale) setMatched([]); });
    return () => { stale = true; };
  }, [category]);

  const handleFile = (file) => { if (file) setFileName(file.name); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) { setError(t.descLabel); return; }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ category, description, budgetRange: budget, timeline, referenceImage: fileName });
      setStep(1);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 1) {
    return (
      <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
        <div className="a-page" style={{ textAlign:"center", paddingTop:96 }}>
          <div style={{ fontSize:56, marginBottom:20 }}>✅</div>
          <h1 style={{ fontFamily:FONT_SERIF, fontSize:26, fontWeight:600, color:COLORS.ink, marginBottom:10 }}>{t.submitted}</h1>
          <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, marginBottom:28 }}>{t.submittedSub}</p>
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
            <button type="button" className="a-btn-primary" onClick={() => navigate("my-commissions")}>{t.commissions.viewMine}</button>
            <button type="button" className="a-btn-outline" onClick={() => navigate("home")}>{t.backHome}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:8 }}>
          <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
            <button type="button" className="a-shop-link" style={{ fontFamily:FONT_SANS, fontSize:13, fontWeight:700 }} onClick={() => navigate("my-commissions")}>
              {t.commissions.mineOpen} →
            </button>
            {isArtisan && (
              <button type="button" className="a-shop-link" style={{ fontFamily:FONT_SANS, fontSize:13, fontWeight:700 }} onClick={() => navigate("commission-board")}>
                {t.commissions.boardOpen} →
              </button>
            )}
          </div>
          <span style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, letterSpacing:0.5, color:COLORS.accentDark }}>{a.kicker}</span>
        </div>

        <div className="a-layout-side">
          <div>
            <div style={{ fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:COLORS.inkSoft, marginBottom:8 }}>{a.step(1, 2)}</div>
            <h1 style={{ fontFamily:FONT_SERIF, fontSize:28, fontWeight:600, color:COLORS.ink, marginBottom:10 }}>{a.title}</h1>
            <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, lineHeight:1.6, marginBottom:28, maxWidth:520 }}>{a.subtitle}</p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom:20 }}>
                <label className="a-label" htmlFor="ra-category">{a.categoryLabel}</label>
                <select id="ra-category" className="a-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {t.productCategories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>

              <div style={{ marginBottom:20 }}>
                <label className="a-label" htmlFor="ra-desc">{t.descLabel}</label>
                <textarea
                  id="ra-desc" className="a-textarea" placeholder={t.descPlaceholder}
                  value={description} onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
                <div>
                  <label className="a-label" htmlFor="ra-budget">{a.budgetLabel}</label>
                  <input
                    id="ra-budget" className="a-input" type="text" placeholder={a.budgetPlaceholder}
                    value={budget} onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
                <div>
                  <label className="a-label" htmlFor="ra-timeline">{a.timelineLabel}</label>
                  <select id="ra-timeline" className="a-select" value={timeline} onChange={(e) => setTimeline(e.target.value)}>
                    {a.timelineOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom:28 }}>
                <label className="a-label" htmlFor="ra-image">{a.imageLabel}</label>
                <label
                  htmlFor="ra-image"
                  className={`a-dropzone${dragOver ? " dragover" : ""}`}
                  style={{ display:"block" }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                >
                  <div aria-hidden="true" style={{ fontSize:20, marginBottom:6 }}>⬆</div>
                  <div style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft }}>
                    {fileName || a.imageDrop}
                  </div>
                </label>
                <input
                  id="ra-image" type="file" accept="image/*" className="a-sr-only"
                  onChange={(e) => handleFile(e.target.files[0])}
                />
              </div>

              {error && (
                <div role="alert" style={{ fontFamily:FONT_SANS, fontSize:12, color:"#B3261E", marginBottom:14 }}>{error}</div>
              )}
              <button type="submit" className="a-btn-primary" style={{ width:"100%" }} disabled={submitting}>
                {submitting ? "…" : a.submit}
              </button>
            </form>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <div className="a-info-block">
              <div className="a-label" style={{ marginBottom:14 }}>{a.howItWorks}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {a.steps.map((s, i) => (
                  <div key={i} style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                    <span className="a-step-badge">{i + 1}</span>
                    <span style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, lineHeight:1.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="a-info-block">
              <div className="a-label" style={{ marginBottom:14 }}>{a.matchedTitle}</div>
              <div aria-live="polite" style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {matched === null ? (
                  <div style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft }}>…</div>
                ) : matched.length === 0 ? (
                  <div style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, lineHeight:1.5 }}>{a.matchedEmpty}</div>
                ) : matched.map((art) => {
                  const { displayName, photoUrl } = artisanInfo(art);
                  return (
                    <div key={art._id} style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <ArtisanAvatar name={displayName} photoUrl={photoUrl} size={36} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:FONT_SANS, fontSize:13, fontWeight:700, color:COLORS.ink, overflowWrap:"anywhere" }}>{displayName}</div>
                        {art.specialty && <div style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>{art.specialty}</div>}
                      </div>
                      {art.certified && (
                        <span title={t.homePage.certified} aria-label={t.homePage.certified} style={{ color:COLORS.accentDark, fontWeight:700 }}>✓</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
