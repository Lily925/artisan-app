import { useEffect, useState } from "react";
import { COLORS, FONT_SERIF, FONT_SANS } from "../theme";
import { api, assetUrl } from "../api";
import { placeholderEmoji } from "../placeholders";

// Status counts always shown; "paid" and "cancelled" only appear when non-zero.
const MAIN_STATUSES = ["pending", "in_production", "shipped", "completed"];
const EXTRA_STATUSES = ["paid", "cancelled"];

const fmtCount = (n) => n.toLocaleString();
const fmtPercent = (rate) => (rate === null ? "—" : `${(rate * 100).toFixed(1)}%`);
const shortDate = (day) => `${day.slice(5, 7)}/${day.slice(8, 10)}`; // "YYYY-MM-DD" -> "MM/DD"

function StatTile({ label, value, sub }) {
  return (
    <div className="a-info-block" style={{ padding:"16px 18px" }}>
      <div style={{ fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:COLORS.inkSoft, marginBottom:6 }}>{label}</div>
      <div style={{ fontFamily:FONT_SANS, fontSize:26, fontWeight:700, color:COLORS.ink, fontVariantNumeric:"tabular-nums", overflowWrap:"anywhere" }}>{value}</div>
      {sub && <div style={{ fontFamily:FONT_SANS, fontSize:11, color:COLORS.inkSoft, marginTop:4, lineHeight:1.4 }}>{sub}</div>}
    </div>
  );
}

// Small "DEMO" label next to headings whose numbers include demo data.
function DemoTag({ label }) {
  return (
    <span style={{ display:"inline-block", verticalAlign:"middle", marginLeft:8, background:COLORS.ink, color:"#fff", borderRadius:2, padding:"2px 6px", fontFamily:FONT_SANS, fontSize:11, fontWeight:700, letterSpacing:0.6 }}>
      {label}
    </span>
  );
}

// Round the axis maximum up to a clean number with 4 even steps.
function niceScale(max) {
  if (max <= 4) return { top: 4, step: 1 };
  const rough = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough);
  return { top: step * 4, step };
}

