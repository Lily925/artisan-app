import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { COLORS, FONT_SANS, FONT_SERIF } from "../theme";
import { api, assetUrl } from "../api";
import { timeAgo } from "../notificationHelpers";
import { useVisiblePolling } from "../usePolling";
import ArtisanAvatar from "./ArtisanAvatar";
import ProductImage from "./ProductImage";

const CHAT_POLL_MS = 15000;
const LIST_POLL_MS = 45000;
const MESSAGE_MAX = 1000;
const LOCALE = { mn: "mn-MN", ko: "ko-KR", en: "en-US" };

const CSS = `
  /* Fills the screen under the sticky header (--msg-header is measured below). */
  .msg-page{padding-top:16px;padding-bottom:16px;--msg-gap:32px;}
  .msg-layout{display:grid;grid-template-columns:320px minmax(0,1fr);background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:2px;overflow:hidden;min-height:420px;height:calc(100vh - var(--msg-header,0px) - var(--msg-gap));height:calc(100dvh - var(--msg-header,0px) - var(--msg-gap));}
  .msg-list{border-right:1px solid ${COLORS.border};overflow-y:auto;min-height:0;display:flex;flex-direction:column;}
  .msg-chat{display:flex;flex-direction:column;min-width:0;min-height:0;}
  .msg-back{display:none;}
  .msg-row{display:flex;gap:10px;align-items:center;width:100%;min-height:64px;padding:12px 14px;background:none;border:none;border-bottom:1px solid ${COLORS.border};cursor:pointer;text-align:left;font-family:${FONT_SANS};}
  .msg-row:hover,.msg-row.active{background:${COLORS.bgSoft};}
  .msg-row:focus-visible,.msg-card:focus-visible{outline:2px solid ${COLORS.accentDark};outline-offset:-2px;}
  .msg-scroll{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:16px;display:flex;flex-direction:column;gap:8px;background:${COLORS.bg};}
  .msg-bubble{max-width:min(75%,520px);padding:9px 12px;border-radius:12px;font-family:${FONT_SANS};font-size:14px;line-height:1.45;color:${COLORS.ink};white-space:pre-wrap;overflow-wrap:anywhere;}
  .msg-bubble.mine{background:${COLORS.accentSoft};border-bottom-right-radius:2px;}
  .msg-bubble.theirs{background:${COLORS.card};border:1px solid ${COLORS.border};border-bottom-left-radius:2px;}
  .msg-card{display:flex;gap:10px;align-items:center;width:100%;padding:8px 14px;background:${COLORS.card};border:none;border-bottom:1px solid ${COLORS.border};cursor:pointer;text-align:left;font-family:${FONT_SANS};}
  .msg-card:hover{background:${COLORS.bgSoft};}
  .msg-chips{display:flex;gap:6px;overflow-x:auto;padding:8px 12px 0;}
  .msg-chips .a-chip{padding:6px 12px;min-height:36px;font-size:12px;border-radius:16px;}
  .msg-input{flex:1;min-width:0;min-height:44px;max-height:120px;resize:none;border:1.5px solid ${COLORS.border};border-radius:2px;padding:10px 12px;font-family:${FONT_SANS};font-size:14px;line-height:1.4;background:${COLORS.card};color:${COLORS.ink};}
  .msg-input:focus{outline:none;border-color:${COLORS.accentDark}!important;box-shadow:0 0 0 3px rgba(232,169,188,0.3)!important;}
  @media (max-width:720px){
    .msg-page.a-container{padding:0;--msg-gap:0px;}
    .msg-layout{grid-template-columns:minmax(0,1fr);border-width:0;}
    .msg-list{border-right:none;}
    .msg-layout.has-active .msg-list{display:none;}
    .msg-layout:not(.has-active) .msg-chat{display:none;}
    .msg-back{display:flex;}
    /* 16px keeps phones from zooming in on focus. */
    .msg-input{font-size:16px;}
  }
`;

const nameOf = (item, lang) => (lang === "mn" ? item.title : item.titleEn || item.title);

