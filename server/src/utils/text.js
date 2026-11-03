// User-written text (chat messages, reviews): control characters other than tab and newline
// are dropped, and the ends trimmed. Anything else is kept as typed; the frontend always
// renders it as plain text.
const cleanText = (v) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim() : "");

module.exports = { cleanText };
