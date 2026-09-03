export type Mode = "image" | "video" | "frame" | "storyboard" | "audio";

export type MediaKind = "image" | "video" | "audio";

export type LibrarySource = "resolve" | "uploads" | "generated" | "assets";

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
  first_last?: boolean;
  supports_draft?: boolean;
  supports_elements?: boolean;
  max_elements?: number;
  element_allows_video?: boolean;
  supports_multi_prompt?: boolean;
  max_multi_prompt?: number;
  modalities?: string[];
  required_slots?: string[];
  optional_slots?: string[];
  size_limits?: {
    max_ref_images?: number;
    max_refs?: number;
    max_num_images?: number;
  };
  requires_runware?: boolean;
  supports_mask?: boolean;
  supports_region_boxes?: boolean;
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
  is_draft?: boolean;
  draft_cache_url?: string | null;
  model?: string;
  model_key?: string;
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
  pinned?: boolean;
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
  lastOptional?: boolean;
  mask?: boolean;
  maskOptional?: boolean;
  extraRefs?: boolean;
  characters?: boolean;
  scenes?: boolean;
};

export type RefRole = "character" | "scene" | "source" | "prop" | "costume";

export type RefCatalogEntry = {
  id: string;
  name: string;
  label?: string;
  notes?: string;
  still_path?: string | null;
  has_still?: boolean;
  url?: string | null;
  thumb_url?: string | null;
  kind?: RefRole;
  identity?: Record<string, string>;
  identity_urls?: Record<string, string>;
  parent_id?: string | null;
  is_variant?: boolean;
  primary_slot?: string;
};

export type RefSlotState = {
  id: string;
  catalogId: string;
  note: string;
  label?: string;
  item: LibraryItem | null;
  identityPaths?: string[];
};

export type RefRolePayload = {
  path: string;
  role: RefRole;
  id?: string | null;
  name?: string | null;
  note?: string | null;
};

export type FramePin = {
  id: string;
  timestamp_s: number;
  pin: "first" | "last" | "timestamp";
  image: LibraryItem;
};

export type PromptLock = {
  mode: Mode;
  modality: string;
  title?: string;
  preferModel?: string;
};

export type PromptNodeData = {
  onGenerated: (
    result: GenerateResponse,
    job?: { source?: LibraryItem | null },
  ) => void;
  onAddSource: () => void;
  onAddFirst: () => void;
  onAddLast: () => void;
  onAddCharacter: () => void;
  onAddScene: () => void;
  onAddProp?: () => void;
  onAddCostume?: () => void;
  onAddHub?: () => void;
  onAddShot?: () => void;
  onAddShotBuilder?: () => void;
  onAutoBalanceShots?: (seconds: string[]) => void;
  shots?: ShotState[];
  hubAssets?: HubAsset[];
  hubTitle?: string;
  hubNotes?: string;
  sequenceLine?: string;
  hasHub?: boolean;
  onModalityChange: (
    mode: Mode,
    modality: string,
    model?: ModelRow | null,
  ) => void;
  onOpenSettings?: () => void;
  onOpenLibrary?: () => void;
  onLibraryPick?: (handler: (item: LibraryItem) => boolean) => void;
  onAttachSource?: (item: LibraryItem) => void;
  onClose?: () => void;
  onAddPromptBuilder?: () => void;
  onAddDirector?: () => void;
  instrumental?: boolean;
  onInstrumental?: (v: boolean) => void;
  incomingPrompt?: string | null;
  incomingPromptToken?: number;
  incomingPromptMode?: "replace" | "append";
  lockTo?: PromptLock | null;
  pins?: FramePin[];
  onPinsChange?: (pins: FramePin[]) => void;
  onEditPin?: (pin: FramePin) => void;
  onCommitPinStill?: (pin: FramePin, item: LibraryItem) => void;
  editingPinId?: string | null;
  source: LibraryItem | null;
  first: LibraryItem | null;
  last: LibraryItem | null;
  characters: RefSlotState[];
  scenes: RefSlotState[];
  maxRefs: number;
  onAddMask?: () => void;
  hasMaskNode?: boolean;
  rasterizeMask?: () => Promise<MaskRasterResult>;
  getMaskSuffix?: () => string;
  getMaskBoxes?: () => MaskBox[];
  maskReady?: boolean;
};

export type MaskRasterResult = {
  item: LibraryItem | null;
  suffix: string;
};

export type MaskApi = {
  rasterize: () => Promise<MaskRasterResult>;
  suffix: () => string;
  boxes: () => MaskBox[];
  hasContent: () => boolean;
};

