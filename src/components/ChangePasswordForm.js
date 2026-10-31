import { useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api, setToken } from "../api";

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128; // same limits as the server

const SERVER_ERRORS = { WRONG_PASSWORD: "wrong", BAD_NEW_PASSWORD: "tooShort", SAME_PASSWORD: "same", WEAK_PASSWORD: "weak", RATE_LIMITED: "limited" };

function PasswordField({ id, label, value, onChange, onBlur, error, hint, autoComplete, cp }) {
  const [show, setShow] = useState(false);
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div style={{ marginBottom:14 }}>
      <label className="a-label" htmlFor={id}>{label}</label>
      <div style={{ position:"relative" }}>
        <input id={id} className="a-input" type={show ? "text" : "password"} value={value} autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)} onBlur={onBlur} maxLength={PASSWORD_MAX}
          aria-invalid={error ? true : undefined} aria-describedby={describedBy}
          style={{ paddingRight:48, ...(error ? { borderColor:COLORS.accentDark } : {}) }} />
        <button type="button" aria-label={show ? cp.hide : cp.show} aria-pressed={show} onClick={() => setShow(!show)}
          style={{ position:"absolute", right:2, top:"50%", transform:"translateY(-50%)", width:44, height:40, background:"none", border:"none", cursor:"pointer", fontSize:15, color:COLORS.inkSoft }}>
          {show ? "🙈" : "👁"}
        </button>
      </div>
      {error
        ? <div id={`${id}-error`} style={{ fontSize:12, fontWeight:600, color:COLORS.accentDark, marginTop:6 }}>{error}</div>
        : hint && <div id={`${id}-hint`} style={{ fontSize:12, color:COLORS.inkSoft, marginTop:6 }}>{hint}</div>}
    </div>
  );
}

// "Change password" for the logged-in user (any role). On success the server invalidates
// every earlier login token and returns a new one for this session, which is stored here.
export default function ChangePasswordForm({ t, onApiError }) {
  const cp = t.changePassword;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState({}); // field -> true once left or submitted
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { text, error }

  const errors = {
    current: !current ? cp.required : null,
    next: next.length < PASSWORD_MIN ? cp.tooShort : next.length > PASSWORD_MAX ? cp.tooLong : current && next === current ? cp.same : null,
    confirm: confirm !== next ? cp.mismatch : null,
  };
  const shown = (k) => (touched[k] ? errors[k] : null);
  const touch = (k) => () => setTouched((s) => ({ ...s, [k]: true }));

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ current: true, next: true, confirm: true });
    setMessage(null);
    if (errors.current || errors.next || errors.confirm) return;
    setBusy(true);
    try {
      const { token } = await api.changePassword(current, next);
      setToken(token);
      setCurrent(""); setNext(""); setConfirm(""); setTouched({});
      setMessage({ text: `✓ ${cp.success}. ${cp.otherDevices}` });
    } catch (err) {
      if (err.status === 401) return onApiError(err);
      setMessage({ text: cp[SERVER_ERRORS[err.code]] || cp.error, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="change-password-title" style={{ background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"22px 20px", marginBottom:14, fontFamily:FONT_SANS, color:COLORS.ink }}>
      <h2 id="change-password-title" style={{ fontFamily:FONT_SERIF, fontSize:20, fontWeight:600, marginBottom:14 }}>🔑 {cp.title}</h2>
      <form onSubmit={submit} noValidate>
        <PasswordField id="cp-current" label={cp.current} value={current} onChange={setCurrent} onBlur={touch("current")} error={shown("current")} autoComplete="current-password" cp={cp} />
        <PasswordField id="cp-new" label={cp.next} value={next} onChange={setNext} onBlur={touch("next")} error={shown("next")} hint={cp.hint} autoComplete="new-password" cp={cp} />
        <PasswordField id="cp-confirm" label={cp.confirm} value={confirm} onChange={setConfirm} onBlur={touch("confirm")} error={shown("confirm")} autoComplete="new-password" cp={cp} />

        {message && (
          <div role={message.error ? "alert" : "status"} style={{ marginBottom:12, fontSize:13, fontWeight:600, color: message.error ? COLORS.accentDark : COLORS.ink, background:COLORS.bgSoft, border:`1px solid ${message.error ? COLORS.accentSoft : COLORS.border}`, borderRadius:2, padding:"8px 12px" }}>
            {message.error && "⚠️ "}{message.text}
          </div>
        )}

        <button type="submit" className="a-btn-primary" disabled={busy} style={{ width:"100%", fontSize:14, opacity:busy ? 0.7 : 1 }}>
          {busy ? cp.saving : cp.submit}
        </button>
      </form>
    </section>
  );
}
