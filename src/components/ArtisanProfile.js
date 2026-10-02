import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { artisanInfo } from "../artisanInfo";
import ArtisanAvatar from "./ArtisanAvatar";
import InstagramIcon from "./InstagramIcon";
import Footer from "./Footer";

// The artisan as a person (photo, name, experience, bio) — separate from their
// shop page, which lists products. Contact is Instagram-only by design: no
// email or phone is shown here or sent to the frontend.
export default function ArtisanProfile({ t, artisan, navigate, onBack, openStorefront }) {
  const p = t.artisanProfile;
  const { ownerName, shopName, instagramHandle, instagramUrl, photoUrl, yearsExperience, location } = artisanInfo(artisan);
  // Specialty gets its own line (it may contain "·" itself); years + location share the next one.
  const meta = [yearsExperience !== null ? p.years(yearsExperience) : "", location].filter(Boolean);

  return (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page" style={{ maxWidth:860 }}>
        <div className="a-breadcrumb">
          <button type="button" className="a-shop-link" onClick={onBack} style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>
            ‹ {p.back}
          </button>
        </div>

        <header style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:28, background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"36px 32px", marginBottom:36 }}>
          <ArtisanAvatar name={ownerName} photoUrl={photoUrl} size={120} />
          <div style={{ flex:"1 1 260px", minWidth:0 }}>
            <div style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, letterSpacing:0.5, textTransform:"uppercase", color:COLORS.accentDark, marginBottom:6 }}>
              {p.eyebrow}
            </div>
            <h1 style={{ fontFamily:FONT_SERIF, fontSize:36, fontWeight:600, color:COLORS.ink, lineHeight:1.15, marginBottom:8, overflowWrap:"anywhere" }}>
              {ownerName}
            </h1>
            {artisan.specialty && (
              <div style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, marginBottom: meta.length > 0 ? 4 : 12 }}>{artisan.specialty}</div>
            )}
            {meta.length > 0 && (
              <div style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, marginBottom:12 }}>{meta.join(" · ")}</div>
            )}
            <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:"8px 16px" }}>
              {artisan.certified && (
                <span style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, color:COLORS.accentDark, background:COLORS.accentSoft, padding:"3px 8px", borderRadius:2 }}>
                  ✓ {t.homePage.certified}
                </span>
              )}
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" aria-label={`@${instagramHandle} on Instagram`}
                  style={{ display:"inline-flex", alignItems:"center", gap:6, fontFamily:FONT_SANS, fontSize:14, fontWeight:600, color:COLORS.accentDark, textDecoration:"none" }}>
                  <InstagramIcon />@{instagramHandle}
                </a>
              )}
            </div>
          </div>
        </header>

        {artisan.bio && (
          <section style={{ marginBottom:36 }}>
            <h2 className="a-label" style={{ marginBottom:10 }}>{p.about}</h2>
            <p style={{ fontFamily:FONT_SANS, fontSize:15, color:COLORS.ink, lineHeight:1.7, whiteSpace:"pre-line" }}>{artisan.bio}</p>
          </section>
        )}

        <button type="button" className="a-btn-outline" style={{ marginBottom:64 }} onClick={() => openStorefront(artisan)}>
          {p.visitShop(shopName || ownerName)}
        </button>
      </div>

      <Footer t={t} navigate={navigate} />
    </div>
  );
}
