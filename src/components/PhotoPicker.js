import { useEffect, useRef, useState } from "react";
import { COLORS, FONT_SANS } from "../theme";
import ProductImage from "./ProductImage";

export const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const REORDER_TYPE = "application/x-artisan-photo";

const CSS = `
  .pp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,112px),1fr));gap:10px;list-style:none;margin:0 0 10px;padding:0;}
  .pp-item{position:relative;aspect-ratio:1;border:1.5px solid ${COLORS.border};border-radius:2px;overflow:hidden;background:${COLORS.bgSoft};cursor:grab;}
  .pp-item.cover{border-color:${COLORS.accentDark};box-shadow:0 0 0 1px ${COLORS.accentDark};}
  .pp-item.dragging{opacity:0.45;}
  .pp-item.over{outline:2px dashed ${COLORS.accentDark};outline-offset:2px;}
  .pp-badge{position:absolute;top:6px;left:6px;z-index:1;background:${COLORS.accentDark};color:#fff;font-family:${FONT_SANS};font-size:10px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;padding:2px 7px;border-radius:2px;}
  .pp-remove{position:absolute;top:4px;right:4px;z-index:1;width:30px;height:30px;border-radius:50%;border:none;background:rgba(59,42,50,0.78);color:#fff;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}
  .pp-remove:hover{background:#B3261E;}
  .pp-bar{position:absolute;left:0;right:0;bottom:0;z-index:1;display:flex;justify-content:space-between;align-items:center;gap:2px;padding:4px;background:linear-gradient(to top,rgba(59,42,50,0.7),rgba(59,42,50,0));}
  .pp-btn{border:none;border-radius:2px;background:rgba(255,251,252,0.92);color:${COLORS.ink};font-family:${FONT_SANS};font-size:11px;font-weight:700;min-height:28px;min-width:28px;padding:0 6px;cursor:pointer;}
  .pp-btn:hover{background:${COLORS.accent};}
  .pp-btn:disabled{opacity:0.35;cursor:default;background:rgba(255,251,252,0.92);}
  .pp-remove:focus-visible,.pp-btn:focus-visible{outline:2px solid #fff;outline-offset:1px;box-shadow:0 0 0 4px ${COLORS.accentDark};}
`;

let nextId = 0;
// Photo entries: { id, url } for photos the product already has, { id, file, preview } for new ones.
export const existingPhotos = (urls = []) => urls.filter(Boolean).map((url) => ({ id: `p${nextId++}`, url }));

// Multi-photo picker for the product form: add by click or drag-drop (up to 5, JPEG/PNG/
// WebP, 2 MB each), thumbnails with remove (×), "Make cover", ‹ › to move, and drag to
// reorder. The first photo is the cover. Errors go to onError (one clear message).
export default function PhotoPicker({ a, items, onChange, onError, inputId }) {
  const [dropActive, setDropActive] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const live = useRef(items);
  live.current = items;

  // Release the browser preview URLs of new photos when the picker goes away.
  useEffect(() => () => live.current.forEach((it) => it.preview && URL.revokeObjectURL(it.preview)), []);

  const addFiles = (fileList) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    const room = MAX_PHOTOS - items.length;
    const problems = [];
    const added = [];
    for (const file of files) {
      if (!PHOTO_TYPES.includes(file.type)) { problems.push(a.photoType(file.name)); continue; }
      if (file.size > MAX_PHOTO_BYTES) { problems.push(a.photoTooBig(file.name)); continue; }
      if (added.length >= room) { problems.push(a.photoLimit(MAX_PHOTOS)); break; }
      added.push({ id: `n${nextId++}`, file, preview: URL.createObjectURL(file) });
    }
    if (added.length) onChange([...items, ...added]);
    onError([...new Set(problems)].join(" · "));
  };

  const move = (from, to) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onChange(next);
  };
  const remove = (index) => {
    const it = items[index];
    if (it.preview) URL.revokeObjectURL(it.preview);
    onChange(items.filter((_, i) => i !== index));
    onError("");
  };

  const full = items.length >= MAX_PHOTOS;
  const onZoneDrop = (e) => {
    e.preventDefault();
    setDropActive(false);
    if (e.dataTransfer.types.includes(REORDER_TYPE)) return;
    if (full) { onError(a.photoLimit(MAX_PHOTOS)); return; }
    addFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <style>{CSS}</style>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8, marginBottom:8 }}>
        <label className="a-label" htmlFor={inputId} style={{ marginBottom:0 }}>{a.photo}</label>
        <span aria-live="polite" style={{ fontFamily:FONT_SANS, fontSize:12, fontWeight:700, fontVariantNumeric:"tabular-nums", color: full ? COLORS.accentDark : COLORS.inkSoft }}>
          {a.photoCount(items.length, MAX_PHOTOS)}
        </span>
      </div>

      {items.length > 0 && (
        <ul className="pp-grid" aria-label={a.photoReorderHint}>
          {items.map((it, i) => (
            <li key={it.id}
              className={`pp-item${i === 0 ? " cover" : ""}${dragIndex === i ? " dragging" : ""}${overIndex === i && dragIndex !== i ? " over" : ""}`}
              draggable
              onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData(REORDER_TYPE, String(i)); }}
              onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
              onDragOver={(e) => { if (e.dataTransfer.types.includes(REORDER_TYPE)) { e.preventDefault(); setOverIndex(i); } }}
              onDrop={(e) => {
                if (!e.dataTransfer.types.includes(REORDER_TYPE)) return;
                e.preventDefault(); e.stopPropagation();
                move(Number(e.dataTransfer.getData(REORDER_TYPE)), i);
                setDragIndex(null); setOverIndex(null);
              }}>
              <ProductImage src={it.preview || it.url} alt={`${a.photo} ${i + 1}`} eager />
              {i === 0 && <span className="pp-badge">{a.photoCover}</span>}
              <button type="button" className="pp-remove" aria-label={a.photoRemove(i + 1)} title={a.photoRemove(i + 1)} onClick={() => remove(i)}>×</button>
              <div className="pp-bar">
                <button type="button" className="pp-btn" aria-label={`${a.photoMoveEarlier} (${i + 1})`} disabled={i === 0} onClick={() => move(i, i - 1)}>‹</button>
                {i > 0 && <button type="button" className="pp-btn" onClick={() => move(i, 0)}>{a.photoMakeCover}</button>}
                <button type="button" className="pp-btn" aria-label={`${a.photoMoveLater} (${i + 1})`} disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>›</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <label htmlFor={inputId} className={`a-dropzone${dropActive ? " dragover" : ""}`} style={{ display:"block", padding: items.length ? "18px 16px" : undefined }}
          onDragOver={(e) => { e.preventDefault(); if (!e.dataTransfer.types.includes(REORDER_TYPE)) setDropActive(true); }}
          onDragLeave={() => setDropActive(false)}
          onDrop={onZoneDrop}>
          <div aria-hidden="true" style={{ fontSize:20, marginBottom:6 }}>⬆</div>
          <div style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft }}>{a.photoDrop}</div>
        </label>
      )}
      <input id={inputId} type="file" multiple accept={PHOTO_TYPES.join(",")} className="a-sr-only" disabled={full}
        aria-describedby={`${inputId}-hint`} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      <div id={`${inputId}-hint`} style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, marginTop:6, lineHeight:1.5 }}>
        {a.photoHint}{items.length > 1 && <> {a.photoReorderHint}</>}
        {full && <strong style={{ display:"block", color:COLORS.accentDark, marginTop:4 }}>{a.photoLimit(MAX_PHOTOS)}</strong>}
      </div>
    </div>
  );
}
