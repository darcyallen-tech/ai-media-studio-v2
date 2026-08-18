export type Mode = "image" | "video" | "audio";

export type MediaKind = "image" | "video" | "audio";

export type LibrarySource = "resolve" | "uploads" | "generated";

export type ModelRow = {
  id: string;
  label: string;
  mode?: string;
  modality?: string;
  notes?: string;
  endpoint?: string;
  cost_estimate_usd?: number;
  cost?: string;
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

export type PromptNodeData = {
  onGenerated: (result: GenerateResponse) => void;
  onAddSource: () => void;
  source: LibraryItem | null;
};

export type ResultNodeData = {
  result: GenerateResponse;
};

export type SourceNodeData = {
  item: LibraryItem | null;
  onClear: () => void;
  onOpenLibrary: () => void;
  onAttach: (item: LibraryItem) => void;
};

export const LIBRARY_DRAG_MIME = "application/x-ams-library";

export const SOURCE_MODALITIES = new Set([
  "i2i",
  "r2i",
  "region",
  "i2v",
  "r2v",
  "v2v",
  "bridge",
  "extend",
]);
