import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useNodesInitialized,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CreatorBuilderNode from "./CreatorBuilderNode";
import LibraryPanel from "./LibraryPanel";
import SheetAngleNode from "./SheetAngleNode";
import MediaLightbox from "./MediaLightbox";
import ModelGuide from "./ModelGuide";
import SettingsPanel from "./SettingsPanel";
import DirectorNode from "./DirectorNode";
import HubNode from "./HubNode";
import PromptBuilderNode from "./PromptBuilderNode";
import ShotBuilderNode from "./ShotBuilderNode";
import ShotNode from "./ShotNode";
import PromptNode, { countFilledRefs, reservedRefNodes } from "./PromptNode";
import RefNode from "./RefNode";
import CompareNode from "./CompareNode";
import MaskNode from "./MaskNode";
import ResultNode from "./ResultNode";
import SourceNode from "./SourceNode";
import ToolNode from "./ToolNode";
import { isAudioPath, isVideoPath } from "./media";
import {
  consumeLibraryDrag,
  itemMediaKind,
  peekLibraryDrag,
  slotAccepts,
  slotNeedLabel,
} from "./libraryDrag";
import {
  filesFromDataTransfer,
  importOsFiles,
  isOsFileDrag,
} from "./osImport";
import { errorFromBody, readJson } from "./http";
import {
  normalizeEdgeStyle,
  normalizeSnap,
  readStoredEdgeStyle,
  readStoredSnap,
  snapGridFor,
  storeEdgeStyle,
  storeSnap,
  type EdgeStyle,
  type GridSnap,
} from "./canvasPrefs";
import { applyTheme, normalizeTheme, readStoredTheme, type ThemeName } from "./theme";
import {
  ANGLE_GENERATE_EVENT,
  ANGLE_SPAWN_EVENT,
  type AngleGenerateDetail,
  type AngleSpawnDetail,
} from "./angleSpawn";
import {
  CORE_SLOTS,
  EXTRA_SLOTS,
  SLOT_LABEL,
  preferredIdentityPaths,
} from "./sheetUi";
import { bindToast, toast } from "./toast";
import {
  assetToLibraryItem,
  catalogToItem,
  hasLibraryPayload,
  inputPlan,
  maxRefImages,
  parseLibraryPayload,
  sourceAcceptFor,
  type FramePin,
  type GenerateResponse,
  type GraphInputs,
  type LibraryItem,
  type MaskApi,
  type MaskNodeData,
  type Mode,
  type ModelRow,
  directorAllowed,
  type AssetRole,
  type CompareNodeData,
  type CreatorBuilderNodeData,
  type CreatorKind,
  type SheetAnglePatch,
  type DirectorNodeData,
  type HubAsset,
  type HubNodeData,
  type PromptBuilderNodeData,
  type PromptNodeData,
  type RefCatalogEntry,
  type RefNodeData,
  type RefSlotState,
  type ResultNodeData,
  type ShotBuilderNodeData,
  type ShotNodeData,
  type SheetAngleNodeData,
  type ShotState,
  type SlotAccept,
  type StudioAsset,
  type SourceNodeData,
  type ToolKind,
  type ToolNodeData,
} from "./types";
import "./App.css";

type StudioNode =
  | Node<PromptNodeData, "prompt">
  | Node<PromptBuilderNodeData, "builder">
  | Node<DirectorNodeData, "director">
  | Node<ResultNodeData, "result">
  | Node<CompareNodeData, "compare">
  | Node<MaskNodeData, "mask">
  | Node<SourceNodeData, "source">
  | Node<SourceNodeData, "first">
  | Node<SourceNodeData, "last">
  | Node<RefNodeData, "character">
  | Node<RefNodeData, "scene">
  | Node<RefNodeData, "prop">
  | Node<HubNodeData, "hub">
  | Node<ShotNodeData, "shot">
  | Node<ShotBuilderNodeData, "shot-builder">
  | Node<CreatorBuilderNodeData, "creator-builder">
  | Node<SheetAngleNodeData, "sheet-angle">
  | Node<ToolNodeData, "upscale">
  | Node<ToolNodeData, "denoise">
  | Node<ToolNodeData, "restore">
  | Node<ToolNodeData, "deblur">
  | Node<ToolNodeData, "interpolate">;

const TOOL_TYPES = ["upscale", "denoise", "restore", "deblur", "interpolate"] as const;

const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  builder: PromptBuilderNode,
  director: DirectorNode,
  result: ResultNode,
  compare: CompareNode,
  mask: MaskNode,
  source: SourceNode,
  first: SourceNode,
  last: SourceNode,
  character: RefNode,
  scene: RefNode,
  prop: RefNode,
  hub: HubNode,
  shot: ShotNode,
  "shot-builder": ShotBuilderNode,
  "creator-builder": CreatorBuilderNode,
  "sheet-angle": SheetAngleNode,
  upscale: ToolNode,
  denoise: ToolNode,
  restore: ToolNode,
  deblur: ToolNode,
  interpolate: ToolNode,
};

function itemFromResult(result: GenerateResponse): LibraryItem | null {
  const local = result.local_paths?.[0] || "";
  const url = result.result_paths?.[0] || "";
  if (!local && !url) return null;
  const sample = url || local;
  const kind = isVideoPath(sample)
    ? "video"
    : isAudioPath(sample)
      ? "audio"
      : "image";
  const name = (local || url).split(/[\\/]/).pop() || "result";
  const path = local || (url.startsWith("/outputs/") ? url : local);
  return {
    id: `gen:${local || url}`,
    name,
    source: "generated",
    kind,
    path,
    url,
    thumb_url: kind === "image" ? url : null,
  };
}

const WORLD: [[number, number], [number, number]] = [
  [-600, -600],
  [10800, 7200],
];

const PROMPT_POS = { x: 420, y: 90 };
const PROMPT_FALLBACK = { w: 420, h: 480 };

function viewportToCenterPrompt(width = PROMPT_FALLBACK.w, height = PROMPT_FALLBACK.h) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  return {
    x: vw / 2 - PROMPT_POS.x - width / 2,
    y: vh / 2 - PROMPT_POS.y - height / 2,
    zoom: 1,
  };
}
const SOURCE_ID = "source";
const FIRST_ID = "first";
const LAST_ID = "last";
const RESULT_ID = "result";
const MASK_ID = "mask";
function compareIdFor(resultId: string) {
  return `compare-${resultId}`;
}

function stillItem(item: LibraryItem | null | undefined): LibraryItem | null {
  if (!item) return null;
  if (itemMediaKind(item) !== "image") return null;
  return item;
}

function editPrimaryStill(
  source: LibraryItem | null,
  characters: RefSlotState[],
  scenes: RefSlotState[],
): LibraryItem | null {
  const fromSource = stillItem(source);
  if (fromSource) return fromSource;
  for (const row of [...characters, ...scenes]) {
    const hit = stillItem(row.item);
    if (hit) return hit;
  }
  return null;
}
const BUILDER_ID = "prompt-builder";
const DIRECTOR_ID = "director";
const HUB_ID = "asset-hub";
function spbId(shotId: string) {
  return `spb-${shotId}`;
}
const PIN_EDIT_SOURCE = "pin-edit-source";
const PIN_EDIT_PROMPT = "pin-edit-prompt";
const PIN_EDIT_RESULT = "pin-edit-result";

function isPinEditId(id: string) {
  return id.startsWith("pin-edit");
}

function renumberShots(rows: ShotState[]): ShotState[] {
  return rows.map((row, index) => {
    const order = index + 1;
    const auto = /^shot\s+\d+$/i.test((row.label || "").trim());
    return {
      ...row,
      order,
      label: auto || !row.label.trim() ? `Shot ${order}` : row.label,
    };
  });
}

