import { useState, useEffect } from "react";
import { COLORS, THEME_CSS } from "./theme";
import { i18n } from "./data";
import { placeholderEmoji } from "./placeholders";
import { api, setToken, getToken, ApiError, assetUrl } from "./api";
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
import Storefront from "./components/Storefront";
import ArtisanProfile from "./components/ArtisanProfile";

const AVATAR_BY_ROLE = { admin: "🧑‍💼", artisan: "👩‍🎨", buyer: "🛍" };
const DEMO_ACCOUNTS = [
  { name: "Admin", email: "admin@artisan.mn", password: "artisan123" },
  { name: "Narantsetseg", email: "narantsetseg@artisan.mn", password: "artisan123" },
  { name: "Buyer Demo", email: "buyer@artisan.mn", password: "artisan123" },
];

function LoginPage({ onLogin, onRegister, lang }) {
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const lbl = lang==="mn"
    ? { login:"Нэвтрэх", register:"Бүртгүүлэх", email:"Имэйл", pw:"Нууц үг", name:"Нэр", loginBtn:"Нэвтрэх", registerBtn:"Бүртгүүлэх", noAcc:"Бүртгэл байхгүй юу?", hasAcc:"Бүртгэл байна уу?", wrongPw:"Имэйл эсвэл нууц үг буруу", demo:"Туршилтаар нэвтрэх:", appSub:"Монгол гар урлалын зах зээл", fillAll:"Бүх талбарыг бөглөнө үү" }
    : lang==="ko"
    ? { login:"로그인", register:"회원가입", email:"이메일", pw:"비밀번호", name:"이름", loginBtn:"로그인", registerBtn:"회원가입", noAcc:"계정이 없으신가요?", hasAcc:"이미 계정이 있으신가요?", wrongPw:"이메일 또는 비밀번호가 틀렸습니다", demo:"데모 로그인:", appSub:"몽골 전통 공예 마켓", fillAll:"모든 항목을 입력해주세요" }
    : { login:"Login", register:"Register", email:"Email", pw:"Password", name:"Name", loginBtn:"Login", registerBtn:"Create Account", noAcc:"Don't have an account?", hasAcc:"Already have an account?", wrongPw:"Incorrect email or password", demo:"Demo login:", appSub:"Mongolian Handmade Marketplace", fillAll:"Please fill all fields" };

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
      await onRegister(name, email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : lbl.wrongPw);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#fdf6ee 0%,#f5ede0 100%)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px", fontFamily:"'Helvetica Neue',Arial,sans-serif" }}>
      <style>{`
        @keyframes loginFade { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .login-card { animation: loginFade 0.35s ease forwards; }
        .login-input { width:100%; border:1.5px solid #e8e2da; border-radius:10px; padding:11px 14px; font-size:14px; outline:none; box-sizing:border-box; background:#faf8f5; transition:border-color 0.2s, box-shadow 0.2s; font-family:inherit; }
        .login-input:focus { border-color:#e05d26; box-shadow:0 0 0 3px rgba(224,93,38,0.1); background:white; }
        .demo-btn { display:flex; align-items:center; gap:10px; width:100%; background:#faf8f5; border:1px solid #ede8e0; border-radius:10px; padding:10px 14px; margin-bottom:8px; cursor:pointer; text-align:left; box-sizing:border-box; transition:all 0.15s; }
        .demo-btn:hover { background:#fff4ee; border-color:#e05d26; transform:translateX(2px); }
      `}</style>
      <div className="login-card" style={{ width:"100%", maxWidth:390 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontFamily:"Georgia,serif", fontSize:40, fontWeight:700, color:"#e05d26", letterSpacing:-1 }}>artisan</div>
          <div style={{ fontSize:11, color:"#c4a882", letterSpacing:2.5, textTransform:"uppercase", marginTop:4 }}>{lbl.appSub}</div>
        </div>

        <div style={{ background:"white", borderRadius:20, padding:"28px 24px", boxShadow:"0 8px 40px rgba(0,0,0,0.08)", marginBottom:14 }}>
          <div style={{ display:"flex", background:"#f5f2ee", borderRadius:12, padding:3, marginBottom:22 }}>
            {["login","register"].map(tb => (
              <button key={tb} onClick={() => { setTab(tb); setError(""); }} style={{ flex:1, padding:"9px 0", border:"none", borderRadius:10, fontWeight:600, fontSize:14, cursor:"pointer", background:tab===tb?"white":"transparent", color:tab===tb?"#e05d26":"#999", boxShadow:tab===tb?"0 2px 8px rgba(0,0,0,0.08)":"none", transition:"all 0.2s" }}>
                {tb==="login"?lbl.login:lbl.register}
              </button>
            ))}
          </div>

          {tab==="register" && (
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, color:"#aaa", display:"block", marginBottom:5, fontWeight:500 }}>{lbl.name}</label>
              <input className="login-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Narantsetseg" />
            </div>
          )}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, color:"#aaa", display:"block", marginBottom:5, fontWeight:500 }}>{lbl.email}</label>
            <input className="login-input" value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="you@example.com" onKeyDown={e=>e.key==="Enter"&&(tab==="login"?handleLogin():handleRegister())} />
          </div>
          <div style={{ marginBottom:20, position:"relative" }}>
            <label style={{ fontSize:12, color:"#aaa", display:"block", marginBottom:5, fontWeight:500 }}>{lbl.pw}</label>
            <input className="login-input" value={password} onChange={e=>setPassword(e.target.value)} type={showPw?"text":"password"} placeholder="••••••••" style={{ paddingRight:42 }} onKeyDown={e=>e.key==="Enter"&&(tab==="login"?handleLogin():handleRegister())} />
            <button onClick={()=>setShowPw(!showPw)} style={{ position:"absolute", right:12, top:30, background:"none", border:"none", cursor:"pointer", fontSize:15, color:"#bbb" }}>{showPw?"🙈":"👁"}</button>
          </div>

          {error && <div style={{ background:"#fff0ef", border:"1px solid #ffc5c0", borderRadius:10, padding:"9px 14px", fontSize:12, color:"#c0392b", marginBottom:14, display:"flex", alignItems:"center", gap:6 }}>⚠️ {error}</div>}

          <button disabled={busy} onClick={tab==="login"?()=>handleLogin():handleRegister} style={{ width:"100%", background:"linear-gradient(135deg,#e05d26,#c94f1e)", color:"white", border:"none", borderRadius:26, padding:"13px 0", fontSize:15, fontWeight:700, cursor:busy?"default":"pointer", opacity:busy?0.7:1, boxShadow:"0 4px 14px rgba(224,93,38,0.35)", transition:"transform 0.1s, box-shadow 0.15s" }}>
            {busy ? "…" : (tab==="login"?lbl.loginBtn:lbl.registerBtn)}
          </button>
          <div style={{ textAlign:"center", marginTop:16, fontSize:13, color:"#aaa" }}>
            {tab==="login"?lbl.noAcc:lbl.hasAcc}{" "}
            <span onClick={()=>setTab(tab==="login"?"register":"login")} style={{ color:"#e05d26", cursor:"pointer", fontWeight:600 }}>{tab==="login"?lbl.register:lbl.login}</span>
          </div>
        </div>

        <div style={{ background:"white", borderRadius:16, padding:"16px 18px", border:"1px solid #ede8e0", boxShadow:"0 2px 12px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize:10, color:"#ccc", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10, fontWeight:600 }}>{lbl.demo}</div>
          {DEMO_ACCOUNTS.map(u => (
            <button key={u.email} className="demo-btn" disabled={busy} onClick={() => handleLogin(u.email, u.password)}>
              <span style={{ fontSize:22 }}>{AVATAR_BY_ROLE[u.email.startsWith("admin")?"admin":u.email.startsWith("narantsetseg")?"artisan":"buyer"]}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#222" }}>{u.name}</div>
                <div style={{ fontSize:11, color:"#bbb" }}>{u.email}</div>
              </div>
              <span style={{ fontSize:13, color:"#e05d26", fontWeight:700 }}>→</span>
            </button>
          ))}
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
  const [lang, setLang] = useState("en");
  const [page, setPage] = useState("home");
  const [pageKey, setPageKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [storeArtisan, setStoreArtisan] = useState(null); // artisan whose storefront is open
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
  const [currency, setCurrency] = useState("USD");
  const [rates, setRates] = useState({ MNT: 3450, KRW: 1380 });
  const [ratesUpdated, setRatesUpdated] = useState(null);

  // Likes replaced the old browser-only wishlist; drop its leftover storage key.
  useEffect(() => { try { localStorage.removeItem("artisan-saved"); } catch {} }, []);
  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then(r => r.json())
      .then(d => {
        if (d.rates) {
          setRates({ MNT: d.rates.MNT, KRW: d.rates.KRW });
          setRatesUpdated(new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }));
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

  // Cart, order history and likes are per-user — (re)load on login, clear on logout.
  useEffect(() => {
    if (currentUser) { refreshCart(); refreshOrders(); api.getMyLikes().then(setSavedItems).catch(handleApiError); }
    else { setCart(null); setOrders([]); setSavedItems([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const handleLogin = async (email, password) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    localStorage.setItem("artisan-user", JSON.stringify(user));
    setCurrentUser(user);
  };
  const handleRegister = async (name, email, password) => {
    const { token, user } = await api.signup(name, email, password, "buyer");
    setToken(token);
    localStorage.setItem("artisan-user", JSON.stringify(user));
    setCurrentUser(user);
  };

  if (!currentUser) return <LoginPage onLogin={handleLogin} onRegister={handleRegister} lang={lang} />;

  const t = i18n[lang];
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
  const storeProducts = storeArtisan ? products.filter(p => p.artisan?._id === storeArtisan._id) : [];
  const storeArtisanLive = liveArtisan(storeArtisan);
  const profileArtisanLive = liveArtisan(profileArtisan);

  const openShop = (category = "") => { setShopCategory(category); navigate("shop"); };
  const categoryLoading = Boolean(shopCategory) && categoryIds === null;
  const filtered = products.filter(p => {
    if (shopCategory && !categoryIds?.includes(p.id)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (lang==="mn" ? p.title : p.titleEn || p.title) || "";
    const artisanName = p.artisan?.user?.name || "";
    const shopName = p.artisan?.shopName || "";
    return name.toLowerCase().includes(q) || artisanName.toLowerCase().includes(q) || shopName.toLowerCase().includes(q);
  });

  // ── Currency helpers: prices are stored in USD, shown in the selected currency ──
  const fmtAmt = (usd) => {
    if (currency === "MNT") return `₮${Math.round(usd * rates.MNT).toLocaleString()}`;
    if (currency === "KRW") return `₩${Math.round(usd * rates.KRW).toLocaleString()}`;
    return `$${usd.toFixed(2)}`;
  };
  const fmtBasic = (p) => fmtAmt(p.pricingTiers.basic.price);
  const cartCount = cart?.items?.reduce((s, i) => s + i.qty, 0) || 0;

  return (
    <div style={{ fontFamily:"'Helvetica Neue',Arial,sans-serif", background: page==="home" ? COLORS.bg : "#f5f2ee", minHeight:"100vh", color:"#222" }}>
      <style>{CSS}</style>
      <style>{THEME_CSS}</style>

      <Nav
        lang={lang} setLang={setLang}
        currency={currency} setCurrency={setCurrency}
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
          lang={lang} t={t} prods={products}
          savedItems={savedItems} toggleSave={toggleSave} openProduct={openProduct}
          fmt={fmtBasic} navigate={navigate} openShop={openShop}
        />
      )}

      {page==="shop" && (
        <Shop
          lang={lang} t={t} filtered={filtered} loading={categoryLoading}
          category={shopCategory} openShop={openShop}
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

      {page==="storefront" && storeArtisanLive && (
        <Storefront
          lang={lang} t={t} artisan={storeArtisanLive} products={storeProducts}
          savedItems={savedItems} toggleSave={toggleSave} openProduct={openProduct}
          fmt={fmtBasic} navigate={navigate} openArtisanProfile={openArtisanProfile}
          onBack={goBack}
        />
      )}

      {page==="artisan-profile" && profileArtisanLive && (
        <ArtisanProfile
          t={t} artisan={profileArtisanLive} navigate={navigate}
          openStorefront={openStorefront} onBack={goBack}
        />
      )}

      {page==="cart" && (
        <Cart
          lang={lang} t={t} cart={cart} onUpdateQty={updateQty} onRemove={removeFromCart}
          onPaid={onPaid} onApiError={handleApiError} fmtAmt={fmtAmt} navigate={navigate}
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

      {page==="dashboard" && currentUser.role==="artisan" && (
        <Dashboard
          key={pageKey} t={t} lang={lang} fmtAmt={fmtAmt} rateMnt={rates.MNT} currency={currency}
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

      {page==="shop-orders" && currentUser.role==="artisan" && (
        <ShopOrders key={pageKey} t={t} fmtAmt={fmtAmt} navigate={navigate} openOrder={openOrder} onApiError={handleApiError} />
      )}

      {page==="my-commissions" && (
        <MyCommissions
          key={pageKey} t={t} fmtAmt={fmtAmt} navigate={navigate}
          onApiError={handleApiError} showToast={showToast}
        />
      )}

      {page==="shop-settings" && currentUser.role==="artisan" && (
        <ArtisanProfileForm
          key={pageKey} t={t} navigate={navigate} onApiError={handleApiError}
          onSaved={() => { showToast(t.shopSettings.saved); refreshProducts(); }}
        />
      )}

      {page==="add-product" && currentUser.role==="artisan" && (
        <AddProductForm
          key={pageKey} t={t} rateMnt={rates.MNT} onApiError={handleApiError}
          onBack={() => navigate("shop-settings")}
          onSaved={(product) => showSavedProduct(product, t.addProduct.created)}
        />
      )}

      {page==="edit-product" && selected && selected.artisan?.user?._id === currentUser.id && (
        <AddProductForm
          key={pageKey} t={t} product={selected} rateMnt={rates.MNT} onApiError={handleApiError}
          onBack={() => navigate("detail")}
          onSaved={(product) => showSavedProduct(product, t.addProduct.updated)}
        />
      )}

      <div style={{ display: ["home","shop","detail","cart","commission","commission-board","my-commissions","dashboard","order-detail","shop-orders","shop-settings","add-product","edit-product","storefront","artisan-profile"].includes(page) ? "none" : "block", maxWidth:430, margin:"0 auto", position:"relative" }}>

      {/* ── SAVED ── */}
      {page==="saved" && (
        <div className="page" key={pageKey} style={{ padding:"18px 16px 90px", minHeight:"100vh" }}>
          <div style={{ fontWeight:700, fontSize:18, marginBottom:18, color:"#111" }}>
            {t.saved} <span style={{ fontWeight:400, color:"#bbb", fontSize:15 }}>({savedItems.length})</span>
          </div>
          {savedItems.length===0 ? (
            <div style={{ textAlign:"center", padding:"70px 0" }}>
              <div style={{ fontSize:52, marginBottom:14 }}>🤍</div>
              <div style={{ fontSize:15, color:"#555", marginBottom:6 }}>{t.savedEmpty}</div>
              <div style={{ fontSize:13, color:"#bbb", marginBottom:26 }}>{t.savedHint}</div>
              <button className="ebtn" onClick={() => navigate("home")}>{t.browseItems}</button>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {products.filter(p => savedItems.includes(p.id)).map(p => (
                <div key={p.id} className="pcard" style={{ background:"white", borderRadius:14, overflow:"hidden", border:"1px solid #ede8e0" }} onClick={() => openProduct(p)}>
                  <div style={{ position:"relative", paddingBottom:"100%", background:"#f5f1ec" }}>
                    {p.images?.[0]
                      ? <img src={assetUrl(p.images[0])} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
                      : <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:50 }}>{placeholderEmoji(p.category)}</div>
                    }
                    <button className="save-pill" onClick={e=>toggleSave(p.id,e)}>❤️</button>
                  </div>
                  <div style={{ padding:"10px 12px 13px" }}>
                    <div style={{ fontSize:12, lineHeight:1.35, marginBottom:4, fontWeight:500, color:"#111" }}>{lang==="mn" ? p.title : p.titleEn || p.title}</div>
                    <div style={{ fontWeight:700, fontSize:14, color:"#111" }}>{fmtBasic(p)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PROFILE ── */}
      {page==="profile" && (
        <div className="page" key={pageKey} style={{ padding:"20px 16px 90px", minHeight:"100vh" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
            <button onClick={() => navigate("home")} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#666" }}>‹</button>
            <div style={{ fontWeight:700, fontSize:18, color:"#111" }}>{t.profile}</div>
          </div>
          <div style={{ background:"white", borderRadius:18, padding:"28px 20px", border:"1px solid #ede8e0", marginBottom:14, textAlign:"center" }}>
            <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#fdf0e0,#fce0c0)", border:"3px solid #e05d26", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, margin:"0 auto 12px", boxShadow:"0 4px 14px rgba(224,93,38,0.2)" }}>{currentUserAvatar}</div>
            <div style={{ fontWeight:700, fontSize:20, marginBottom:4, color:"#111" }}>{currentUser.name}</div>
            <div style={{ fontSize:13, color:"#bbb", marginBottom:10 }}>{currentUser.email}</div>
            <div style={{ display:"inline-block", background:"#fff0eb", color:"#e05d26", border:"1px solid #fddcc8", borderRadius:20, padding:"4px 14px", fontSize:12, fontWeight:600 }}>{currentUser.role}</div>
            {currentUser.role === "artisan" && (
              <div style={{ marginTop:16, display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                <button type="button" className="ebtn" style={{ padding:"10px 20px", fontSize:13 }} onClick={() => navigate("dashboard")}>
                  {t.dashboard.open}
                </button>
                <button type="button" className="ebtn" style={{ padding:"10px 20px", fontSize:13 }} onClick={() => navigate("shop-orders")}>
                  {t.orders.shopOpen}
                </button>
                <button type="button" className="ebtn" style={{ padding:"10px 20px", fontSize:13 }} onClick={() => navigate("add-product")}>
                  {t.addProduct.open}
                </button>
                <button type="button" className="obtn" style={{ padding:"10px 20px", fontSize:13 }} onClick={() => navigate("shop-settings")}>
                  {t.shopSettings.open}
                </button>
                <button type="button" className="obtn" style={{ padding:"10px 20px", fontSize:13 }} onClick={() => navigate("commission-board")}>
                  {t.commissions.boardOpen}
                </button>
              </div>
            )}
            <div style={{ marginTop:12 }}>
              <button type="button" className="obtn" style={{ padding:"10px 20px", fontSize:13 }} onClick={() => navigate("my-commissions")}>
                {t.commissions.mineOpen}
              </button>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
            {[[cart?.items?.length || 0,"🛒",t.cart],[savedItems.length,"🤍",t.saved]].map(([val,icon,lbl]) => (
              <div key={lbl} style={{ background:"white", borderRadius:14, padding:"18px 16px", border:"1px solid #ede8e0", textAlign:"center" }}>
                <div style={{ fontSize:22, marginBottom:4 }}>{icon}</div>
                <div style={{ fontFamily:"Georgia,serif", fontSize:28, fontWeight:700, color:"#e05d26" }}>{val}</div>
                <div style={{ fontSize:12, color:"#bbb", marginTop:2 }}>{lbl}</div>
              </div>
            ))}
          </div>

          <div style={{ background:"white", borderRadius:14, padding:"16px 18px", border:"1px solid #ede8e0", marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12, color:"#111" }}>{t.orders.historyTitle}</div>
            {orders.length === 0 ? (
              <div style={{ fontSize:13, color:"#bbb" }}>{t.orders.none}</div>
            ) : (
              orders.map(o => (
                <button key={o._id} type="button" onClick={() => openOrder(o._id)}
                  style={{ display:"flex", width:"100%", justifyContent:"space-between", alignItems:"center", padding:"10px 0", background:"none", border:"none", borderBottom:"1px solid #f0ece8", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#222" }}>{t.orders.items(o.items.length)}</div>
                    <div style={{ fontSize:11, color:"#bbb" }}>{new Date(o.createdAt).toLocaleDateString()} · {t.orders.status[o.status] || o.status}</div>
                  </div>
                  <div style={{ fontWeight:700, fontSize:14, color:"#e05d26" }}>{fmtAmt(o.total)} ›</div>
                </button>
              ))
            )}
          </div>

          <button onClick={logout} style={{ width:"100%", background:"white", color:"#e05d26", border:"1.5px solid #e05d26", borderRadius:26, padding:"13px 0", fontSize:15, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
            {t.logout}
          </button>
        </div>
      )}

      </div>
    </div>
  );
}