export type MaskBox = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
};

export type MaskNodeData = {
  source: LibraryItem | null;
  disabled?: boolean;
  disabledNote?: string;
  onClose?: () => void;
  onRegister?: (api: MaskApi | null) => void;
  onContent?: (has: boolean) => void;
};

export type PromptBuilderNodeData = {
  mode: Mode;
  modality: string;
  instrumental?: boolean;
  onClose?: () => void;
  onApply: (text: string) => void;
};

export type DirectorNodeData = {
  onClose?: () => void;
  onApply: (text: string) => void;
};

export const DIRECTOR_MODALITIES = [
  "t2v",
  "i2v",
  "r2v",
  "bridge",
  "extend",
] as const;

export function directorAllowed(mode?: Mode | string, modality?: string) {
  return (
    mode === "video" &&
    DIRECTOR_MODALITIES.includes(
      (modality || "").toLowerCase() as (typeof DIRECTOR_MODALITIES)[number],
    )
  );
}

export function mergeDirectorBlock(existing: string, block: string) {
  const cam = block.trim();
  const stripped = existing
    .replace(/\n*Camera \(Director\):[\s\S]*$/i, "")
    .trimEnd();
  if (!cam) return stripped;
  if (!stripped) return cam;
  return `${stripped}\n\n${cam}`;
}

export type ToolKind =
  | "upscale"
  | "denoise"
  | "restore"
  | "deblur"
  | "interpolate";

export type ResultNodeData = {
  result: GenerateResponse;
  title?: string;
  prompt?: string;
  generating?: boolean;
  error?: string | null;
  builderId?: string;
  slot?: string;
  resolution?: string;
  resolutionChoices?: string[];
  aspect?: string;
  quality?: string;
  qualityChoices?: string[];
  t2iModel?: string;
  r2iModel?: string;
  assetId?: string;
  sourceStill?: string;
  extraRefs?: string[];
  maxRefs?: number;
  modelId?: string;
  wardrobe?: string;
  name?: string;
  fields?: Record<string, string>;
  sheetKind?: "costume" | "character" | "dress" | "scene" | "prop";
  characterId?: string;
  costumeId?: string;
  nodeKey?: string;
  refPreviews?: { id?: string; label: string; path: string; url?: string }[];
  onPrompt?: (prompt: string) => void;
  onModel?: (id: string) => void;
  onConfirmSheet?: () => void;
  onRegen?: () => void;
  onResolution?: (resolution: string) => void;
  onBusy?: (busy: boolean, error?: string | null) => void;
  onGenerated?: (info: {
    slot: string;
    assetId: string;
    path: string;
    url: string;
    prompt: string;
    cost?: string;
    resolution?: string;
  }) => void;
  onClose?: () => void;
  onTool?: (kind: ToolKind) => void;
  onApplyToPin?: () => void;
  applyLabel?: string;
  dragItem?: LibraryItem | null;
  onDraftEnhance?: (result: GenerateResponse) => void;
  compareSource?: LibraryItem | null;
  onCompareSource?: () => void;
};

export type CompareNodeData = {
  source: LibraryItem;
  result: LibraryItem;
  onClose?: () => void;
};

export type ToolModelRow = {
  id: string;
  key?: string;
  label: string;
  notes?: string;
  cost?: string;
  supports_factor?: boolean;
  factor_choices?: string[];
  default_factor?: string;
  supports_strength?: boolean;
  default_strength?: number | null;
};

export type ToolNodeData = {
  kind: ToolKind;
  title: string;
  source: LibraryItem;
  mediaKind: "image" | "video";
  onClose?: () => void;
  onGenerated: (result: GenerateResponse) => void;
  onReplace: (item: LibraryItem) => void;
  onOpenLibrary: () => void;
};

export type SourceNodeData = {
  title: string;
  accept: SlotAccept;
  item: LibraryItem | null;
  onClear: () => void;
  onOpenLibrary: () => void;
  onAttach: (item: LibraryItem) => void;
  onOsFiles?: (files: File[]) => void;
  onClose?: () => void;
  locked?: boolean;
};

export type AssetRole = "character" | "scene" | "prop" | "costume";
export type AssetKind = AssetRole | "costume";

