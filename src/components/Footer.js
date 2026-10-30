import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";

export default function Footer({ t, navigate }) {
  const shop = t.shopPage;

  const link = (label, page) => (
    <a
      href="/"
      onClick={(e) => { e.preventDefault(); navigate(page); }}
      style={{ display:"block", fontFamily:FONT_SANS, fontSize:13, padding:"4px 0" }}
    >
      {label}
    </a>
  );

  return (
    <footer className="a-footer">
      <div className="a-container" style={{ paddingTop:48, paddingBottom:48, display:"flex", flexWrap:"wrap", justifyContent:"space-between", gap:32 }}>
        <div style={{ fontFamily:FONT_SERIF, fontSize:24, fontWeight:700, color:COLORS.card }}>Artisan</div>
        <div style={{ display:"flex", gap:64, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, letterSpacing:0.5, opacity:0.6, marginBottom:10 }}>{shop.footerBuyers}</div>
            {link(shop.footerShop, "shop")}
            {link(shop.footerCommission, "commission")}
          </div>
          <div>
            <div style={{ fontFamily:FONT_SANS, fontSize:11, fontWeight:700, letterSpacing:0.5, opacity:0.6, marginBottom:10 }}>{shop.footerArtisans}</div>
            {link(shop.footerCertified, "profile")}
            {link(shop.footerOpenShop, "profile")}
          </div>
        </div>
      </div>
      <div style={{ borderTop:"1px solid rgba(255,255,255,0.12)" }}>
        <div className="a-container" style={{ paddingTop:16, paddingBottom:16, textAlign:"center", fontFamily:FONT_SANS, fontSize:11, opacity:0.6 }}>
          {shop.copyright}
        </div>
      </div>
    </footer>
  );
}
