import { COLORS, FONT_SANS } from "../theme";

// Shipping address fields for checkout. Shown to the order's artisan only (and to the buyer).
export const ADDRESS_FIELDS = [
  ["name", 2, 100, "name"],
  ["address", 5, 200, "street-address"],
  ["city", 2, 100, "address-level2"],
  ["country", 2, 60, "country-name"],
  ["phone", 6, 30, "tel"],
];
export const emptyAddress = () => Object.fromEntries(ADDRESS_FIELDS.map(([f]) => [f, ""]));

// Same rules as the server (paymentController.js readShippingAddress). Returns { field: message }.
export function validateAddress(address, text) {
  const errors = {};
  for (const [field, min, max] of ADDRESS_FIELDS) {
    const value = (address[field] || "").trim();
    if (value.length < min || value.length > max) errors[field] = text.required;
  }
  const phone = (address.phone || "").trim();
  if (!errors.phone && (!/^\+?[0-9][0-9 ()-]{4,28}$/.test(phone) || phone.replace(/\D/g, "").length < 6)) errors.phone = text.phoneInvalid;
  return errors;
}

export default function ShippingAddressForm({ text, value, errors, onChange }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  return (
    <fieldset style={{ border:"none", padding:0, margin:"0 0 16px" }}>
      <legend className="a-label" style={{ marginBottom:4 }}>{text.title}</legend>
      <div style={{ fontFamily:FONT_SANS, fontSize:11, color:COLORS.inkSoft, lineHeight:1.5, marginBottom:10 }}>{text.privacy}</div>
      {ADDRESS_FIELDS.map(([field, , max, autoComplete]) => (
        <div key={field} style={{ marginBottom:10 }}>
          <label htmlFor={`ship-${field}`} style={{ display:"block", fontFamily:FONT_SANS, fontSize:12, fontWeight:700, color:COLORS.ink, marginBottom:4 }}>
            {text[field]}
          </label>
          <input id={`ship-${field}`} className="a-input" type={field === "phone" ? "tel" : "text"} maxLength={max}
            autoComplete={`shipping ${autoComplete}`} value={value[field]} onChange={set(field)}
            aria-invalid={Boolean(errors[field])} aria-describedby={errors[field] ? `ship-${field}-error` : undefined} />
          {errors[field] && (
            <div id={`ship-${field}-error`} style={{ fontFamily:FONT_SANS, fontSize:11, color:"#B3261E", marginTop:3 }}>{errors[field]}</div>
          )}
        </div>
      ))}
    </fieldset>
  );
}