function assetNames(rows: RefSlotState[], hubIds: string[]): string[] {
  const attached = rows.filter((r) => hubIds.includes(r.id));
  const src = attached.length ? attached : rows;
  const out: string[] = [];
  for (const row of src) {
    const name = (row.label || row.item?.name || "").trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

function sequenceLine(rows: ShotState[]): string {
  if (!rows.length) return "";
  return [...rows]
    .sort((a, b) => a.order - b.order)
    .map((row) => row.label || `Shot ${row.order}`)
    .join(" → ");
}

type PinEditSession = {
  pinId: string;
  timestamp_s: number;
  still: LibraryItem;
};

const initialEdges: Edge[] = [];

const initialNodes: StudioNode[] = [
  {
    id: "prompt",
    type: "prompt",
    position: PROMPT_POS,
    dragHandle: ".node-header",
    data: {
      onGenerated: () => undefined,
      onAddSource: () => undefined,
      onAddFirst: () => undefined,
      onAddLast: () => undefined,
      onAddCharacter: () => undefined,
      onAddScene: () => undefined,
      onModalityChange: () => undefined,
      onOpenSettings: () => undefined,
      onOpenLibrary: () => undefined,
      onAttachSource: () => undefined,
      source: null,
      first: null,
      last: null,
      characters: [],
      scenes: [],
      maxRefs: 0,
    },
  },
];

function StudioCanvas() {
  const [sideTab, setSideTab] = useState<"library" | "assets" | null>(null);
  const openLibrary = () => setSideTab("library");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const libraryPickRef = useRef<((item: LibraryItem) => boolean) | null>(null);
  const [sourceItem, setSourceItem] = useState<LibraryItem | null>(null);
  const [firstItem, setFirstItem] = useState<LibraryItem | null>(null);
  const [lastItem, setLastItem] = useState<LibraryItem | null>(null);
  const [characters, setCharacters] = useState<RefSlotState[]>([]);
  const [scenes, setScenes] = useState<RefSlotState[]>([]);
  const [props, setProps] = useState<RefSlotState[]>([]);
  const [hubTitle, setHubTitle] = useState("");
  const [hubNotes, setHubNotes] = useState("");
  const [hubIds, setHubIds] = useState<string[]>([]);
  const [shots, setShots] = useState<ShotState[]>([]);
  const [activeShotId, setActiveShotId] = useState<string | null>(null);
  const [charCatalog, setCharCatalog] = useState<RefCatalogEntry[]>([]);
  const [sceneCatalog, setSceneCatalog] = useState<RefCatalogEntry[]>([]);
  const [propCatalog, setPropCatalog] = useState<RefCatalogEntry[]>([]);
  const [builderSessions, setBuilderSessions] = useState<
    Record<
      string,
      {
        assetId: string;
        t2iModel: string;
        r2iModel: string;
        slots: string[];
        attachSlotId?: string;
        name?: string;
        fields?: Record<string, string>;
        wardrobe?: string;
        notes?: string;
        t2iResolution?: string;
        r2iResolution?: string;
        done?: Record<string, string>;
      }
    >
  >({});
  const [studioMode, setStudioMode] = useState<Mode>("image");
  const [studioModality, setStudioModality] = useState("t2i");
  const [maskReady, setMaskReady] = useState(false);
  const [instrumental, setInstrumental] = useState(true);
  const [appliedPrompt, setAppliedPrompt] = useState<{
    text: string;
    token: number;
    mode: "replace" | "append";
  } | null>(null);
  const [theme, setTheme] = useState<ThemeName>(() => readStoredTheme());
  const [gridSnap, setGridSnap] = useState<GridSnap>(() => readStoredSnap());
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>(() =>
    readStoredEdgeStyle(),
  );
  const [plan, setPlan] = useState<GraphInputs>({});
  const [maxRefs, setMaxRefs] = useState(0);
  const sourceAccept = sourceAcceptFor(studioMode, plan);
  const [framePins, setFramePins] = useState<FramePin[]>([]);
  const [pinEdit, setPinEdit] = useState<PinEditSession | null>(null);
  const pinEditRef = useRef(pinEdit);
  pinEditRef.current = pinEdit;
  const [toolSources, setToolSources] = useState<Record<string, LibraryItem>>(
    {},
  );
  const [toastMsg, setToastMsg] = useState<{ text: string; error: boolean } | null>(
    null,
  );

  useEffect(() => {
    bindToast((message, error) => {
      setToastMsg({ text: message, error: Boolean(error) });
    });
    return () => bindToast(null);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!settingsOpen && !guideOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setSettingsOpen(false);
      setGuideOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, guideOpen]);

  useEffect(() => {
    const ac = new AbortController();
    fetch("/settings", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: {
          preferences?: {
            theme?: string;
            grid_snap?: string;
            edge_style?: string;
          };
        } | null) => {
        if (!body) return;
        setTheme(normalizeTheme(body.preferences?.theme ?? readStoredTheme()));
        if (body.preferences?.grid_snap) {
          setGridSnap(normalizeSnap(body.preferences.grid_snap));
        }
        if (body.preferences?.edge_style) {
          setEdgeStyle(normalizeEdgeStyle(body.preferences.edge_style));
        }
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, []);

  const persistPrefs = useCallback((patch: Record<string, string>) => {
    void fetch("/settings/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => undefined);
  }, []);

  const setThemePref = useCallback((next: ThemeName) => {
    setTheme(next);
    applyTheme(next);
    persistPrefs({ theme: next });
  }, [persistPrefs]);

  const setGridSnapPref = useCallback(
    (next: GridSnap) => {
      setGridSnap(next);
      storeSnap(next);
      persistPrefs({ grid_snap: next });
    },
    [persistPrefs],
  );

  const setEdgeStylePref = useCallback(
    (next: EdgeStyle) => {
      setEdgeStyle(next);
      storeEdgeStyle(next);
      persistPrefs({ edge_style: next });
    },
    [persistPrefs],
  );

  const edgeType = edgeStyle === "straight" ? "straight" : "default";

  const applyBuilderPrompt = useCallback((text: string) => {
    setAppliedPrompt((cur) => ({
      text,
      token: (cur?.token ?? 0) + 1,
      mode: "replace",
    }));
  }, []);

  const applyDirectorPrompt = useCallback((text: string) => {
    setAppliedPrompt((cur) => ({
      text,
      token: (cur?.token ?? 0) + 1,
      mode: "append",
    }));
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const id = window.setTimeout(() => setToastMsg(null), 6000);
    return () => window.clearTimeout(id);
  }, [toastMsg]);

  const [nodes, setNodes, onNodesChange] = useNodesState<StudioNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const maskApiRef = useRef<MaskApi | null>(null);
  const toolCompareSourceRef = useRef<Record<string, LibraryItem | null>>({});
  const registerMaskApi = useCallback((api: MaskApi | null) => {
    maskApiRef.current = api;
  }, []);

  useEffect(() => {
    setEdges((current) =>
      current.map((e) => (e.type === edgeType ? e : { ...e, type: edgeType })),
    );
  }, [edgeType, setEdges]);

  const { screenToFlowPosition, getNodes, fitView, setCenter } = useReactFlow();
  const nodesReady = useNodesInitialized();
  const didCenterPrompt = useRef(false);
  const dimChangeTimer = useRef(0);

  useEffect(() => {
    if (didCenterPrompt.current || !nodesReady) return;
    const prompt = getNodes().find((n) => n.id === "prompt");
    if (!prompt) return;
    const w = prompt.measured?.width ?? PROMPT_FALLBACK.w;
    const h = prompt.measured?.height ?? PROMPT_FALLBACK.h;
    didCenterPrompt.current = true;
    setCenter(prompt.position.x + w / 2, prompt.position.y + h / 2, {
      zoom: 1,
    });
  }, [getNodes, nodesReady, setCenter]);

  const frameAll = useCallback(() => {
    if (!getNodes().length) return;
    void fitView({
      padding: 0.2,
      duration: 220,
      minZoom: 0.2,
      maxZoom: 1,
    });
  }, [fitView, getNodes]);

  const closePinEdit = useCallback(() => {
    setPinEdit(null);
    setNodes((current) => current.filter((n) => !isPinEditId(n.id)));
    setEdges((current) =>
      current.filter((e) => !isPinEditId(e.source) && !isPinEditId(e.target)),
    );
  }, [setEdges, setNodes]);

  const closeNode = useCallback(
    (id: string) => {
      if (id === "prompt") return;
      if (isPinEditId(id)) {
        closePinEdit();
        return;
      }
      if (id === SOURCE_ID) setSourceItem(null);
      if (id === MASK_ID) {
        maskApiRef.current = null;
        setMaskReady(false);
      }
      if (id === FIRST_ID) setFirstItem(null);
      if (id === LAST_ID) setLastItem(null);
      if (id.startsWith("char-")) {
        setCharacters((cur) => cur.filter((r) => r.id !== id));
      }
      if (id.startsWith("scene-")) {
        setScenes((cur) => cur.filter((r) => r.id !== id));
      }
      if (id.startsWith("prop-")) {
        setProps((cur) => cur.filter((r) => r.id !== id));
      }
      if (id === HUB_ID) {
        setHubIds([]);
      }
      setHubIds((cur) => cur.filter((row) => row !== id));
      if (id.startsWith("cbuild-")) {
        setBuilderSessions((cur) => {
          const next = { ...cur };
          delete next[id];
          return next;
        });
        setNodes((current) =>
          current.filter(
            (n) => n.id !== id && !n.id.startsWith(`sang-${id}-`),
          ),
        );
        setEdges((current) =>
          current.filter(
            (e) =>
              e.source !== id &&
              e.target !== id &&
              !String(e.source).startsWith(`sang-${id}-`) &&
              !String(e.target).startsWith(`sang-${id}-`),
          ),
        );
      }
      if (id.startsWith("shot-")) {
        setShots((cur) => renumberShots(cur.filter((s) => s.id !== id)));
        setActiveShotId((cur) => (cur === id ? null : cur));
        const builderId = spbId(id);
        setNodes((current) => current.filter((n) => n.id !== builderId));
        setEdges((current) =>
          current.filter((e) => e.source !== builderId && e.target !== builderId),
        );
      }
      if (TOOL_TYPES.includes(id.split("-")[0] as ToolKind)) {
        setToolSources((cur) => {
          const next = { ...cur };
          delete next[id];
          return next;
        });
      }
      const compareId = compareIdFor(id);
      setNodes((current) =>
        current.filter((n) => n.id !== id && n.id !== compareId),
      );
      setEdges((current) =>
        current.filter(
          (e) =>
            e.source !== id &&
            e.target !== id &&
            e.source !== compareId &&
            e.target !== compareId,
        ),
      );
    },
    [closePinEdit, setEdges, setNodes],
  );

  const addCompareFromResult = useCallback(
    (resultId: string) => {
      const compareId = compareIdFor(resultId);
      setNodes((current) => {
        const resultNode = current.find((n) => n.id === resultId);
        if (!resultNode || resultNode.type !== "result") return current;
        const source = stillItem(resultNode.data.compareSource);
        const mapped = itemFromResult(resultNode.data.result);
        if (!source || !mapped || mapped.kind !== "image") return current;
        const existing = current.find((n) => n.id === compareId);
        const position = existing?.position ?? {
          x: resultNode.position.x + 440,
          y: resultNode.position.y,
        };
        const next: StudioNode = {
          id: compareId,
          type: "compare",
          position,
          dragHandle: ".node-header",
          data: {
            source,
            result: mapped,
            onClose: () => closeNode(compareId),
          },
        };
        if (existing) {
          return current.map((n) => (n.id === compareId ? next : n));
        }
        return [...current, next];
      });
      setEdges((current) => {
        if (current.some((e) => e.id === `e-${resultId}-${compareId}`)) {
          return current;
        }
        return addEdge(
          {
            id: `e-${resultId}-${compareId}`,
            source: resultId,
            target: compareId,
            style: { stroke: "#8aa4c2", strokeWidth: 2 },
          },
          current,
        );
      });
    },
    [closeNode, setEdges, setNodes],
  );

  const spawnResult = useCallback(
    (result: GenerateResponse, job?: { source?: LibraryItem | null }) => {
      const compareSource = stillItem(job?.source);
      const mapped = itemFromResult(result);
      const compareId = compareIdFor(RESULT_ID);
      setNodes((current) => {
        const prompt = current.find((n) => n.id === "prompt");
        const existing = current.find((n) => n.id === RESULT_ID);
        const position = existing?.position ?? {
          x: (prompt?.position.x ?? PROMPT_POS.x) + 500,
          y: prompt?.position.y ?? PROMPT_POS.y,
        };
        const next: StudioNode = {
          id: RESULT_ID,
          type: "result",
          position,
          dragHandle: ".node-header",
          data: {
            result,
            compareSource,
            onClose: () => closeNode(RESULT_ID),
            onTool: () => undefined,
            onCompareSource: () => addCompareFromResult(RESULT_ID),
          },
        };
        let nodes = existing
          ? current.map((n) => (n.id === RESULT_ID ? next : n))
          : [...current, next];
        const openCompare = nodes.find((n) => n.id === compareId);
        if (openCompare && openCompare.type === "compare" && mapped && compareSource) {
          nodes = nodes.map((n) =>
            n.id === compareId && n.type === "compare"
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    source: compareSource,
                    result: mapped,
                  },
                }
              : n,
          );
        }
        return nodes;
      });
      setEdges((current) => {
        if (current.some((e) => e.id === "e-prompt-result")) return current;
        return addEdge(
          {
            id: "e-prompt-result",
            source: "prompt",
            target: RESULT_ID,
            style: { stroke: "#8aa4c2", strokeWidth: 2 },
          },
          current,
        );
      });
    },
    [addCompareFromResult, closeNode, setEdges, setNodes],
  );

  const applyStillToPinRef = useRef<
    (pinId: string, item: LibraryItem, timestampS?: number) => Promise<boolean>
  >(async () => false);

  const spawnPinResult = useCallback(
    (result: GenerateResponse) => {
      const mapped = itemFromResult(result);
      const applyNow = () => {
        const session = pinEditRef.current;
        if (!session?.pinId) {
          toast("Pin id is missing.", true);
          return;
        }
        if (!mapped || mapped.kind === "video" || mapped.kind === "audio") {
          toast("Apply to pin needs an image result.", true);
          return;
        }
        void applyStillToPinRef.current(
          session.pinId,
          mapped,
          session.timestamp_s,
        );
      };
      setNodes((current) => {
        const parent = current.find((n) => n.id === PIN_EDIT_PROMPT);
        const existing = current.find((n) => n.id === PIN_EDIT_RESULT);
        const node: StudioNode = {
          id: PIN_EDIT_RESULT,
          type: "result",
          position: existing?.position ?? {
            x: (parent?.position.x ?? PROMPT_POS.x) + 360,
            y: parent?.position.y ?? PROMPT_POS.y,
          },
          dragHandle: ".node-header",
          data: {
            result,
            onClose: () => closeNode(PIN_EDIT_RESULT),
            onTool: () => undefined,
            onApplyToPin: applyNow,
            applyLabel: "Apply to pin",
            dragItem: mapped && mapped.kind === "image" ? mapped : null,
          },
        };
        if (existing) {
          return current.map((n) => (n.id === PIN_EDIT_RESULT ? node : n));
        }
        return [...current, node];
      });
      setEdges((current) => {
        if (current.some((e) => e.id === "e-pin-edit-result")) return current;
        return addEdge(
          {
            id: "e-pin-edit-result",
            source: PIN_EDIT_PROMPT,
            target: PIN_EDIT_RESULT,
            style: { stroke: "#8aa4c2", strokeWidth: 2 },
          },
          current,
        );
      });
    },
    [closeNode, setEdges, setNodes],
  );

  const spawnPinEdit = useCallback(
    (pin: FramePin) => {
      if (!pin.image?.path) {
        toast("This pin has no still to edit.", true);
        return;
      }
      setPinEdit({
        pinId: pin.id,
        timestamp_s: pin.timestamp_s,
        still: pin.image,
      });
      setNodes((current) => {
        const without = current.filter((n) => !isPinEditId(n.id));
        const prompt = without.find((n) => n.id === "prompt");
        const px = prompt?.position.x ?? PROMPT_POS.x;
        const py = prompt?.position.y ?? PROMPT_POS.y;
        const srcNode: StudioNode = {
          id: PIN_EDIT_SOURCE,
          type: "source",
          position: { x: px + 480, y: py + 80 },
          dragHandle: ".node-header",
          data: {
            title: `Pin @ t=${pin.timestamp_s.toFixed(2)}s`,
            accept: "image",
            item: pin.image,
            locked: true,
            onClear: () => undefined,
            onOpenLibrary: () => undefined,
            onAttach: () => undefined,
            onClose: () => closePinEdit(),
          },
        };
        const prNode: StudioNode = {
          id: PIN_EDIT_PROMPT,
          type: "prompt",
          position: { x: px + 760, y: py + 40 },
          dragHandle: ".node-header",
          data: {
            onGenerated: spawnPinResult,
            onAddSource: () => undefined,
            onAddFirst: () => undefined,
            onAddLast: () => undefined,
            onAddCharacter: () => undefined,
            onAddScene: () => undefined,
            onModalityChange: () => undefined,
            onClose: () => closePinEdit(),
            lockTo: {
              mode: "image",
              modality: "i2i",
              title: `Editing pin @ t=${pin.timestamp_s.toFixed(2)}s`,
              preferModel: "flux 2 pro",
            },
            source: pin.image,
            first: null,
            last: null,
            characters: [],
            scenes: [],
            maxRefs: 0,
          },
        };
        return [...without, srcNode, prNode];
      });
      setEdges((current) => {
        const without = current.filter(
          (e) => !isPinEditId(e.source) && !isPinEditId(e.target),
        );
        return addEdge(
          {
            id: "e-pin-edit-src-prompt",
            source: PIN_EDIT_SOURCE,
            target: PIN_EDIT_PROMPT,
            style: { stroke: "#8aa4c2", strokeWidth: 2 },
          },
          without,
        );
      });
    },
    [closePinEdit, setEdges, setNodes, spawnPinResult],
  );

  const applyStillToPin = useCallback(
    async (pinId: string, item: LibraryItem, timestampS?: number) => {
      const id = (pinId || "").trim();
      if (!id) {
        toast("Pin id is missing.", true);
        return false;
      }
      const existing = framePins.find((p) => p.id === id);
      if (!existing && pinEdit?.pinId !== id) {
        toast("Pin id is missing.", true);
        return false;
      }
      const path = (item.path || item.url || "").trim();
      if (!path) {
        toast("That still has no file path.", true);
        return false;
      }
      const ts =
        timestampS ??
        existing?.timestamp_s ??
        pinEdit?.timestamp_s ??
        0;
      try {
        const res = await fetch("/frame/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_path: path,
            timestamp_s: ts,
            source_path: existing?.image.path || pinEdit?.still.path || null,
            pin_id: id,
          }),
        });
        const body = await readJson(res);
        if (!body.ok || !body.pin) {
          toast(
            (typeof body.error === "string" && body.error) ||
              "Could not apply this still to the pin.",
            true,
          );
          return false;
        }
        const pinRow = body.pin as Record<string, unknown>;
        const url = String(pinRow.thumb_url || pinRow.url || item.url || "");
        const bust = url.includes("?") ? "&" : "?";
        const fresh = url ? `${url}${bust}v=${Date.now()}` : url;
        const still: LibraryItem = {
          id: String(pinRow.id || id),
          name: String(pinRow.name || item.name || "pin"),
          source: String(pinRow.source || "uploads"),
          kind: "image",
          path: String(pinRow.path || path),
          url: fresh,
          thumb_url: fresh,
        };
        setFramePins((cur) =>
          cur.map((p) => (p.id === id ? { ...p, image: still } : p)),
        );
        setPinEdit((cur) =>
          cur && cur.pinId === id ? { ...cur, still } : cur,
        );
        toast(`Applied still to pin @ t=${Number(ts).toFixed(2)}s`);
        return true;
      } catch (err: unknown) {
        console.error("Apply to pin failed", err);
        toast(err instanceof Error ? err.message : "Apply to pin failed.", true);
        return false;
      }
    },
    [framePins, pinEdit],
  );
  applyStillToPinRef.current = applyStillToPin;

  const applyPinStill = useCallback(
    (result: GenerateResponse) => {
      if (!pinEdit?.pinId) {
        toast("Pin id is missing.", true);
        return;
      }
      const item = itemFromResult(result);
      if (!item || item.kind === "video" || item.kind === "audio") {
        toast("Apply to pin needs an image result.", true);
        return;
      }
      void applyStillToPin(pinEdit.pinId, item, pinEdit.timestamp_s);
    },
    [applyStillToPin, pinEdit],
  );

  const spawnResultNear = useCallback(
    (fromId: string, result: GenerateResponse) => {
      const resultId = `result-${Date.now().toString(36)}`;
      setNodes((current) => {
        const parent = current.find((n) => n.id === fromId);
        let compareSource: LibraryItem | null = null;
        if (parent?.type === "result") {
          compareSource = stillItem(parent.data.compareSource);
        }
        if (!compareSource) {
          compareSource = stillItem(toolCompareSourceRef.current[fromId]);
        }
        const node: StudioNode = {
          id: resultId,
          type: "result",
          position: {
            x: (parent?.position.x ?? PROMPT_POS.x) + 360,
            y: parent?.position.y ?? PROMPT_POS.y,
          },
          dragHandle: ".node-header",
          data: {
            result,
            compareSource,
            onClose: () => closeNode(resultId),
            onTool: () => undefined,
          },
        };
        if (compareSource) {
          toolCompareSourceRef.current[resultId] = compareSource;
        }
        return [...current, node];
      });
      setEdges((current) =>
        addEdge(
          {
            id: `e-${fromId}-${resultId}`,
            source: fromId,
            target: resultId,
            style: { stroke: "#8aa4c2", strokeWidth: 2 },
          },
          current,
        ),
      );
    },
    [closeNode, setEdges, setNodes],
  );

  const spawnTool = useCallback(
    (parentId: string, kind: ToolKind, result: GenerateResponse) => {
      const item = itemFromResult(result);
      if (!item || !item.path) {
        toast("This result has no local file to send to a tool.", true);
        return;
      }
      if (item.kind === "audio") {
        toast("Tools are for image or video results.", true);
        return;
      }
      const id = `${kind}-${Date.now().toString(36)}`;
      const titles: Record<ToolKind, string> = {
        upscale: "Upscale",
        denoise: "Denoise",
        restore: "Restore",
        deblur: "Deblur",
        interpolate: "Interpolate",
      };
      setToolSources((cur) => ({ ...cur, [id]: item }));
      setNodes((current) => {
        const parent = current.find((n) => n.id === parentId);
        let cs: LibraryItem | null = null;
        if (parent?.type === "result") {
          cs = stillItem(parent.data.compareSource);
        }
        if (!cs) {
          cs = stillItem(toolCompareSourceRef.current[parentId]);
        }
        if (cs) toolCompareSourceRef.current[id] = cs;
        const node: StudioNode = {
          id,
          type: kind,
          position: {
            x: (parent?.position.x ?? PROMPT_POS.x) + 360,
            y: (parent?.position.y ?? PROMPT_POS.y) + 40,
          },
          dragHandle: ".node-header",
          data: {
            kind,
            title: titles[kind],
            source: item,
            mediaKind: item.kind === "video" ? "video" : "image",
            onClose: () => closeNode(id),
            onGenerated: () => undefined,
            onReplace: () => undefined,
            onOpenLibrary: () => openLibrary(),
          },
        };
        return [...current, node];
      });
      setEdges((current) =>
        addEdge(
          {
            id: `e-${parentId}-${id}`,
            source: parentId,
            target: id,
            style: { stroke: "#8aa4c2", strokeWidth: 2 },
          },
          current,
        ),
      );
    },
    [closeNode, setEdges, setNodes],
  );

  const ensureSlot = useCallback(
    (
      id: "source" | "first" | "last",
      title: string,
      accept: SlotAccept,
      yOff: number,
    ) => {
      setNodes((current) => {
        if (current.some((n) => n.id === id)) return current;
        const prompt = current.find((n) => n.id === "prompt");
        const node: StudioNode = {
          id,
          type: id,
          position: {
            x: Math.max(-160, (prompt?.position.x ?? PROMPT_POS.x) - 300),
            y: (prompt?.position.y ?? PROMPT_POS.y) + yOff,
          },
          dragHandle: ".node-header",
          data: {
            title,
            accept,
            item: null,
            onClear: () => undefined,
            onOpenLibrary: () => openLibrary(),
            onAttach: () => undefined,
            onOsFiles: () => undefined,
            onClose: () => closeNode(id),
          },
        };
        return [...current, node];
      });
      const edgeId = `e-${id}-prompt`;
      setEdges((current) => {
        let next = current;
        if (!next.some((e) => e.id === edgeId)) {
          next = addEdge(
            {
              id: edgeId,
              source: id,
              target: "prompt",
              style: { stroke: "#8aa4c2", strokeWidth: 2 },
            },
            next,
          );
        }
        return next;
      });
      if (id === SOURCE_ID) {
        setEdges((current) => {
          if (
            !current.some((e) => e.target === MASK_ID || e.source === MASK_ID)
          ) {
            return current;
          }
          if (current.some((e) => e.id === "e-source-mask")) return current;
          return addEdge(
            {
              id: "e-source-mask",
              source: SOURCE_ID,
              target: MASK_ID,
              style: { stroke: "#8aa4c2", strokeWidth: 2 },
            },
            current,
          );
        });
      }
    },
    [closeNode, setEdges, setNodes],
  );

  const addSourceNode = useCallback(() => {
    const accept = sourceAccept;
    const title = accept === "video" ? "Source Video" : "Source";
    ensureSlot(SOURCE_ID, title, accept, 36);
  }, [ensureSlot, sourceAccept]);

  const addMaskNode = useCallback(() => {
    const still = editPrimaryStill(sourceItem, characters, scenes);
    if (!still) {
      toast("Attach a source still first.", true);
      return;
    }
    const existing = getNodes().find((n) => n.id === MASK_ID);
    if (existing) {
      setNodes((current) =>
        current.map((n) => ({
          ...n,
          selected: n.id === MASK_ID,
        })),
      );
      window.setTimeout(() => {
        setCenter(existing.position.x + 220, existing.position.y + 180, {
          duration: 180,
          zoom: 1,
        });
      }, 40);
      return;
    }
    setNodes((current) => {
      if (current.some((n) => n.id === MASK_ID)) return current;
      const prompt = current.find((n) => n.id === "prompt");
      const source = current.find((n) => n.id === SOURCE_ID);
      const node: StudioNode = {
        id: MASK_ID,
        type: "mask",
        position: {
          x: Math.max(
            -200,
            (source?.position.x ?? (prompt?.position.x ?? PROMPT_POS.x) - 300),
          ),
          y:
            (source?.position.y ?? prompt?.position.y ?? PROMPT_POS.y) + 220,
        },
        dragHandle: ".node-header",
        data: {
          source: still,
          onClose: () => closeNode(MASK_ID),
          onRegister: registerMaskApi,
        },
      };
      return [...current, node];
    });
    setEdges((current) => {
      let next = current;
      if (!next.some((e) => e.id === "e-mask-prompt")) {
        next = addEdge(
          {
            id: "e-mask-prompt",
            source: MASK_ID,
            target: "prompt",
            style: { stroke: "#8aa4c2", strokeWidth: 2 },
          },
          next,
        );
      }
      if (
        next.some((e) => e.source === SOURCE_ID || e.target === SOURCE_ID) ||
        getNodes().some((n) => n.id === SOURCE_ID)
      ) {
        if (!next.some((e) => e.id === "e-source-mask")) {
          next = addEdge(
            {
              id: "e-source-mask",
              source: SOURCE_ID,
              target: MASK_ID,
              style: { stroke: "#8aa4c2", strokeWidth: 2 },
            },
            next,
          );
        }
      }
      return next;
    });
    window.setTimeout(() => {
      const n = getNodes().find((row) => row.id === MASK_ID);
      if (!n) return;
      setCenter(n.position.x + 220, n.position.y + 180, {
        duration: 180,
        zoom: 1,
      });
    }, 40);
  }, [
    characters,
    closeNode,
    getNodes,
    registerMaskApi,
    scenes,
    setCenter,
    setEdges,
    setNodes,
    sourceItem,
  ]);

  const addFirstNode = useCallback(() => {
    ensureSlot(FIRST_ID, "First Frame", "image", -10);
  }, [ensureSlot]);

  const addLastNode = useCallback(() => {
    ensureSlot(LAST_ID, "Last Frame", "image", 170);
  }, [ensureSlot]);

  const addPromptBuilder = useCallback(() => {
    setNodes((current) => {
      if (current.some((n) => n.id === BUILDER_ID)) return current;
      const prompt = current.find((n) => n.id === "prompt");
      const node: StudioNode = {
        id: BUILDER_ID,
        type: "builder",
        position: {
          x: Math.max(-180, (prompt?.position.x ?? PROMPT_POS.x) - 440),
          y: (prompt?.position.y ?? PROMPT_POS.y) - 40,
        },
        dragHandle: ".node-header",
        data: {
          mode: studioMode,
          modality: studioModality,
          onClose: () => closeNode(BUILDER_ID),
          onApply: applyBuilderPrompt,
          instrumental,
        },
      };
      return [...current, node];
    });
    setEdges((current) => {
      if (current.some((e) => e.id === "e-builder-prompt")) return current;
      return addEdge(
        {
          id: "e-builder-prompt",
          source: BUILDER_ID,
          target: "prompt",
          style: { stroke: "#8aa4c2", strokeWidth: 2 },
        },
        current,
      );
    });
  }, [
    applyBuilderPrompt,
    closeNode,
    instrumental,
    setEdges,
    setNodes,
    studioMode,
    studioModality,
  ]);

  const addDirector = useCallback(() => {
    if (!directorAllowed(studioMode, studioModality)) return;
    setNodes((current) => {
      if (current.some((n) => n.id === DIRECTOR_ID)) return current;
      const prompt = current.find((n) => n.id === "prompt");
      const node: StudioNode = {
        id: DIRECTOR_ID,
        type: "director",
        position: {
          x: Math.max(-180, (prompt?.position.x ?? PROMPT_POS.x) - 440),
          y: (prompt?.position.y ?? PROMPT_POS.y) + 220,
        },
        dragHandle: ".node-header",
        data: {
          onClose: () => closeNode(DIRECTOR_ID),
          onApply: applyDirectorPrompt,
        },
      };
      return [...current, node];
    });
    setEdges((current) => {
      if (current.some((e) => e.id === "e-director-prompt")) return current;
      return addEdge(
        {
          id: "e-director-prompt",
          source: DIRECTOR_ID,
          target: "prompt",
          style: { stroke: "#8aa4c2", strokeWidth: 2 },
        },
        current,
      );
    });
  }, [
    applyDirectorPrompt,
    closeNode,
    setEdges,
    setNodes,
    studioMode,
    studioModality,
  ]);

  const onModalityChange = useCallback(
    (mode: Mode, modality: string, model?: ModelRow | null) => {
      const nextMod = modality === "region" ? "i2i" : modality;
      setStudioMode(mode);
      setStudioModality(nextMod);
      setPlan((prev) => {
        const next = inputPlan(nextMod, model, mode);
        if (
          prev.source === next.source &&
          Boolean(prev.sourceOptional) === Boolean(next.sourceOptional) &&
          Boolean(prev.first) === Boolean(next.first) &&
          Boolean(prev.last) === Boolean(next.last) &&
          Boolean(prev.lastOptional) === Boolean(next.lastOptional) &&
          Boolean(prev.characters) === Boolean(next.characters) &&
          Boolean(prev.scenes) === Boolean(next.scenes)
        ) {
          return prev;
        }
        return next;
      });
      setMaxRefs(maxRefImages(model, nextMod));
    },
    [],
  );

  const atRefLimit = useCallback(
    (nextFilled?: number) => {
      if (maxRefs <= 0) return false;
      const n =
        nextFilled ?? countFilledRefs(sourceItem, characters, scenes);
      return n >= maxRefs;
    },
    [characters, maxRefs, scenes, sourceItem],
  );

  const addRefNode = useCallback(
    (role: AssetRole) => {
      const story = studioMode === "storyboard";
      if (!story) {
        const reserved = reservedRefNodes(sourceItem, characters, scenes);
        if (maxRefs > 0 && reserved >= maxRefs) {
          toast(`This model allows at most ${maxRefs} reference images.`, true);
          return;
        }
      }
      const prefix =
        role === "character" ? "char" : role === "scene" ? "scene" : "prop";
      const id = `${prefix}-${Date.now().toString(36)}`;
      const row: RefSlotState = {
        id,
        catalogId: "",
        note: "",
        label: "",
        item: null,
      };
      if (role === "character") setCharacters((cur) => [...cur, row]);
      else if (role === "scene") setScenes((cur) => [...cur, row]);
      else setProps((cur) => [...cur, row]);
      setNodes((current) => {
        if (current.some((n) => n.id === id)) return current;
        const prompt = current.find((n) => n.id === "prompt");
        const siblings = current.filter((n) =>
          ["source", "character", "scene", "prop"].includes(n.type || ""),
        );
        const y = siblings.length
          ? Math.max(...siblings.map((n) => n.position.y)) + 250
          : (prompt?.position.y ?? PROMPT_POS.y) + 36;
        const node: StudioNode = {
          id,
          type: role,
          position: {
            x: Math.max(-160, (prompt?.position.x ?? PROMPT_POS.x) - 300),
            y,
          },
          dragHandle: ".node-header",
          data: {
            title:
              role === "character"
                ? "Character"
                : role === "scene"
                  ? "Scene"
                  : "Prop",
            role,
            item: null,
            catalogId: "",
            note: "",
            label: "",
            catalog:
              role === "character"
                ? charCatalog
                : role === "scene"
                  ? sceneCatalog
                  : propCatalog,
            onClear: () => undefined,
            onOpenLibrary: () => openLibrary(),
            onAttach: () => undefined,
            onPickCatalog: () => undefined,
            onNote: () => undefined,
            onClose: () => closeNode(id),
          },
        };
        return [...current, node];
      });
      if (story) {
        setNodes((current) => {
          if (!current.some((n) => n.id === HUB_ID)) return current;
          setHubIds((cur) => (cur.includes(id) ? cur : [...cur, id]));
          setEdges((eds) => {
            const hubEdge = `e-${id}-hub`;
            if (eds.some((e) => e.id === hubEdge)) return eds;
            return addEdge(
              {
                id: hubEdge,
                source: id,
                target: HUB_ID,
                style: { stroke: "#8aa4c2", strokeWidth: 2 },
              },
              eds,
            );
          });
          return current;
        });
        return;
      }
      const edgeId = `e-${id}-prompt`;
      setEdges((current) => {
        if (current.some((e) => e.id === edgeId)) return current;
        return addEdge(
          {
            id: edgeId,
            source: id,
            target: "prompt",
            style: { stroke: "#8aa4c2", strokeWidth: 2 },
          },
          current,
        );
      });
    },
    [
      charCatalog,
      characters,
      closeNode,
      maxRefs,
      propCatalog,
      sceneCatalog,
      scenes,
      setEdges,
      setNodes,
      sourceItem,
      studioMode,
    ],
  );

  const addCharacterNode = useCallback(
    () => addRefNode("character"),
    [addRefNode],
  );
  const addSceneNode = useCallback(() => addRefNode("scene"), [addRefNode]);
  const addPropNode = useCallback(() => addRefNode("prop"), [addRefNode]);

  const addCreatorBuilder = useCallback(
    (kind: CreatorKind, attachSlotId?: string, seeds?: { characterId?: string; costumeId?: string }) => {
      const safeKind: CreatorKind =
        kind === "costume" || kind === "scene" || kind === "prop" || kind === "dress"
          ? kind
          : "character";
      const id = `cbuild-${safeKind}-${Date.now().toString(36)}`;
      try {
      setNodes((current) => {
        if (current.some((n) => n.id === id)) return current;
        const prompt = current.find((n) => n.id === "prompt");
        const builders = current.filter((n) => n.type === "creator-builder");
        const ys = builders
          .map((n) => Number(n.position?.y))
          .filter((n) => Number.isFinite(n));
        const y = ys.length
          ? Math.max(...ys) + 36
          : (prompt?.position.y ?? PROMPT_POS.y) - 20;
        const node: StudioNode = {
          id,
          type: "creator-builder",
          position: {
            x: Math.max(-520, (prompt?.position.x ?? PROMPT_POS.x) - 460),
            y: Number.isFinite(y) ? y : PROMPT_POS.y,
          },
          dragHandle: ".node-header",
          style:
            safeKind === "costume" || safeKind === "scene" || safeKind === "prop"
              ? { width: 620, minWidth: 560 }
              : undefined,
          data: {
            kind: safeKind,
            attachSlotId,
            seedCharacterId: seeds?.characterId,
            seedCostumeId: seeds?.costumeId,
            onAngle: () => undefined,
            onSaved: () => undefined,
            onClose: () => closeNode(id),
          },
        };
        return [...current, node];
      });
      } catch (err) {
        console.error("New builder failed", err);
        toast("Could not open the builder node.", true);
      }
    },
    [closeNode, setNodes],
  );

  const upsertSheetAngleRef = useRef<
    (builderId: string, slot: string, patch: SheetAnglePatch) => void
  >(() => undefined);
  const regenSheetAngleRef = useRef<
    (builderId: string, slot: string, prompt?: string, resolution?: string) => void
  >(() => undefined);

  const upsertSheetAngle = useCallback(
    (builderId: string, slot: string, patch: SheetAnglePatch) => {
      const key = patch.nodeKey || slot;
      const angleId = `sang-${builderId}-${key}`;
      const edgeId = `e-${builderId}-${key}`;
      const order = [
        "front",
        "side",
        "closeup",
        "back",
        "threequarter_front",
        "threequarter_back",
        "top",
        "sheet",
      ];
      const sheetish =
        slot === "sheet" ||
        patch.sheetKind === "dress" ||
        key.startsWith("dressed");
      const idx = sheetish ? 0 : Math.max(0, order.indexOf(slot));
      let panTo: { x: number; y: number } | null = patch.focus ? { x: 0, y: 0 } : null;
      try {
        setNodes((current) => {
          const builder = current.find((n) => n.id === builderId);
          const promptNode = current.find((n) => n.id === "prompt");
          const existing = current.find((n) => n.id === angleId);
          const position = existing?.position ?? {
            x: Math.max(
              (builder?.position.x ?? PROMPT_POS.x) + (sheetish ? 460 : 400),
              (promptNode?.position.x ?? PROMPT_POS.x) + 520,
            ),
            y: (builder?.position.y ?? PROMPT_POS.y) + (sheetish ? 36 : idx * 270),
          };
          if (panTo) panTo = position;
          const prev = existing?.type === "result" ? existing.data : null;
          const hasStill = Boolean(
            prev?.result?.result_paths?.[0] || prev?.result?.local_paths?.[0],
          );
          if (existing && patch.focus && !patch.generating && !patch.path && !patch.url) {
            return current.map((n) => {
              if (n.id !== angleId) return { ...n, selected: false };
              if (n.type !== "result") return { ...n, selected: true };
              const nextPrompt =
                hasStill ? n.data.prompt : patch.prompt ?? n.data.prompt;
              return {
                ...n,
                selected: true,
                data: {
                  ...n.data,
                  title: patch.label || n.data.title,
                  prompt: nextPrompt,
                  resolution: patch.resolution ?? n.data.resolution,
                  resolutionChoices:
                    patch.resolutionChoices ?? n.data.resolutionChoices,
                  aspect: patch.aspect ?? n.data.aspect,
                  quality: patch.quality ?? n.data.quality,
                  qualityChoices: patch.qualityChoices ?? n.data.qualityChoices,
                  sourceStill: patch.sourceStill || n.data.sourceStill,
                  extraRefs: patch.extraRefs ?? n.data.extraRefs,
                  maxRefs: patch.maxRefs ?? n.data.maxRefs,
                  modelId: patch.modelId ?? n.data.modelId,
                  sheetKind: patch.sheetKind ?? n.data.sheetKind,
                  characterId: patch.characterId ?? n.data.characterId,
                  costumeId: patch.costumeId ?? n.data.costumeId,
                  refPreviews: patch.refPreviews ?? n.data.refPreviews,
                  nodeKey: key,
                  assetId: patch.assetId || n.data.assetId,
                  error: patch.error === undefined ? n.data.error ?? null : patch.error,
                },
              };
            });
          }
          const url = patch.url ?? prev?.result?.result_paths?.[0] ?? "";
          const path = patch.path ?? prev?.result?.local_paths?.[0] ?? "";
          const title = patch.label || prev?.title || SLOT_LABEL[slot] || slot;
          const node: StudioNode = {
            id: angleId,
            type: "result",
            position,
            selected: Boolean(patch.focus),
            dragHandle: ".node-header",
            data: {
              ...(prev || {}),
              title,
              builderId,
              slot,
              prompt: patch.prompt ?? prev?.prompt ?? "",
              resolution: patch.resolution ?? prev?.resolution ?? "",
              resolutionChoices:
                patch.resolutionChoices ?? prev?.resolutionChoices ?? [],
              aspect: patch.aspect ?? prev?.aspect,
              quality: patch.quality ?? prev?.quality,
              qualityChoices: patch.qualityChoices ?? prev?.qualityChoices,
              t2iModel: patch.t2iModel ?? prev?.t2iModel,
              r2iModel: patch.r2iModel ?? prev?.r2iModel,
              assetId: patch.assetId ?? prev?.assetId,
              sourceStill: patch.sourceStill ?? prev?.sourceStill,
              extraRefs: patch.extraRefs ?? prev?.extraRefs,
              maxRefs: patch.maxRefs ?? prev?.maxRefs,
              modelId: patch.modelId ?? prev?.modelId,
              sheetKind: patch.sheetKind ?? prev?.sheetKind,
              characterId: patch.characterId ?? prev?.characterId,
              costumeId: patch.costumeId ?? prev?.costumeId,
              refPreviews: patch.refPreviews ?? prev?.refPreviews,
              nodeKey: key,
              wardrobe: patch.wardrobe ?? prev?.wardrobe,
              name: patch.name ?? prev?.name,
              generating: patch.generating ?? prev?.generating ?? false,
              error: patch.error === undefined ? prev?.error ?? null : patch.error,
              result: {
                ok: true,
                result_paths: url ? [url] : [],
                local_paths: path ? [path] : [],
                cost: patch.cost || prev?.result?.cost || "",
              },
              dragItem: path
                ? {
                    id: `assets:${builderId}:${slot}`,
                    name: title,
                    source: "generated",
                    kind: "image",
                    path,
                    url: url || "",
                    thumb_url: url || "",
                  }
                : prev?.dragItem ?? null,
              onPrompt:
                prev?.onPrompt ??
                ((prompt) =>
                  upsertSheetAngleRef.current(builderId, slot, { slot, prompt })),
              onResolution:
                prev?.onResolution ??
                ((resolution) =>
                  upsertSheetAngleRef.current(builderId, slot, {
                    slot,
                    resolution,
                    aspect: resolution,
                  })),
              onBusy:
                prev?.onBusy ??
                ((busy, error) =>
                  upsertSheetAngleRef.current(builderId, slot, {
                    slot,
                    generating: busy,
                    error: error === undefined ? null : error,
                  })),
              onRegen:
                prev?.onRegen ??
                (() => regenSheetAngleRef.current(builderId, slot)),
              onGenerated:
                prev?.onGenerated ??
                ((info) => {
                  upsertSheetAngleRef.current(builderId, info.slot, {
                    slot: info.slot,
                    path: info.path,
                    url: info.url,
                    prompt: info.prompt,
                    cost: info.cost,
                    resolution: info.resolution,
                    assetId: info.assetId,
                    generating: false,
                    error: null,
                  });
                  setBuilderSessions((cur) => {
                    const prevSess = cur[builderId];
                    return {
                      ...cur,
                      [builderId]: {
                        assetId: info.assetId || prevSess?.assetId || "",
                        t2iModel: prevSess?.t2iModel || "",
                        r2iModel: prevSess?.r2iModel || "",
                        slots: prevSess?.slots?.length
                          ? prevSess.slots
                          : [...CORE_SLOTS, ...EXTRA_SLOTS],
                        attachSlotId: prevSess?.attachSlotId,
                        name: prevSess?.name || "Character",
                        fields: prevSess?.fields,
                        wardrobe: prevSess?.wardrobe,
                        notes: prevSess?.notes,
                        t2iResolution: prevSess?.t2iResolution,
                        r2iResolution: prevSess?.r2iResolution,
                        done: {
                          ...(prevSess?.done || {}),
                          [info.slot]: info.path,
                        },
                      },
                    };
                  });
                }),
              onClose: prev?.onClose ?? (() => closeNode(angleId)),
              onModel: prev?.onModel,
              onConfirmSheet: prev?.onConfirmSheet,
              onCompareSource: prev?.onCompareSource,
            },
          };
          const mapped = existing
            ? current.map((n) =>
                n.id === angleId ? node : patch.focus ? { ...n, selected: false } : n,
              )
            : [...current.map((n) => (patch.focus ? { ...n, selected: false } : n)), node];
          return mapped;
        });
        setEdges((current) => {
          if (current.some((e) => e.id === edgeId)) return current;
          const hasBuilder = current.some((n) => n.id === builderId);
          if (!hasBuilder) return current;
          return addEdge(
            {
              id: edgeId,
              source: builderId,
              target: angleId,
              style: { stroke: "#8aa4c2", strokeWidth: 2 },
            },
            current,
          );
        });
        if (patch.focus && !patch.generating) {
          const x = panTo?.x ?? 0;
          const y = panTo?.y ?? 0;
          window.setTimeout(() => {
            setCenter(x + 220, y + 160, { duration: 180, zoom: 1 });
          }, 40);
        }
      } catch (err: unknown) {
        console.error("Angle Result spawn failed", err);
        throw err;
      }
    },
    [closeNode, setCenter, setEdges, setNodes],
  );
  upsertSheetAngleRef.current = upsertSheetAngle;

  useEffect(() => {
    function onSpawn(ev: Event) {
      const detail = (ev as CustomEvent<AngleSpawnDetail>).detail;
      if (!detail?.builderId || !detail.slot) {
        const msg = "Could not open Result node (missing builder or slot).";
        console.error("[sheet] spawn rejected", msg, detail);
        toast(msg, true);
        return;
      }
      try {
        setBuilderSessions((cur) => {
          const prev = cur[detail.builderId];
          return {
            ...cur,
            [detail.builderId]: {
              assetId: prev?.assetId || "",
              t2iModel: detail.t2iModel || prev?.t2iModel || "",
              r2iModel: detail.r2iModel || prev?.r2iModel || "",
              slots: prev?.slots?.length
                ? prev.slots
                : [...CORE_SLOTS, ...EXTRA_SLOTS],
              attachSlotId: prev?.attachSlotId,
              name: detail.name || prev?.name || "Character",
              fields: detail.fields || prev?.fields,
              wardrobe: detail.wardrobe || prev?.wardrobe,
              notes: detail.notes || prev?.notes,
              t2iResolution: detail.t2iResolution || prev?.t2iResolution,
              r2iResolution: detail.r2iResolution || prev?.r2iResolution,
              done: prev?.done || {},
            },
          };
        });
        upsertSheetAngle(detail.builderId, detail.slot, {
          ...detail,
          focus: true,
        });
      } catch (err: unknown) {
        console.error("Angle Result spawn failed", err);
        const msg = err instanceof Error ? err.message : "Could not open Result node.";
        toast(msg, true);
        try {
          upsertSheetAngle(detail.builderId, detail.slot, {
            slot: detail.slot,
            prompt: detail.prompt || "",
            label: detail.label,
            error: msg,
            focus: true,
          });
        } catch (inner: unknown) {
          console.error("Angle Result fallback spawn failed", inner);
        }
      }
    }
    window.addEventListener(ANGLE_SPAWN_EVENT, onSpawn);
    return () => window.removeEventListener(ANGLE_SPAWN_EVENT, onSpawn);
  }, [upsertSheetAngle]);

  const regenSheetAngle = useCallback(
    async (
      builderId: string,
      slot: string,
      promptOverride?: string,
      resolutionOverride?: string,
    ) => {
      const live = getNodes();
      const angle = live.find((n) => n.id === `sang-${builderId}-${slot}`);
      if (!angle || angle.type !== "result") {
        toast("Angle Result node is missing.", true);
        return;
      }
      const session = builderSessions[builderId];
      const anglePath = (id: string) => {
        const node = live.find((n) => n.id === id);
        if (!node || node.type !== "result") return "";
        const data = node.data as ResultNodeData;
        return data.result?.local_paths?.[0] || "";
      };
      const prompt = (
        promptOverride ??
        ((angle.data as ResultNodeData).prompt || "")
      ).trim();
      const frontPath = anglePath(`sang-${builderId}-front`);
      const nodeData = angle.data as ResultNodeData;
      if (slot !== "front" && !frontPath && !nodeData.sourceStill) {
        const msg = slot === "sheet" ? "Generate a costume angle first" : "Generate Front first";
        upsertSheetAngle(builderId, slot, { slot, generating: false, error: msg });
        toast(msg, true);
        return;
      }
      const extraRefs = Array.isArray(nodeData.extraRefs)
        ? nodeData.extraRefs.filter(Boolean)
        : [];
      const sourceStill = nodeData.sourceStill || (slot === "front" ? "" : frontPath);
      const packed: string[] = [];
      for (const p of [sourceStill, ...extraRefs]) {
        if (p && !packed.includes(p)) packed.push(p);
      }
      const cap = Number(nodeData.maxRefs) || 0;
      if (cap > 0 && packed.length > cap) {
        const msg = `This model allows at most ${cap} reference images (got ${packed.length}).`;
        upsertSheetAngle(builderId, slot, { slot, generating: false, error: msg });
        toast(msg, true);
        return;
      }
      const resolution = (
        resolutionOverride ||
        nodeData.aspect ||
        nodeData.resolution ||
        (slot === "front" ? session?.t2iResolution : session?.r2iResolution) ||
        ""
      ).trim();
      upsertSheetAngle(builderId, slot, { slot, generating: true, error: null });
      try {
        let assetId = session?.assetId || "";
        if (!assetId) {
          const created = await fetch("/assets/sheet/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: "character",
              name: session?.name || "Character",
              notes: session?.notes || "",
              fields: session?.fields || {},
            }),
          });
          const draft = (await readJson(created)) as {
            ok?: boolean;
            item?: StudioAsset;
            detail?: string;
            error?: string;
          };
          if (!created.ok || !draft.item) {
            throw new Error(errorFromBody(draft, "Create failed."));
          }
          assetId = draft.item.id;
        }
        const res = await fetch("/assets/sheet/angle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_id: assetId,
            slot,
            model_id:
              slot === "front" && !sourceStill
                ? session?.t2iModel || ""
                : session?.r2iModel || session?.t2iModel || "",
            prompt,
            source_still: sourceStill,
            wardrobe: session?.wardrobe || "",
            resolution,
            aspect: nodeData.aspect || resolution,
            extra_refs: extraRefs,
          }),
        });
        const body = (await readJson(res)) as {
          ok?: boolean;
          item?: StudioAsset;
          detail?: string;
          error?: string;
        };
        if (!res.ok || body.ok === false || !body.item) {
          throw new Error(errorFromBody(body, "Generate failed."));
        }
        const path = body.item.identity?.[slot] || body.item.still_path || "";
        const url = body.item.identity_urls?.[slot] || body.item.url || "";
        setBuilderSessions((cur) => {
          const prev = cur[builderId];
          return {
            ...cur,
            [builderId]: {
              assetId,
              t2iModel: prev?.t2iModel || "",
              r2iModel: prev?.r2iModel || "",
              slots: prev?.slots?.length
                ? prev.slots
                : [...CORE_SLOTS, ...EXTRA_SLOTS],
              attachSlotId: prev?.attachSlotId,
              name: prev?.name || "Character",
              fields: prev?.fields,
              wardrobe: prev?.wardrobe,
              notes: prev?.notes,
              t2iResolution: prev?.t2iResolution,
              r2iResolution: prev?.r2iResolution,
              done: { ...(prev?.done || {}), [slot]: path },
            },
          };
        });
        upsertSheetAngle(builderId, slot, {
          slot,
          prompt: String(body.item.prompt || prompt || ""),
          path,
          url: url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : "",
          cost: body.item.cost || "",
          generating: false,
          error: null,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Generate failed.";
        upsertSheetAngle(builderId, slot, { slot, generating: false, error: msg });
        toast(msg, true);
      }
    },
    [builderSessions, getNodes, upsertSheetAngle],
  );
  regenSheetAngleRef.current = regenSheetAngle;

  useEffect(() => {
    function onGenerate(ev: Event) {
      const detail = (ev as CustomEvent<AngleGenerateDetail>).detail;
      if (!detail?.builderId || !detail.slot) return;
      void regenSheetAngle(
        detail.builderId,
        detail.slot,
        detail.prompt,
        detail.resolution,
      );
    }
    window.addEventListener(ANGLE_GENERATE_EVENT, onGenerate);
    return () => window.removeEventListener(ANGLE_GENERATE_EVENT, onGenerate);
  }, [regenSheetAngle]);

  const connectAssetToHub = useCallback(
    (id: string) => {
      setHubIds((cur) => (cur.includes(id) ? cur : [...cur, id]));
      setEdges((current) => {
        const edgeId = `e-${id}-hub`;
        if (current.some((e) => e.id === edgeId)) return current;
        return addEdge(
          {
            id: edgeId,
            source: id,
            target: HUB_ID,
            style: { stroke: "#8aa4c2", strokeWidth: 2 },
          },
          current,
        );
      });
    },
    [setEdges],
  );

  const addHub = useCallback(() => {
    const existingIds = [
      ...characters.map((r) => r.id),
      ...scenes.map((r) => r.id),
      ...props.map((r) => r.id),
    ];
    setNodes((current) => {
      if (current.some((n) => n.id === HUB_ID)) return current;
      const prompt = current.find((n) => n.id === "prompt");
      const node: StudioNode = {
        id: HUB_ID,
        type: "hub",
        position: {
          x: (prompt?.position.x ?? PROMPT_POS.x) + 480,
          y: prompt?.position.y ?? PROMPT_POS.y,
        },
        dragHandle: ".node-header",
        data: {
          title: hubTitle,
          notes: hubNotes,
          assets: [],
          sequenceLine: "",
          onTitle: setHubTitle,
          onNotes: setHubNotes,
          onClose: () => closeNode(HUB_ID),
        },
      };
      return [...current, node];
    });
    setHubIds((cur) => {
      const next = new Set(cur);
      for (const id of existingIds) next.add(id);
      return [...next];
    });
    setEdges((current) => {
      let next = current;
      for (const id of existingIds) {
        const edgeId = `e-${id}-hub`;
        if (next.some((e) => e.id === edgeId)) continue;
        next = addEdge(
          {
            id: edgeId,
            source: id,
            target: HUB_ID,
            style: { stroke: "#8aa4c2", strokeWidth: 2 },
          },
          next,
        );
      }
      return next;
    });
  }, [
    characters,
    closeNode,
    hubNotes,
    hubTitle,
    props,
    scenes,
    setEdges,
    setNodes,
  ]);

  const addAssetToHub = useCallback(
    (id: string) => {
      addHub();
      connectAssetToHub(id);
    },
    [addHub, connectAssetToHub],
  );

  const layoutShotEdges = useCallback(
    (rows: ShotState[]) => {
      const ordered = [...rows].sort((a, b) => a.order - b.order);
      setEdges((current) => {
        let next = current.filter(
          (e) =>
            !(e.source === HUB_ID && String(e.target).startsWith("shot-")) &&
            !(
              String(e.source).startsWith("shot-") &&
              String(e.target).startsWith("shot-")
            ),
        );
        const hasHubNow = getNodes().some((n) => n.id === HUB_ID);
        if (hasHubNow && !next.some((e) => e.id === "e-hub-prompt")) {
          next = addEdge(
            {
              id: "e-hub-prompt",
              source: HUB_ID,
              target: "prompt",
              style: { stroke: "#8aa4c2", strokeWidth: 2 },
            },
            next,
          );
        }
        if (ordered.length) {
          const last = ordered[ordered.length - 1];
          const lastEdge = `e-${last.id}-prompt`;
          next = next.filter(
            (e) =>
              !(
                String(e.source).startsWith("shot-") &&
                e.target === "prompt" &&
                e.id !== lastEdge
              ),
          );
          if (!next.some((e) => e.id === lastEdge)) {
            next = addEdge(
              {
                id: lastEdge,
                source: last.id,
                target: "prompt",
                style: { stroke: "#8aa4c2", strokeWidth: 2 },
              },
              next,
            );
          }
        }
        if (!ordered.length) return next;
        const first = ordered[0];
        const hasHub = getNodes().some((n) => n.id === HUB_ID);
        if (hasHub && !next.some((e) => e.id === `e-hub-${first.id}`)) {
          next = addEdge(
            {
              id: `e-hub-${first.id}`,
              source: HUB_ID,
              target: first.id,
              style: { stroke: "#8aa4c2", strokeWidth: 2 },
            },
            next,
          );
        }
        for (let i = 0; i < ordered.length - 1; i += 1) {
          const src = ordered[i].id;
          const tgt = ordered[i + 1].id;
          const edgeId = `e-${src}-${tgt}`;
          if (next.some((e) => e.id === edgeId)) continue;
          next = addEdge(
            {
              id: edgeId,
              source: src,
              target: tgt,
              style: { stroke: "#8aa4c2", strokeWidth: 2 },
            },
            next,
          );
        }
        return next;
      });
    },
    [getNodes, setEdges],
  );

  const addShot = useCallback(() => {
    if (!getNodes().some((n) => n.id === HUB_ID)) {
      toast("Add a Hub first — shots read the Asset Hub.", true);
      return;
    }
    const id = `shot-${Date.now().toString(36)}`;
    setShots((cur) => {
      const order = cur.length + 1;
      return [
        ...cur,
        {
          id,
          order,
          label: `Shot ${order}`,
          action: "",
          move: "Push in",
          speed: "Slow",
          ease: "Ease in-out",
          framing: "",
          still: null,
          duration: "",
        },
      ];
    });
    setNodes((current) => {
      if (current.some((n) => n.id === id)) return current;
      const hub = current.find((n) => n.id === HUB_ID);
      const siblings = current.filter((n) => n.type === "shot");
      const y = siblings.length
        ? Math.max(...siblings.map((n) => n.position.y)) + 280
        : (hub?.position.y ?? PROMPT_POS.y);
      const node: StudioNode = {
        id,
        type: "shot",
        position: {
          x: (hub?.position.x ?? PROMPT_POS.x) + 360,
          y,
        },
        dragHandle: ".node-header",
        data: {
          order: siblings.length + 1,
          label: `Shot ${siblings.length + 1}`,
          action: "",
          move: "Push in",
          speed: "Slow",
          ease: "Ease in-out",
          framing: "",
          still: null,
          duration: "",
          hubLinked: true,
          hubTitle: hubTitle,
          sequenceLine: "",
          onPatch: () => undefined,
          onAttachStill: () => undefined,
          onClearStill: () => undefined,
          onOpenLibrary: () => openLibrary(),
          onClose: () => closeNode(id),
        },
      };
      return [...current, node];
    });
    setActiveShotId(id);
  }, [closeNode, getNodes, hubTitle, setNodes]);

  const addShotBuilder = useCallback(
    (shotId?: string) => {
      const ordered = [...shots].sort((a, b) => a.order - b.order);
      const live = getNodes();
      const target =
        shotId ||
        ordered.find((s) => !live.some((n) => n.id === spbId(s.id)))?.id ||
        ordered.at(-1)?.id;
      if (!target) {
        toast("Add a Shot first.", true);
        return;
      }
      const builderId = spbId(target);
      const shot = shots.find((s) => s.id === target);
      setActiveShotId(target);
      const who = assetNames(characters, hubIds);
      setNodes((current) => {
        if (current.some((n) => n.id === builderId)) return current;
        const parent = current.find((n) => n.id === target);
        const node: StudioNode = {
          id: builderId,
          type: "shot-builder",
          position: {
            x: Math.max(-180, (parent?.position.x ?? PROMPT_POS.x) - 360),
            y: parent?.position.y ?? PROMPT_POS.y,
          },
          dragHandle: ".node-header",
          data: {
            shotId: target,
            shotLabel: shot?.label || "Shot",
            whoChoices: who,
            characters: who,
            scenes: assetNames(scenes, hubIds),
            props: assetNames(props, hubIds),
            onClose: () => closeNode(builderId),
            onApply: () => undefined,
          },
        };
        return [...current, node];
      });
      setEdges((current) => {
        const edgeId = `e-${builderId}-${target}`;
        if (current.some((e) => e.id === edgeId)) return current;
        return addEdge(
          {
            id: edgeId,
            source: builderId,
            target,
            style: { stroke: "#8aa4c2", strokeWidth: 2 },
          },
          current,
        );
      });
    },
    [
      activeShotId,
      characters,
      closeNode,
      getNodes,
      hubIds,
      props,
      scenes,
      setEdges,
      setNodes,
      shots,
    ],
  );

  const applyShotBuilder = useCallback(
    (
      shotId: string,
      patch: {
        action: string;
        move: string;
        speed: string;
        ease: string;
        framing: string;
      },
    ) => {
      setShots((cur) =>
        cur.map((s) => {
          if (s.id !== shotId) return s;
          return {
            ...s,
            action: patch.action,
            move: patch.move || s.move,
            speed: patch.speed || s.speed,
            ease: patch.ease || s.ease,
            framing: patch.framing,
          };
        }),
      );
    },
    [],
  );

  useEffect(() => {
    if (!plan.characters && !plan.scenes) {
      setCharacters([]);
      setScenes([]);
      setNodes((current) =>
        current.filter((n) => n.type !== "character" && n.type !== "scene"),
      );
      setEdges((current) =>
        current.filter(
          (e) =>
            !String(e.source).startsWith("char-") &&
            !String(e.source).startsWith("scene-"),
        ),
      );
    }
  }, [plan.characters, plan.scenes, setEdges, setNodes]);

  const loadCatalogs = useCallback(() => {
    fetch("/characters")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body: { items?: RefCatalogEntry[] }) => {
        setCharCatalog(body.items ?? []);
      })
      .catch(() => undefined);
    fetch("/scenes")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body: { items?: RefCatalogEntry[] }) => {
        setSceneCatalog(body.items ?? []);
      })
      .catch(() => undefined);
    fetch("/props")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body: { items?: RefCatalogEntry[] }) => {
        setPropCatalog(body.items ?? []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadCatalogs();
    function onAssets() {
      loadCatalogs();
    }
    window.addEventListener("ams-assets-changed", onAssets);
    return () => window.removeEventListener("ams-assets-changed", onAssets);
  }, [loadCatalogs]);

  const tryAttachSlot = useCallback(
    (slot: string, item: LibraryItem) => {
      if (slot.startsWith("shot-")) {
        if (!slotAccepts("image", item)) {
          toast(slotNeedLabel("image"), true);
          return false;
        }
        setShots((cur) =>
          cur.map((s) => (s.id === slot ? { ...s, still: item } : s)),
        );
        return true;
      }
      if (
        slot.startsWith("char-") ||
        slot.startsWith("scene-") ||
        slot.startsWith("prop-")
      ) {
        if (!slotAccepts("image", item)) {
          toast(slotNeedLabel("image"), true);
          return false;
        }
        const isChar = slot.startsWith("char-");
        const isProp = slot.startsWith("prop-");
        const rows = isChar ? characters : isProp ? props : scenes;
        const setter = isChar ? setCharacters : isProp ? setProps : setScenes;
        const existing = rows.find((r) => r.id === slot);
        const replacing = Boolean(existing?.item?.path);
        if (!replacing && atRefLimit()) {
          toast(`This model allows at most ${maxRefs} reference images.`, true);
          return false;
        }
        setter((cur) =>
          cur.map((r) => (r.id === slot ? { ...r, item } : r)),
        );
        return true;
      }
      const accept: SlotAccept =
        slot === "source" ? sourceAccept : "image";
      if (!slotAccepts(accept, item)) {
        toast(slotNeedLabel(accept), true);
        return false;
      }
      if (slot === "first") {
        setFirstItem(item);
        addFirstNode();
        return true;
      }
      if (slot === "last") {
        setLastItem(item);
        addLastNode();
        return true;
      }
      if (!sourceItem?.path && atRefLimit()) {
        toast(`This model allows at most ${maxRefs} reference images.`, true);
        return false;
      }
      setSourceItem(item);
      addSourceNode();
      return true;
    },
    [
      addFirstNode,
      addLastNode,
      addSourceNode,
      atRefLimit,
      characters,
      maxRefs,
      plan.source,
      props,
      scenes,
      sourceAccept,
      sourceItem,
    ],
  );

  const attachMedia = useCallback(
    (item: LibraryItem) => {
      const intercept = libraryPickRef.current;
      if (intercept) {
        libraryPickRef.current = null;
        if (intercept(item)) return;
      }
      if (studioMode === "frame") {
        addSourceNode();
        tryAttachSlot("source", item);
        return;
      }
      if (plan.first || plan.last) {
        if (!firstItem) {
          tryAttachSlot("first", item);
          return;
        }
        if (!lastItem) {
          tryAttachSlot("last", item);
          return;
        }
        tryAttachSlot("last", item);
        return;
      }
      if (plan.characters || plan.scenes) {
        const emptyChar = characters.find((r) => !r.item);
        if (emptyChar) {
          tryAttachSlot(emptyChar.id, item);
          return;
        }
        const emptyScene = scenes.find((r) => !r.item);
        if (emptyScene) {
          tryAttachSlot(emptyScene.id, item);
          return;
        }
        const emptyProp = props.find((r) => !r.item);
        if (emptyProp) {
          tryAttachSlot(emptyProp.id, item);
          return;
        }
        if (studioMode === "storyboard") {
          toast("Add a Character, Scene, or Prop first, or drop onto one.", true);
          return;
        }
        if (plan.source && !sourceItem) {
          tryAttachSlot("source", item);
          return;
        }
        toast("Add a Character or Scene node first, or drop onto one.", true);
        return;
      }
      if (plan.source) {
        tryAttachSlot("source", item);
      }
    },
    [
      addSourceNode,
      characters,
      firstItem,
      lastItem,
      plan,
      props,
      scenes,
      sourceItem,
      studioMode,
      tryAttachSlot,
    ],
  );

  const pickCatalog = useCallback(
    (slotId: string, role: AssetRole, catalogId: string) => {
      const catalog =
        role === "character"
          ? charCatalog
          : role === "scene"
            ? sceneCatalog
            : propCatalog;
      const setter =
        role === "character"
          ? setCharacters
          : role === "scene"
            ? setScenes
            : setProps;
      const entry = catalog.find((r) => r.id === catalogId) ?? null;
      const identPaths = catalogId
        ? preferredIdentityPaths(
            entry?.identity,
            entry?.primary_slot,
            entry?.still_path || "",
          )
        : [];
      const mapped = entry ? catalogToItem(entry) : null;
      if (mapped && identPaths[0]) mapped.path = identPaths[0];
      setter((cur) =>
        cur.map((r) => {
          if (r.id !== slotId) return r;
          if (catalogId && mapped && !r.item?.path && atRefLimit()) {
            toast(
              `This model allows at most ${maxRefs} reference images.`,
              true,
            );
            return r;
          }
          return {
            ...r,
            catalogId,
            item: catalogId ? mapped || r.item : r.item,
            identityPaths: identPaths,
            label:
              r.label ||
              (catalogId
                ? entry?.label || entry?.name || r.label
                : r.label),
          };
        }),
      );
    },
    [atRefLimit, charCatalog, maxRefs, propCatalog, sceneCatalog],
  );

  const applyCreatedAsset = useCallback(
    (asset: StudioAsset, slotId?: string) => {
      if (asset.kind === "costume") return;
      const item = assetToLibraryItem(asset);
      const label = asset.label || asset.name;
      const role = asset.kind;
      const setter =
        role === "character"
          ? setCharacters
          : role === "scene"
            ? setScenes
            : setProps;
      if (slotId) {
        setter((cur) =>
          cur.map((r) =>
            r.id === slotId
              ? {
                  ...r,
                  catalogId: asset.id,
                  label: r.label || label,
                  item: item || r.item,
                }
              : r,
          ),
        );
        return;
      }
      const rows =
        role === "character"
          ? characters
          : role === "scene"
            ? scenes
            : props;
      const empty = rows.find((r) => !r.item);
      if (empty && item) tryAttachSlot(empty.id, item);
    },
    [characters, props, scenes, tryAttachSlot],
  );

  useEffect(() => {
    if (studioMode !== "frame") {
      closePinEdit();
      setFramePins([]);
    }
  }, [studioMode, closePinEdit]);

  useEffect(() => {
    if (directorAllowed(studioMode, studioModality)) return;
    setNodes((current) => {
      if (!current.some((n) => n.id === DIRECTOR_ID)) return current;
      return current.filter((n) => n.id !== DIRECTOR_ID);
    });
    setEdges((current) =>
      current.filter((e) => e.source !== DIRECTOR_ID && e.target !== DIRECTOR_ID),
    );
  }, [setEdges, setNodes, studioMode, studioModality]);

  useEffect(() => {
    if (studioMode === "storyboard") {
      closePinEdit();
      setSourceItem(null);
      setFirstItem(null);
      setLastItem(null);
      setNodes((current) =>
        current.filter(
          (n) =>
            n.id !== SOURCE_ID &&
            n.id !== FIRST_ID &&
            n.id !== LAST_ID &&
            n.id !== BUILDER_ID &&
            n.id !== DIRECTOR_ID,
        ),
      );
      setEdges((current) =>
        current.filter(
          (e) =>
            e.source !== SOURCE_ID &&
            e.source !== FIRST_ID &&
            e.source !== LAST_ID &&
            e.source !== BUILDER_ID &&
            e.source !== DIRECTOR_ID &&
            e.target !== SOURCE_ID,
        ),
      );
      return;
    }
    setProps([]);
    setHubIds([]);
    setShots([]);
    setActiveShotId(null);
    setNodes((current) =>
      current.filter(
        (n) =>
          n.type !== "prop" &&
          n.type !== "shot" &&
          n.type !== "shot-builder" &&
          n.id !== HUB_ID,
      ),
    );
    setEdges((current) =>
      current.filter(
        (e) =>
          !String(e.source).startsWith("prop-") &&
          !String(e.source).startsWith("shot-") &&
          !String(e.target).startsWith("shot-") &&
          e.source !== HUB_ID &&
          e.target !== HUB_ID,
      ),
    );
  }, [closePinEdit, setEdges, setNodes, studioMode]);

  useEffect(() => {
    if (studioMode !== "storyboard") return;
    layoutShotEdges(shots);
  }, [layoutShotEdges, shots, studioMode]);

  useEffect(() => {
    if (pinEdit && !framePins.some((p) => p.id === pinEdit.pinId)) {
      closePinEdit();
    }
  }, [closePinEdit, framePins, pinEdit]);

  useEffect(() => {
    const kind = itemMediaKind(sourceItem);
    if (sourceAccept === "image" && kind === "video") {
      setSourceItem(null);
    }
    if (sourceAccept === "video" && sourceItem && kind !== "video") {
      setSourceItem(null);
    }
    if (itemMediaKind(firstItem) === "video") setFirstItem(null);
    if (itemMediaKind(lastItem) === "video") setLastItem(null);
  }, [sourceAccept, sourceItem, firstItem, lastItem]);

  useEffect(() => {
    setNodes((current) =>
      current.map((n): StudioNode => {
        if (n.id === "prompt") {
          return {
            ...n,
            type: "prompt",
            data: {
              onGenerated: spawnResult,
              onAddSource: addSourceNode,
              onAddMask: addMaskNode,
              hasMaskNode: current.some((row) => row.id === MASK_ID),
              rasterizeMask: async () => {
                if (!maskApiRef.current) return { item: null, suffix: "" };
                return maskApiRef.current.rasterize();
              },
              getMaskSuffix: () => maskApiRef.current?.suffix() || "",
              getMaskBoxes: () => maskApiRef.current?.boxes() ?? [],
              maskReady,
              onAddFirst: addFirstNode,
              onAddLast: addLastNode,
              onAddCharacter: addCharacterNode,
              onAddScene: addSceneNode,
              onAddProp: addPropNode,
              onAddHub: addHub,
              onAddShot: addShot,
              onAddShotBuilder: () => addShotBuilder(),
              onAutoBalanceShots: (seconds) => {
                setShots((cur) =>
                  cur.map((s, i) => ({
                    ...s,
                    duration: seconds[i] ?? s.duration,
                  })),
                );
              },
              shots,
              hubAssets: hubIds
                .map((id) => {
                  const row = [...characters, ...scenes, ...props].find(
                    (r) => r.id === id,
                  );
                  if (!row) return null;
                  return {
                    id: row.id,
                    role: row.id.startsWith("scene-")
                      ? ("scene" as const)
                      : row.id.startsWith("prop-")
                        ? ("prop" as const)
                        : ("character" as const),
                    label: row.label || row.item?.name || "",
                    item: row.item,
                  };
                })
                .filter((row): row is HubAsset => Boolean(row)),
              hubTitle,
              hubNotes,
              sequenceLine: sequenceLine(shots),
              hasHub: current.some((n) => n.id === HUB_ID),
              onModalityChange,
              onOpenSettings: () => setSettingsOpen(true),
              onOpenLibrary: () => openLibrary(),
              onLibraryPick: (handler) => {
                libraryPickRef.current = handler;
                openLibrary();
              },
              onAddPromptBuilder: addPromptBuilder,
              instrumental,
              onInstrumental: setInstrumental,
              onAddDirector: addDirector,
              incomingPrompt: appliedPrompt?.text ?? null,
              incomingPromptToken: appliedPrompt?.token ?? 0,
              incomingPromptMode: appliedPrompt?.mode ?? "replace",
              onAttachSource: (item) => tryAttachSlot(SOURCE_ID, item),
              pins: framePins,
              onPinsChange: setFramePins,
              onEditPin: spawnPinEdit,
              onCommitPinStill: (pin, item) => {
                void applyStillToPin(pin.id, item, pin.timestamp_s);
              },
              editingPinId: pinEdit?.pinId ?? null,
              source: sourceItem,
              first: firstItem,
              last: lastItem,
              characters,
              scenes,
              maxRefs,
            },
          };
        }
        if (n.id === PIN_EDIT_SOURCE && pinEdit) {
          return {
            ...n,
            type: "source",
            data: {
              title: `Pin @ t=${pinEdit.timestamp_s.toFixed(2)}s`,
              accept: "image",
              item: pinEdit.still,
              locked: true,
              onClear: () => undefined,
              onOpenLibrary: () => undefined,
              onAttach: () => undefined,
              onClose: () => closePinEdit(),
            },
          };
        }
        if (n.id === BUILDER_ID) {
          return {
            ...n,
            type: "builder",
            data: {
              mode: studioMode,
              modality: studioModality,
              instrumental,
              onClose: () => closeNode(BUILDER_ID),
              onApply: applyBuilderPrompt,
            },
          };
        }
        if (n.id === DIRECTOR_ID) {
          return {
            ...n,
            type: "director",
            data: {
              onClose: () => closeNode(DIRECTOR_ID),
              onApply: applyDirectorPrompt,
            },
          };
        }
        if (n.id === HUB_ID) {
          const lookup = [...characters, ...scenes, ...props];
          const assets: HubAsset[] = hubIds
            .map((id) => lookup.find((r) => r.id === id))
            .filter((row): row is RefSlotState => Boolean(row))
            .map((row) => ({
              id: row.id,
              role: row.id.startsWith("scene-")
                ? "scene"
                : row.id.startsWith("prop-")
                  ? "prop"
                  : "character",
              label: row.label || row.item?.name || "",
              item: row.item,
            }));
          return {
            ...n,
            type: "hub",
            data: {
              title: hubTitle,
              notes: hubNotes,
              assets,
              sequenceLine: sequenceLine(shots),
              onTitle: setHubTitle,
              onNotes: setHubNotes,
              onClose: () => closeNode(HUB_ID),
            },
          };
        }
        if (n.id === PIN_EDIT_PROMPT && pinEdit) {
          return {
            ...n,
            type: "prompt",
            data: {
              onGenerated: spawnPinResult,
              onAddSource: () => undefined,
              onAddFirst: () => undefined,
              onAddLast: () => undefined,
              onAddCharacter: () => undefined,
              onAddScene: () => undefined,
              onModalityChange: () => undefined,
              onClose: () => closePinEdit(),
              lockTo: {
                mode: "image",
                modality: "i2i",
                title: `Editing pin @ t=${pinEdit.timestamp_s.toFixed(2)}s`,
                preferModel: "flux 2 pro",
              },
              source: pinEdit.still,
              first: null,
              last: null,
              characters: [],
              scenes: [],
              maxRefs: 0,
            },
          };
        }
        if (n.id === MASK_ID || n.type === "mask") {
          return {
            ...n,
            type: "mask",
            data: {
              source: editPrimaryStill(sourceItem, characters, scenes),
              disabled: countFilledRefs(sourceItem, characters, scenes) > 1,
              disabledNote: "Mask is single-ref only on this model",
              onClose: () => closeNode(MASK_ID),
              onRegister: registerMaskApi,
              onContent: setMaskReady,
            },
          };
        }
        if (n.id === SOURCE_ID) {
          return {
            ...n,
            type: "source",
            data: {
              title: sourceAccept === "video" ? "Source Video" : "Source",
              accept: sourceAccept,
              item: sourceItem,
              onClear: () => setSourceItem(null),
              onOpenLibrary: () => openLibrary(),
              onAttach: (item) => tryAttachSlot(SOURCE_ID, item),
              onOsFiles: (files) => {
                void importOsFiles(files)
                  .then((items) => {
                    if (items[0]) tryAttachSlot(SOURCE_ID, items[0]);
                  })
                  .catch((err: unknown) => {
                    console.error("Library import failed", err);
                    toast(
                      err instanceof Error ? err.message : "Import failed.",
                      true,
                    );
                  });
              },
              onClose: () => closeNode(SOURCE_ID),
            },
          };
        }
        if (n.id === FIRST_ID) {
          return {
            ...n,
            type: "first",
            data: {
              title: "First Frame",
              accept: "image",
              item: firstItem,
              onClear: () => setFirstItem(null),
              onOpenLibrary: () => openLibrary(),
              onAttach: (item) => setFirstItem(item),
              onOsFiles: (files) => {
                void importOsFiles(files)
                  .then((items) => {
                    if (items[0]) tryAttachSlot(FIRST_ID, items[0]);
                  })
                  .catch((err: unknown) => {
                    console.error("Library import failed", err);
                    toast(
                      err instanceof Error ? err.message : "Import failed.",
                      true,
                    );
                  });
              },
              onClose: () => closeNode(FIRST_ID),
            },
          };
        }
        if (n.id === LAST_ID) {
          return {
            ...n,
            type: "last",
            data: {
              title: "Last Frame",
              accept: "image",
              item: lastItem,
              onClear: () => setLastItem(null),
              onOpenLibrary: () => openLibrary(),
              onAttach: (item) => setLastItem(item),
              onOsFiles: (files) => {
                void importOsFiles(files)
                  .then((items) => {
                    if (items[0]) tryAttachSlot(LAST_ID, items[0]);
                  })
                  .catch((err: unknown) => {
                    console.error("Library import failed", err);
                    toast(
                      err instanceof Error ? err.message : "Import failed.",
                      true,
                    );
                  });
              },
              onClose: () => closeNode(LAST_ID),
            },
          };
        }
        if (n.type === "result") {
          const result = "result" in n.data ? n.data.result : undefined;
          if (!result) return n;
          const builderId = n.data.builderId;
          const slot = n.data.slot;
          if (builderId && slot) {
            return {
              ...n,
              type: "result",
              data: {
                ...n.data,
                result,
                title: n.data.title,
                prompt: n.data.prompt,
                generating: n.data.generating,
                error: n.data.error,
                builderId,
                slot,
                dragItem: n.data.dragItem ?? itemFromResult(result),
                resolution: n.data.resolution,
                resolutionChoices: n.data.resolutionChoices,
                t2iModel: n.data.t2iModel,
                r2iModel: n.data.r2iModel,
                assetId: n.data.assetId || builderSessions[builderId]?.assetId,
                sourceStill:
                  n.data.sourceStill ||
                  (slot === "front"
                    ? ""
                    : builderSessions[builderId]?.done?.front || ""),
                extraRefs: n.data.extraRefs,
                maxRefs: n.data.maxRefs,
                modelId: n.data.modelId,
                sheetKind: n.data.sheetKind,
                characterId: n.data.characterId,
                costumeId: n.data.costumeId,
                nodeKey: n.data.nodeKey,
                refPreviews: n.data.refPreviews,
                wardrobe: n.data.wardrobe || builderSessions[builderId]?.wardrobe,
                name: n.data.name || builderSessions[builderId]?.name,
                compareSource: n.data.compareSource,
                onCompareSource: () => addCompareFromResult(n.id),
                onPrompt: (prompt) =>
                  upsertSheetAngle(builderId, slot, { slot, prompt }),
                onResolution: (resolution) =>
                  upsertSheetAngle(builderId, slot, {
                    slot,
                    resolution,
                    aspect: resolution,
                  }),
                onBusy: (busy, error) =>
                  upsertSheetAngle(builderId, slot, {
                    slot,
                    generating: busy,
                    error: error === undefined ? null : error,
                  }),
                onRegen: () => void regenSheetAngle(builderId, slot),
                onGenerated: (info) => {
                  upsertSheetAngle(builderId, info.slot, {
                    slot: info.slot,
                    path: info.path,
                    url: info.url,
                    prompt: info.prompt,
                    cost: info.cost,
                    resolution: info.resolution,
                    assetId: info.assetId,
                    generating: false,
                    error: null,
                  });
                  setBuilderSessions((cur) => {
                    const prev = cur[builderId];
                    return {
                      ...cur,
                      [builderId]: {
                        assetId: info.assetId,
                        t2iModel: prev?.t2iModel || n.data.t2iModel || "",
                        r2iModel: prev?.r2iModel || n.data.r2iModel || "",
                        slots: prev?.slots?.length
                          ? prev.slots
                          : [...CORE_SLOTS, ...EXTRA_SLOTS],
                        attachSlotId: prev?.attachSlotId,
                        name: prev?.name || n.data.name || "Character",
                        fields: prev?.fields,
                        wardrobe: prev?.wardrobe || n.data.wardrobe,
                        notes: prev?.notes,
                        t2iResolution: prev?.t2iResolution,
                        r2iResolution: prev?.r2iResolution,
                        done: {
                          ...(prev?.done || {}),
                          [info.slot]: info.path,
                        },
                      },
                    };
                  });
                  if (info.slot === "front" && info.path) {
                    setNodes((current) =>
                      current.map((row) => {
                        if (
                          row.type !== "result" ||
                          row.data.builderId !== builderId ||
                          row.data.slot === "front"
                        ) {
                          return row;
                        }
                        return {
                          ...row,
                          data: {
                            ...row.data,
                            assetId: info.assetId,
                            sourceStill: info.path,
                          },
                        };
                      }),
                    );
                  }
                },
                onClose: () => closeNode(n.id),
              },
            };
          }
          const pinApply =
            n.id === PIN_EDIT_RESULT && pinEdit
              ? () => applyPinStill(result)
              : undefined;
          const mapped = itemFromResult(result);
          const dragItem =
            n.id === PIN_EDIT_RESULT && mapped && mapped.kind === "image"
              ? mapped
              : null;
          return {
            ...n,
            type: "result",
            data: {
              ...n.data,
              result,
              compareSource: n.data.compareSource,
              onClose: () => closeNode(n.id),
              onTool: (kind) => spawnTool(n.id, kind, result),
              onCompareSource: () => addCompareFromResult(n.id),
              onDraftEnhance: (next) => {
                setNodes((cur) =>
                  cur.map((row) =>
                    row.id === n.id && row.type === "result"
                      ? { ...row, data: { ...row.data, result: next } }
                      : row,
                  ),
                );
              },
              onApplyToPin: pinApply,
              applyLabel: pinApply ? "Apply to pin" : undefined,
              dragItem,
            },
          };
        }
        if (n.type === "compare") {
          return {
            ...n,
            type: "compare",
            data: {
              ...n.data,
              onClose: () => closeNode(n.id),
            },
          };
        }
        if (TOOL_TYPES.includes(n.type as ToolKind)) {
          const kind = n.type as ToolKind;
          const source = toolSources[n.id];
          if (!source) return n;
          return {
            ...n,
            type: kind,
            data: {
              kind,
              title:
                kind === "upscale"
                  ? "Upscale"
                  : kind === "denoise"
                    ? "Denoise"
                    : kind === "restore"
                      ? "Restore"
                      : kind === "deblur"
                        ? "Deblur"
                        : "Interpolate",
              source,
              mediaKind: source.kind === "video" ? "video" : "image",
              onClose: () => closeNode(n.id),
              onGenerated: (res) => spawnResultNear(n.id, res),
              onReplace: (item) =>
                setToolSources((cur) => ({ ...cur, [n.id]: item })),
              onOpenLibrary: () => openLibrary(),
            },
          };
        }
        if (n.type === "character") {
          const row = characters.find((r) => r.id === n.id);
          if (!row) return n;
          return {
            ...n,
            type: "character",
            data: {
              title: "Character",
              role: "character",
              item: row.item,
              catalogId: row.catalogId,
              note: row.note,
              label: row.label ?? "",
              catalog: charCatalog,
              onClear: () =>
                setCharacters((cur) =>
                  cur.map((r) =>
                    r.id === n.id
                      ? { ...r, item: null, catalogId: "", note: "" }
                      : r,
                  ),
                ),
              onOpenLibrary: () => openLibrary(),
              onAttach: (item) => tryAttachSlot(n.id, item),
              onPickCatalog: (id) => pickCatalog(n.id, "character", id),
              onNote: (note) =>
                setCharacters((cur) =>
                  cur.map((r) => (r.id === n.id ? { ...r, note } : r)),
                ),
              onLabel: (label) =>
                setCharacters((cur) =>
                  cur.map((r) => (r.id === n.id ? { ...r, label } : r)),
                ),
              onAddToHub:
                studioMode === "storyboard"
                  ? () => addAssetToHub(n.id)
                  : undefined,
              onCreate: () => addCreatorBuilder("character", n.id),
              onClose: () => closeNode(n.id),
            },
          };
        }
        if (n.type === "scene") {
          const row = scenes.find((r) => r.id === n.id);
          if (!row) return n;
          return {
            ...n,
            type: "scene",
            data: {
              title: "Scene",
              role: "scene",
              item: row.item,
              catalogId: row.catalogId,
              note: row.note,
              label: row.label ?? "",
              catalog: sceneCatalog,
              onClear: () =>
                setScenes((cur) =>
                  cur.map((r) =>
                    r.id === n.id
                      ? { ...r, item: null, catalogId: "", note: "" }
                      : r,
                  ),
                ),
              onOpenLibrary: () => openLibrary(),
              onAttach: (item) => tryAttachSlot(n.id, item),
              onPickCatalog: (id) => pickCatalog(n.id, "scene", id),
              onNote: (note) =>
                setScenes((cur) =>
                  cur.map((r) => (r.id === n.id ? { ...r, note } : r)),
                ),
              onLabel: (label) =>
                setScenes((cur) =>
                  cur.map((r) => (r.id === n.id ? { ...r, label } : r)),
                ),
              onAddToHub:
                studioMode === "storyboard"
                  ? () => addAssetToHub(n.id)
                  : undefined,
              onCreate: () => addCreatorBuilder("scene", n.id),
              onClose: () => closeNode(n.id),
            },
          };
        }
        if (n.type === "prop") {
          const row = props.find((r) => r.id === n.id);
          if (!row) return n;
          return {
            ...n,
            type: "prop",
            data: {
              title: "Prop",
              role: "prop",
              item: row.item,
              catalogId: row.catalogId,
              note: row.note,
              label: row.label ?? "",
              catalog: propCatalog,
              onClear: () =>
                setProps((cur) =>
                  cur.map((r) =>
                    r.id === n.id
                      ? { ...r, item: null, catalogId: "", note: "" }
                      : r,
                  ),
                ),
              onOpenLibrary: () => openLibrary(),
              onAttach: (item) => tryAttachSlot(n.id, item),
              onPickCatalog: (id) => pickCatalog(n.id, "prop", id),
              onNote: (note) =>
                setProps((cur) =>
                  cur.map((r) => (r.id === n.id ? { ...r, note } : r)),
                ),
              onLabel: (label) =>
                setProps((cur) =>
                  cur.map((r) => (r.id === n.id ? { ...r, label } : r)),
                ),
              onAddToHub: () => addAssetToHub(n.id),
              onCreate: () => addCreatorBuilder("prop", n.id),
              onClose: () => closeNode(n.id),
            },
          };
        }
        if (n.type === "shot") {
          const row = shots.find((s) => s.id === n.id);
          if (!row) return n;
          const hubLinked = Boolean(
            current.some((node) => node.id === HUB_ID),
          );
          return {
            ...n,
            type: "shot",
            data: {
              order: row.order,
              label: row.label,
              action: row.action,
              move: row.move,
              speed: row.speed,
              ease: row.ease,
              framing: row.framing,
              still: row.still,
              duration: row.duration,
              hubLinked,
              hubTitle: hubTitle || "Asset Hub",
              sequenceLine: sequenceLine(shots),
              onPatch: (patch) =>
                setShots((cur) =>
                  cur.map((s) => (s.id === n.id ? { ...s, ...patch } : s)),
                ),
              onAttachStill: (item) =>
                setShots((cur) =>
                  cur.map((s) => (s.id === n.id ? { ...s, still: item } : s)),
                ),
              onClearStill: () =>
                setShots((cur) =>
                  cur.map((s) => (s.id === n.id ? { ...s, still: null } : s)),
                ),
              onOpenLibrary: () => openLibrary(),
              onAddBuilder: () => addShotBuilder(n.id),
              onClose: () => closeNode(n.id),
            },
          };
        }
        if (n.type === "shot-builder") {
          const targetId =
            ("shotId" in n.data && n.data.shotId) ||
            n.id.replace(/^spb-/, "");
          const shot = shots.find((s) => s.id === targetId);
          const who = assetNames(characters, hubIds);
          return {
            ...n,
            type: "shot-builder",
            data: {
              shotId: targetId,
              shotLabel: shot?.label || "Shot",
              whoChoices: who,
              characters: who,
              scenes: assetNames(scenes, hubIds),
              props: assetNames(props, hubIds),
              onClose: () => closeNode(n.id),
              onApply: (patch) => {
                if (targetId) applyShotBuilder(targetId, patch);
              },
            },
          };
        }
        if (n.type === "creator-builder") {
          const kind = n.data?.kind || "character";
          return {
            ...n,
            type: "creator-builder",
            data: {
              kind,
              attachSlotId: n.data?.attachSlotId,
              seedCharacterId: n.data?.seedCharacterId,
              seedCostumeId: n.data?.seedCostumeId,
              onClose: () => closeNode(n.id),
              onAngle: (slot, patch) => upsertSheetAngle(n.id, slot, patch),
              sessionAssetId: builderSessions[n.id]?.assetId || "",
              doneSlots: builderSessions[n.id]?.done || {},
              onSession: (info) =>
                setBuilderSessions((cur) => ({
                  ...cur,
                  [n.id]: {
                    ...cur[n.id],
                    ...info,
                    attachSlotId: n.data.attachSlotId,
                    done: {
                      ...(cur[n.id]?.done || {}),
                      ...(info.done || {}),
                    },
                  },
                })),
              onSaved: (asset) => {
                void (async () => {
                  try {
                    const res = await fetch("/assets");
                    const body = (await res.json()) as { items?: StudioAsset[] };
                    const full =
                      (body.items ?? []).find((row) => row.id === asset.id) ||
                      asset;
                    applyCreatedAsset(full, n.data.attachSlotId);
                  } catch {
                    applyCreatedAsset(asset, n.data.attachSlotId);
                  }
                  loadCatalogs();
                  window.dispatchEvent(new Event("ams-assets-changed"));
                  toast("Saved to Assets.");
                })();
              },
            },
          };
        }
        if (n.type === "sheet-angle") {
          return {
            ...n,
            type: "sheet-angle",
            data: {
              ...n.data,
              onPrompt: (prompt) =>
                upsertSheetAngle(n.data.builderId, n.data.slot, {
                  slot: n.data.slot,
                  prompt,
                }),
              onRegen: () =>
                void regenSheetAngle(n.data.builderId, n.data.slot),
              onClose: () => closeNode(n.id),
            },
          };
        }
        return n;
      }),
    );
  }, [
    addAssetToHub,
    addCharacterNode,
    addFirstNode,
    addDirector,
    addHub,
    addPropNode,
    addShot,
    addShotBuilder,
    addCreatorBuilder,
    addPromptBuilder,
    applyShotBuilder,
    activeShotId,
    applyBuilderPrompt,
    applyDirectorPrompt,
    appliedPrompt,
    closeNode,
    addLastNode,
    addSceneNode,
    addSourceNode,
    addMaskNode,
    registerMaskApi,
    applyPinStill,
    applyStillToPin,
    applyCreatedAsset,
    builderSessions,
    closePinEdit,
    charCatalog,
    characters,
    firstItem,
    hubIds,
    hubNotes,
    hubTitle,
    instrumental,
    framePins,
    lastItem,
    loadCatalogs,
    maxRefs,
    onModalityChange,
    pickCatalog,
    pinEdit,
    regenSheetAngle,
    plan.source,
    sourceAccept,
    propCatalog,
    props,
    sceneCatalog,
    scenes,
    shots,
    setNodes,
    sourceItem,
    spawnPinEdit,
    spawnPinResult,
    spawnResult,
    spawnResultNear,
    addCompareFromResult,
    spawnTool,
    studioMode,
    studioModality,
    maskReady,
    toolSources,
    tryAttachSlot,
    upsertSheetAngle,
  ]);

  useEffect(() => {
    function onWinOver(event: globalThis.DragEvent) {
      const el = document.elementFromPoint(event.clientX, event.clientY);
      const overLibrary = Boolean(el?.closest("[data-os-drop='library']"));
      const overSlot = Boolean(el?.closest("[data-drop-slot]"));
      const os = isOsFileDrag(event.dataTransfer);
      if (overLibrary && !peekLibraryDrag()) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        return;
      }
      if (!os && !peekLibraryDrag()) return;
      if (!os && !overSlot) return;
      if (os || overSlot) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      }
    }
    function importThenMaybeAttach(files: File[], slot?: string) {
      void importOsFiles(files)
        .then((items) => {
          if (!items.length) return;
          if (slot) {
            tryAttachSlot(slot, items[0]);
            return;
          }
          openLibrary();
          toast(`Imported ${items.length} file(s) to Uploads.`);
        })
        .catch((err: unknown) => {
          console.error("Library import failed", err);
          toast(err instanceof Error ? err.message : "Import failed.", true);
        });
    }
    function onWinDrop(event: globalThis.DragEvent) {
      const el = document.elementFromPoint(event.clientX, event.clientY);
      const overLibrary = Boolean(el?.closest("[data-os-drop='library']"));
      const files = event.dataTransfer
        ? filesFromDataTransfer(event.dataTransfer)
        : [];
      if (files.length) {
        if (overLibrary) return;
        const slotEl = el?.closest("[data-drop-slot]") as HTMLElement | null;
        const slot = slotEl?.dataset.dropSlot;
        event.preventDefault();
        event.stopPropagation();
        importThenMaybeAttach(
          files,
          slot === "source" ||
            slot === "first" ||
            slot === "last" ||
            slot?.startsWith("char-") ||
            slot?.startsWith("scene-")
            ? slot
            : undefined,
        );
        return;
      }
      const item =
        peekLibraryDrag() ||
        (event.dataTransfer ? parseLibraryPayload(event.dataTransfer) : null);
      if (!item) return;
      const slotEl = el?.closest("[data-drop-slot]") as HTMLElement | null;
      const slot = slotEl?.dataset.dropSlot;
      if (slot?.startsWith("pin:")) {
        event.preventDefault();
        event.stopPropagation();
        consumeLibraryDrag();
        const pinId = slot.slice(4);
        const pin = framePins.find((p) => p.id === pinId);
        void applyStillToPin(pinId, item, pin?.timestamp_s);
        return;
      }
      if (
        slot !== "source" &&
        slot !== "first" &&
        slot !== "last" &&
        !slot?.startsWith("char-") &&
        !slot?.startsWith("scene-")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      consumeLibraryDrag();
      tryAttachSlot(slot, item);
    }
    window.addEventListener("dragover", onWinOver, true);
    window.addEventListener("drop", onWinDrop, true);
    return () => {
      window.removeEventListener("dragover", onWinOver, true);
      window.removeEventListener("drop", onWinDrop, true);
    };
  }, [applyStillToPin, framePins, tryAttachSlot]);

  const onFlowDragOver = useCallback((event: DragEvent) => {
    if (
      peekLibraryDrag() ||
      hasLibraryPayload(event.dataTransfer) ||
      isOsFileDrag(event.dataTransfer)
    ) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onFlowDrop = useCallback(
    (event: DragEvent) => {
      if (isOsFileDrag(event.dataTransfer) && event.dataTransfer.files.length) {
        event.preventDefault();
        const files = filesFromDataTransfer(event.dataTransfer);
        if (!files.length) return;
        void importOsFiles(files)
          .then((items) => {
            if (items.length) {
              openLibrary();
              toast(`Imported ${items.length} file(s) to Uploads.`);
            }
          })
          .catch((err: unknown) => {
            console.error("Library import failed", err);
            toast(err instanceof Error ? err.message : "Import failed.", true);
          });
        return;
      }
      const item = peekLibraryDrag() || parseLibraryPayload(event.dataTransfer);
      if (!item) return;
      event.preventDefault();
      const p = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const hit = getNodes().find((n) => {
        if (
          !n.type ||
          !["source", "first", "last", "character", "scene", "prop", "shot"].includes(n.type)
        )
          return false;
        const w = n.measured?.width ?? 240;
        const h = n.measured?.height ?? 220;
        return (
          p.x >= n.position.x &&
          p.x <= n.position.x + w &&
          p.y >= n.position.y &&
          p.y <= n.position.y + h
        );
      });
      if (!hit) return;
      consumeLibraryDrag();
      if (
        hit.id === SOURCE_ID ||
        hit.id === FIRST_ID ||
        hit.id === LAST_ID ||
        hit.id.startsWith("char-") ||
        hit.id.startsWith("scene-") ||
        hit.id.startsWith("prop-") ||
        hit.id.startsWith("shot-")
      ) {
        tryAttachSlot(hit.id, item);
      }
    },
    [getNodes, screenToFlowPosition, tryAttachSlot],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const src = connection.source || "";
      const tgt = connection.target || "";
      const ok =
        (src === SOURCE_ID && tgt === "prompt") ||
        (src === PIN_EDIT_SOURCE && tgt === PIN_EDIT_PROMPT) ||
        (src === PIN_EDIT_PROMPT && tgt === PIN_EDIT_RESULT) ||
        (src === FIRST_ID && tgt === "prompt") ||
        (src === LAST_ID && tgt === "prompt") ||
        (src.startsWith("char-") && tgt === "prompt") ||
        (src.startsWith("scene-") && tgt === "prompt") ||
        (src.startsWith("char-") && tgt === HUB_ID) ||
        (src.startsWith("scene-") && tgt === HUB_ID) ||
        (src.startsWith("prop-") && tgt === HUB_ID) ||
        (src === HUB_ID && tgt.startsWith("shot-")) ||
        (src === HUB_ID && tgt === "prompt") ||
        (src.startsWith("shot-") && tgt === "prompt") ||
        (src.startsWith("shot-") && tgt.startsWith("shot-")) ||
        (src.startsWith("spb-") && tgt.startsWith("shot-")) ||
        (src === BUILDER_ID && tgt === "prompt") ||
        (src === DIRECTOR_ID && tgt === "prompt") ||
        (src === "prompt" && tgt.startsWith("result")) ||
        (src.startsWith("result") &&
          TOOL_TYPES.some((t) => tgt.startsWith(`${t}-`))) ||
        (TOOL_TYPES.some((t) => src.startsWith(`${t}-`)) &&
          tgt.startsWith("result"));
      if (!ok) return;
      if (
        tgt === HUB_ID &&
        (src.startsWith("char-") ||
          src.startsWith("scene-") ||
          src.startsWith("prop-"))
      ) {
        setHubIds((cur) => (cur.includes(src) ? cur : [...cur, src]));
      }
      setEdges((eds) =>
        addEdge(
          { ...connection, style: { stroke: "#8aa4c2", strokeWidth: 2 } },
          eds,
        ),
      );
    },
    [setEdges],
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className={
              settingsOpen
                ? "library-toggle settings-toggle on"
                : "library-toggle settings-toggle"
            }
            aria-label="Settings"
            title="Settings"
            aria-pressed={settingsOpen}
            onClick={() => {
              setGuideOpen(false);
              setSettingsOpen((v) => !v);
            }}
          >
            ⚙
          </button>
          <button
            type="button"
            className={guideOpen ? "library-toggle on" : "library-toggle"}
            aria-label="Model Guide"
            title="Model Guide"
            aria-pressed={guideOpen}
            onClick={() => {
              setSettingsOpen(false);
              setGuideOpen((v) => !v);
            }}
          >
            Model Guide
          </button>
          <div>
            <h1>AI Media Studio V2</h1>
            <p>Wheel zoom · Middle-drag pan</p>
          </div>
        </div>
        <div className="topbar-right">
          <button
            type="button"
            className="library-toggle"
            title="Fit all nodes in view"
            onClick={frameAll}
          >
            Frame all
          </button>
          <button
            type="button"
            className={sideTab === "library" ? "library-toggle on" : "library-toggle"}
            onClick={() => setSideTab((v) => (v === "library" ? null : "library"))}
          >
            Library
          </button>
          <button
            type="button"
            className={sideTab === "assets" ? "library-toggle on" : "library-toggle"}
            onClick={() => setSideTab((v) => (v === "assets" ? null : "assets"))}
          >
            Assets
          </button>
        </div>
      </header>
      {settingsOpen || guideOpen ? (
        <div
          className="panel-overlay"
          onClick={() => {
            setSettingsOpen(false);
            setGuideOpen(false);
          }}
        />
      ) : null}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onTheme={setThemePref}
        gridSnap={gridSnap}
        onGridSnap={setGridSnapPref}
        edgeStyle={edgeStyle}
        onEdgeStyle={setEdgeStylePref}
      />
      <ModelGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          const busy = nodes.some(
            (n) => n.type === "result" && Boolean(n.data.generating),
          );
          const rest = changes.filter((c) => c.type !== "dimensions");
          const dims = changes.filter((c) => c.type === "dimensions");
          if (rest.length) onNodesChange(rest);
          if (busy || !dims.length) return;
          window.clearTimeout(dimChangeTimer.current);
          dimChangeTimer.current = window.setTimeout(() => {
            onNodesChange(dims);
          }, 80);
        }}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onFlowDragOver}
        onDrop={onFlowDrop}
        nodeTypes={nodeTypes}
        snapToGrid={gridSnap !== "off"}
        snapGrid={snapGridFor(gridSnap) ?? [22, 22]}
        defaultEdgeOptions={{
          type: edgeType,
          style: { stroke: "#8aa4c2", strokeWidth: 2 },
        }}
        connectionLineType={
          edgeStyle === "straight"
            ? ConnectionLineType.Straight
            : ConnectionLineType.Bezier
        }
        colorMode={theme === "night" ? "dark" : "light"}
        proOptions={{ hideAttribution: true }}
        panOnDrag={[1]}
        panOnScroll={false}
        selectionOnDrag={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={0.2}
        maxZoom={1.6}
        translateExtent={WORLD}
        nodesConnectable
        isValidConnection={(c) => {
          const src = c.source || "";
          const tgt = c.target || "";
          return (
            (src === SOURCE_ID && tgt === "prompt") ||
            (src === FIRST_ID && tgt === "prompt") ||
            (src === LAST_ID && tgt === "prompt") ||
            (src.startsWith("char-") && tgt === "prompt") ||
            (src.startsWith("scene-") && tgt === "prompt") ||
            (src.startsWith("char-") && tgt === HUB_ID) ||
            (src.startsWith("scene-") && tgt === HUB_ID) ||
            (src.startsWith("prop-") && tgt === HUB_ID) ||
            (src === HUB_ID && tgt.startsWith("shot-")) ||
            (src === HUB_ID && tgt === "prompt") ||
            (src.startsWith("shot-") && tgt === "prompt") ||
            (src.startsWith("shot-") && tgt.startsWith("shot-")) ||
            (src.startsWith("spb-") && tgt.startsWith("shot-")) ||
            (src === BUILDER_ID && tgt === "prompt") ||
            (src === DIRECTOR_ID && tgt === "prompt") ||
            (src.startsWith("cbuild-") && tgt.startsWith("sang-")) ||
            (src.startsWith("sang-") && tgt.startsWith("sang-")) ||
            (src === "prompt" && tgt.startsWith("result")) ||
            (src.startsWith("result") &&
              TOOL_TYPES.some((t) => tgt.startsWith(`${t}-`))) ||
            (TOOL_TYPES.some((t) => src.startsWith(`${t}-`)) &&
              tgt.startsWith("result"))
          );
        }}
        nodesDraggable
        elementsSelectable
        deleteKeyCode={null}
        defaultViewport={viewportToCenterPrompt()}
        preventScrolling
      >
        <Background
          id="dots"
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.5}
          color={theme === "night" ? "#3a4554" : "#c5c9d1"}
        />
      </ReactFlow>
      <LibraryPanel
        open={sideTab !== null}
        tab={sideTab || "library"}
        onClose={() => setSideTab(null)}
        onPick={attachMedia}
        onNewAsset={(kind, seeds) => addCreatorBuilder(kind, undefined, seeds)}
      />
      <MediaLightbox />
      {toastMsg ? (
        <div
          className={toastMsg.error ? "toast error" : "toast"}
          role="status"
        >
          {toastMsg.text}
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <StudioCanvas />
    </ReactFlowProvider>
  );
}
