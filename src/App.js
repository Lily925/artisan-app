import { useState, useEffect } from "react";
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
import ProductCard from "./components/ProductCard";

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

const AVATAR_BY_ROLE = { admin: "🧑‍💼", artisan: "👩‍🎨", buyer: "🛍" };
// One-click demo logins on the login page: development only. Production builds leave them
// (and the seed password) out of the bundle; the API refuses that password in production anyway.
const DEMO_ACCOUNTS = process.env.NODE_ENV !== "production" ? [
  { name: "Admin", email: "admin@artisan.mn", password: "artisan123" },
  { name: "Narantsetseg", email: "narantsetseg@artisan.mn", password: "artisan123" },
  { name: "Buyer Demo", email: "buyer@artisan.mn", password: "artisan123" },
] : [];

function LoginPage({ onLogin, onRegister, lang }) {
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accountType, setAccountType] = useState("buyer"); // register: "buyer" | "artisan"

  const lbl = lang==="mn"
    ? { login:"Нэвтрэх", register:"Бүртгүүлэх", email:"Имэйл", pw:"Нууц үг", name:"Нэр", loginBtn:"Нэвтрэх", registerBtn:"Бүртгүүлэх", noAcc:"Бүртгэл байхгүй юу?", hasAcc:"Бүртгэл байна уу?", wrongPw:"Имэйл эсвэл нууц үг буруу", demo:"Туршилтаар нэвтрэх:", appSub:"Монгол гар урлалын зах зээл", fillAll:"Бүх талбарыг бөглөнө үү", accountType:"Бүртгэлийн төрөл", buyerTitle:"Би худалдан авна", buyerSub:"Гар урлалын бүтээл худалдан авч, тусгай захиалга өгнө.", artisanTitle:"Би гар урлалын бүтээлээ зарна", artisanNote:"Урчны бүртгэлээр бүтээгдэхүүн нэмэх, захиалгаа удирдах, борлуулалтын самбараа харах боломжтой. Бүртгүүлсний дараа дэлгүүрээ тохируулна." }
    : lang==="ko"
    ? { login:"로그인", register:"회원가입", email:"이메일", pw:"비밀번호", name:"이름", loginBtn:"로그인", registerBtn:"회원가입", noAcc:"계정이 없으신가요?", hasAcc:"이미 계정이 있으신가요?", wrongPw:"이메일 또는 비밀번호가 틀렸습니다", demo:"데모 로그인:", appSub:"몽골 전통 공예 마켓", fillAll:"모든 항목을 입력해주세요", accountType:"계정 유형", buyerTitle:"구매하고 싶어요", buyerSub:"핸드메이드 작품을 구매하고 맞춤 주문을 할 수 있어요.", artisanTitle:"내 핸드메이드 작품을 판매하고 싶어요", artisanNote:"장인 계정으로 상품 등록, 주문 관리, 판매 대시보드를 이용할 수 있어요. 가입 후 바로 상점을 설정해요." }
    : { login:"Login", register:"Register", email:"Email", pw:"Password", name:"Name", loginBtn:"Login", registerBtn:"Create Account", noAcc:"Don't have an account?", hasAcc:"Already have an account?", wrongPw:"Incorrect email or password", demo:"Demo login:", appSub:"Mongolian Handmade Marketplace", fillAll:"Please fill all fields", accountType:"Account type", buyerTitle:"I want to buy", buyerSub:"Shop handmade pieces and order custom work.", artisanTitle:"I want to sell my handmade products", artisanNote:"An artisan account lets you add products, manage orders and see your sales dashboard. You'll set up your shop right after signing up." };

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
    if (!name || !email || !password) { setError(lbl.fillAll); return; }
    setBusy(true); setError("");
    try {
      await onRegister(name, email, password, accountType);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : lbl.wrongPw);
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
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontFamily:FONT_SERIF, fontSize:44, fontWeight:700, color:COLORS.ink, letterSpacing:-0.5 }}>Artisan</div>
          <div style={{ fontSize:11, color:COLORS.accentDark, letterSpacing:2.5, textTransform:"uppercase", marginTop:4, fontWeight:700 }}>{lbl.appSub}</div>
        </div>

        <div style={{ background:COLORS.card, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"28px 24px", boxShadow:"0 8px 32px rgba(59,42,50,0.08)", marginBottom:14 }}>
          <div role="tablist" style={{ display:"flex", background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:3, marginBottom:22 }}>
            {["login","register"].map(tb => (
              <button key={tb} type="button" role="tab" aria-selected={tab===tb} onClick={() => { setTab(tb); setError(""); }} style={{ flex:1, padding:"10px 0", minHeight:44, border:"none", borderRadius:2, fontWeight:700, fontSize:14, cursor:"pointer", background:tab===tb?COLORS.card:"transparent", color:tab===tb?COLORS.accentDark:COLORS.inkSoft, boxShadow:tab===tb?"0 2px 8px rgba(59,42,50,0.08)":"none", transition:"all 0.2s" }}>
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
            <button type="button" className="a-shop-link" onClick={()=>setTab(tab==="login"?"register":"login")} style={{ display:"inline", color:COLORS.accentDark, fontWeight:700, fontSize:13 }}>{tab==="login"?lbl.register:lbl.login}</button>
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

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try { return getToken() ? JSON.parse(localStorage.getItem("artisan-user") || "null") : null; } catch { return null; }
  });
  const [lang, setLang] = useState(savedLang);
  const currency = CURRENCY_BY_LANG[lang];
  const [page, setPage] = useState("home");
  const [pageKey, setPageKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [storeArtisan, setStoreArtisan] = useState(null); // artisan whose storefront is open
  // An artisan account without a shop profile yet (new sign-up): sent to "Set up your shop".
  const [shopSetupNeeded, setShopSetupNeeded] = useState(false);
  const [profileArtisan, setProfileArtisan] = useState(null); // artisan whose personal profile is open
  // Pages to return to from the storefront / artisan-profile pages ("Back" pops one).
  const [backStack, setBackStack] = useState([]);
  // Ids of products the current user has liked (the heart). Loaded from the API per user.
  const [savedItems, setSavedItems] = useState([]);
  const [products, setProducts] = useState([]);
  // Shop category filter ("" = all) and the ids the API returned for it (null = not loaded yet).
  const [shopCategory, setShopCategory] = useState("");
  const [categoryIds, setCategoryIds] = useState(null);
  const [catalogVersion, setCatalogVersion] = useState(0); // bumped on every catalog reload
  const [cart, setCart] = useState(null);
  const [orders, setOrders] = useState([]);
  const [orderView, setOrderView] = useState(null); // { id, back }: the order detail page and where "Back" goes
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [rates, setRates] = useState({ MNT: 3450, KRW: 1380 });

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
      .catch(() => {});
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

  const logout = () => {
    setToken(null);
    localStorage.removeItem("artisan-user");
    setCurrentUser(null);
    setCart(null);
    setOrders([]);
    setPage("home");
  };

  const handleApiError = (err) => {
    if (err instanceof ApiError && err.status === 401) { logout(); return; }
    showToast(err.message || "Something went wrong");
  };

  const refreshCart = () => api.getCart().then(setCart).catch(handleApiError);
  const refreshOrders = () => api.getOrders().then(setOrders).catch(handleApiError);

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
      refreshCart(); refreshOrders(); api.getMyLikes().then(setSavedItems).catch(handleApiError);
      api.getMe().then(updateCurrentUser).catch(handleApiError);
      if (currentUser.role === "artisan") {
        api.getMyArtisan()
          .then(() => setShopSetupNeeded(false))
          .catch((err) => {
            if (err.status !== 404) return handleApiError(err);
            setShopSetupNeeded(true);
            navigate("shop-setup");
          });
      } else setShopSetupNeeded(false);
    }
    else { setCart(null); setOrders([]); setSavedItems([]); setShopSetupNeeded(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const handleLogin = async (email, password) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    localStorage.setItem("artisan-user", JSON.stringify(user));
    setCurrentUser(user);
  };
  // accountType is only a request: the server accepts "buyer" or "artisan" and nothing else.
  const handleRegister = async (name, email, password, accountType = "buyer") => {
    const { token, user } = await api.signup(name, email, password, accountType === "artisan" ? "artisan" : "buyer");
    setToken(token);
    localStorage.setItem("artisan-user", JSON.stringify(user));
    setCurrentUser(user);
  };

  if (!currentUser) return <LoginPage onLogin={handleLogin} onRegister={handleRegister} lang={lang} />;

  const t = i18n[lang];
  // Shop pages can't work without a shop profile, so they show the setup form until it exists.
  const SHOP_SETUP_GATED = ["shop-setup", "dashboard", "shop-orders", "shop-settings", "add-product", "edit-product"];
  const showShopSetup = currentUser.role === "artisan" && shopSetupNeeded && SHOP_SETUP_GATED.includes(page);
  const currentUserAvatar = AVATAR_BY_ROLE[currentUser.role] || "🙂";

  const navigate = (pg) => { setPage(pg); setPageKey(k => k + 1); };
  // Heart = like. Flip the heart immediately, then take liked state + count from the server.
  const toggleSave = (id, e) => {
    if (e) e.stopPropagation();
    const wasLiked = savedItems.includes(id);
    const setLiked = (liked) => setSavedItems(s => liked ? (s.includes(id) ? s : [...s, id]) : s.filter(x => x !== id));
    setLiked(!wasLiked);
    (wasLiked ? api.unlikeProduct(id) : api.likeProduct(id))
      .then(({ liked, likeCount }) => {
        setLiked(liked);
        setProducts(ps => ps.map(p => p.id === id ? { ...p, likeCount } : p));
        setSelected(sel => sel && sel.id === id ? { ...sel, likeCount } : sel);
      })
      .catch((err) => { setLiked(wasLiked); handleApiError(err); });
  };

  // One shop per order: a translated message instead of the server's English one.
  const cartError = (err) => {
    if (err instanceof ApiError && err.code === "OTHER_SHOP") showToast(t.orders.otherShop);
    else handleApiError(err);
  };
  const addToCart = (productId, tier, qty = 1) =>
    api.addCartItem(productId, tier, qty).then((c) => { setCart(c); showToast(t.addCart); })
      .catch((err) => (err instanceof ApiError && err.code === "PATRON_UNAVAILABLE" ? showToast(t.orders.patronUnavailable) : cartError(err)));
  const updateQty = (productId, tier, qty) =>
    api.updateCartItem(productId, tier, qty).then(setCart).catch(handleApiError);
  const removeFromCart = (productId, tier) =>
    api.removeCartItem(productId, tier).then(setCart).catch(handleApiError);
  // After PayPal capture: the server has created the paid order and emptied those cart lines.
  const onPaid = (orderId) =>
    Promise.all([refreshCart(), refreshOrders()]).then(() => { showToast(t.paypal.paid); openOrder(orderId); });
  const openOrder = (id, back = "profile") => { setOrderView({ id, back }); navigate("order-detail"); window.scrollTo(0, 0); };

  const submitCommission = (data) =>
    api.createCommission(data).catch((err) => {
      if (err instanceof ApiError && err.status === 401) { logout(); }
      throw err;
    });

  const openProduct = (p) => {
    setSelected(p);
    navigate("detail");
    // Feeds the owning artisan's dashboard; the server ignores repeats and owner views.
    api.recordView(p.id).catch(() => {});
  };

  // Shop page (products) and personal profile page for one artisan. Moving between
  // these two pushes onto backStack; arriving from anywhere else starts a fresh stack,
  // so "Back" always unwinds to where the visitor came from (no shop <-> profile loop).
  const ARTISAN_PAGES = ["storefront", "artisan-profile"];
  const openArtisanPage = (target) => {
    setBackStack(s => ARTISAN_PAGES.includes(page) ? [...s, page] : [page]);
    navigate(target);
    window.scrollTo(0, 0);
  };
  const openStorefront = (artisan) => {
    if (!artisan?._id) return;
    setStoreArtisan(artisan);
    openArtisanPage("storefront");
  };
  const openArtisanProfile = (artisan) => {
    if (!artisan?._id) return;
    setProfileArtisan(artisan);
    openArtisanPage("artisan-profile");
  };
  // ── Artisan's own products ──
  const showSavedProduct = (product, message) => {
    showToast(message);
    refreshProducts();
    openProduct({ ...product, id: product._id });
    window.scrollTo(0, 0);
  };
  // Returns the promise so the detail page can show "Deleting…" until it settles.
  const deleteOwnProduct = (p) =>
    api.deleteProduct(p.id)
      .then(() => {
        showToast(t.addProduct.deleted);
        setSavedItems(s => s.filter(x => x !== p.id));
        refreshProducts();
        refreshCart();
        // Land on the shop the product was in; fresh back stack so "Back" can't
        // return to the deleted product's page.
        setStoreArtisan(p.artisan);
        setBackStack(["shop"]);
        navigate("storefront");
        window.scrollTo(0, 0);
      })
      .catch(handleApiError);

  const goBack = () => {
    const prev = backStack[backStack.length - 1] || "shop";
    setBackStack(s => s.slice(0, -1));
    navigate(prev);
  };
  // Prefer the freshest copy of an artisan (products reload after a profile edit).
  const liveArtisan = (a) => (a && products.find(p => p.artisan?._id === a._id)?.artisan) || a;
  // The API also returns an artisan's own hidden products (isHidden) to that artisan, so
  // they can still open them; every public list leaves them out.
  const publicProducts = products.filter(p => !p.isHidden);
  const storeArtisanLive = liveArtisan(storeArtisan);
  const profileArtisanLive = liveArtisan(profileArtisan);

  const openShop = (category = "") => { setShopCategory(category); navigate("shop"); };
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

  return (
    <div style={{ fontFamily:"'Helvetica Neue',Arial,sans-serif", background: COLORS.bg, minHeight:"100vh", color:"#222" }}>
      <style>{CSS}</style>
      <style>{THEME_CSS}</style>

      <Nav
        lang={lang} setLang={setLang}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        onSearchSubmit={() => navigate("shop")}
        cartCount={cartCount} wishlistCount={savedItems.length}
        currentUser={{ ...currentUser, avatar: currentUserAvatar }} navigate={navigate} t={t}
      />

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ position:"fixed", top:76, left:"50%", background:"#1c1c1c", color:"white", padding:"10px 20px", borderRadius:30, fontSize:13, fontWeight:500, zIndex:999, whiteSpace:"nowrap", boxShadow:"0 6px 24px rgba(0,0,0,0.22)", display:"flex", alignItems:"center", gap:8, animation:"toastIn 0.25s ease forwards" }}>
          <span style={{ fontSize:14, animation:"checkBounce 0.4s ease 0.1s both", display:"inline-block" }}>✓</span>
          {toast}
        </div>
      )}

      {/* ── HOME ── */}
      {page==="home" && (
        <Home
          lang={lang} t={t} prods={publicProducts}
          savedItems={savedItems} toggleSave={toggleSave} openProduct={openProduct}
          fmt={fmtBasic} navigate={navigate} openShop={openShop}
        />
      )}

      {page==="shop" && (
        <Shop
          lang={lang} t={t} filtered={filtered} loading={categoryLoading}
          category={shopCategory} openShop={openShop}
          searchQuery={searchQuery} clearSearch={() => setSearchQuery("")}
          savedItems={savedItems} toggleSave={toggleSave} openProduct={openProduct}
          fmt={fmtBasic} navigate={navigate}
        />
      )}

      {page==="detail" && selected && (
        <ProductDetail
          lang={lang} t={t} selected={selected} savedItems={savedItems}
          toggleSave={toggleSave} addToCart={addToCart} fmtAmt={fmtAmt}
          navigate={navigate} openStorefront={openStorefront} openArtisanProfile={openArtisanProfile}
          currentUserId={currentUser.id}
          onEdit={() => { navigate("edit-product"); window.scrollTo(0, 0); }}
          onDelete={deleteOwnProduct}
        />
      )}

      {/* Shop page and personal profile are one portfolio page; "artisan-profile" opens it at About. */}
      {ARTISAN_PAGES.includes(page) && (page==="storefront" ? storeArtisanLive : profileArtisanLive) && (() => {
        const a = page==="storefront" ? storeArtisanLive : profileArtisanLive;
        return (
          <Portfolio
            key={`${page}-${a._id}`} lang={lang} t={t} artisan={a}
            products={publicProducts.filter(p => p.artisan?._id === a._id)}
            savedItems={savedItems} toggleSave={toggleSave} openProduct={openProduct}
            fmtBasic={fmtBasic} navigate={navigate} onBack={goBack}
            focus={page==="artisan-profile" ? "about" : undefined}
          />
        );
      })()}

      {page==="cart" && (
        <Cart
          lang={lang} t={t} cart={cart} onUpdateQty={updateQty} onRemove={removeFromCart}
          onPaid={onPaid} onApiError={handleApiError} fmtAmt={fmtAmt} fmtUsd={fmtUsd} currency={currency} navigate={navigate}
        />
      )}

      {page==="commission" && (
        <ReverseAuction t={t} navigate={navigate} onSubmit={submitCommission} isArtisan={currentUser.role==="artisan"} />
      )}

      {page==="commission-board" && ["artisan","admin"].includes(currentUser.role) && (
        <CommissionBoard
          key={pageKey} t={t} fmtAmt={fmtAmt} canBid={currentUser.role==="artisan"}
          onApiError={handleApiError} showToast={showToast}
        />
      )}

      {showShopSetup && (
        <ShopSetup
          key={pageKey} t={t} onApiError={handleApiError}
          onDone={() => { setShopSetupNeeded(false); showToast(t.shopSetup.done); refreshProducts(); navigate("profile"); window.scrollTo(0, 0); }}
        />
      )}

      {page==="dashboard" && currentUser.role==="artisan" && !showShopSetup && (
        <Dashboard
          key={pageKey} t={t} lang={lang} fmtAmt={fmtAmt} fmtUsd={fmtUsd} currency={currency}
          navigate={navigate} onApiError={handleApiError}
        />
      )}

      {page==="order-detail" && orderView && (
        <OrderDetail
          key={orderView.id} t={t} lang={lang} orderId={orderView.id} fmtAmt={fmtAmt}
          onBack={() => navigate(orderView.back)} onApiError={handleApiError} showToast={showToast}
          onChanged={refreshOrders}
        />
      )}

      {page==="shop-orders" && currentUser.role==="artisan" && !showShopSetup && (
        <ShopOrders key={pageKey} t={t} fmtAmt={fmtAmt} navigate={navigate} openOrder={openOrder} onApiError={handleApiError} />
      )}

      {page==="my-commissions" && (
        <MyCommissions
          key={pageKey} t={t} fmtAmt={fmtAmt} navigate={navigate}
          onApiError={handleApiError} showToast={showToast}
        />
      )}

      {page==="shop-settings" && currentUser.role==="artisan" && !showShopSetup && (
        <ArtisanProfileForm
          key={pageKey} t={t} navigate={navigate} onApiError={handleApiError}
          onSaved={() => { showToast(t.shopSettings.saved); refreshProducts(); }}
        />
      )}

      {page==="add-product" && currentUser.role==="artisan" && !showShopSetup && (
        <AddProductForm
          key={pageKey} t={t} rateMnt={rates.MNT} onApiError={handleApiError}
          onBack={() => navigate("shop-settings")}
          onSaved={(product) => showSavedProduct(product, t.addProduct.created)}
        />
      )}

      {page==="edit-product" && !showShopSetup && selected && selected.artisan?.user?._id === currentUser.id && (
        <AddProductForm
          key={pageKey} t={t} product={selected} rateMnt={rates.MNT} onApiError={handleApiError}
          onBack={() => navigate("detail")}
          onSaved={(product) => showSavedProduct(product, t.addProduct.updated)}
        />
      )}

      {/* ── SAVED ── */}
      {page==="saved" && (
        <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
          <div className="a-page page" key={pageKey}>
            <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:24 }}>
              {t.saved} <span style={{ fontFamily:FONT_SANS, fontWeight:400, color:COLORS.inkSoft, fontSize:16 }}>({savedItems.length})</span>
            </h1>
            {savedItems.length===0 ? (
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
                    isSaved onToggleSave={toggleSave} onOpen={openProduct} price={fmtBasic(p)}
                    certifiedLabel={t.homePage.certified} wishlistAddLabel={t.homePage.wishlistAdd} wishlistRemoveLabel={t.homePage.wishlistRemove}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PROFILE ── */}
      {page==="profile" && (
        <ProfilePage
          key={pageKey} t={t} lang={lang} user={currentUser} emoji={currentUserAvatar}
          products={products} savedItems={savedItems} toggleSave={toggleSave} openProduct={openProduct}
          fmtBasic={fmtBasic} fmtAmt={fmtAmt} cartLines={cart?.items?.length || 0}
          orders={orders} openOrder={openOrder} navigate={navigate} logout={logout} shopSetupNeeded={shopSetupNeeded}
          onApiError={handleApiError}
          onUpdated={(user) => { updateCurrentUser(user); if (currentUser.role === "artisan") refreshProducts(); }}
        />
      )}
    </div>
  );
}