// Pinned above the messages: what this conversation is about. All from the server, by id.
function ContextCard({ t, lang, card, fmtAmt, onOpenProduct, onOpenOrder }) {
  const m = t.messages;
  const name = nameOf(card, lang);
  const isProduct = card.type === "product";
  const detail = isProduct
    ? fmtAmt(card.price)
    : `${t.orders.status[card.status] || card.status}${card.moreItems > 0 ? ` · ${m.moreItems(card.moreItems)}` : ""}`;
  return (
    <button type="button" className="msg-card" onClick={() => (isProduct ? onOpenProduct(card.id) : onOpenOrder(card.id))} aria-label={`${isProduct ? m.cardProduct : m.cardOrder}: ${name}`}>
      <span style={{ position:"relative", display:"block", width:44, height:44, flexShrink:0, border:`1px solid ${COLORS.border}`, borderRadius:2, overflow:"hidden" }}>
        <ProductImage src={card.image} alt="" />
      </span>
      <span style={{ minWidth:0, flex:1 }}>
        <span style={{ display:"block", fontSize:10, fontWeight:700, letterSpacing:0.4, textTransform:"uppercase", color:COLORS.accentDark }}>{isProduct ? m.cardProduct : m.cardOrder}</span>
        <span style={{ display:"block", fontSize:13, fontWeight:700, color:COLORS.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{name}</span>
        <span style={{ display:"block", fontSize:12, color:COLORS.inkSoft }}>{detail}</span>
      </span>
      <span aria-hidden="true" style={{ color:COLORS.accentDark, fontWeight:700 }}>›</span>
    </button>
  );
}

function Chat({ t, lang, chat, fmtAmt, onOpenProduct, onOpenOrder, onBack, onSent, onLoadOlder, onApiError, navigate }) {
  const m = t.messages;
  const { conversation, card, messages, hasMore } = chat;
  const isBuyer = conversation.role === "buyer";
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showReplies, setShowReplies] = useState(false);
  const [savedReplies, setSavedReplies] = useState(null);
  const scroller = useRef(null);
  const input = useRef(null);
  const atBottom = useRef(true);
  const lastId = useRef(null);
  const olderFrom = useRef(null); // scroll height before loading older messages

  // Stays at the newest message unless the reader has scrolled up; keeps the place when older
  // messages are added above.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (olderFrom.current !== null) {
      el.scrollTop += el.scrollHeight - olderFrom.current;
      olderFrom.current = null;
      return;
    }
    const newest = messages[messages.length - 1]?.id;
    if (newest !== lastId.current && (atBottom.current || lastId.current === null || messages[messages.length - 1]?.mine)) el.scrollTop = el.scrollHeight;
    lastId.current = newest;
  }, [messages]);

  const fmtTime = (date) => {
    const d = new Date(date);
    const sameDay = d.toDateString() === new Date().toDateString();
    return d.toLocaleString(LOCALE[lang], sameDay ? { hour:"2-digit", minute:"2-digit" } : { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
  };
  const lastSeenId = [...messages].reverse().find((x) => x.mine && x.readAt)?.id;

  const send = async (raw) => {
    const text = raw.trim();
    if (!text || sending) return false;
    setSending(true);
    setError("");
    try {
      await onSent(text);
      return true;
    } catch (err) {
      if (err.status === 401) onApiError(err);
      else setError(m.errors[err.code] || m.errors.generic);
      return false;
    } finally {
      setSending(false);
    }
  };
  const sendDraft = async () => {
    if (await send(draft)) { setDraft(""); input.current?.focus(); }
  };

  const toggleReplies = () => {
    setShowReplies((v) => !v);
    if (savedReplies === null) api.getChatSettings().then((res) => setSavedReplies(res.savedReplies)).catch(() => setSavedReplies([]));
  };

  return (
    <>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 14px", borderBottom:`1px solid ${COLORS.border}`, minHeight:52 }}>
        <button type="button" className="a-icon-btn msg-back" aria-label={m.back} onClick={onBack} style={{ fontSize:22, color:COLORS.accentDark, marginLeft:-10 }}>‹</button>
        <ArtisanAvatar name={conversation.other.name} photoUrl={assetUrl(conversation.other.photo)} size={32} />
        <h2 style={{ fontFamily:FONT_SERIF, fontSize:19, fontWeight:600, color:COLORS.ink, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{conversation.other.name}</h2>
      </div>
      {card && <ContextCard t={t} lang={lang} card={card} fmtAmt={fmtAmt} onOpenProduct={onOpenProduct} onOpenOrder={onOpenOrder} />}

      <div ref={scroller} className="msg-scroll" role="log" aria-label={conversation.other.name}
        onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}>
        {hasMore && (
          <button type="button" className="a-shop-link" style={{ alignSelf:"center", fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:COLORS.accentDark, minHeight:32 }}
            onClick={() => { olderFrom.current = scroller.current.scrollHeight; onLoadOlder(); }}>{m.loadOlder}</button>
        )}
        {messages.length === 0 && <p style={{ margin:"auto", textAlign:"center", fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft }}>{isBuyer ? m.chatEmptyBuyer : m.chatEmptyArtisan}</p>}
        {messages.map((message) => (
          <div key={message.id} style={{ display:"flex", flexDirection:"column", alignItems: message.mine ? "flex-end" : "flex-start" }}>
            {/* Plain text only: React escapes it, and it is never rendered as HTML. */}
            <div className={`msg-bubble ${message.mine ? "mine" : "theirs"}`}>{message.text}</div>
            <div style={{ fontFamily:FONT_SANS, fontSize:11, color:COLORS.inkSoft, marginTop:2 }}>
              {fmtTime(message.createdAt)}
              {message.id === lastSeenId && <> · <strong style={{ color:COLORS.accentDark }}>{m.seen}</strong></>}
            </div>
          </div>
        ))}
      </div>

      {conversation.canSend ? (
        <div style={{ borderTop:`1px solid ${COLORS.border}`, background:COLORS.card, paddingBottom:"env(safe-area-inset-bottom)" }}>
          {isBuyer && (
            <div className="msg-chips" role="group" aria-label={m.quickQuestions}>
              {m.quick.map((q) => <button key={q} type="button" className="a-chip" disabled={sending} onClick={() => send(q)}>{q}</button>)}
            </div>
          )}
          {!isBuyer && (
            <div style={{ padding:"8px 12px 0" }}>
              <button type="button" className="a-shop-link" aria-expanded={showReplies} style={{ fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:COLORS.accentDark, minHeight:28 }} onClick={toggleReplies}>{m.quickReplies} {showReplies ? "▴" : "▾"}</button>
            </div>
          )}
          {!isBuyer && showReplies && (
            savedReplies?.length > 0 ? (
              <div className="msg-chips" style={{ paddingTop:4 }}>
                {savedReplies.map((reply, i) => (
                  <button key={i} type="button" className="a-chip" title={reply} style={{ maxWidth:240, overflow:"hidden", textOverflow:"ellipsis" }}
                    onClick={() => { setDraft(reply); input.current?.focus(); }}>{reply}</button>
                ))}
              </div>
            ) : savedReplies && (
              <p style={{ fontFamily:FONT_SANS, fontSize:12, color:COLORS.inkSoft, padding:"4px 12px 0" }}>
                {m.noReplies}{" "}
                <button type="button" className="a-shop-link" style={{ fontSize:12, fontWeight:700, color:COLORS.accentDark }} onClick={() => navigate("shop-settings")}>{m.manageReplies}</button>
              </p>
            )
          )}
          <p style={{ fontFamily:FONT_SANS, fontSize:11, color:COLORS.inkSoft, padding:"6px 12px 0", lineHeight:1.35 }}>{m.safety}</p>
          {error && <p role="alert" style={{ fontFamily:FONT_SANS, fontSize:12, color:"#B3261E", padding:"4px 12px 0" }}>{error}</p>}
          <div style={{ display:"flex", gap:8, padding:"6px 12px 2px", alignItems:"flex-end" }}>
            <label htmlFor="msg-text" className="a-sr-only">{m.placeholder}</label>
            <textarea id="msg-text" ref={input} className="msg-input" rows={1} maxLength={MESSAGE_MAX} placeholder={m.placeholder} value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Not while an input method (Korean, Mongolian, ...) is composing a word.
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); sendDraft(); }
              }} />
            <button type="button" className="a-btn-primary" style={{ padding:"0 16px", flexShrink:0 }} disabled={sending || !draft.trim()} onClick={sendDraft}>{m.send}</button>
          </div>
          <div style={{ fontFamily:FONT_SANS, fontSize:11, color:COLORS.inkSoft, textAlign:"right", padding:"0 12px 6px", fontVariantNumeric:"tabular-nums" }}>{draft.length} / {MESSAGE_MAX}</div>
        </div>
      ) : (
        <p role="status" style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, padding:"14px", borderTop:`1px solid ${COLORS.border}`, textAlign:"center" }}>{m.shopClosed}</p>
      )}
    </>
  );
}

