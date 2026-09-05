import type {
  EdgeStyle,
  GridSnap,
} from "./canvasPrefs";
import type {
  BuilderSessionInfo,
  FramePin,
  LibraryItem,
  Mode,
  PromptCanvasDraft,
  RefSlotState,
  ShotState,
} from "./types";

export const CANVAS_LS_KEY = "ams-canvas-v1";
export const CANVAS_VERSION = 1;

const SKIP_NODE_IDS = new Set([
  "pin-edit-source",
  "pin-edit-prompt",
  "pin-edit-result",
]);

export type CanvasNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  style?: Record<string, unknown>;
  dragHandle?: string;
  data?: Record<string, unknown>;
};

export type CanvasEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  label?: string | null;
};

export type CanvasSlots = {
  source: LibraryItem | null;
  first: LibraryItem | null;
  last: LibraryItem | null;
  characters: RefSlotState[];
  scenes: RefSlotState[];
  props: RefSlotState[];
  costumes: RefSlotState[];
  hubTitle: string;
  hubNotes: string;
  hubIds: string[];
  shots: ShotState[];
  studioMode: Mode;
  studioModality: string;
  instrumental: boolean;
  framePins: FramePin[];
  builderSessions: Record<string, BuilderSessionInfo & { attachSlotId?: string }>;
  toolSources: Record<string, LibraryItem>;
};

export type CanvasSnapshot = {
  version: number;
  savedAt: string;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  slots: CanvasSlots;
  promptDraft: PromptCanvasDraft | null;
  gridSnap?: GridSnap;
  edgeStyle?: EdgeStyle;
};

function tooBigDataUrl(value: string): boolean {
  return value.startsWith("data:") && value.length > 256;
}

export function jsonSafe(value: unknown): unknown {
  if (value == null) return value;
  const t = typeof value;
  if (t === "function") return undefined;
  if (t === "string") return tooBigDataUrl(value as string) ? undefined : value;
  if (t === "number" || t === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .map((row) => jsonSafe(row))
      .filter((row) => row !== undefined);
  }
  if (t === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (typeof raw === "function") continue;
      if (key.startsWith("on") && key.length > 2) continue;
      if (
        key === "rasterizeMask" ||
        key === "getMaskSuffix" ||
        key === "getMaskBoxes"
      ) {
        continue;
      }
      const next = jsonSafe(raw);
      if (next !== undefined) out[key] = next;
    }
    return out;
  }
  return undefined;
}

export function serializeNode(node: {
  id: string;
  type?: string;
  position: { x: number; y: number };
  width?: number | null;
  height?: number | null;
  style?: unknown;
  dragHandle?: string;
  data?: unknown;
}): CanvasNode | null {
  if (!node?.id || SKIP_NODE_IDS.has(node.id) || node.id.startsWith("pin-edit")) {
    return null;
  }
  const style =
    node.style && typeof node.style === "object"
      ? (jsonSafe(node.style) as Record<string, unknown>)
      : undefined;
  const data =
    node.data && typeof node.data === "object"
      ? (jsonSafe(node.data) as Record<string, unknown>)
      : {};
  return {
    id: node.id,
    type: node.type,
    position: {
      x: Number(node.position?.x) || 0,
      y: Number(node.position?.y) || 0,
    },
    width: node.width ?? undefined,
    height: node.height ?? undefined,
    style,
    dragHandle: node.dragHandle,
    data,
  };
}

export function serializeEdge(edge: {
  id?: string;
  source?: string;
  target?: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  label?: unknown;
}): CanvasEdge | null {
  if (!edge?.source || !edge?.target) return null;
  if (
    SKIP_NODE_IDS.has(edge.source) ||
    SKIP_NODE_IDS.has(edge.target) ||
    edge.source.startsWith("pin-edit") ||
    edge.target.startsWith("pin-edit")
  ) {
    return null;
  }
  const label =
    typeof edge.label === "string" || edge.label == null
      ? edge.label ?? undefined
      : String(edge.label);
  return {
    id: edge.id || `e-${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    type: edge.type,
    label: label ?? null,
  };
}

export function buildSnapshot(input: {
  nodes: Parameters<typeof serializeNode>[0][];
  edges: Parameters<typeof serializeEdge>[0][];
  slots: CanvasSlots;
  promptDraft: PromptCanvasDraft | null;
  gridSnap?: GridSnap;
  edgeStyle?: EdgeStyle;
}): CanvasSnapshot {
  return {
    version: CANVAS_VERSION,
    savedAt: new Date().toISOString(),
    nodes: input.nodes.map(serializeNode).filter((n): n is CanvasNode => Boolean(n)),
    edges: input.edges.map(serializeEdge).filter((e): e is CanvasEdge => Boolean(e)),
    slots: jsonSafe(input.slots) as CanvasSlots,
    promptDraft: (jsonSafe(input.promptDraft) as PromptCanvasDraft | null) || null,
    gridSnap: input.gridSnap,
    edgeStyle: input.edgeStyle,
  };
}

export function isCanvasSnapshot(raw: unknown): raw is CanvasSnapshot {
  if (!raw || typeof raw !== "object") return false;
  const row = raw as CanvasSnapshot;
  return (
    Number(row.version) === CANVAS_VERSION &&
    Array.isArray(row.nodes) &&
    Array.isArray(row.edges) &&
    Boolean(row.slots) &&
    typeof row.slots === "object"
  );
}

export function readLocalCanvas(): CanvasSnapshot | null {
  try {
    const raw = localStorage.getItem(CANVAS_LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isCanvasSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeLocalCanvas(snapshot: CanvasSnapshot) {
  try {
    localStorage.setItem(CANVAS_LS_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
}

export function clearLocalCanvas() {
  try {
    localStorage.removeItem(CANVAS_LS_KEY);
  } catch {
    /* ignore */
  }
}

export async function fetchCanvas(): Promise<CanvasSnapshot | null> {
  try {
    const res = await fetch("/canvas");
    if (!res.ok) return readLocalCanvas();
    const body = (await res.json()) as { item?: unknown; ok?: boolean };
    if (isCanvasSnapshot(body.item)) return body.item;
    return readLocalCanvas();
  } catch {
    return readLocalCanvas();
  }
}

export async function putCanvas(snapshot: CanvasSnapshot): Promise<void> {
  writeLocalCanvas(snapshot);
  const res = await fetch("/canvas", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(
      (typeof body?.detail === "string" && body.detail) || "Could not save canvas.",
    );
  }
}

export async function deleteCanvas(): Promise<void> {
  clearLocalCanvas();
  try {
    await fetch("/canvas", { method: "DELETE" });
  } catch {
    /* ignore */
  }
}