export type StudioAsset = {
  id: string;
  name: string;
  label?: string;
  notes?: string;
  kind: AssetKind;
  still_path?: string | null;
  still_paths?: string[];
  sheet_path?: string | null;
  has_still?: boolean;
  url?: string | null;
  thumb_url?: string | null;
  owned?: boolean;
  created?: string;
  model?: string;
  parent_id?: string | null;
  is_costume?: boolean;
  is_variant?: boolean;
  primary_slot?: string;
  identity?: Record<string, string>;
  identity_urls?: Record<string, string>;
  fields?: Record<string, string>;
  angle?: string;
  modality?: string;
  prompt?: string;
  cost?: string;
};

export function assetToLibraryItem(asset: StudioAsset): LibraryItem | null {
  const path = (asset.still_path || "").trim();
  const url = asset.url || asset.thumb_url || "";
  if (!path && !url) return null;
  return {
    id: `assets:${asset.id}`,
    name: asset.label || asset.name || asset.id,
    source: "assets",
    kind: "image",
    path: path || asset.id,
    url,
    thumb_url: asset.thumb_url || url || null,
  };
}

export type CreatorKind = "character" | "costume" | "scene" | "prop" | "dress";

export type SheetAnglePatch = {
  slot: string;
  label?: string;
  prompt?: string;
  url?: string;
  path?: string;
  cost?: string;
  generating?: boolean;
  error?: string | null;
  focus?: boolean;
  resolution?: string;
  resolutionChoices?: string[];
  aspect?: string;
  quality?: string;
  qualityChoices?: string[];
  t2iModel?: string;
  r2iModel?: string;
  assetId?: string;
  sourceStill?: string;
  extraRefs?: string[];
  maxRefs?: number;
  modelId?: string;
  wardrobe?: string;
  name?: string;
  fields?: Record<string, string>;
  sheetKind?: "costume" | "character" | "dress" | "scene" | "prop";
  characterId?: string;
  costumeId?: string;
  nodeKey?: string;
  refPreviews?: { id?: string; label: string; path: string; url?: string }[];
};

export type BuilderSessionInfo = {
  assetId: string;
  t2iModel: string;
  r2iModel: string;
  slots: string[];
  name?: string;
  fields?: Record<string, string>;
  wardrobe?: string;
  notes?: string;
  t2iResolution?: string;
  r2iResolution?: string;
  done?: Record<string, string>;
};

export type CreatorBuilderNodeData = {
  kind: CreatorKind;
  attachSlotId?: string;
  bases?: StudioAsset[];
  sessionAssetId?: string;
  doneSlots?: Record<string, string>;
  seedCharacterId?: string;
  seedCostumeId?: string;
  onClose?: () => void;
  onAngle: (slot: string, patch: SheetAnglePatch) => void;
  onSession?: (info: BuilderSessionInfo) => void;
  onSaved: (asset: StudioAsset) => void;
};

export type SheetAngleNodeData = {
  builderId: string;
  slot: string;
  label: string;
  prompt: string;
  url?: string;
  path?: string;
  generating?: boolean;
  error?: string | null;
  onPrompt: (prompt: string) => void;
  onRegen: () => void;
  onClose?: () => void;
};

export type RefNodeData = {
  title: string;
  role: AssetRole;
  item: LibraryItem | null;
  catalogId: string;
  note: string;
  label?: string;
  catalog: RefCatalogEntry[];
  onClear: () => void;
  onOpenLibrary: () => void;
  onAttach: (item: LibraryItem) => void;
  onPickCatalog: (id: string) => void;
  onNote: (note: string) => void;
  onLabel?: (label: string) => void;
  onAddToHub?: () => void;
  onCreate?: () => void;
  onClose?: () => void;
};

export type HubAsset = {
  id: string;
  role: AssetRole;
  label: string;
  item: LibraryItem | null;
};

export type HubNodeData = {
  title: string;
  notes: string;
  assets: HubAsset[];
  sequenceLine: string;
  onTitle: (value: string) => void;
  onNotes: (value: string) => void;
  onClose?: () => void;
};

export const CAMERA_MOVES = [
  "Static",
  "Push in",
  "Pull out",
  "Orbit",
  "Crane up",
  "Crane down",
  "Pan L",
  "Pan R",
  "Tilt",
  "Handheld",
  "Dolly zoom",
  "Roll",
] as const;

export const CAMERA_SPEEDS = ["Slow", "Medium", "Fast"] as const;
export const CAMERA_EASES = ["Linear", "Ease in", "Ease out", "Ease in-out"] as const;

export type ShotState = {
  id: string;
  order: number;
  label: string;
  action: string;
  move: string;
  speed: string;
  ease: string;
  framing: string;
  still: LibraryItem | null;
  duration: string;
};

