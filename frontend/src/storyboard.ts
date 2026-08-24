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

function stillMark(item: LibraryItem | null | undefined): string {
  const path = (item?.path || "").trim();
  return path ? "still attached" : "no still";
}

function dialogueFromAction(action: string): string[] {
  const out: string[] = [];
  const re = /([^\n:]{1,60}):\s*["“]([^"”]+)["”]/g;
  let match: RegExpExecArray | null = re.exec(action);
  while (match) {
    const speaker = match[1].trim();
    const line = match[2].trim();
    if (speaker && line) out.push(`${speaker}: "${line}"`);
    match = re.exec(action);
  }
  return out;
}

function shotDurationLabel(
  shot: ShotState,
  hold?: number,
): string {
  const raw = shot.duration.trim();
  if (raw) {
    const n = parseSeconds(raw);
    return n ? `${formatHold(n)}s` : raw;
  }
  if (hold && hold > 0) return `${formatHold(hold)}s`;
  return "(unallocated)";
}

export function composeStoryboardEnhanceBrief(
  title: string,
  notes: string,
  assets: HubAsset[],
  shots: ShotState[],
  holds?: Map<string, number>,
  hubNotes?: string,
): string {
  const parts: string[] = [];
  const t = title.trim();
  if (t) parts.push(`Sequence title: ${t}`);
  parts.push("Hub assets:");
  if (!assets.length) {
    parts.push("- (none)");
  } else {
    for (const row of assets) {
      const label = (row.label || row.item?.name || row.role).trim();
      parts.push(`- ${row.role}: ${label} [${stillMark(row.item)}]`);
    }
  }
  const mood = (hubNotes || "").trim();
  const n = notes.trim();
  if (mood && mood !== n) {
    parts.push("");
    parts.push("Hub mood / style:");
    parts.push(mood);
  }
  parts.push("");
  parts.push("Global notes:");
  parts.push(n || "(none)");
  parts.push("");
  parts.push("Shots in order:");
  const ordered = [...shots].sort((a, b) => a.order - b.order);
  if (!ordered.length) {
    parts.push("- (none)");
  } else {
    for (const shot of ordered) {
      const hold = holds?.get(shot.id);
      const lines = [`${shot.order}. ${shot.label || `Shot ${shot.order}`}`];
      lines.push(`   Action: ${shot.action.trim() || "(empty)"}`);
      lines.push(`   Move: ${shot.move || "—"}`);
      if (shot.move && shot.move !== "Static" && shot.speed) {
        lines.push(`   Speed: ${shot.speed}`);
      }
      if (shot.move && shot.move !== "Static" && shot.ease) {
        lines.push(`   Ease: ${shot.ease}`);
      }
      lines.push(`   Duration: ${shotDurationLabel(shot, hold)}`);
      lines.push(`   Framing: ${shot.framing.trim() || "(none)"}`);
      const speech = dialogueFromAction(shot.action);
      lines.push(
        `   Dialogue: ${speech.length ? speech.join(" | ") : "(none)"}`,
      );
      parts.push(lines.join("\n"));
    }
  }
  parts.push("");
  parts.push(
    "Rewrite this board into a master generation prompt (global notes) for the selected model. Keep shot order, attributed dialogue, hub identities, camera/move, durations, and framing. Do not drop shots or unname the cast.",
  );
  return parts.join("\n").trim();
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
  const fromModel = durationOptions(model).filter(
    (t) => t.toLowerCase() !== "auto",
  );
  if (fromModel.length) return fromModel;
  const lo = Number(model?.duration_min) || 5;
  const hi = Number(model?.duration_max) || 30;
  return ["5", "10", "15", "30"].filter((tok) => {
    const n = Number(tok);
    return n >= lo && n <= hi;
  });
}

export function allocatedSeconds(shots: ShotState[]): {
  allocated: number;
  empty: number;
  filled: number;
} {
  let allocated = 0;
  let empty = 0;
  let filled = 0;
  for (const shot of shots) {
    const n = parseSeconds(shot.duration);
    if (n) {
      allocated += n;
      filled += 1;
    } else {
      empty += 1;
    }
  }
  return { allocated, empty, filled };
}

export function evenSplitSeconds(total: number, count: number): number[] {
  if (count <= 0) return [];
  const tenths = Math.round(total * 10);
  const base = Math.floor(tenths / count);
  const rem = tenths - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < rem ? 1 : 0)) / 10);
}

export function formatHold(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
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