// Single-series column chart: one value per day, hover/tap a column for its tooltip.
function DailyChart({ days, field, label }) {
  const [hover, setHover] = useState(null);
  const W = 720, H = 220, PAD_L = 36, PAD_R = 8, PAD_T = 12, PAD_B = 28;
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const values = days.map((d) => d[field]);
  const { top, step } = niceScale(Math.max(...values, 0));
  const slot = plotW / days.length;
  const barW = Math.min(24, slot - 2); // 2px surface gap between neighbours
  const y = (v) => PAD_T + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: 5 }, (_, i) => i * step);
  const total = values.reduce((s, v) => s + v, 0);

  // Column with a 4px rounded top, square at the baseline.
  const column = (x, v) => {
    const h = Math.max(0, (v / top) * plotH);
    if (h === 0) return null;
    const r = Math.min(4, h, barW / 2);
    const yTop = PAD_T + plotH - h, yBase = PAD_T + plotH;
    return `M${x},${yBase} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${yBase} Z`;
  };

  const hovered = hover === null ? null : days[hover];
  return (
    <div style={{ position:"relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
        aria-label={`${label}: ${shortDate(days[0].date)}–${shortDate(days[days.length - 1].date)}, ${total}`}
        style={{ display:"block", overflow:"visible" }} onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(tick)} y2={y(tick)} stroke={COLORS.border} strokeWidth="1" />
            <text x={PAD_L - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle"
              style={{ fontFamily:FONT_SANS, fontSize:11, fill:COLORS.inkSoft }}>{fmtCount(tick)}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = PAD_L + i * slot + (slot - barW) / 2;
          const showLabel = i % 5 === 0 || i === days.length - 1;
          return (
            <g key={d.date}>
              {/* full-height hit target, wider than the column */}
              <rect x={PAD_L + i * slot} y={PAD_T} width={slot} height={plotH} fill={hover === i ? COLORS.bgSoft : "transparent"}
                onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
              <path d={column(x, d[field]) || ""} fill={COLORS.accentDark} pointerEvents="none" />
              {showLabel && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" style={{ fontFamily:FONT_SANS, fontSize:11, fill:COLORS.inkSoft }}>
                  {shortDate(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div role="status" style={{
          position:"absolute", top:0,
          left:`clamp(0px, calc(${((PAD_L + (hover + 0.5) * slot) / W) * 100}% - 70px), calc(100% - 140px))`,
          width:140, background:COLORS.ink, color:"#fff", borderRadius:2, padding:"8px 10px",
          fontFamily:FONT_SANS, fontSize:12, lineHeight:1.4, pointerEvents:"none", boxShadow:"0 4px 14px rgba(59,42,50,0.2)",
        }}>
          <div style={{ opacity:0.8 }}>{hovered.date}</div>
          <div style={{ fontWeight:700 }}>{label}: {fmtCount(hovered[field])}</div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ t, lang, fmtAmt, rateMnt, currency, navigate, onApiError }) {
  const d = t.dashboard;
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [metric, setMetric] = useState("units");
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let stale = false;
    api.getMyDashboard()
      .then((res) => { if (!stale) setData(res); })
      .catch((err) => {
        if (stale) return;
        if (err.status === 401) onApiError(err);
        setFailed(true);
      });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const page = (children) => (
    <div style={{ background:COLORS.bg, minHeight:"100vh" }}>
      <div className="a-page" style={{ maxWidth:1000 }}>
        <button type="button" className="a-shop-link" style={{ fontFamily:FONT_SANS, fontSize:13, marginBottom:16 }} onClick={() => navigate("profile")}>
          ‹ {d.back}
        </button>
        <h1 style={{ fontFamily:FONT_SERIF, fontSize:30, fontWeight:600, color:COLORS.ink, marginBottom:8 }}>{d.title}</h1>
        {children}
      </div>
    </div>
  );

  if (failed) return page(<p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>{d.loadError}</p>);
  if (!data) return page(<p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>…</p>);

  const { totals, statusCounts, products, daily } = data;
  const demo = data.demo || { orders: 0, views: 0 };
  const hasDemo = demo.orders > 0 || demo.views > 0;
  const mnt = (usd) => `₮${Math.round(usd * rateMnt).toLocaleString()}`;
  const productName = (p) => (lang === "mn" ? p.title : p.titleEn || p.title);
  const statuses = [...MAIN_STATUSES, ...EXTRA_STATUSES.filter((s) => statusCounts[s] > 0)];
  const field = metric === "units" ? "units" : "views";
  const metricLabel = metric === "units" ? d.chartSales : d.chartViews;
  const chartTotal = daily.reduce((s, x) => s + x[field], 0);
  const th = { fontFamily:FONT_SANS, fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:0.4, color:COLORS.inkSoft, textAlign:"right", padding:"10px 12px", borderBottom:`1px solid ${COLORS.border}`, whiteSpace:"nowrap" };
  const td = { fontFamily:FONT_SANS, fontSize:14, color:COLORS.ink, textAlign:"right", padding:"10px 12px", borderBottom:`1px solid ${COLORS.border}`, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap" };

  return page(
    <>
      <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, lineHeight:1.6, marginBottom:4 }}>{d.intro}</p>
      <p style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginBottom:20 }}>
        {d.updated(new Date(data.generatedAt).toLocaleString([], { dateStyle:"medium", timeStyle:"short" }))}
      </p>

      <div className="a-callout" role="note" style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, lineHeight:1.6, marginBottom:24 }}>
        <strong aria-hidden="true">ⓘ </strong>{d.note}
        <div style={{ color:COLORS.inkSoft, marginTop:4 }}>{d.privacy}</div>
      </div>

      {hasDemo && (
        <div role="note" style={{ background:COLORS.bgSoft, border:`2px dashed ${COLORS.accentDark}`, borderRadius:2, padding:"14px 18px", marginBottom:16, fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink, lineHeight:1.6 }}>
          <strong>{d.demoTitle}</strong><DemoTag label={d.demoTag} />
          <div style={{ marginTop:4 }}>{d.demoNote(fmtCount(demo.orders), fmtCount(totals.orders), fmtCount(demo.views), fmtCount(totals.views))}</div>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:12, marginBottom:12 }}>
        <StatTile label={d.orders} value={fmtCount(totals.orders)} />
        <StatTile label={d.unitsSold} value={fmtCount(totals.unitsSold)} />
        <StatTile label={d.revenue} value={fmtAmt(totals.revenue)}
          sub={currency === "MNT" ? d.revenueHint : `${mnt(totals.revenue)} · ${d.revenueHint}`} />
        <StatTile label={d.views} value={fmtCount(totals.views)} />
        <StatTile label={d.likes} value={fmtCount(totals.likes)} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:12, marginBottom:32 }}>
        <div className="a-info-block" style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:COLORS.inkSoft, marginBottom:6 }}>{d.uniqueBuyers}</div>
            <div style={{ fontFamily:FONT_SANS, fontSize:22, fontWeight:700, color:COLORS.ink }}>{fmtCount(totals.uniqueBuyers)}</div>
          </div>
          <div>
            <div style={{ fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:COLORS.inkSoft, marginBottom:6 }}>{d.repeatBuyers}</div>
            <div style={{ fontFamily:FONT_SANS, fontSize:22, fontWeight:700, color:COLORS.ink }}>{fmtCount(totals.repeatBuyers)}</div>
            <div style={{ fontFamily:FONT_SANS, fontSize:11, color:COLORS.inkSoft }}>{d.repeatHint}</div>
          </div>
        </div>
        <div className="a-info-block">
          <div style={{ fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:COLORS.inkSoft, marginBottom:10 }}>{d.statusTitle}</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {statuses.map((s) => (
              <span key={s} style={{ display:"inline-flex", gap:6, alignItems:"baseline", background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, padding:"6px 10px", fontFamily:FONT_SANS, fontSize:13, color:COLORS.ink }}>
                {d.status[s]} <strong style={{ fontVariantNumeric:"tabular-nums" }}>{fmtCount(statusCounts[s] || 0)}</strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      <section className="a-info-block" style={{ marginBottom:32 }} aria-labelledby="dash-chart-title">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexWrap:"wrap", marginBottom:12 }}>
          <div>
            <h2 id="dash-chart-title" style={{ fontFamily:FONT_SERIF, fontSize:22, fontWeight:600, color:COLORS.ink, margin:0 }}>{d.chartTitle} · {metricLabel}{hasDemo && <DemoTag label={d.demoTag} />}</h2>
            <div style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft }}>{d.chartTotal(fmtCount(chartTotal))}</div>
          </div>
          <div role="group" aria-label={d.chartTitle} style={{ display:"flex", gap:8 }}>
            {[["units", d.chartSales], ["views", d.chartViews]].map(([key, lbl]) => (
              <button key={key} type="button" className={`a-chip${metric === key ? " selected" : ""}`} aria-pressed={metric === key} onClick={() => setMetric(key)}>{lbl}</button>
            ))}
          </div>
        </div>
        {chartTotal === 0 ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:160, background:COLORS.bgSoft, border:`1px dashed ${COLORS.border}`, borderRadius:2, padding:"24px 16px", textAlign:"center", fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, lineHeight:1.6 }}>
            {d.chartEmpty[field]}
          </div>
        ) : (<>
        <DailyChart days={daily} field={field} label={metricLabel} />
        <button type="button" className="a-shop-link" style={{ fontFamily:FONT_SANS, fontSize:12, marginTop:10 }} aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
          {showTable ? d.hideTable : d.showTable}
        </button>
        {showTable && (
          <div style={{ overflowX:"auto", marginTop:8, maxHeight:320, overflowY:"auto" }}>
            <table style={{ borderCollapse:"collapse", width:"100%" }}>
              <thead><tr>
                <th style={{ ...th, textAlign:"left" }}>{d.date}</th>
                <th style={th}>{d.orders}</th><th style={th}>{d.chartSales}</th><th style={th}>{d.revenue}</th><th style={th}>{d.chartViews}</th>
              </tr></thead>
              <tbody>
                {[...daily].reverse().map((row) => (
                  <tr key={row.date}>
                    <td style={{ ...td, textAlign:"left" }}>{row.date}</td>
                    <td style={td}>{row.orders}</td><td style={td}>{row.units}</td><td style={td}>{fmtAmt(row.revenue)}</td><td style={td}>{row.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>)}
      </section>

      <section aria-labelledby="dash-products-title">
        <h2 id="dash-products-title" style={{ fontFamily:FONT_SERIF, fontSize:22, fontWeight:600, color:COLORS.ink, marginBottom:12 }}>{d.tableTitle}{hasDemo && <DemoTag label={d.demoTag} />}</h2>
        {products.length === 0 ? (
          <p style={{ fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft }}>{d.noProducts}</p>
        ) : (
          <div className="a-info-block" style={{ padding:0, overflowX:"auto" }}>
            <table style={{ borderCollapse:"collapse", width:"100%", minWidth:640 }}>
              <thead><tr>
                <th style={{ ...th, textAlign:"left" }}>{d.product}</th>
                <th style={th}>{d.unitsSold}</th>
                <th style={th}>{d.revenue}</th>
                <th style={th}>{d.views}</th>
                <th style={th}>{d.likes}</th>
                <th style={th} title={d.conversionHint}>{d.conversion}<div style={{ fontWeight:400, textTransform:"none", letterSpacing:0 }}>{d.conversionHint}</div></th>
              </tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td style={{ ...td, textAlign:"left", whiteSpace:"normal" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:40, height:40, flexShrink:0, background:COLORS.bgSoft, border:`1px solid ${COLORS.border}`, borderRadius:2, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {p.image
                            ? <img src={assetUrl(p.image)} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                            : <span aria-hidden="true">{placeholderEmoji(p.category)}</span>}
                        </div>
                        <span style={{ overflowWrap:"anywhere" }}>
                          {productName(p)} {p.deleted && <span style={{ color:COLORS.inkSoft }}>{d.deleted}</span>}
                        </span>
                      </div>
                    </td>
                    <td style={td}>{fmtCount(p.unitsSold)}</td>
                    <td style={td}>{fmtAmt(p.revenue)}</td>
                    <td style={td}>{p.deleted ? "—" : fmtCount(p.viewCount)}</td>
                    <td style={td}>{p.deleted ? "—" : fmtCount(p.likeCount)}</td>
                    <td style={td}>{fmtPercent(p.conversionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
