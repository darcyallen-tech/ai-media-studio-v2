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
  resolution_choices?: string[];
  default_resolution?: string;
  supports_audio?: boolean;
  supports_duration?: boolean;
  supports_voice?: boolean;
  default_voice?: string;
  voices?: string[];
  requires_end_frame?: boolean;
  supports_end_frame?: boolean;
  required_slots?: string[];
  optional_slots?: string[];
  size_limits?: {
    max_ref_images?: number;
    max_refs?: number;
  };
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
  sourceOptional?: boolean;
  first?: boolean;
  last?: boolean;
  characters?: boolean;
  scenes?: boolean;
};

export type RefRole = "character" | "scene" | "source";

export type RefCatalogEntry = {
  id: string;
  name: string;
  label?: string;
  notes?: string;
  still_path?: string | null;
  has_still?: boolean;
  url?: string | null;
  kind?: RefRole;
};

export type RefSlotState = {
  id: string;
  catalogId: string;
  note: string;
  item: LibraryItem | null;
};

export type RefRolePayload = {
  path: string;
  role: RefRole;
  id?: string | null;
  name?: string | null;
  note?: string | null;
};

export type PromptNodeData = {
  onGenerated: (result: GenerateResponse) => void;
  onAddSource: () => void;
  onAddFirst: () => void;
  onAddLast: () => void;
  onAddCharacter: () => void;
  onAddScene: () => void;
  onModalityChange: (
    mode: Mode,
    modality: string,
    model?: ModelRow | null,
  ) => void;
  source: LibraryItem | null;
  first: LibraryItem | null;
  last: LibraryItem | null;
  characters: RefSlotState[];
  scenes: RefSlotState[];
  maxRefs: number;
};

export type ResultNodeData = {
  result: GenerateResponse;
  onClose?: () => void;
};

export type SourceNodeData = {
  title: string;
  accept: SlotAccept;
  item: LibraryItem | null;
  onClear: () => void;
  onOpenLibrary: () => void;
  onAttach: (item: LibraryItem) => void;
  onClose?: () => void;
};

export type RefNodeData = {
  title: string;
  role: "character" | "scene";
  item: LibraryItem | null;
  catalogId: string;
  note: string;
  catalog: RefCatalogEntry[];
  onClear: () => void;
  onOpenLibrary: () => void;
  onAttach: (item: LibraryItem) => void;
  onPickCatalog: (id: string) => void;
  onNote: (note: string) => void;
  onClose?: () => void;
};

export const LIBRARY_DRAG_MIME = "application/x-ams-library";

export function writeLibraryPayload(dt: DataTransfer, item: LibraryItem) {
  const raw = JSON.stringify(item);
  dt.setData(LIBRARY_DRAG_MIME, raw);
  dt.setData("application/json", raw);
  dt.setData("text/plain", raw);
  dt.effectAllowed = "copy";
}

export function parseLibraryPayload(dt: DataTransfer): LibraryItem | null {
  const raw =
    dt.getData(LIBRARY_DRAG_MIME) ||
    dt.getData("application/json") ||
    dt.getData("text/plain");
  if (!raw) return null;
  try {
    const item = JSON.parse(raw) as LibraryItem;
    if (item && typeof item.path === "string") return item;
  } catch {
    return null;
  }
  return null;
}

export function hasLibraryPayload(dt: DataTransfer): boolean {
  const types = [...dt.types];
  return (
    types.includes(LIBRARY_DRAG_MIME) ||
    types.includes("application/json") ||
    types.includes("text/plain")
  );
}

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
  if (modality === "r2i" || modality === "r2v") {
    return {
      source: "image",
      sourceOptional: true,
      characters: true,
      scenes: true,
    };
  }
  if (modality === "v2v" || modality === "extend") {
    return { source: "video" };
  }
  return {};
}

export function maxRefImages(
  model?: ModelRow | null,
  modality?: string,
): number {
  const raw =
    model?.size_limits?.max_ref_images ?? model?.size_limits?.max_refs ?? 0;
  const n = Number(raw) || 0;
  if (n > 0) return n;
  if (modality === "r2i" || modality === "r2v") return 4;
  return 0;
}

export function catalogToItem(entry: RefCatalogEntry): LibraryItem | null {
  const path = (entry.still_path || "").trim();
  if (!path) return null;
  const url = entry.url || "";
  return {
    id: `${entry.kind || "ref"}:${entry.id}`,
    name: entry.label || entry.name || entry.id,
    source: "uploads",
    kind: "image",
    path,
    url,
    thumb_url: url || null,
  };
}

export function durationOptions(model?: ModelRow | null): string[] {
  const raw = model?.duration_enum ?? [];
  return raw.map(String).filter((t) => t.trim() && t.toLowerCase() !== "auto");
}

export function resolutionOptions(model?: ModelRow | null): string[] {
  const raw = (model?.resolution_choices ?? [])
    .map(String)
    .map((t) => t.trim())
    .filter(Boolean);
  const useful = raw.filter((t) => t.toLowerCase() !== "auto");
  return useful.length ? raw : [];
}

export function formatDurationToken(tok: string): string {
  const t = tok.trim();
  if (!t) return t;
  if (/s$/i.test(t) || t.toLowerCase() === "auto") return t;
  return `${t}s`;
}
