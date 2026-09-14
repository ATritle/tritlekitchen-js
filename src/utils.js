export function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

function decimalToFraction(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (Number.isInteger(n)) return String(n);

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const fraction = abs - whole;

  // Convert to a simple fractional measurement while keeping enough
  // precision for values such as 1/3, 2/3, 1/5, and 3/5.
  let bestNumerator = 0;
  let bestDenominator = 1;
  let bestError = Infinity;
  for (let denominator = 2; denominator <= 100; denominator++) {
    const numerator = Math.round(fraction * denominator);
    const error = Math.abs(fraction - numerator / denominator);
    if (error < bestError) {
      bestError = error;
      bestNumerator = numerator;
      bestDenominator = denominator;
    }
  }

  if (bestNumerator === 0) return `${sign}${whole}`;
  if (bestNumerator === bestDenominator) return `${sign}${whole + 1}`;

  const gcd = (a, b) => {
    while (b) [a, b] = [b, a % b];
    return a;
  };
  const divisor = gcd(bestNumerator, bestDenominator);
  const numerator = bestNumerator / divisor;
  const denominator = bestDenominator / divisor;
  const fractionText = `${numerator}/${denominator}`;

  return whole ? `${sign}${whole} ${fractionText}` : `${sign}${fractionText}`;
}

export function formatAmount(amount) {
  if (amount === undefined || amount === null || amount === "") return "";

  // Support existing numeric amounts as well as fractions/mixed fractions
  // entered by the Recipe Creator.
  if (typeof amount === "string") {
    const text = amount.trim();
    if (/^-?\d+(?:\s+\d+\/\d+|\/\d+)$/.test(text)) return text;
  }

  return decimalToFraction(amount);
}

export function formatIngredient(ing) {
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
