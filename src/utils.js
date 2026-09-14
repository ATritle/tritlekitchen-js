export function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

export function formatAmount(amount) {
  if (amount === undefined || amount === null || amount === "") return "";
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
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
