import { useEffect, useRef, useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api, assetUrl } from "../api";

const BIO_MAX = 300;
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// The logged-in user's own profile card: photo (upload / change / remove), name, email
// (only ever shown here, to the user themselves), role and a short bio with a live
// character counter. With no photo the role emoji is the avatar. An artisan's photo and
// bio are public (shop, artisan profile, product pages); a buyer's stay private.
// `children` are the page's action buttons, shown under the profile.
export default function ProfileCard({ t, user, emoji, onUpdated, onApiError, children }) {
  const m = t.myProfile;
  const fileInput = useRef(null);
  const [bio, setBio] = useState(user.bio || "");
  const [busy, setBusy] = useState(null); // "photo" | "remove" | "bio" while saving
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [message, setMessage] = useState(null); // { text, error }

  // The saved bio can arrive after mount (profile refresh on login).
  useEffect(() => setBio(user.bio || ""), [user.bio]);

  const isArtisan = user.role === "artisan";
  const photoUrl = user.avatarUrl && !photoFailed ? assetUrl(user.avatarUrl) : "";
  const bioChanged = bio.trim() !== (user.bio || "");

  const save = async (kind, data, okText) => {
    setBusy(kind);
    setMessage(null);
    try {
      const updated = await api.updateProfile(user.id, data);
      setPhotoFailed(false);
      setBio(updated.bio);
      onUpdated(updated);
      setMessage({ text: okText });
    } catch (err) {
      if (err.status === 401) onApiError(err);
      else setMessage({ text: err.message || m.error, error: true });
    } finally {
      setBusy(null);
      setConfirmRemove(false);
    }
  };

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // picking the same file again should still trigger a change
    if (!file) return;
    // Quick checks for a friendly message; the server checks the real file contents again.
    if (!PHOTO_TYPES.includes(file.type)) return setMessage({ text: m.wrongType, error: true });
    if (file.size > PHOTO_MAX_BYTES) return setMessage({ text: m.tooBig, error: true });
    const form = new FormData();
    form.append("photo", file);
    save("photo", form, m.photoSaved);
  };

  const removePhoto = () => {
    const form = new FormData();
    form.append("removePhoto", "true");
    save("remove", form, m.photoRemoved);
  };

  const circle = { width:104, height:104, borderRadius:"50%", border:`3px solid ${COLORS.accent}`, margin:"0 auto 14px", boxShadow:"0 4px 14px rgba(201,124,150,0.22)" };
  const smallBtn = { padding:"8px 16px", fontSize:13, minHeight:40 };

  return (
    <section aria-labelledby="my-profile-name" style={{ background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"28px 20px", marginBottom:14, textAlign:"center", fontFamily:FONT_SANS, color:COLORS.ink }}>
      {photoUrl ? (
        <img src={photoUrl} alt={m.photo} onError={() => setPhotoFailed(true)} style={{ ...circle, display:"block", objectFit:"cover" }} />
      ) : (
        <div aria-hidden="true" style={{ ...circle, background:COLORS.bgSoft, display:"flex", alignItems:"center", justifyContent:"center", fontSize:48 }}>{emoji}</div>
      )}

      <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:6 }}>
        <input ref={fileInput} type="file" accept={PHOTO_TYPES.join(",")} onChange={onPickPhoto} className="a-sr-only" tabIndex={-1} aria-hidden="true" />
        <button type="button" className="a-btn-primary" style={smallBtn} disabled={!!busy} onClick={() => fileInput.current?.click()}>
          {busy === "photo" ? m.uploading : user.avatarUrl ? m.change : m.upload}
        </button>
        {user.avatarUrl && !confirmRemove && (
          <button type="button" className="a-btn-outline" style={smallBtn} disabled={!!busy} onClick={() => setConfirmRemove(true)}>
            {m.remove}
          </button>
        )}
        {user.avatarUrl && confirmRemove && (
          <>
            <button type="button" className="a-btn-outline" style={{ ...smallBtn, borderColor:COLORS.accentDark, color:COLORS.accentDark }} disabled={!!busy} onClick={removePhoto}>
              {busy === "remove" ? m.saving : m.removeConfirm}
            </button>
            <button type="button" className="a-btn-outline" style={{ ...smallBtn, borderColor:COLORS.border }} disabled={!!busy} onClick={() => setConfirmRemove(false)}>
              {m.cancel}
            </button>
          </>
        )}
      </div>
      <div style={{ fontSize:12, color:COLORS.inkSoft, marginBottom:18 }}>{m.photoHint}</div>

      <h2 id="my-profile-name" style={{ fontFamily:FONT_SERIF, fontWeight:600, fontSize:26, marginBottom:4, overflowWrap:"anywhere" }}>{user.name}</h2>
      <div style={{ fontSize:13, color:COLORS.inkSoft, marginBottom:2, overflowWrap:"anywhere" }}>{user.email}</div>
      <div style={{ fontSize:11, color:COLORS.inkSoft, marginBottom:10 }}>🔒 {m.emailNote}</div>
      <div style={{ display:"inline-block", background:COLORS.bgSoft, color:COLORS.accentDark, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"4px 14px", fontSize:12, fontWeight:700 }}>{user.role}</div>

      <div style={{ textAlign:"left", marginTop:22 }}>
        <label className="a-label" htmlFor="my-profile-bio">{m.bio}</label>
        <textarea id="my-profile-bio" className="a-textarea" style={{ minHeight:96 }} maxLength={BIO_MAX}
          placeholder={m.bioPlaceholder} value={bio} onChange={(e) => setBio(e.target.value)}
          aria-describedby="my-profile-bio-count my-profile-visibility" />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginTop:6, flexWrap:"wrap" }}>
          <span id="my-profile-bio-count" aria-live="polite" style={{ fontSize:12, fontVariantNumeric:"tabular-nums", color: bio.length >= BIO_MAX ? COLORS.accentDark : COLORS.inkSoft, fontWeight: bio.length >= BIO_MAX ? 700 : 400 }}>
            {m.counter(bio.length, BIO_MAX)}
          </span>
          <div style={{ display:"flex", gap:8 }}>
            {(user.bio || bio) && (
              <button type="button" className="a-btn-outline" style={{ ...smallBtn, borderColor:COLORS.border }} disabled={!!busy}
                onClick={() => (user.bio ? save("bio", { bio: "" }, m.bioSaved) : setBio(""))}>
                {m.clearBio}
              </button>
            )}
            <button type="button" className="a-btn-primary" style={smallBtn} disabled={!!busy || !bioChanged}
              onClick={() => save("bio", { bio }, m.bioSaved)}>
              {busy === "bio" ? m.saving : m.saveBio}
            </button>
          </div>
        </div>
        <p id="my-profile-visibility" style={{ fontSize:12, color:COLORS.inkSoft, marginTop:10, lineHeight:1.5 }}>
          {isArtisan ? m.publicNote : m.privateNote}
        </p>
      </div>

      {message && (
        <div role={message.error ? "alert" : "status"} style={{ marginTop:12, fontSize:13, fontWeight:600, color: message.error ? COLORS.accentDark : COLORS.ink, background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"8px 12px" }}>
          {message.text}
        </div>
      )}

      {children}
    </section>
  );
}