export type ShotNodeData = {
  order: number;
  label: string;
  action: string;
  move: string;
  speed: string;
  ease: string;
  framing: string;
  still: LibraryItem | null;
  duration: string;
  hubLinked: boolean;
  hubTitle: string;
  sequenceLine: string;
  onPatch: (patch: Partial<ShotState>) => void;
  onAttachStill: (item: LibraryItem) => void;
  onClearStill: () => void;
  onOpenLibrary: () => void;
  onAddBuilder?: () => void;
  onClose?: () => void;
};

export type ShotBuilderNodeData = {
  shotId: string;
  shotLabel: string;
  whoChoices: string[];
  characters?: string[];
  scenes?: string[];
  props?: string[];
  onClose?: () => void;
  onApply: (patch: {
    action: string;
    move: string;
    speed: string;
    ease: string;
    framing: string;
  }) => void;
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

export function sourceAcceptFor(
  mode: Mode | undefined,
  plan: GraphInputs,
): SlotAccept {
  if (mode === "frame") return "video";
  if (plan.source) return plan.source;
  return "any";
}

export function inputPlan(
  modality: string,
  model?: ModelRow | null,
  mode?: Mode,
): GraphInputs {
  if (mode === "storyboard" || modality === "storyboard") {
    return { characters: true, scenes: true };
  }
  if (mode === "frame" || modality === "frame") {
    return { source: "video" };
  }
  if (modality === "bridge" || model?.requires_end_frame) {
    return { first: true, last: true };
  }
  if (modality === "i2v") {
    const last = Boolean(
      model?.first_last || model?.supports_end_frame,
    );
    return { source: "image", last, lastOptional: last };
  }
  if (modality === "i2i") {
    const mask = modelSupportsMask(model);
    const extra = maxRefImages(model, "i2i") > 1;
    return {
      source: "image",
      mask,
      maskOptional: mask,
      extraRefs: extra,
    };
  }
  if (modality === "region") {
    return { source: "image" };
  }
  if (modality === "r2i" || modality === "r2v") {
    const mask = modality === "r2i" && modelSupportsMask(model);
    return {
      source: "image",
      sourceOptional: true,
      characters: true,
      scenes: true,
      mask,
      maskOptional: mask,
    };
  }
  if (modality === "v2v" || modality === "extend") {
    return { source: "video" };
  }
  return {};
}

export function modelSupportsMask(model?: ModelRow | null): boolean {
  if (!model) return false;
  if (model.supports_mask === true) return true;
  const ep = (model.endpoint || "").toLowerCase();
  const key = (model.id || "").toLowerCase();
  return ep.includes("fibo-edit") || key.includes("fibo edit");
}

export function modelUsesRegionBoxes(model?: ModelRow | null): boolean {
  if (!model) return false;
  if (model.supports_region_boxes === true) return true;
  const ep = (model.endpoint || "").toLowerCase();
  const key = `${model.id || ""} ${model.label || ""}`.toLowerCase();
  return ep.includes("seedream") && ep.includes("/edit") || key.includes("seedream 5 pro (edit)") || key.includes("seedream 5 pro · r2i");
}

export function modelUsesSpatialMask(model?: ModelRow | null): boolean {
  return modelSupportsMask(model) || modelUsesRegionBoxes(model);
}

export const MASK_BOX_COLORS = [
  "#E53935",
  "#1E88E5",
  "#43A047",
  "#FDD835",
  "#8E24AA",
  "#FB8C00",
  "#6fdc12",
  "#abb2bf",
] as const;

export const MASK_BOX_COLOR_NAMES = [
  "red",
  "blue",
  "green",
  "yellow",
  "purple",
  "orange",
  "lime",
  "gray",
] as const;

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
  const owned =
    (entry.kind === "character" ||
      entry.kind === "scene" ||
      entry.kind === "prop" ||
      entry.kind === "costume") &&
    Boolean(url?.startsWith("/assets/"));
  return {
    id: `${entry.kind || "ref"}:${entry.id}`,
    name: entry.label || entry.name || entry.id,
    source: owned ? "assets" : "uploads",
    kind: "image",
    path,
    url,
    thumb_url: entry.thumb_url || url || null,
  };
}

export function durationOptions(model?: ModelRow | null): string[] {
  const raw = model?.duration_enum ?? [];
  return raw.map(String).filter((t) => t.trim());
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
  if (t.toLowerCase() === "auto") return "Auto (smart)";
  if (/s$/i.test(t)) return t;
  return `${t}s`;
}
