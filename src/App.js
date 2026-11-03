import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, matchPath, useLocation, useNavigate, useParams } from "react-router-dom";
import { COLORS, FONT_SERIF, FONT_SANS, THEME_CSS } from "./theme";
import { i18n } from "./data";
import { api, setToken, getToken, ApiError } from "./api";
import Nav from "./components/Nav";
import Home from "./components/Home";
import Shop from "./components/Shop";
import ProductDetail from "./components/ProductDetail";
import Cart from "./components/Cart";
import ReverseAuction from "./components/ReverseAuction";
import CommissionBoard from "./components/CommissionBoard";
import MyCommissions from "./components/MyCommissions";
import Dashboard from "./components/Dashboard";
import OrderDetail from "./components/OrderDetail";
import ShopOrders from "./components/ShopOrders";
import ArtisanProfileForm from "./components/ArtisanProfileForm";
import AddProductForm from "./components/AddProductForm";
import Portfolio from "./components/Portfolio";
import ProfilePage from "./components/ProfilePage";
import ShopSetup from "./components/ShopSetup";
import ShopStatusBanner from "./components/ShopStatusBanner";
import AdminShops from "./components/AdminShops";
import Messages from "./components/Messages";
import ProductCard from "./components/ProductCard";
import { isOwnProduct } from "./artisanInfo";
import { useNotifications } from "./useNotifications";
import { parseLink } from "./notificationHelpers";
import { PAGE_PATHS, artisanAboutPath, categoryPath, chatPath, editProductPath, orderPath, productPath, reviewPath, shopPath } from "./paths";
import { NotAllowed, NotFound, PageLoading, PageTitle, RequireAuth, RequireRole, ScrollToTop } from "./components/Routing";
import ProductRoute from "./components/ProductRoute";
import ShopRoute from "./components/ShopRoute";
import OrdersPage from "./components/OrdersPage";
import NotificationsPage from "./components/NotificationsPage";
import ProductReviews from "./components/ProductReviews";
import ReviewForm from "./components/ReviewForm";
import AdminReviews from "./components/AdminReviews";

// One switcher sets both: the UI language and the display currency that goes with it.
// Money is always USD on the server; other currencies are a display-only conversion.
const CURRENCY_BY_LANG = { en: "USD", mn: "MNT", ko: "KRW" };
const LOCALE_KEY = "artisan-lang";
function savedLang() {
  try {
    const v = localStorage.getItem(LOCALE_KEY);
    return Object.hasOwn(CURRENCY_BY_LANG, v) ? v : "en"; // anything unknown/old → English
  } catch { return "en"; }
}

const SHOP_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._&'-]{1,59}$/u; // same rule as the server
const SHOP_DESCRIPTION_MAX = 500;
const AVATAR_BY_ROLE = { admin: "🧑‍💼", artisan: "👩‍🎨", buyer: "🛍" };
// One-click demo logins on the login page: development only. Production builds leave them
// (and the seed password) out of the bundle; the API refuses that password in production anyway.
const DEMO_ACCOUNTS = process.env.NODE_ENV !== "production" ? [
  { name: "Admin", email: "admin@artisan.mn", password: "artisan123" },
  { name: "Narantsetseg", email: "narantsetseg@artisan.mn", password: "artisan123" },
  { name: "Buyer Demo", email: "buyer@artisan.mn", password: "artisan123" },
] : [];

