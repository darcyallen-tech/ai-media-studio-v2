import {
  durationOptions,
  type HubAsset,
  type LibraryItem,
  type ModelRow,
  type ShotState,
} from "./types";

export function composeStoryboardPrompt(
  title: string,
  notes: string,
  assets: HubAsset[],
  shots: ShotState[],
  holds?: Map<string, number>,
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
    const hold = holds?.get(shot.id);
    if (hold && hold > 0) {
      const pretty = Number.isInteger(hold) ? String(hold) : hold.toFixed(1);
      bits.push(`Hold about ${pretty}s.`);
    } else if (shot.duration.trim()) {
      bits.push(`Hold about ${shot.duration.trim()}.`);
    }
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

export function parseSeconds(tok: string): number {
  const n = Number(String(tok || "").trim().toLowerCase().replace(/s$/i, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function storyboardDurationChoices(model?: ModelRow | null): string[] {
  const fromModel = durationOptions(model);
  if (fromModel.length) return fromModel;
  const lo = Number(model?.duration_min) || 5;
  const hi = Number(model?.duration_max) || 30;
  return ["5", "10", "15", "30"].filter((tok) => {
    const n = Number(tok);
    return n >= lo && n <= hi;
  });
}

export function distributeShotSeconds(
  shots: ShotState[],
  totalTok: string,
): Map<string, number> {
  const total = parseSeconds(totalTok);
  const ordered = [...shots].sort((a, b) => a.order - b.order);
  let used = 0;
  let empty = 0;
  const override = new Map<string, number>();
  for (const shot of ordered) {
    const n = parseSeconds(shot.duration);
    if (n) {
      override.set(shot.id, n);
      used += n;
    } else {
      empty += 1;
    }
  }
  const rest = Math.max(0, total - used);
  const each = empty > 0 ? rest / empty : 0;
  const out = new Map<string, number>();
  for (const shot of ordered) {
    out.set(shot.id, override.get(shot.id) ?? each);
  }
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
