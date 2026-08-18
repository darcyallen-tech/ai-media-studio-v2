import type { HubAsset, LibraryItem, ModelRow, ShotState } from "./types";

export function composeStoryboardPrompt(
  title: string,
  notes: string,
  assets: HubAsset[],
  shots: ShotState[],
): string {
  const parts: string[] = [];
  const t = title.trim();
  const n = notes.trim();
  if (t) parts.push(`Sequence: ${t}.`);
  if (n) parts.push(n);
  const cast = assets
    .map((row) => {
      const label = (row.label || row.item?.name || "").trim();
      return label ? `${row.role}: ${label}` : "";
    })
    .filter(Boolean);
  if (cast.length) parts.push(`Cast / locations: ${cast.join("; ")}.`);
  const ordered = [...shots].sort((a, b) => a.order - b.order);
  for (const shot of ordered) {
    const bits = [`Shot ${shot.order} (${shot.label || `Shot ${shot.order}`}):`];
    if (shot.action.trim()) bits.push(shot.action.trim());
    const cam: string[] = [];
    if (shot.move) cam.push(shot.move);
    if (shot.move !== "Static" && shot.speed) cam.push(shot.speed);
    if (shot.move !== "Static" && shot.ease) cam.push(shot.ease);
    if (shot.framing.trim()) cam.push(shot.framing.trim());
    if (cam.length) bits.push(`Camera: ${cam.join(", ")}.`);
    if (shot.duration.trim()) bits.push(`Hold about ${shot.duration.trim()}.`);
    parts.push(bits.join(" "));
  }
  if (ordered.length) {
    parts.push(
      "Play the shots in order as one continuous sequence. Keep character and location identity locked to the reference stills.",
    );
  }
  return parts.join("\n\n").trim();
}

export function storyboardRefItems(
  assets: HubAsset[],
  shots: ShotState[],
): LibraryItem[] {
  const out: LibraryItem[] = [];
  const seen = new Set<string>();
  const add = (item: LibraryItem | null | undefined) => {
    const path = (item?.path || "").trim();
    if (!path || seen.has(path.toLowerCase())) return;
    seen.add(path.toLowerCase());
    out.push(item as LibraryItem);
  };
  for (const row of assets) add(row.item);
  for (const shot of [...shots].sort((a, b) => a.order - b.order)) add(shot.still);
  return out;
}

export function storyboardDurationToken(
  shots: ShotState[],
  model?: ModelRow | null,
): string {
  let total = 0;
  for (const shot of shots) {
    const raw = shot.duration.trim().toLowerCase().replace(/s$/, "");
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  const lo = Number(model?.duration_min) || 5;
  const hi = Number(model?.duration_max) || 15;
  const def = model?.default_duration || String(lo);
  if (total <= 0) return def;
  const clamped = Math.min(hi, Math.max(lo, Math.round(total)));
  const opts = model?.duration_enum ?? [];
  if (opts.length) {
    const asStr = String(clamped);
    if (opts.includes(asStr) || opts.includes(`${asStr}s`)) return asStr;
    const nums = opts
      .map((t) => Number(String(t).replace(/s$/i, "")))
      .filter((n) => Number.isFinite(n));
    if (nums.length) {
      const nearest = nums.reduce((a, b) =>
        Math.abs(b - clamped) < Math.abs(a - clamped) ? b : a,
      );
      return String(nearest);
    }
  }
  return String(clamped);
}
