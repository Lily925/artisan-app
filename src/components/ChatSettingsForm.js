import { useEffect, useState } from "react";
import { COLORS, FONT_SANS, FONT_SERIF } from "../theme";
import { api } from "../api";

const REPLIES_MAX = 10;
const TEXT_MAX = 300;
const counter = { fontFamily:FONT_SANS, fontSize:11, color:COLORS.inkSoft, textAlign:"right", marginTop:4, fontVariantNumeric:"tabular-nums" };

// Shop settings: quick replies for the chat and the optional automatic greeting (own shop only).
export default function ChatSettingsForm({ t, onApiError, showToast }) {
  const m = t.messages;
  const [replies, setReplies] = useState(null); // null = loading
  const [greeting, setGreeting] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let stale = false;
    api.getChatSettings()
      .then((res) => { if (stale) return; setReplies(res.savedReplies); setGreeting(res.greeting); })
      .catch((err) => { if (stale) return; if (err.status === 401) onApiError(err); setLoadFailed(true); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    api.updateChatSettings({ savedReplies: replies, greeting })
      .then((res) => { setReplies(res.savedReplies); setGreeting(res.greeting); showToast(m.settingsSaved); })
      .catch((err) => {
        if (err.status === 401) onApiError(err);
        else setError(m.errors[err.code] || m.errors.generic);
      })
      .finally(() => setSaving(false));
  };

  if (loadFailed) return <p role="alert" style={{ fontFamily:FONT_SANS, fontSize:14, color:"#B3261E", marginTop:32 }}>{m.errors.generic}</p>;
  if (replies === null) return null;

  return (
    <section aria-labelledby="chat-settings-title" style={{ marginTop:40, paddingTop:32, borderTop:`1px solid ${COLORS.border}` }}>
      <h2 id="chat-settings-title" style={{ fontFamily:FONT_SERIF, fontSize:24, fontWeight:600, color:COLORS.ink, marginBottom:6 }}>{m.settingsTitle}</h2>
      <p style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, marginBottom:20 }}>{m.settingsIntro}</p>

      <form onSubmit={save} noValidate>
        <div style={{ marginBottom:24 }}>
          <label className="a-label" htmlFor="chat-greeting">{m.greetingLabel}</label>
          <textarea id="chat-greeting" className="a-textarea" style={{ minHeight:80 }} maxLength={TEXT_MAX} value={greeting}
            aria-describedby="chat-greeting-hint" onChange={(e) => setGreeting(e.target.value)} />
          <div style={counter}>{greeting.length} / {TEXT_MAX}</div>
          <div id="chat-greeting-hint" style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>{m.greetingHint}</div>
        </div>

        <div className="a-label">{m.repliesLabel} ({replies.length} / {REPLIES_MAX})</div>
        {replies.length === 0 && <p style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, marginBottom:12 }}>{m.repliesEmpty}</p>}
        {replies.map((reply, i) => (
          <div key={i} style={{ marginBottom:12 }}>
            <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
              <textarea className="a-textarea" style={{ minHeight:60 }} maxLength={TEXT_MAX} aria-label={m.replyAria(i + 1)} value={reply}
                onChange={(e) => setReplies((list) => list.map((r, j) => (j === i ? e.target.value : r)))} />
              <button type="button" className="a-icon-only-btn" aria-label={m.replyRemove(i + 1)} onClick={() => setReplies((list) => list.filter((_, j) => j !== i))}>×</button>
            </div>
            <div style={{ ...counter, paddingRight:52 }}>{reply.length} / {TEXT_MAX}</div>
          </div>
        ))}
        {replies.length < REPLIES_MAX && (
          <button type="button" className="a-btn-outline" style={{ padding:"8px 16px", minHeight:40, fontSize:13, marginBottom:20 }} onClick={() => setReplies((list) => [...list, ""])}>+ {m.replyAdd}</button>
        )}

        {error && <div role="alert" style={{ fontFamily:FONT_SANS, fontSize:12, color:"#B3261E", marginBottom:14 }}>{error}</div>}
        <button type="submit" className="a-btn-primary" style={{ width:"100%" }} disabled={saving}>{saving ? t.shopSettings.saving : m.settingsSave}</button>
      </form>
    </section>
  );
}
