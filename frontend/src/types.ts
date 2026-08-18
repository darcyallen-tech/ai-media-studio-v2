export type Mode = "image" | "video" | "audio";

export type MediaKind = "image" | "video" | "audio";

export type LibrarySource = "resolve" | "uploads" | "generated";

export type SlotAccept = "image" | "video" | "any";

export type ModelRow = {
  id: string;
  label: string;
  mode?: string;
  modality?: string;
  notes?: string;
  endpoint?: string;
  cost_estimate_usd?: number;
  cost?: string;
  duration_enum?: string[];
  duration_min?: number | null;
  duration_max?: number | null;
  default_duration?: string;
  aspect_choices?: string[];
  default_aspect?: string;
  supports_audio?: boolean;
  requires_end_frame?: boolean;
  supports_end_frame?: boolean;
  required_slots?: string[];
};

export type GenerateResponse = {
  ok: boolean;
  result_paths?: string[];
  local_paths?: string[];
  cost?: string;
  duration_sec?: number;
  error?: string | null;
  status?: string;
  job_kind?: string;
};

export type LibraryItem = {
  id: string;
  name: string;
  source: LibrarySource | string;
  kind: MediaKind | string;
  path: string;
  rel?: string;
  url: string;
  thumb_url?: string | null;
  mtime?: number;
  size?: number;
  cost?: string;
  duration_sec?: number;
  model?: string;
};

export type LibraryBucket = {
  source: string;
  note?: string | null;
  items: LibraryItem[];
};

export type GraphInputs = {
  source?: SlotAccept;
  first?: boolean;
  last?: boolean;
};

export type PromptNodeData = {
  onGenerated: (result: GenerateResponse) => void;
  onAddSource: () => void;
  onAddFirst: () => void;
  onAddLast: () => void;
  onModalityChange: (mode: Mode, modality: string) => void;
  source: LibraryItem | null;
  first: LibraryItem | null;
  last: LibraryItem | null;
};

export type ResultNodeData = {
  result: GenerateResponse;
};

export type SourceNodeData = {
  title: string;
  accept: SlotAccept;
  item: LibraryItem | null;
  onClear: () => void;
  onOpenLibrary: () => void;
  onAttach: (item: LibraryItem) => void;
};

export const LIBRARY_DRAG_MIME = "application/x-ams-library";

export function inputPlan(
  modality: string,
  model?: ModelRow | null,
): GraphInputs {
  if (modality === "bridge" || model?.requires_end_frame) {
    return { first: true, last: true };
  }
  if (modality === "i2v" || modality === "i2i" || modality === "region") {
    return { source: "image" };
  }
  if (modality === "r2i") {
    return { source: "image" };
  }
  if (modality === "v2v" || modality === "extend") {
    return { source: "video" };
  }
  if (modality === "r2v") {
    return { source: "any" };
  }
  return {};
}

export function durationOptions(model?: ModelRow | null): string[] {
  const raw = model?.duration_enum ?? [];
  return raw.map(String).filter((t) => t.trim() && t.toLowerCase() !== "auto");
}

export function formatDurationToken(tok: string): string {
  const t = tok.trim();
  if (!t) return t;
  if (/s$/i.test(t) || t.toLowerCase() === "auto") return t;
  return `${t}s`;
}
