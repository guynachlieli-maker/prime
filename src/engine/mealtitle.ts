/** A short, natural name for a meal built from its foods: "ביצה, לחם ופיתה". */
export function mealTitle(names: string[], max = 4): string {
  // "גבינת קוטג' 5%, שטראוס" -> "גבינת קוטג' 5%": keep the food, drop brand and detail after a comma or parenthesis
  const short = names
    .map((n) => n.split(/[,(]/)[0].replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((n, i, a) => a.indexOf(n) === i);
  if (!short.length) return 'ארוחה';
  const shown = short.slice(0, max);
  const rest = short.length - shown.length;
  if (shown.length === 1) return rest ? `${shown[0]} ועוד ${rest}` : shown[0];
  const head = shown.slice(0, -1).join(', ');
  const last = shown[shown.length - 1];
  const joined = `${head} ו${/^[ואיוa-z]/i.test(last) ? '-' : ''}${last}`;
  return rest ? `${shown.join(', ')} ועוד ${rest}` : joined;
}
