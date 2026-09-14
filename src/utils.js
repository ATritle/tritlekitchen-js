export function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

const FRACTIONS = [
  [1 / 8, "1/8"],
  [1 / 6, "1/6"],
  [1 / 5, "1/5"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [2 / 5, "2/5"],
  [1 / 2, "1/2"],
  [3 / 5, "3/5"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [4 / 5, "4/5"],
  [5 / 6, "5/6"],
  [7 / 8, "7/8"],
];

function fractionPart(value) {
  let best = null;
  let bestDiff = Infinity;

  for (const [decimal, fraction] of FRACTIONS) {
    const diff = Math.abs(value - decimal);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = fraction;
    }
  }

  return bestDiff <= 0.02 ? best : null;
}

export function formatAmount(amount) {
  if (amount === undefined || amount === null || amount === "") return "";

  // Preserve fraction strings such as "1/2" or "1 1/2".
  if (typeof amount === "string" && amount.trim().includes("/")) {
    return amount.trim();
  }

  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);

  if (Number.isInteger(n)) return String(n);

  const whole = Math.floor(n);
  const fraction = fractionPart(n - whole);

  if (fraction) {
    return whole > 0 ? `${whole} ${fraction}` : fraction;
  }

  // Fall back to a sensible decimal for values that are not a common
  // cooking fraction.
  return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatIngredient(ing) {
  if (ing?.type === "section") return String(ing.text ?? "").trim();
  const amount = formatAmount(ing.amount);
  const unit = ing.unit ? `${ing.unit} ` : "";
  const item = ing.item ?? "";
  const note = ing.note ? ` — ${ing.note}` : "";
  return `${amount}${amount ? " " : ""}${unit}${item}${note}`.trim();
}

export function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function weekStart(date = new Date(), offset = 0) {
  const d = dateOnly(date);
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  return d;
}

export function weekKey(start) {
  return `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`;
}

export function vibrate(pattern = 10) {
  try { navigator.vibrate?.(pattern); } catch {}
}
