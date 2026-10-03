/** Match backend app/naming.py song_slug. Local only — no Enhance, no API. */

const RESERVED = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

export function songSlug(text: string, maxLen = 40): string {
  const raw = (text || "").replace(/\r/g, " ").replace(/\n/g, " ").trim();
  if (!raw) return "";
  const cleaned = raw
    .slice(0, 40)
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/[^a-z0-9\s-]+/g, " ");
  let slug = cleaned
    .split(/[\s-]+/)
    .filter(Boolean)
    .join("-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > maxLen) slug = slug.slice(0, maxLen).replace(/-+$/g, "");
  if (!slug) return "";
  if (RESERVED.has(slug)) slug = `x-${slug}`.slice(0, maxLen).replace(/-+$/g, "");
  return slug;
}

export function localStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