// Conversations on the left, the open chat on the right; one or the other on phones.
// openRequest = { id }: open that conversation (from a button or a notification).
export default function Messages({ t, lang, fmtAmt, openRequest, onOpenProduct, onOpenOrder, onApiError, navigate }) {
  const m = t.messages;
  const [conversations, setConversations] = useState(null); // null = loading
  const [listFailed, setListFailed] = useState(false);
  const [activeId, setActiveId] = useState(openRequest?.id || null);
  const [chat, setChat] = useState(null); // { id, conversation, card, messages, hasMore }
  const [chatFailed, setChatFailed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  useEffect(() => { if (openRequest?.id) setActiveId(openRequest.id); }, [openRequest]);

  useLayoutEffect(() => {
    const measure = () => setHeaderHeight(document.querySelector("header")?.getBoundingClientRect().height || 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const handleError = useCallback((err, onOther) => {
    if (err.status === 401) onApiError(err);
    else onOther();
  }, [onApiError]);

  const loadList = useCallback(() => api.getConversations()
    .then((res) => { setConversations(res.conversations || []); setListFailed(false); })
    .catch((err) => handleError(err, () => { setListFailed(true); setConversations((list) => list || []); })), [handleError]);

  const loadChat = useCallback(() => {
    const id = activeRef.current;
    if (!id) return Promise.resolve();
    return api.getConversationMessages(id).then((res) => {
      if (activeRef.current !== id) return;
      setChatFailed(false);
      // Merged by id: the page from the server updates read receipts; older pages stay.
      setChat((prev) => {
        const same = prev?.id === id;
        const byId = new Map((same ? prev.messages : []).map((x) => [x.id, x]));
        res.messages.forEach((x) => byId.set(x.id, x));
        return {
          id, conversation: res.conversation, card: res.card,
          messages: [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
          hasMore: same ? prev.hasMore : res.hasMore,
        };
      });
      if (res.conversation.unread > 0) {
        api.markConversationRead(id).catch(() => {});
        setConversations((list) => list?.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) || list);
      }
    }).catch((err) => handleError(err, () => { if (activeRef.current === id) setChatFailed(true); }));
  }, [handleError]);

  // Every 45 seconds, and every 15 for the open chat; both pause while the tab is hidden.
  useVisiblePolling(loadList, LIST_POLL_MS);
  useEffect(() => { setChat(null); setChatFailed(false); }, [activeId]);
  useVisiblePolling(loadChat, CHAT_POLL_MS, Boolean(activeId), activeId);

  const sendMessage = async (text) => {
    const { message } = await api.sendConversationMessage(activeId, text);
    setChat((prev) => (prev?.id === activeId ? { ...prev, messages: [...prev.messages, message] } : prev));
    loadList();
  };

  const loadOlder = () => {
    const first = chat?.messages[0]?.id;
    if (!first) return;
    const id = chat.id;
    api.getConversationMessages(id, first).then((res) => {
      setChat((prev) => (prev?.id === id ? { ...prev, messages: [...res.messages, ...prev.messages], hasMore: res.hasMore } : prev));
    }).catch((err) => handleError(err, () => setChatFailed(true)));
  };

  // A chat just opened with no real message yet isn't in the server's list: show it anyway.
  const shown = conversations && chat && !conversations.some((c) => c.id === chat.id) ? [chat.conversation, ...conversations] : conversations;

  return (
    <div className="a-container msg-page" style={{ "--msg-header":`${headerHeight}px` }}>
      <style>{CSS}</style>
      <h1 className="a-sr-only">{m.title}</h1>
      <div className={`msg-layout${activeId ? " has-active" : ""}`}>
        <nav className="msg-list" aria-label={m.title}>
          <h2 style={{ fontFamily:FONT_SERIF, fontSize:22, fontWeight:600, color:COLORS.ink, padding:"12px 14px", borderBottom:`1px solid ${COLORS.border}` }}>{m.title}</h2>
          {shown === null ? <p style={{ fontFamily:FONT_SANS, color:COLORS.inkSoft, padding:16 }}>…</p>
            : listFailed && shown.length === 0 ? (
              <div role="alert" style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, padding:16 }}>
                {m.listError}{" "}
                <button type="button" className="a-shop-link" style={{ fontWeight:700, color:COLORS.accentDark }} onClick={loadList}>{m.retry}</button>
              </div>
            ) : shown.length === 0 ? (
              <p style={{ fontFamily:FONT_SANS, fontSize:13, color:COLORS.inkSoft, padding:"32px 16px", textAlign:"center", lineHeight:1.5 }}>{m.listEmpty}</p>
            ) : shown.map((c) => (
              <button key={c.id} type="button" className={`msg-row${c.id === activeId ? " active" : ""}`} aria-current={c.id === activeId ? "true" : undefined} onClick={() => setActiveId(c.id)}>
                <ArtisanAvatar name={c.other.name} photoUrl={assetUrl(c.other.photo)} size={40} />
                <span style={{ flex:1, minWidth:0 }}>
                  <span style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8 }}>
                    <span style={{ fontSize:14, fontWeight:700, color:COLORS.ink, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.other.name}</span>
                    {c.lastMessageAt && <span style={{ fontSize:11, color:COLORS.inkSoft, flexShrink:0 }}>{timeAgo(c.lastMessageAt, t.notifications)}</span>}
                  </span>
                  <span style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginTop:2 }}>
                    <span style={{ fontSize:12, color: c.unread ? COLORS.ink : COLORS.inkSoft, fontWeight: c.unread ? 700 : 400, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {c.preview ? `${c.previewMine ? `${m.you}: ` : ""}${c.preview}` : m.newChat}
                    </span>
                    {c.unread > 0 && <span aria-label={m.unreadAria(c.unread)} style={{ flexShrink:0, background:COLORS.accentDark, color:"#fff", borderRadius:9, minWidth:18, height:18, padding:"0 5px", fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{c.unread > 9 ? "9+" : c.unread}</span>}
                  </span>
                </span>
              </button>
            ))}
        </nav>

        <section className="msg-chat" aria-label={chat?.conversation.other.name || m.title}>
          {!activeId ? (
            <p style={{ margin:"auto", fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, padding:24, textAlign:"center" }}>{m.pick}</p>
          ) : chatFailed && !chat ? (
            <div role="alert" style={{ margin:"auto", fontFamily:FONT_SANS, fontSize:14, color:COLORS.inkSoft, padding:24, textAlign:"center" }}>
              {m.chatError}{" "}
              <button type="button" className="a-shop-link" style={{ fontWeight:700, color:COLORS.accentDark }} onClick={loadChat}>{m.retry}</button>
              <div style={{ marginTop:12 }}><button type="button" className="a-shop-link msg-back" style={{ margin:"0 auto", color:COLORS.accentDark }} onClick={() => setActiveId(null)}>‹ {m.back}</button></div>
            </div>
          ) : !chat ? (
            <p style={{ margin:"auto", fontFamily:FONT_SANS, color:COLORS.inkSoft }}>…</p>
          ) : (
            <Chat key={chat.id} t={t} lang={lang} chat={chat} fmtAmt={fmtAmt} navigate={navigate} onApiError={onApiError}
              onOpenProduct={onOpenProduct} onOpenOrder={onOpenOrder} onBack={() => setActiveId(null)} onSent={sendMessage} onLoadOlder={loadOlder} />
          )}
        </section>
      </div>
    </div>
  );
}
