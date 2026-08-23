import { parseSeconds } from "./storyboard";
import type { HubAsset, LibraryItem, ModelRow, ShotState } from "./types";

export type PromptElement = {
  id: string;
  frontal: LibraryItem | null;
  refs: LibraryItem[];
  video: LibraryItem | null;
};

export function newElement(): PromptElement {
  return {
    id: `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    frontal: null,
    refs: [],
    video: null,
  };
}

export function serializeElements(rows: PromptElement[]) {
  return rows
    .map((row) => ({
      frontal: row.frontal?.path || "",
      refs: row.refs.map((r) => r.path).filter(Boolean),
      video: row.video?.path || "",
    }))
    .filter((r) => r.frontal || r.video);
}

export function hubCharactersToElements(assets: HubAsset[]): PromptElement[] {
  return assets
    .filter((a) => a.role === "character" && a.item?.path)
    .map((a) => ({
      id: a.id,
      frontal: a.item,
      refs: [],
      video: null,
    }));
}

export function storyboardKlingModality(model?: ModelRow | null): string {
  if (!model?.supports_multi_prompt) return "r2v";
  const blob = `${model.id} ${model.modalities?.join(" ") || ""}`.toLowerCase();
  if (blob.includes("t2v") && !blob.includes("i2v")) return "t2v";
  if ((model.modalities || []).includes("t2v") && blob.includes("t2v")) return "t2v";
  if ((model.modalities || []).includes("i2v")) return "i2v";
  if ((model.modalities || []).includes("t2v")) return "t2v";
  return "i2v";
}

export function shotMultiPromptEntries(
  shots: ShotState[],
  holds?: Map<string, number>,
  globalNotes?: string,
): { prompt: string; duration: string }[] {
  const note = (globalNotes || "").trim();
  const ordered = [...shots].sort((a, b) => a.order - b.order);
  const out: { prompt: string; duration: string }[] = [];
  for (const shot of ordered) {
    const bits: string[] = [];
    if (note) bits.push(note);
    const action = (shot.action || "").trim();
    if (action) bits.push(action);
    const cam: string[] = [];
    if (shot.move && shot.move !== "Static") {
      cam.push(shot.move);
      if (shot.speed) cam.push(shot.speed);
      if (shot.ease) cam.push(shot.ease);
    } else if (shot.move === "Static") {
      cam.push("Static");
    }
    if (shot.framing.trim()) cam.push(shot.framing.trim());
    if (cam.length) bits.push(`Camera: ${cam.join(", ")}.`);
    const prompt = bits.join(" ").trim();
    if (!prompt) continue;
    const hold = holds?.get(shot.id);
    const n = hold && hold > 0 ? hold : parseSeconds(shot.duration) || 5;
    out.push({ prompt, duration: String(Math.max(1, Math.round(n))) });
  }
  return out;
}