// tab: "login" | "register", from the address (/signin, /signup).
function LoginPage({ tab, onTab, onLogin, onRegister, onBack, lang }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accountType, setAccountType] = useState("buyer"); // register: "buyer" | "artisan"
  const [shopName, setShopName] = useState("");
  const [shopDescription, setShopDescription] = useState("");

  const lbl = lang==="mn"
    ? { back:"Artisan руу буцах", login:"Нэвтрэх", register:"Бүртгүүлэх", email:"Имэйл", pw:"Нууц үг", name:"Нэр", loginBtn:"Нэвтрэх", registerBtn:"Бүртгүүлэх", noAcc:"Бүртгэл байхгүй юу?", hasAcc:"Бүртгэл байна уу?", wrongPw:"Имэйл эсвэл нууц үг буруу", demo:"Туршилтаар нэвтрэх:", appSub:"Монгол гар урлалын зах зээл", fillAll:"Бүх талбарыг бөглөнө үү", accountType:"Бүртгэлийн төрөл", buyerTitle:"Би худалдан авна", buyerSub:"Гар урлалын бүтээл худалдан авч, тусгай захиалга өгнө.", artisanTitle:"Би гар урлалаа зарна", artisanNote:"Урчны бүртгэлээр бүтээгдэхүүн нэмэх, захиалгаа удирдах, борлуулалтын самбараа харах боломжтой. Админ дэлгүүрийг тань зөвшөөрсний дараа дэлгүүр нээгдэнэ.", shopName:"Дэлгүүрийн нэр", shopNameHint:"2-60 тэмдэгт. Дараа нь өөрчлөх боломжгүй.", shopDesc:"Дэлгүүрийн товч тайлбар", shopDescHint:"Юу хийдэг, хэрхэн хийдэг вэ?", nameInvalid:"Дэлгүүрийн нэр 2-60 тэмдэгт байх ёстой: үсэг, тоо, хоосон зай болон . _ - & '", nameTaken:"Энэ дэлгүүрийн нэр бүртгэлтэй байна", emailTaken:"Энэ имэйл бүртгэлтэй байна" }
    : lang==="ko"
    ? { back:"Artisan으로 돌아가기", login:"로그인", register:"회원가입", email:"이메일", pw:"비밀번호", name:"이름", loginBtn:"로그인", registerBtn:"회원가입", noAcc:"계정이 없으신가요?", hasAcc:"이미 계정이 있으신가요?", wrongPw:"이메일 또는 비밀번호가 틀렸습니다", demo:"데모 로그인:", appSub:"몽골 전통 공예 마켓", fillAll:"모든 항목을 입력해주세요", accountType:"계정 유형", buyerTitle:"구매하고 싶어요", buyerSub:"핸드메이드 작품을 구매하고 맞춤 주문을 할 수 있어요.", artisanTitle:"내 공예품을 판매하고 싶어요", artisanNote:"장인 계정으로 상품 등록, 주문 관리, 판매 대시보드를 이용할 수 있어요. 관리자가 상점을 승인하면 상점이 공개돼요.", shopName:"상점 이름", shopNameHint:"2~60자. 나중에 바꿀 수 없어요.", shopDesc:"상점 소개 (짧게)", shopDescHint:"무엇을, 어떻게 만드나요?", nameInvalid:"상점 이름은 2~60자의 글자, 숫자, 공백, . _ - & ' 만 쓸 수 있어요", nameTaken:"이미 사용 중인 상점 이름이에요", emailTaken:"이미 가입된 이메일이에요" }
    : { back:"Back to Artisan", login:"Login", register:"Register", email:"Email", pw:"Password", name:"Name", loginBtn:"Login", registerBtn:"Create Account", noAcc:"Don't have an account?", hasAcc:"Already have an account?", wrongPw:"Incorrect email or password", demo:"Demo login:", appSub:"Mongolian Handmade Marketplace", fillAll:"Please fill all fields", accountType:"Account type", buyerTitle:"I want to buy", buyerSub:"Shop handmade pieces and order custom work.", artisanTitle:"I want to sell my crafts", artisanNote:"An artisan account lets you add products, manage orders and see your sales dashboard. Your shop opens once an admin approves it.", shopName:"Shop name", shopNameHint:"2-60 characters. It can't be changed later.", shopDesc:"Short shop description", shopDescHint:"What do you make, and how?", nameInvalid:"Shop name must be 2-60 characters: letters, numbers, spaces and . _ - & '", nameTaken:"That shop name is already taken", emailTaken:"That email is already registered" };

  const handleLogin = async (loginEmail = email, loginPassword = password) => {
    if (!loginEmail || !loginPassword) { setError(lbl.fillAll); return; }
    setBusy(true); setError("");
    try {
      await onLogin(loginEmail, loginPassword);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : lbl.wrongPw);
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    const isArtisan = accountType === "artisan";
    if (!name || !email || !password || (isArtisan && !shopName.trim())) { setError(lbl.fillAll); return; }
    if (isArtisan && !SHOP_NAME.test(shopName.trim())) { setError(lbl.nameInvalid); return; }
    setBusy(true); setError("");
    try {
      await onRegister(name, email, password, accountType, isArtisan ? { shopName: shopName.trim(), shopDescription: shopDescription.trim() } : undefined);
    } catch (err) {
      const byCode = { BAD_SHOP_NAME: lbl.nameInvalid, SHOP_NAME_TAKEN: lbl.nameTaken };
      setError(err instanceof ApiError ? (byCode[err.code] || (err.status === 409 ? lbl.emailTaken : err.message)) : lbl.wrongPw);
    } finally {
      setBusy(false);
    }
  };

  const submitOnEnter = (e) => e.key==="Enter" && (tab==="login" ? handleLogin() : handleRegister());

  // Full-width page (the shared .a-page container); the form itself stays ~560px, centered.
  return (
    <div style={{ minHeight:"100vh", background:COLORS.bg, color:COLORS.ink, fontFamily:FONT_SANS }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;} input,button{font-family:inherit;}`}</style>
      <style>{THEME_CSS}</style>
      <style>{`
        @keyframes loginFade { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .login-card { animation: loginFade 0.35s ease forwards; width:100%; max-width:560px; margin:0 auto; }
        .demo-btn { display:flex; align-items:center; gap:12px; width:100%; background:${COLORS.card}; border:1px solid ${COLORS.border}; border-radius:2px; padding:10px 14px; margin-bottom:8px; cursor:pointer; text-align:left; min-height:44px; transition:all 0.15s; }
        .demo-btn:hover { background:${COLORS.bgSoft}; border-color:${COLORS.accentDark}; }
        .acct-card { display:flex; gap:12px; align-items:flex-start; width:100%; text-align:left; background:${COLORS.card}; border:1.5px solid ${COLORS.border}; border-radius:2px; padding:14px 16px; cursor:pointer; min-height:44px; transition:border-color 0.15s, background 0.15s, box-shadow 0.15s; }
        .acct-card:hover { border-color:${COLORS.accentDark}; }
        .acct-card[aria-checked="true"] { border-color:${COLORS.accentDark}; background:${COLORS.bgSoft}; box-shadow:0 0 0 1px ${COLORS.accentDark}; }
        .acct-card:focus-visible { outline:2px solid ${COLORS.accentDark}; outline-offset:2px; }
      `}</style>
      <div className="a-page" style={{ minHeight:"100vh", display:"flex", alignItems:"center" }}>
      <div className="login-card">
        <button type="button" className="a-shop-link" style={{ fontFamily:FONT_SANS, fontSize:13, minHeight:44, color:COLORS.inkSoft, marginBottom:8 }} onClick={onBack}>‹ {lbl.back}</button>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontFamily:FONT_SERIF, fontSize:44, fontWeight:700, color:COLORS.ink, letterSpacing:-0.5 }}>Artisan</div>
          <div style={{ fontSize:11, color:COLORS.accentDark, letterSpacing:2.5, textTransform:"uppercase", marginTop:4, fontWeight:700 }}>{lbl.appSub}</div>
        </div>

        <div style={{ background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"28px 24px", boxShadow:"0 8px 32px rgba(59,42,50,0.08)", marginBottom:14 }}>
          <div role="tablist" style={{ display:"flex", background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:3, marginBottom:22 }}>
            {["login","register"].map(tb => (
              <button key={tb} type="button" role="tab" aria-selected={tab===tb} onClick={() => { onTab(tb); setError(""); }} style={{ flex:1, padding:"10px 0", minHeight:44, border:"none", borderRadius:2, fontWeight:700, fontSize:14, cursor:"pointer", background:tab===tb?COLORS.card:"transparent", color:tab===tb?COLORS.accentDark:COLORS.inkSoft, boxShadow:tab===tb?"0 2px 8px rgba(59,42,50,0.08)":"none", transition:"all 0.2s" }}>
                {tb==="login"?lbl.login:lbl.register}
              </button>
            ))}
          </div>

          {tab==="register" && (
            <div role="radiogroup" aria-label={lbl.accountType} style={{ display:"grid", gap:10, marginBottom:20 }}
              onKeyDown={(e) => {
                if (!["ArrowDown","ArrowUp","ArrowLeft","ArrowRight"].includes(e.key)) return;
                e.preventDefault();
                const next = accountType === "buyer" ? "artisan" : "buyer";
                setAccountType(next);
                e.currentTarget.querySelector(`[data-type="${next}"]`)?.focus();
              }}>
              {[["buyer", "🛍", lbl.buyerTitle, lbl.buyerSub], ["artisan", "🧶", lbl.artisanTitle, lbl.artisanNote]].map(([key, icon, title, sub]) => (
                <button key={key} type="button" role="radio" data-type={key} className="acct-card" aria-checked={accountType===key} tabIndex={accountType===key ? 0 : -1}
                  onClick={() => setAccountType(key)}>
                  <span className={`a-radio-dot${accountType===key ? " on" : ""}`} aria-hidden="true" style={{ marginTop:2 }} />
                  <span style={{ minWidth:0 }}>
                    <span style={{ display:"block", fontSize:15, fontWeight:700, color:COLORS.ink }}><span aria-hidden="true">{icon} </span>{title}</span>
                    <span style={{ display:"block", fontSize:12, color:COLORS.inkSoft, lineHeight:1.5, marginTop:4 }}>{sub}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {tab==="register" && (
            <div style={{ marginBottom:16 }}>
              <label className="a-label" htmlFor="login-name">{lbl.name}</label>
              <input id="login-name" className="a-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Narantsetseg" />
            </div>
          )}
          {tab==="register" && accountType==="artisan" && (
            <div style={{ background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"16px 14px 2px", marginBottom:16 }}>
              <div style={{ marginBottom:14 }}>
                <label className="a-label" htmlFor="signup-shop-name">{lbl.shopName} *</label>
                <input id="signup-shop-name" className="a-input" value={shopName} onChange={e=>setShopName(e.target.value)} maxLength={60} autoComplete="organization" aria-describedby="signup-shop-name-hint" />
                <div id="signup-shop-name-hint" style={{ fontSize:12, color:COLORS.inkSoft, marginTop:6 }}>{lbl.shopNameHint}</div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label className="a-label" htmlFor="signup-shop-desc">{lbl.shopDesc}</label>
                <textarea id="signup-shop-desc" className="a-textarea" style={{ minHeight:80 }} value={shopDescription} onChange={e=>setShopDescription(e.target.value)} maxLength={SHOP_DESCRIPTION_MAX} placeholder={lbl.shopDescHint} aria-describedby="signup-shop-desc-count" />
                <div id="signup-shop-desc-count" style={{ fontSize:12, color:COLORS.inkSoft, marginTop:6, textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{shopDescription.length} / {SHOP_DESCRIPTION_MAX}</div>
              </div>
            </div>
          )}
          <div style={{ marginBottom:16 }}>
            <label className="a-label" htmlFor="login-email">{lbl.email}</label>
            <input id="login-email" className="a-input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" onKeyDown={submitOnEnter} />
          </div>
          <div style={{ marginBottom:20 }}>
            <label className="a-label" htmlFor="login-password">{lbl.pw}</label>
            <div style={{ position:"relative" }}>
              <input id="login-password" className="a-input" value={password} onChange={e=>setPassword(e.target.value)} type={showPw?"text":"password"} placeholder="••••••••" style={{ paddingRight:48 }} onKeyDown={submitOnEnter} />
              <button type="button" aria-pressed={showPw} onClick={()=>setShowPw(!showPw)} style={{ position:"absolute", right:2, top:"50%", transform:"translateY(-50%)", width:44, height:40, background:"none", border:"none", cursor:"pointer", fontSize:15, color:COLORS.inkSoft }}>{showPw?"🙈":"👁"}</button>
            </div>
          </div>

          {error && <div role="alert" style={{ background:COLORS.bgSoft, border:`1px solid ${COLORS.accentSoft}`, borderRadius:2, padding:"9px 14px", fontSize:13, color:COLORS.accentDark, fontWeight:600, marginBottom:14, display:"flex", alignItems:"center", gap:6 }}>⚠️ {error}</div>}

          <button type="button" className="a-btn-primary" disabled={busy} onClick={tab==="login"?()=>handleLogin():handleRegister} style={{ width:"100%", fontSize:15, cursor:busy?"default":"pointer", opacity:busy?0.7:1 }}>
            {busy ? "…" : (tab==="login"?lbl.loginBtn:lbl.registerBtn)}
          </button>
          <div style={{ textAlign:"center", marginTop:16, fontSize:13, color:COLORS.inkSoft }}>
            {tab==="login"?lbl.noAcc:lbl.hasAcc}{" "}
            <button type="button" className="a-shop-link" onClick={() => { onTab(tab==="login"?"register":"login"); setError(""); }} style={{ display:"inline", color:COLORS.accentDark, fontWeight:700, fontSize:13 }}>{tab==="login"?lbl.register:lbl.login}</button>
          </div>
        </div>

        {DEMO_ACCOUNTS.length > 0 && (
        <div style={{ background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"16px 18px" }}>
          <div style={{ fontSize:11, color:COLORS.inkSoft, textTransform:"uppercase", letterSpacing:1.5, marginBottom:10, fontWeight:700 }}>{lbl.demo}</div>
          {DEMO_ACCOUNTS.map(u => (
            <button key={u.email} type="button" className="demo-btn" disabled={busy} onClick={() => handleLogin(u.email, u.password)}>
              <span style={{ fontSize:22 }}>{AVATAR_BY_ROLE[u.email.startsWith("admin")?"admin":u.email.startsWith("narantsetseg")?"artisan":"buyer"]}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:COLORS.ink }}>{u.name}</div>
                <div style={{ fontSize:12, color:COLORS.inkSoft, overflowWrap:"anywhere" }}>{u.email}</div>
              </div>
              <span style={{ fontSize:13, color:COLORS.accentDark, fontWeight:700 }}>→</span>
            </button>
          ))}
        </div>
        )}
      </div>
      </div>
    </div>
  );
}

// /orders/:orderId
function OrderRoute({ startChat, ...props }) {
  const { orderId } = useParams();
  return <OrderDetail key={orderId} {...props} orderId={orderId} onMessage={() => startChat({ orderId })} />;
}

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  input,textarea,button{font-family:inherit;}
  ::-webkit-scrollbar{display:none;}

  @keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
  @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(-14px) scale(0.94);}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}}
  @keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
  @keyframes heartPop{0%{transform:scale(1);}40%{transform:scale(1.5);}70%{transform:scale(0.9);}100%{transform:scale(1);}}
  @keyframes checkBounce{0%{transform:scale(0.5);opacity:0;}60%{transform:scale(1.15);opacity:1;}100%{transform:scale(1);opacity:1;}}
  @keyframes dotPop{from{transform:scale(0);}to{transform:scale(1);}}

  .page{animation:fadeUp 0.22s ease forwards;}

  .pcard{cursor:pointer;transition:transform 0.2s ease,box-shadow 0.2s ease;}
  .pcard:hover{transform:translateY(-4px);box-shadow:0 12px 32px rgba(0,0,0,0.11);}
  .pcard:active{transform:scale(0.97);}

  .ebtn{background:#e05d26;color:white;border:none;border-radius:26px;padding:11px 22px;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.15s,transform 0.1s,box-shadow 0.2s;}
  .ebtn:hover{background:#c94f1e;box-shadow:0 4px 16px rgba(224,93,38,0.4);}
  .ebtn:active{transform:scale(0.96);box-shadow:none;}

  .obtn{background:white;color:#333;border:1.5px solid #d0cbc4;border-radius:26px;padding:10px 20px;font-size:13px;cursor:pointer;transition:all 0.15s;}
  .obtn:hover{background:#f7f4f0;border-color:#aaa;}
  .obtn:active{transform:scale(0.96);}

  .save-pill{position:absolute;top:8px;right:8px;background:rgba(255,255,255,0.93);border:none;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:15px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.12);transition:transform 0.15s;backdrop-filter:blur(4px);}
  .save-pill:hover{transform:scale(1.12);}
  .save-pill:active{animation:heartPop 0.3s ease;}

  .skeleton{background:linear-gradient(90deg,#eeebe8 25%,#e4e0dc 50%,#eeebe8 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:8px;}

  input:focus,textarea:focus{border-color:#e05d26!important;box-shadow:0 0 0 3px rgba(224,93,38,0.11)!important;outline:none!important;}

  .cat-chip{border:1.5px solid #ddd;border-radius:20px;padding:6px 14px;font-size:12px;cursor:pointer;background:white;transition:all 0.15s;font-family:inherit;}
  .cat-chip:hover{border-color:#e05d26;color:#e05d26;background:#fff8f5;}
  .cat-chip.on{background:#e05d26;color:white;border-color:#e05d26;}

  .tier-card{border:1.5px solid #e0dbd4;border-radius:12px;padding:13px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:all 0.15s;background:white;}
  .tier-card:hover{border-color:#e05d26;background:#fff8f5;}
  .tier-card.on{border-color:#e05d26;background:#fff8f5;box-shadow:0 0 0 1px #e05d26;}

  .pkg-option{border:1.5px solid #e0dbd4;border-radius:10px;padding:11px 14px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:all 0.15s;background:white;}
  .pkg-option:hover{border-color:#e05d26;background:#fff8f5;}
  .pkg-option.on{border-color:#e05d26;background:#fff8f5;}

  .nav-tab{flex:1;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0 2px;transition:transform 0.15s;}
  .nav-tab:active{transform:scale(0.85);}

  .nav-dot{width:4px;height:4px;border-radius:50%;background:#e05d26;margin:2px auto 0;animation:dotPop 0.2s ease forwards;}

  .bdg{display:inline-block;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.2px;}

  .shop-tab-active{border-bottom:2.5px solid #e05d26;background:white;}
  .shop-tab-inactive{border-bottom:2.5px solid transparent;background:#faf9f7;}
`;

// /orders/:orderId/review/:itemIndex. Saving replaces the form, so Back doesn't reopen it.
function ReviewFormRoute({ onSaved, goBack, routerNavigate, ...props }) {
  const { orderId } = useParams();
  return (
    <ReviewForm {...props} onBack={() => goBack(orderPath(orderId))}
      onDone={(message) => { onSaved(message); routerNavigate(orderPath(orderId), { replace: true }); }} />
  );
}

// /messages and /messages/:conversationId: the URL says which chat is open.
function MessagesRoute(props) {
  const { conversationId } = useParams();
  const go = useNavigate();
  return <Messages {...props} activeId={conversationId || null} onSelect={(id) => go(id ? chatPath(id) : PAGE_PATHS.messages)} />;
}

const LOGIN_PATHS = [PAGE_PATHS.login, PAGE_PATHS.signup];
const SHOP_STATUS_PAGES = /^\/(profile|dashboard\/settings|dashboard\/products\/new|product\/[^/]+\/edit)$/;
const searchSuffix = (q) => (q ? `?q=${encodeURIComponent(q)}` : "");

function ArtisanApp() {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const { pathname } = location;
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const pageKey = location.key; // pages load fresh each time they're opened

  const [currentUser, setCurrentUser] = useState(() => {
    try { return getToken() ? JSON.parse(localStorage.getItem("artisan-user") || "null") : null; } catch { return null; }
  });
  const [lang, setLang] = useState(savedLang);
  const t = i18n[lang];
  const currency = CURRENCY_BY_LANG[lang];
  // An artisan account without a shop profile yet (new sign-up): sent to "Set up your shop".
  const [shopSetupNeeded, setShopSetupNeeded] = useState(false);
  // Own shop's approval: { status, reason }; status null = not loaded yet. Only "approved"
  // shops are public and can add or edit products (the server enforces this too).
  const [shopStatus, setShopStatus] = useState({ status: null, reason: "" });
  // Ids of products the current user has liked (the heart). Loaded from the API per user.
  const [savedItems, setSavedItems] = useState([]);
  const [likesLoaded, setLikesLoaded] = useState(false);
  const [products, setProducts] = useState([]);
  const [catalogReady, setCatalogReady] = useState(false);
  // The ids the API returned for the category in the URL (null = not loaded yet).
  const [categoryIds, setCategoryIds] = useState(null);
  const [catalogVersion, setCatalogVersion] = useState(0); // bumped on every catalog reload
  const [cart, setCart] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(location.search).get("q") || "");
  const [toast, setToast] = useState(null);
  const [rates, setRates] = useState({ MNT: 3450, KRW: 1380 });

  // /category/<anything else> is a 404 (below), not an empty list.
  const routeCategory = matchPath("/category/:name", pathname)?.params.name ?? null;
  const shopCategory = t.productCategories.some((c) => c.key === routeCategory) ? routeCategory : "";
  // On the product lists the search lives in the URL (?q=), so it survives refresh and Back.
  const onProductList = pathname === PAGE_PATHS.shop || routeCategory !== null;
  const urlQuery = new URLSearchParams(location.search).get("q") || "";
  useEffect(() => { if (onProductList) setSearchQuery(urlQuery); }, [onProductList, urlQuery]);
  const updateSearch = (q) => {
    setSearchQuery(q);
    if (onProductList) routerNavigate({ search: searchSuffix(q) }, { replace: true });
  };

  // Likes replaced the old browser-only wishlist; drop its leftover storage key.
  useEffect(() => { try { localStorage.removeItem("artisan-saved"); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(LOCALE_KEY, lang); } catch {} }, [lang]);
  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then(r => r.json())
      .then(d => {
        if (d.rates) {
          setRates({ MNT: d.rates.MNT, KRW: d.rates.KRW });
        }
      })
      .catch(() => {});
  }, []);

  // Product catalog is public — load it regardless of login state.
  const refreshProducts = () =>
    api.getProducts()
      .then(list => { setProducts(list.map(p => ({ ...p, id: p._id }))); setCatalogVersion(v => v + 1); })
      .catch(() => {})
      .finally(() => setCatalogReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refreshProducts(); }, []);

  // Category filtering is done by the API (?category=). Only the ids are kept so the
  // shop shows the same product objects as everywhere else (likes, edits stay in sync).
  // Re-runs on every catalog reload, so added/edited/deleted products are picked up.
  useEffect(() => {
    if (!shopCategory) { setCategoryIds(null); return; }
    let stale = false;
    setCategoryIds(null);
    api.getProducts(shopCategory)
      .then(list => { if (!stale) setCategoryIds(list.map(p => p._id)); })
      .catch(() => { if (!stale) setCategoryIds([]); });
    return () => { stale = true; };
  }, [shopCategory, catalogVersion]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2400); };

  // Login ended. On a public page the visitor stays; a protected page goes to sign-in and
  // comes back afterwards (see RequireAuth).
  const clearSession = () => {
    setToken(null);
    localStorage.removeItem("artisan-user");
    setCurrentUser(null);
    setCart(null);
    setOrders([]);
  };
  // The Logout button goes home: nothing to come back to.
  const logout = () => {
    clearSession();
    routerNavigate(PAGE_PATHS.home);
  };

  const handleApiError = (err) => {
    if (err instanceof ApiError && err.status === 401) { clearSession(); return; }
    showToast(err.message || "Something went wrong");
  };

  const refreshCart = () => api.getCart().then(setCart).catch((err) => {
    handleApiError(err);
    if (err.status !== 401) setCart((c) => c || { items: [] });
  });
  const refreshOrders = () => api.getOrders().then(setOrders).catch(handleApiError).finally(() => setOrdersLoaded(true));

  // Own profile changed (photo / bio): keep the stored copy in sync.
  const updateCurrentUser = (user) => {
    const next = { ...currentUser, ...user };
    localStorage.setItem("artisan-user", JSON.stringify(next));
    setCurrentUser(next);
  };

  // Cart, order history and likes are per-user — (re)load on login, clear on logout.
  // Also refresh the stored profile (photo/bio may have changed, or predate this version).
  const currentUserId = currentUser?.id;
  useEffect(() => {
    if (currentUserId) {
      refreshCart(); refreshOrders();
      api.getMyLikes().then(setSavedItems).catch(handleApiError).finally(() => setLikesLoaded(true));
      api.getMe().then(updateCurrentUser).catch(handleApiError);
      if (currentUser.role === "artisan") {
        api.getMyArtisan()
          .then((a) => { setShopSetupNeeded(false); setShopStatus({ status: a.status || "approved", reason: a.statusReason || "" }); })
          .catch((err) => {
            if (err.status !== 404) {
              setShopStatus((s) => ({ ...s, status: s.status || "unknown" })); // pages stop waiting for it
              return handleApiError(err);
            }
            setShopSetupNeeded(true);
            // Signing in or arriving at home leads to setup. Any other address (a refresh, a
            // shared link) stays put; shop pages show the setup form themselves.
            if ([PAGE_PATHS.home, ...LOGIN_PATHS].includes(pathRef.current)) routerNavigate(PAGE_PATHS["shop-setup"], { replace: true });
          });
      } else setShopSetupNeeded(false);
    }
    else {
      setCart(null); setOrders([]); setOrdersLoaded(false); setSavedItems([]); setLikesLoaded(false);
      setShopSetupNeeded(false); setShopStatus({ status: null, reason: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const notifications = useNotifications(Boolean(currentUserId), handleApiError);

  // The sign-in route sees the new user and goes back to where they were heading.
  const handleLogin = async (email, password) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    localStorage.setItem("artisan-user", JSON.stringify(user));
    setCurrentUser(user);
  };
  // accountType is only a request: the server accepts "buyer" or "artisan" and nothing else.
  // Artisans also send shop: { shopName, shopDescription }; the new shop waits for approval.
  const handleRegister = async (name, email, password, accountType = "buyer", shop) => {
    const { token, user } = await api.signup(name, email, password, accountType === "artisan" ? "artisan" : "buyer", shop);
    setToken(token);
    localStorage.setItem("artisan-user", JSON.stringify(user));
    setCurrentUser(user);
  };

  const currentUserAvatar = AVATAR_BY_ROLE[currentUser?.role] || "🙂";
  const isArtisan = currentUser?.role === "artisan";
  const shopLive = isArtisan && !shopSetupNeeded && shopStatus.status === "approved";

  // An admin may have approved / suspended the shop meanwhile: re-check on the shop's own pages.
  const refreshShopStatus = () =>
    api.getMyArtisan()
      .then((a) => setShopStatus({ status: a.status || "approved", reason: a.statusReason || "" }))
      .catch((err) => { if (err.status === 401) handleApiError(err); });
  useEffect(() => {
    if (isArtisan && !shopSetupNeeded && SHOP_STATUS_PAGES.test(pathname)) refreshShopStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Signing in comes back to this page.
  const openLogin = () => routerNavigate(PAGE_PATHS.login, { state: { from: pathname + location.search } });
  // Components ask for a page by name; RequireAuth sends logged-out visitors to sign in.
  const navigate = (pg) => (pg === "login" ? openLogin() : routerNavigate(PAGE_PATHS[pg] || PAGE_PATHS.home));
  // Back within the app if there's somewhere to go; a shared link has nothing behind it.
  const goBack = (fallback) => (window.history.state?.idx > 0 ? routerNavigate(-1) : routerNavigate(fallback, { replace: true }));
  // Heart = like. Flip the heart immediately, then take liked state + count from the server.
  const toggleSave = (id, e) => {
    if (e) e.stopPropagation();
    if (!currentUser) return openLogin();
    const wasLiked = savedItems.includes(id);
    const setLiked = (liked) => setSavedItems(s => liked ? (s.includes(id) ? s : [...s, id]) : s.filter(x => x !== id));
    setLiked(!wasLiked);
    (wasLiked ? api.unlikeProduct(id) : api.likeProduct(id))
      .then(({ liked, likeCount }) => {
        setLiked(liked);
        setProducts(ps => ps.map(p => p.id === id ? { ...p, likeCount } : p));
      })
      .catch((err) => { setLiked(wasLiked); handleApiError(err); });
  };

  // One shop per order: a translated message instead of the server's English one.
  const cartError = (err) => {
    if (err instanceof ApiError && err.code === "OTHER_SHOP") showToast(t.orders.otherShop);
    else handleApiError(err);
  };
  const addToCart = (productId, tier, qty = 1) => (!currentUser ? openLogin() :
    api.addCartItem(productId, tier, qty).then((c) => { setCart(c); showToast(t.addCart); })
      .catch((err) => (err instanceof ApiError && err.code === "PATRON_UNAVAILABLE" ? showToast(t.orders.patronUnavailable) : cartError(err))));
  const updateQty = (productId, tier, qty) =>
    api.updateCartItem(productId, tier, qty).then(setCart).catch(handleApiError);
  const removeFromCart = (productId, tier) =>
    api.removeCartItem(productId, tier).then(setCart).catch(handleApiError);
  // After PayPal capture: the server has created the paid order and emptied those cart lines.
  // Replaces /checkout, so Back can't return to a payment form for a paid order.
  const onPaid = (orderId) =>
    Promise.all([refreshCart(), refreshOrders()]).then(() => { showToast(t.paypal.paid); routerNavigate(orderPath(orderId), { replace: true }); });
  const openOrder = (id) => routerNavigate(orderPath(id));
  const openReview = (orderId, itemIndex) => routerNavigate(reviewPath(orderId, itemIndex));
  // A notification's in-app link. Anything unknown stays on the current page.
  const openLink = (link) => {
    const path = parseLink(link);
    if (path) routerNavigate(path);
  };
  // The inbox itself (header, profile): not whichever chat was opened last.
  const openInbox = () => routerNavigate(PAGE_PATHS.messages);
  // "Message shop" / "Message the artisan" / "Message the buyer". target: { shopId } | { productId } | { orderId }
  const startChat = (target) =>
    api.startConversation(target)
      .then(({ conversation }) => routerNavigate(chatPath(conversation.id)))
      .catch((err) => {
        if (err.status === 401) return handleApiError(err);
        return showToast(t.messages.errors[err.code] || t.messages.errors.generic);
      });

  const submitCommission = (data) =>
    api.createCommission(data).catch((err) => {
      if (err instanceof ApiError && err.status === 401) { clearSession(); }
      throw err;
    });

  const openProduct = (p) => routerNavigate(productPath(p.id));
  const openStorefront = (artisan) => { if (artisan?._id) routerNavigate(shopPath(artisan)); };
  const openArtisanProfile = (artisan) => { if (artisan?._id) routerNavigate(artisanAboutPath(artisan)); };
  // ── Artisan's own products ──
  // Replaces the form, so Back doesn't reopen it.
  const showSavedProduct = (product, message) => {
    showToast(message);
    refreshProducts();
    routerNavigate(productPath(product._id), { replace: true });
  };
  // Returns the promise so the detail page can show "Deleting…" until it settles.
  const deleteOwnProduct = (p) =>
    api.deleteProduct(p.id)
      .then(() => {
        showToast(t.addProduct.deleted);
        setSavedItems(s => s.filter(x => x !== p.id));
        refreshProducts();
        refreshCart();
        // Land on the shop the product was in; replaced so Back can't return to the deleted product.
        routerNavigate(shopPath(p.artisan), { replace: true });
      })
      .catch(handleApiError);

  // The API also returns an artisan's own hidden products (isHidden) to that artisan, so
  // they can still open them; every public list leaves them out.
  // Same for the artisan's own products while their shop isn't approved.
  const publicProducts = products.filter(p => !p.isHidden && (!p.artisan?.status || p.artisan.status === "approved"));
  // For an empty inbox: shops with something to ask about, one per shop.
  const suggestedShops = [...new Map(publicProducts.filter(p => p.artisan?._id).map(p => [p.artisan._id, p.artisan])).values()].slice(0, 4);

  const openShop = (category = "") => routerNavigate(categoryPath(category) + searchSuffix(searchQuery));
  const categoryLoading = Boolean(shopCategory) && categoryIds === null;
  const filtered = publicProducts.filter(p => {
    if (shopCategory && !categoryIds?.includes(p.id)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (lang==="mn" ? p.title : p.titleEn || p.title) || "";
    const artisanName = p.artisan?.user?.name || "";
    const shopName = p.artisan?.shopName || "";
    return name.toLowerCase().includes(q) || artisanName.toLowerCase().includes(q) || shopName.toLowerCase().includes(q);
  });

  // ── Currency helpers: prices are stored (and charged) in USD. fmtAmt shows them in the
  // language's currency; converted amounts are approximate, hence "≈". fmtUsd is the exact USD.
  const fmtUsd = (usd) => `$${usd.toFixed(2)}`;
  const fmtAmt = (usd) => {
    if (currency === "MNT") return `≈ ₮${Math.round(usd * rates.MNT).toLocaleString()}`;
    if (currency === "KRW") return `≈ ₩${Math.round(usd * rates.KRW).toLocaleString()}`;
    return fmtUsd(usd);
  };
  const fmtBasic = (p) => fmtAmt(p.pricingTiers.basic.price);
  const cartCount = cart?.items?.reduce((s, i) => s + i.qty, 0) || 0;
  const productName = (p) => (lang === "mn" ? p.title : p.titleEn || p.title);

  // ── Route elements ──
  const page = (title, element) => <><PageTitle title={title} />{element}</>;
  const signedIn = (title, element) => <RequireAuth user={currentUser}>{page(title, element)}</RequireAuth>;
  const forRoles = (roles, title, element) => <RequireRole user={currentUser} roles={roles} t={t}>{page(title, element)}</RequireRole>;
  // Shop pages can't work without a shop profile, so they show the setup form until it exists.
  const shopSetupForm = (
    <ShopSetup
      key={pageKey} t={t} onApiError={handleApiError}
      onDone={(artisan) => { setShopSetupNeeded(false); setShopStatus({ status: artisan?.status || "pending", reason: "" }); showToast(t.shopSetup.done); refreshProducts(); navigate("profile"); }}
    />
  );
  const shopChecked = shopSetupNeeded || shopStatus.status !== null;
  const artisanPage = (title, element) => forRoles(["artisan"], shopSetupNeeded ? t.shopSetup.title : title,
    !shopChecked ? <PageLoading /> : shopSetupNeeded ? shopSetupForm : element);
  const cantPublish = (
    <div className="a-page page">
      <p role="status" style={{ fontFamily:FONT_SANS, fontSize:15, color:COLORS.ink, marginTop:12 }}>{t.shopStatus.cantPublish}</p>
      <button type="button" className="a-btn-outline" style={{ marginTop:16 }} onClick={() => navigate("profile")}>{t.profile}</button>
    </div>
  );
  const cartPage = (checkout) => (
    <Cart
      lang={lang} t={t} cart={cart} checkout={checkout} onUpdateQty={updateQty} onRemove={removeFromCart}
      onPaid={onPaid} onApiError={handleApiError} fmtAmt={fmtAmt} fmtUsd={fmtUsd} currency={currency} navigate={navigate}
    />
  );
  const shopList = (
    <Shop
      lang={lang} t={t} filtered={filtered} loading={categoryLoading} currentUserId={currentUser?.id}
      category={shopCategory} openShop={openShop}
      searchQuery={searchQuery} clearSearch={() => updateSearch("")}
      savedItems={savedItems} toggleSave={toggleSave}
      fmt={fmtBasic} navigate={navigate}
    />
  );
  // Shop page and personal profile are one portfolio page; "about" opens it at About.
  const shopPage = (about) => (
    <ShopRoute t={t} about={about} products={products} catalogReady={catalogReady}>
      {(a) => (
        <>
          <PageTitle title={a.shopName || a.user?.name} />
          <Portfolio
            key={`${about}-${a._id}`} lang={lang} t={t} artisan={a}
            products={publicProducts.filter(p => p.artisan?._id === a._id)}
            savedItems={savedItems} toggleSave={toggleSave} openProduct={openProduct}
            fmtBasic={fmtBasic} navigate={navigate} onBack={() => goBack(PAGE_PATHS.shop)}
            focus={about ? "about" : undefined}
            viewer={currentUser} onMessageShop={() => startChat({ shopId: a._id })} onSignIn={openLogin}
          />
        </>
      )}
    </ShopRoute>
  );
  const loginPage = (tab, title) => (currentUser
    ? <Navigate to={location.state?.from || PAGE_PATHS.home} replace />
    : page(title, <LoginPage tab={tab} onTab={(next) => routerNavigate(PAGE_PATHS[next === "register" ? "signup" : "login"], { replace: true, state: location.state })}
        onLogin={handleLogin} onRegister={handleRegister} lang={lang} onBack={() => goBack(PAGE_PATHS.home)} />));

  return (
    <Routes>
      <Route path={PAGE_PATHS.login} element={loginPage("login", t.routing.signIn)} />
      <Route path={PAGE_PATHS.signup} element={loginPage("register", t.routing.signUp)} />

      <Route element={
        <div style={{ fontFamily:"'Helvetica Neue',Arial,sans-serif", background: COLORS.bg, minHeight:"100vh", color:"#222" }}>
          <style>{CSS}</style>
          <style>{THEME_CSS}</style>

          <Nav
            lang={lang} setLang={setLang}
            searchQuery={searchQuery} setSearchQuery={updateSearch}
            onSearchSubmit={() => routerNavigate((routeCategory !== null ? pathname : PAGE_PATHS.shop) + searchSuffix(searchQuery))}
            cartCount={cartCount} wishlistCount={savedItems.length}
            currentUser={currentUser && { ...currentUser, avatar: currentUserAvatar }} navigate={navigate} t={t}
            notifications={currentUser ? notifications : null} fmtAmt={fmtAmt} onOpenLink={openLink} onOpenInbox={openInbox} compact={pathname.startsWith(PAGE_PATHS.messages)}
          />

          {isArtisan && !shopSetupNeeded && <ShopStatusBanner t={t} status={shopStatus.status} reason={shopStatus.reason} />}

          {/* ── TOAST ── */}
          {toast && (
            <div style={{ position:"fixed", top:76, left:"50%", background:"#1c1c1c", color:"white", padding:"10px 20px", borderRadius:30, fontSize:13, fontWeight:500, zIndex:999, whiteSpace:"nowrap", boxShadow:"0 6px 24px rgba(0,0,0,0.22)", display:"flex", alignItems:"center", gap:8, animation:"toastIn 0.25s ease forwards" }}>
              <span style={{ fontSize:14, animation:"checkBounce 0.4s ease 0.1s both", display:"inline-block" }}>✓</span>
              {toast}
            </div>
          )}

          <Outlet />
        </div>
      }>
        {/* ── Public: shareable, no login needed ── */}
        <Route path={PAGE_PATHS.home} element={page(null,
          <Home
            lang={lang} t={t} prods={publicProducts} currentUserId={currentUser?.id}
            savedItems={savedItems} toggleSave={toggleSave}
            fmt={fmtBasic} navigate={navigate} openShop={openShop}
          />
        )} />
        <Route path={PAGE_PATHS.shop} element={page(t.detailPage.breadcrumbShop, shopList)} />
        <Route path="/category/:name" element={shopCategory
          ? page(t.productCategories.find((c) => c.key === shopCategory).label, shopList)
          : <NotFound t={t} />} />
        <Route path="/shop/:slug" element={shopPage(false)} />
        <Route path="/shop/:slug/about" element={shopPage(true)} />
        <Route path="/product/:id" element={
          <ProductRoute t={t} products={products} viewerId={currentUser?.id} onApiError={handleApiError}
            onLoaded={(id) => api.recordView(id).catch(() => {})}>
            {(selected) => (
              <>
                <PageTitle title={productName(selected)} />
                <ProductDetail
                  key={selected.id} lang={lang} t={t} selected={selected} savedItems={savedItems}
                  toggleSave={toggleSave} addToCart={addToCart} fmtAmt={fmtAmt}
                  openStorefront={openStorefront} openArtisanProfile={openArtisanProfile}
                  currentUserId={currentUser?.id} canEdit={shopLive}
                  viewer={currentUser} onMessageShop={() => startChat({ productId: selected.id })} onSignIn={openLogin}
                  onEdit={() => routerNavigate(editProductPath(selected.id))}
                  onDelete={deleteOwnProduct}
                />
                <ProductReviews key={`reviews-${selected.id}`} t={t} lang={lang} productId={selected.id} viewerId={currentUser?.id} onEdit={openReview} onApiError={handleApiError} showToast={showToast} />
              </>
            )}
          </ProductRoute>
        } />

        {/* ── Any signed-in account ── */}
        <Route path={PAGE_PATHS.cart} element={signedIn(t.cart, cart ? cartPage(false) : <PageLoading />)} />
        <Route path={PAGE_PATHS.checkout} element={signedIn(t.routing.checkoutTitle, cart ? cartPage(true) : <PageLoading />)} />
        <Route path={PAGE_PATHS.orders} element={signedIn(t.orders.historyTitle,
          <OrdersPage t={t} orders={orders} loaded={ordersLoaded} fmtAmt={fmtAmt} openOrder={openOrder} onReview={openReview} />
        )} />
        <Route path="/orders/:orderId" element={signedIn(t.orders.title,
          <OrderRoute
            t={t} lang={lang} fmtAmt={fmtAmt}
            onBack={() => goBack(PAGE_PATHS.orders)} onApiError={handleApiError} showToast={showToast}
            onChanged={refreshOrders} startChat={startChat} onReview={openReview}
          />
        )} />
        <Route path="/orders/:orderId/review/:itemIndex" element={signedIn(t.reviews.formTitle,
          <ReviewFormRoute
            t={t} lang={lang} onApiError={handleApiError}
            goBack={goBack} routerNavigate={routerNavigate}
            onSaved={(message) => { showToast(message); refreshProducts(); refreshOrders(); }}
          />
        )} />
        <Route path={PAGE_PATHS.notifications} element={signedIn(t.notifications.title,
          <NotificationsPage t={t} notifications={notifications} fmtAmt={fmtAmt} onOpenLink={openLink} />
        )} />
        <Route path={PAGE_PATHS.saved} element={signedIn(t.saved,
          <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
            <div className="a-page page" key={pageKey}>
              <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:24 }}>
                {t.saved} <span style={{ fontFamily:FONT_SANS, fontWeight:400, color:COLORS.inkSoft, fontSize:16 }}>({savedItems.length})</span>
              </h1>
              {!likesLoaded ? (
                <p role="status" style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>…</p>
              ) : savedItems.length===0 ? (
                <div style={{ textAlign:"center", padding:"64px 0", fontFamily:FONT_SANS }}>
                  <div style={{ fontSize:52, marginBottom:14 }}>🤍</div>
                  <div style={{ fontFamily:FONT_SERIF, fontSize:20, color:COLORS.ink, marginBottom:6 }}>{t.savedEmpty}</div>
                  <div style={{ fontSize:13, color:COLORS.inkSoft, marginBottom:24 }}>{t.savedHint}</div>
                  <button type="button" className="a-btn-primary" onClick={() => navigate("home")}>{t.browseItems}</button>
                </div>
              ) : (
                <div className="a-product-grid">
                  {products.filter(p => savedItems.includes(p.id)).map(p => (
                    <ProductCard
                      key={p.id} product={p} nameMn={p.title} nameEn={p.titleEn} lang={lang}
                      isOwn={isOwnProduct(p, currentUser?.id)} isSaved onToggleSave={toggleSave} price={fmtBasic(p)}
                      certifiedLabel={t.homePage.certified} wishlistAddLabel={t.homePage.wishlistAdd} wishlistRemoveLabel={t.homePage.wishlistRemove} ratingAria={t.reviews.ratingAria}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )} />
        <Route path={PAGE_PATHS.profile} element={signedIn(t.profile,
          <ProfilePage
            key={pageKey} t={t} lang={lang} user={currentUser} emoji={currentUserAvatar}
            products={products} savedItems={savedItems} toggleSave={toggleSave}
            fmtBasic={fmtBasic} fmtAmt={fmtAmt} cartLines={cart?.items?.length || 0}
            orders={orders} openOrder={openOrder} navigate={navigate} logout={logout} shopSetupNeeded={shopSetupNeeded} shopLive={shopLive}
            onApiError={handleApiError} unreadMessages={notifications.unreadMessages} onOpenInbox={openInbox} onReview={openReview}
            onUpdated={(user) => { updateCurrentUser(user); if (currentUser.role === "artisan") refreshProducts(); }}
          />
        )} />
        <Route path={PAGE_PATHS.commission} element={signedIn(t.commission,
          <ReverseAuction t={t} navigate={navigate} onSubmit={submitCommission} isArtisan={isArtisan} />
        )} />
        <Route path={PAGE_PATHS["my-commissions"]} element={signedIn(t.commissions.mineTitle,
          <MyCommissions
            key={pageKey} t={t} fmtAmt={fmtAmt} navigate={navigate}
            onApiError={handleApiError} showToast={showToast}
          />
        )} />

        {/* ── Admins take no part in chats ── */}
        <Route path="/messages/:conversationId?" element={forRoles(["buyer", "artisan"], t.messages.title,
          <MessagesRoute
            t={t} lang={lang} fmtAmt={fmtAmt} navigate={navigate} onApiError={handleApiError}
            onOpenProduct={(id) => routerNavigate(productPath(id))} onOpenOrder={openOrder}
            role={currentUser?.role} suggestedShops={suggestedShops} onStartChat={(shopId) => startChat({ shopId })}
          />
        )} />

        {/* ── By role ── */}
        <Route path={PAGE_PATHS["commission-board"]} element={forRoles(["artisan", "admin"], t.commissions.boardTitle,
          <CommissionBoard
            key={pageKey} t={t} fmtAmt={fmtAmt} canBid={isArtisan}
            onApiError={handleApiError} showToast={showToast}
          />
        )} />
        <Route path={PAGE_PATHS["shop-setup"]} element={forRoles(["artisan"], t.shopSetup.title,
          !shopChecked ? <PageLoading /> : shopSetupNeeded ? shopSetupForm : <Navigate to={PAGE_PATHS.profile} replace />
        )} />
        <Route path={PAGE_PATHS.dashboard} element={artisanPage(t.dashboard.title,
          <Dashboard
            key={pageKey} t={t} lang={lang} fmtAmt={fmtAmt} fmtUsd={fmtUsd} currency={currency}
            navigate={navigate} onApiError={handleApiError}
          />
        )} />
        <Route path={PAGE_PATHS["shop-orders"]} element={artisanPage(t.orders.shopTitle,
          <ShopOrders key={pageKey} t={t} fmtAmt={fmtAmt} navigate={navigate} openOrder={openOrder} onApiError={handleApiError} />
        )} />
        <Route path={PAGE_PATHS["shop-settings"]} element={artisanPage(t.shopSettings.title,
          <ArtisanProfileForm
            key={pageKey} t={t} navigate={navigate} onApiError={handleApiError} canAddProducts={shopLive} showToast={showToast}
            onSaved={() => { showToast(t.shopSettings.saved); refreshProducts(); }}
          />
        )} />
        <Route path={PAGE_PATHS["add-product"]} element={artisanPage(t.addProduct.title, !shopLive ? cantPublish :
          <AddProductForm
            key={pageKey} t={t} rateMnt={rates.MNT} onApiError={handleApiError}
            onBack={() => navigate("shop-settings")}
            onSaved={(product) => showSavedProduct(product, t.addProduct.created)}
          />
        )} />
        <Route path="/product/:id/edit" element={artisanPage(t.addProduct.editTitle, !shopLive ? cantPublish :
          <ProductRoute t={t} products={products} viewerId={currentUser?.id} onApiError={handleApiError}>
            {(selected) => (selected.artisan?.user?._id !== currentUser?.id ? <NotAllowed t={t} /> : (
              <AddProductForm
                key={selected.id} t={t} product={selected} rateMnt={rates.MNT} onApiError={handleApiError}
                onBack={() => goBack(productPath(selected.id))}
                onSaved={(product) => showSavedProduct(product, t.addProduct.updated)}
              />
            ))}
          </ProductRoute>
        )} />
        <Route path={PAGE_PATHS["admin-shops"]} element={forRoles(["admin"], t.adminShops.title,
          <AdminShops key={pageKey} t={t} lang={lang} onApiError={handleApiError} showToast={showToast} />
        )} />
        <Route path={PAGE_PATHS["admin-reviews"]} element={forRoles(["admin"], t.reviews.admin.title,
          <AdminReviews key={pageKey} t={t} lang={lang} onApiError={handleApiError} showToast={showToast} />
        )} />

        <Route path="*" element={<NotFound t={t} />} />
      </Route>
    </Routes>
  );
}

// The address is the app's navigation state, so everything sits inside the router.
// React Router's startTransition flag stays off: logging out changes the user and the address
// together, and a transition would show the old page without a user in between.
export default function App() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <ArtisanApp />
    </BrowserRouter>
  );
}
