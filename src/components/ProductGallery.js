import { useEffect, useState } from "react";
import { COLORS, FONT_SANS } from "../theme";
import ProductImage from "./ProductImage";

const CSS = `
  .pg-main{position:relative;aspect-ratio:1;background:${COLORS.bgSoft};border:1px solid ${COLORS.border};border-radius:2px;overflow:hidden;}
  .pg-main:focus-visible{outline:2px solid ${COLORS.accentDark};outline-offset:2px;}
  .pg-arrow{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:1px solid ${COLORS.border};background:rgba(255,251,252,0.92);color:${COLORS.ink};font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(59,42,50,0.16);}
  .pg-arrow:hover{background:${COLORS.accent};}
  .pg-arrow.prev{left:10px;} .pg-arrow.next{right:10px;}
  .pg-count{position:absolute;bottom:10px;right:10px;background:rgba(59,42,50,0.72);color:#fff;font-family:${FONT_SANS};font-size:12px;font-weight:700;padding:3px 9px;border-radius:2px;}
  .pg-thumbs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:12px;list-style:none;padding:0;}
  .pg-thumb{position:relative;display:block;width:100%;aspect-ratio:1;padding:0;border:1.5px solid ${COLORS.border};border-radius:2px;overflow:hidden;cursor:pointer;background:${COLORS.bgSoft};}
  .pg-thumb:hover{border-color:${COLORS.accentDark};}
  .pg-thumb[aria-current="true"]{border-color:${COLORS.accentDark};box-shadow:0 0 0 1px ${COLORS.accentDark};}
  .pg-thumb:focus-visible{outline:2px solid ${COLORS.accentDark};outline-offset:2px;}
`;

// Product page photos: the selected photo large, thumbnails to switch (only with 2+ photos),
// ‹ › buttons on the photo and ←/→ keys when it's focused. images[0] (the cover) shows first.
export default function ProductGallery({ images = [], name, labels }) {
  const list = images.filter(Boolean);
  const [index, setIndex] = useState(0);
  // A different product (or an edited photo list) starts again at the cover.
  const key = list.join("|");
  useEffect(() => setIndex(0), [key]);

  const count = list.length;
  const current = Math.min(index, Math.max(count - 1, 0));
  const go = (delta) => setIndex((i) => (i + delta + count) % count);
  const many = count > 1;
  const alt = many ? `${name} · ${labels.photoOf(current + 1, count)}` : name;

  return (
    <div>
      <style>{CSS}</style>
      <div className="pg-main" tabIndex={many ? 0 : undefined} aria-roledescription={many ? "carousel" : undefined}
        aria-label={many ? labels.photoOf(current + 1, count) : undefined}
        onKeyDown={(e) => { if (!many) return; if (e.key === "ArrowRight") { e.preventDefault(); go(1); } if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); } }}>
        <ProductImage key={list[current] || "none"} src={list[current]} alt={count ? alt : `${name} · ${labels.noPhoto}`} eager />
        {many && (
          <>
            <button type="button" className="pg-arrow prev" aria-label={labels.prevPhoto} onClick={() => go(-1)}>‹</button>
            <button type="button" className="pg-arrow next" aria-label={labels.nextPhoto} onClick={() => go(1)}>›</button>
            <span className="pg-count" aria-hidden="true">{current + 1}/{count}</span>
          </>
        )}
      </div>
      {many && (
        <ul className="pg-thumbs">
          {list.map((src, i) => (
            <li key={src}>
              <button type="button" className="pg-thumb" aria-current={i === current} aria-label={labels.photoOf(i + 1, count)} onClick={() => setIndex(i)}>
                <ProductImage src={src} alt="" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
