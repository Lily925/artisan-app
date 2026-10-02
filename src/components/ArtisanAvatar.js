import { useState } from "react";
import { COLORS, FONT_SERIF } from "../theme";

// Round artisan avatar: the profile photo when there is one (and it loads),
// otherwise the initial-letter circle used across the site.
export default function ArtisanAvatar({ name, photoUrl, size = 88 }) {
  const [failed, setFailed] = useState(false);
  const circle = { width:size, height:size, borderRadius:"50%", border:`2px solid ${COLORS.accent}`, flexShrink:0 };

  if (photoUrl && !failed) {
    return <img src={photoUrl} alt="" onError={() => setFailed(true)} style={{ ...circle, objectFit:"cover", display:"block" }} />;
  }
  return (
    <div aria-hidden="true" style={{ ...circle, background:COLORS.accentSoft, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:FONT_SERIF, fontSize:Math.round(size * 0.41), fontWeight:600, color:COLORS.ink }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}
