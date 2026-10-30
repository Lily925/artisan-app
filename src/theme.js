export const COLORS = {
  bg: "#FDF5F7",
  bgSoft: "#FBE8EE",
  card: "#FFFBFC",
  border: "#F0D3DD",
  accent: "#E8A9BC",
  accentDark: "#C97C96",
  accentSoft: "#F0C9D6",
  ink: "#3B2A32",
  inkSoft: "#8B7480",
};

export const FONT_SERIF = "'Cormorant Garamond', Georgia, serif";
export const FONT_SANS = "'Karla', 'Helvetica Neue', Arial, sans-serif";

export const THEME_CSS = `
  .a-btn-primary{background:${COLORS.accent};color:${COLORS.ink};border:none;border-radius:2px;padding:13px 26px;font-family:${FONT_SANS};font-size:14px;font-weight:700;cursor:pointer;transition:background 0.15s,color 0.15s;min-height:44px;}
  .a-btn-primary:hover{background:${COLORS.accentDark};color:#fff;}
  .a-btn-primary:active{transform:scale(0.98);}

  .a-btn-outline{background:transparent;color:${COLORS.ink};border:1.5px solid ${COLORS.ink};border-radius:2px;padding:13px 26px;font-family:${FONT_SANS};font-size:14px;font-weight:700;cursor:pointer;transition:all 0.15s;min-height:44px;}
  .a-btn-outline:hover{background:${COLORS.ink};color:#fff;}
  .a-btn-outline:active{transform:scale(0.98);}

  .a-icon-btn{background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;width:44px;height:44px;min-width:44px;border-radius:2px;color:${COLORS.ink};transition:background 0.15s;position:relative;flex-shrink:0;}
  .a-icon-btn:hover{background:${COLORS.bgSoft};}

  .a-chip{border:1.5px solid ${COLORS.border};border-radius:2px;padding:10px 18px;font-family:${FONT_SANS};font-size:13px;font-weight:600;cursor:pointer;background:${COLORS.card};color:${COLORS.ink};transition:all 0.15s;min-height:44px;white-space:nowrap;flex-shrink:0;}
  .a-chip:hover{border-color:${COLORS.accentDark};color:${COLORS.accentDark};}
  .a-chip.selected{background:${COLORS.accent};border-color:${COLORS.accentDark};color:${COLORS.ink};}

  .a-nav-link{font-family:${FONT_SANS};font-size:12px;font-weight:700;color:${COLORS.inkSoft};background:none;border:none;cursor:pointer;padding:8px 6px;min-height:44px;transition:color 0.15s;}
  .a-nav-link:hover,.a-nav-link.active{color:${COLORS.ink};}

  /* Language + currency switcher: one segmented control, active option filled pink. */
  .a-locale-switch{border:1.5px solid ${COLORS.border};border-radius:2px;padding:2px;gap:2px;background:${COLORS.card};}
  .a-locale-btn{font-family:${FONT_SANS};font-size:12px;font-weight:700;color:${COLORS.inkSoft};background:none;border:none;border-radius:2px;cursor:pointer;padding:0 10px;min-height:38px;min-width:44px;white-space:nowrap;transition:background 0.15s,color 0.15s;}
  .a-locale-btn:hover{color:${COLORS.ink};background:${COLORS.bgSoft};}
  .a-locale-btn.active{background:${COLORS.accent};color:${COLORS.ink};}
  .a-locale-btn:focus-visible{outline:2px solid ${COLORS.accentDark};outline-offset:1px;}
  .a-locale-sym{font-weight:400;opacity:0.75;}

  .a-search-input{border:1.5px solid ${COLORS.border};border-radius:2px;padding:0 14px;font-family:${FONT_SANS};font-size:13px;height:44px;outline:none;background:${COLORS.card};color:${COLORS.ink};width:100%;}
  .a-search-input:focus{border-color:${COLORS.accentDark};box-shadow:0 0 0 3px rgba(232,169,188,0.3);}

  .a-product-card{background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:2px;overflow:hidden;display:flex;flex-direction:column;transition:transform 0.18s ease,box-shadow 0.18s ease;}
  .a-product-card:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(59,42,50,0.14);}
  .a-product-card:focus-within{box-shadow:0 0 0 3px rgba(232,169,188,0.4);}

  .a-card-link{display:block;text-decoration:none;color:inherit;}
  .a-card-link:focus-visible{outline:2px solid ${COLORS.accentDark};outline-offset:-2px;}

  .a-wishlist-btn{position:absolute;top:6px;right:6px;background:rgba(255,251,252,0.92);border:none;border-radius:2px;min-width:44px;height:44px;padding:0 10px;gap:5px;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;box-shadow:0 2px 8px rgba(59,42,50,0.16);transition:transform 0.15s;z-index:1;}
  .a-wishlist-btn:hover{transform:scale(1.06);}
  .a-like-count{font-family:${FONT_SANS};font-size:13px;font-weight:700;color:${COLORS.ink};font-variant-numeric:tabular-nums;}

  .a-badge-certified{display:inline-flex;align-items:center;gap:4px;position:absolute;bottom:8px;left:8px;background:${COLORS.card};color:${COLORS.accentDark};border:1px solid ${COLORS.accentSoft};border-radius:2px;font-family:${FONT_SANS};font-size:9px;font-weight:700;padding:4px 8px;letter-spacing:0.3px;text-transform:uppercase;}

  .a-nav-row{padding-top:12px;padding-bottom:12px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;}
  .a-nav-group{display:flex;gap:4px;flex-shrink:0;}
  .a-search-form{flex:1 1 200px;min-width:160px;}

  /* Product lists: as many ~220px+ columns as fit (desktop 4-5, tablet 2-3, phone 1-2). */
  .a-product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr));gap:20px;}
  @media (max-width:640px){.a-product-grid{gap:14px;}}
  /* Larger cards (commission requests): 2 columns on wide screens, 1 below ~900px. */
  .a-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr));gap:16px;align-items:start;}

  .a-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}

  /* The one shared page container: full width up to 1280px, centered, 24px sides
     (16px on phones). Header and footer rows use .a-container (same sides, no vertical
     padding). .a-page-form narrows it for form pages, still centered. */
  .a-container,.a-page{width:100%;max-width:1280px;margin-left:auto;margin-right:auto;padding-left:24px;padding-right:24px;}
  .a-page{padding-top:40px;padding-bottom:64px;}
  .a-page.a-page-form{max-width:calc(680px + 48px);}
  @media (max-width:640px){
    .a-container,.a-page{padding-left:16px;padding-right:16px;}
    .a-page{padding-top:24px;padding-bottom:48px;}
    .a-page.a-page-form{max-width:calc(680px + 32px);}
  }
  .a-readable{max-width:72ch;}

  /* Profile: sticky ~340px card on the left, content on the right (>= 1024px); one column below. */
  .a-profile-layout{display:grid;grid-template-columns:1fr;gap:20px;align-items:start;}
  @media (min-width:1024px){
    .a-profile-layout{grid-template-columns:340px minmax(0,1fr);gap:32px;}
    /* Sticky, but never taller than the screen: a long card scrolls on its own. */
    .a-profile-side{position:sticky;top:96px;max-height:calc(100vh - 112px);overflow-y:auto;overscroll-behavior:contain;}
  }
  .a-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;}

  /* Order detail: status + items on the left, shipping + payout on the right (>= 1024px). */
  .a-order-layout{display:grid;grid-template-columns:minmax(0,1fr);}
  .a-order-layout > *{min-width:0;}
  @media (min-width:1024px){
    .a-order-layout.has-aside{grid-template-columns:minmax(0,1fr) 380px;grid-template-areas:"status aside" "items aside";grid-template-rows:auto 1fr;column-gap:24px;align-items:start;}
    .a-order-layout.has-aside .a-order-status{grid-area:status;}
    .a-order-layout.has-aside .a-order-aside{grid-area:aside;}
    .a-order-layout.has-aside .a-order-items{grid-area:items;}
  }
  .a-breadcrumb{font-family:${FONT_SANS};font-size:12px;color:${COLORS.inkSoft};margin-bottom:20px;}
  .a-breadcrumb a{color:${COLORS.inkSoft};text-decoration:none;}
  .a-breadcrumb a:hover{color:${COLORS.ink};text-decoration:underline;}

  .a-input,.a-select,.a-textarea{border:1.5px solid ${COLORS.border};border-radius:2px;padding:11px 14px;font-family:${FONT_SANS};font-size:14px;outline:none;background:${COLORS.card};color:${COLORS.ink};width:100%;min-height:44px;}
  .a-input:focus,.a-select:focus,.a-textarea:focus{border-color:${COLORS.accentDark};box-shadow:0 0 0 3px rgba(232,169,188,0.3);}
  .a-textarea{min-height:120px;resize:vertical;font-family:${FONT_SANS};line-height:1.6;}
  .a-label{display:block;font-family:${FONT_SANS};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${COLORS.inkSoft};margin-bottom:8px;}

  .a-tier-card{border:1.5px solid ${COLORS.border};border-radius:2px;padding:14px 16px;cursor:pointer;background:${COLORS.card};transition:all 0.15s;text-align:left;font-family:${FONT_SANS};min-height:44px;}
  .a-tier-card:hover{border-color:${COLORS.accentDark};}
  .a-tier-card.selected{border-color:${COLORS.accentDark};background:${COLORS.bgSoft};box-shadow:0 0 0 1px ${COLORS.accentDark};}


  .a-callout{background:${COLORS.bgSoft};border:1px solid ${COLORS.border};border-radius:2px;padding:16px 18px;}
  .a-info-block{background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:2px;padding:18px 20px;}

  .a-qty-btn{width:32px;height:32px;min-width:32px;border:1.5px solid ${COLORS.border};background:${COLORS.card};color:${COLORS.ink};border-radius:2px;cursor:pointer;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;transition:border-color 0.15s;}
  .a-qty-btn:hover{border-color:${COLORS.accentDark};}
  .a-qty-input{width:36px;text-align:center;border:none;background:transparent;font-family:${FONT_SANS};font-size:14px;color:${COLORS.ink};}

  .a-icon-only-btn{background:none;border:1.5px solid ${COLORS.border};border-radius:2px;width:44px;height:44px;min-width:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:${COLORS.ink};transition:all 0.15s;}
  .a-icon-only-btn:hover{border-color:${COLORS.accentDark};background:${COLORS.bgSoft};}
  .a-shop-link{display:inline-flex;align-items:center;min-height:24px;background:none;border:none;padding:0;margin:0;text-align:left;cursor:pointer;color:${COLORS.ink};text-decoration:underline;text-decoration-color:transparent;text-underline-offset:3px;transition:color 0.15s,text-decoration-color 0.15s;}
  .a-shop-link:hover{color:${COLORS.accentDark};text-decoration-color:currentColor;}
  .a-shop-link:focus-visible{outline:2px solid ${COLORS.accentDark};outline-offset:2px;}

  .a-dropzone{border:1.5px dashed ${COLORS.border};border-radius:2px;background:${COLORS.bgSoft};padding:32px 16px;text-align:center;cursor:pointer;transition:border-color 0.15s;}
  .a-dropzone:hover,.a-dropzone.dragover{border-color:${COLORS.accentDark};}

  .a-step-badge{width:26px;height:26px;min-width:26px;border-radius:50%;background:${COLORS.accentSoft};color:${COLORS.ink};display:flex;align-items:center;justify-content:center;font-family:${FONT_SANS};font-size:12px;font-weight:700;flex-shrink:0;}

  .a-category-icon{width:56px;height:56px;border-radius:50%;background:${COLORS.bgSoft};border:1px solid ${COLORS.border};display:flex;align-items:center;justify-content:center;font-size:20px;margin:0 auto 8px;}

  .a-footer{background:${COLORS.ink};color:${COLORS.bgSoft};}
  .a-footer a{color:${COLORS.bgSoft};text-decoration:none;opacity:0.85;}
  .a-footer a:hover{opacity:1;text-decoration:underline;}

  .a-radio-dot{width:18px;height:18px;min-width:18px;border-radius:50%;border:1.5px solid ${COLORS.border};display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .a-radio-dot.on{border-color:${COLORS.accentDark};background:${COLORS.accentDark};}

  .a-two-col{display:grid;grid-template-columns:1fr 1fr;gap:48px;}
  @media (max-width:860px){.a-two-col{grid-template-columns:1fr;gap:32px;}}

  .a-layout-side{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:32px;align-items:start;}
  .a-layout-side > *{min-width:0;}
  /* Browsers give <fieldset> min-width:min-content, which can push a narrow column wider than the screen. */
  fieldset{min-width:0;}
  @media (max-width:900px){.a-layout-side{grid-template-columns:1fr;}}
`;
