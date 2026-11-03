import { useEffect } from "react";
import { Navigate, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { COLORS, FONT_SANS, FONT_SERIF } from "../theme";
import { PAGE_PATHS } from "../paths";

// New pages open at the top; Back and Forward leave the scroll position to the browser.
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType !== "POP") window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}

export function PageTitle({ title }) {
  useEffect(() => { document.title = title ? `${title} · Artisan` : "Artisan"; }, [title]);
  return null;
}

// Logged out: to the sign-in page, which comes back to this address afterwards.
export function RequireAuth({ user, children }) {
  const { pathname, search } = useLocation();
  if (!user) return <Navigate to={PAGE_PATHS.login} replace state={{ from: pathname + search }} />;
  return children;
}

// The server checks the role on every request too; this only explains the page to the visitor.
export function RequireRole({ user, roles, t, children }) {
  return (
    <RequireAuth user={user}>
      {user && !roles.includes(user.role) ? <NotAllowed t={t} /> : children}
    </RequireAuth>
  );
}

function StatusPage({ icon, title, body, t }) {
  const navigate = useNavigate();
  return (
    <div style={{ background:COLORS.bg, minHeight:"70vh" }}>
      <PageTitle title={title} />
      <div className="a-page page" style={{ textAlign:"center" }}>
        <div aria-hidden="true" style={{ fontSize:52, marginBottom:14 }}>{icon}</div>
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:32, fontWeight:600, color:COLORS.ink, marginBottom:10 }}>{title}</h1>
        <p className="a-readable" style={{ fontFamily:FONT_SANS, fontSize:15, color:COLORS.inkSoft, lineHeight:1.6, margin:"0 auto 24px" }}>{body}</p>
        <button type="button" className="a-btn-primary" onClick={() => navigate(PAGE_PATHS.home)}>{t.backHome}</button>
      </div>
    </div>
  );
}

export function NotFound({ t }) {
  return <StatusPage icon="🧶" title={t.routing.notFoundTitle} body={t.routing.notFoundBody} t={t} />;
}

export function NotAllowed({ t }) {
  return <StatusPage icon="🔒" title={t.routing.notAllowedTitle} body={t.routing.notAllowedBody} t={t} />;
}

export function PageLoading() {
  return (
    <div className="a-page">
      <p role="status" style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>…</p>
    </div>
  );
}

// A page's data couldn't be loaded (not the same as "doesn't exist").
export function PageLoadError({ t, onRetry }) {
  return (
    <div className="a-page">
      <p role="alert" style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, marginBottom:16 }}>{t.routing.loadError}</p>
      <button type="button" className="a-btn-outline" onClick={onRetry}>{t.routing.retry}</button>
    </div>
  );
}
