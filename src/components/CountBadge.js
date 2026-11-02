import { COLORS } from "../theme";
import { badgeText } from "../notificationHelpers";

// Small count on a header icon: "9+" above 9, nothing at 0. The icon's aria-label says the number.
export default function CountBadge({ count }) {
  if (!count) return null;
  return (
    <span aria-hidden="true" data-testid="count-badge" style={{ position:"absolute", top:2, right:0, background:COLORS.accentDark, color:"#fff", borderRadius:8, minWidth:16, height:16, padding:"0 3px", fontSize:9, fontWeight:700, lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
      {badgeText(count)}
    </span>
  );
}
