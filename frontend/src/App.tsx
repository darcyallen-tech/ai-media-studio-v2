import { useCallback, useEffect, useState, type DragEvent } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import LibraryPanel from "./LibraryPanel";
import MediaLightbox from "./MediaLightbox";
import SettingsPanel from "./SettingsPanel";
import PromptNode, { countFilledRefs, reservedRefNodes } from "./PromptNode";
import RefNode from "./RefNode";
import ResultNode from "./ResultNode";
import SourceNode from "./SourceNode";
import ToolNode from "./ToolNode";
import { isAudioPath, isVideoPath } from "./media";
import {
  consumeLibraryDrag,
  peekLibraryDrag,
  slotAccepts,
  slotNeedLabel,
} from "./libraryDrag";
import {
  filesFromDataTransfer,
  importOsFiles,
  isOsFileDrag,
} from "./osImport";
import { bindToast, toast } from "./toast";
import {
  catalogToItem,
  hasLibraryPayload,
  inputPlan,
  maxRefImages,
  parseLibraryPayload,
  type GenerateResponse,
  type GraphInputs,
  type LibraryItem,
  type Mode,
  type ModelRow,
  type PromptNodeData,
  type RefCatalogEntry,
  type RefNodeData,
  type RefSlotState,
  type ResultNodeData,
  type SlotAccept,
  type SourceNodeData,
  type ToolKind,
  type ToolNodeData,
} from "./types";
import "./App.css";

type StudioNode =
  | Node<PromptNodeData, "prompt">
  | Node<ResultNodeData, "result">
  | Node<SourceNodeData, "source">
  | Node<SourceNodeData, "first">
  | Node<SourceNodeData, "last">
  | Node<RefNodeData, "character">
  | Node<RefNodeData, "scene">
  | Node<ToolNodeData, "upscale">
  | Node<ToolNodeData, "denoise">
  | Node<ToolNodeData, "restore">
  | Node<ToolNodeData, "deblur">
  | Node<ToolNodeData, "interpolate">;

const TOOL_TYPES = ["upscale", "denoise", "restore", "deblur", "interpolate"] as const;

const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  result: ResultNode,
  source: SourceNode,
  first: SourceNode,
  last: SourceNode,
  character: RefNode,
  scene: RefNode,
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
  return {
    id: `gen:${local || url}`,
    name,
    source: "generated",
    kind,
    path: local,
    url,
    thumb_url: kind === "image" ? url : null,
  };
}

const WORLD: [[number, number], [number, number]] = [
  [-200, -200],
  [3600, 2400],
];

const PROMPT_POS = { x: 420, y: 90 };
const SOURCE_ID = "source";
const FIRST_ID = "first";
const LAST_ID = "last";
const RESULT_ID = "result";

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
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourceItem, setSourceItem] = useState<LibraryItem | null>(null);
  const [firstItem, setFirstItem] = useState<LibraryItem | null>(null);
  const [lastItem, setLastItem] = useState<LibraryItem | null>(null);
  const [characters, setCharacters] = useState<RefSlotState[]>([]);
  const [scenes, setScenes] = useState<RefSlotState[]>([]);
  const [charCatalog, setCharCatalog] = useState<RefCatalogEntry[]>([]);
  const [sceneCatalog, setSceneCatalog] = useState<RefCatalogEntry[]>([]);
  const [plan, setPlan] = useState<GraphInputs>({});
  const [maxRefs, setMaxRefs] = useState(0);
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
    if (!toastMsg) return;
    const id = window.setTimeout(() => setToastMsg(null), 6000);
    return () => window.clearTimeout(id);
  }, [toastMsg]);

  const [nodes, setNodes, onNodesChange] = useNodesState<StudioNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { screenToFlowPosition, getNodes } = useReactFlow();

  const closeNode = useCallback(
    (id: string) => {
      if (id === "prompt") return;
      if (id === SOURCE_ID) setSourceItem(null);
      if (id === FIRST_ID) setFirstItem(null);
      if (id === LAST_ID) setLastItem(null);
      if (id.startsWith("char-")) {
        setCharacters((cur) => cur.filter((r) => r.id !== id));
      }
      if (id.startsWith("scene-")) {
        setScenes((cur) => cur.filter((r) => r.id !== id));
      }
      if (TOOL_TYPES.includes(id.split("-")[0] as ToolKind)) {
        setToolSources((cur) => {
          const next = { ...cur };
          delete next[id];
          return next;
        });
      }
      setNodes((current) => current.filter((n) => n.id !== id));
      setEdges((current) =>
        current.filter((e) => e.source !== id && e.target !== id),
      );
    },
    [setEdges, setNodes],
  );

  const spawnResult = useCallback(
    (result: GenerateResponse) => {
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
            onClose: () => closeNode(RESULT_ID),
            onTool: () => undefined,
          },
        };
        if (existing) {
          return current.map((n) => (n.id === RESULT_ID ? next : n));
        }
        return [...current, next];
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
    [closeNode, setEdges, setNodes],
  );

  const spawnResultNear = useCallback(
    (fromId: string, result: GenerateResponse) => {
      const resultId = `result-${Date.now().toString(36)}`;
      setNodes((current) => {
        const parent = current.find((n) => n.id === fromId);
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
            onClose: () => closeNode(resultId),
            onTool: () => undefined,
          },
        };
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
            onOpenLibrary: () => setLibraryOpen(true),
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
            onOpenLibrary: () => setLibraryOpen(true),
            onAttach: () => undefined,
            onOsFiles: () => undefined,
            onClose: () => closeNode(id),
          },
        };
        return [...current, node];
      });
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
    [closeNode, setEdges, setNodes],
  );

  const addSourceNode = useCallback(() => {
    const accept = plan.source ?? "any";
    ensureSlot(SOURCE_ID, "Source", accept, 36);
  }, [ensureSlot, plan.source]);

  const addFirstNode = useCallback(() => {
    ensureSlot(FIRST_ID, "First Frame", "image", -10);
  }, [ensureSlot]);

  const addLastNode = useCallback(() => {
    ensureSlot(LAST_ID, "Last Frame", "image", 170);
  }, [ensureSlot]);

  const onModalityChange = useCallback(
    (_mode: Mode, modality: string, model?: ModelRow | null) => {
      setPlan(inputPlan(modality, model));
      setMaxRefs(maxRefImages(model, modality));
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
    (role: "character" | "scene") => {
      const reserved = reservedRefNodes(sourceItem, characters, scenes);
      if (maxRefs > 0 && reserved >= maxRefs) {
        toast(`This model allows at most ${maxRefs} reference images.`, true);
        return;
      }
      const id = `${role === "character" ? "char" : "scene"}-${Date.now().toString(36)}`;
      const row: RefSlotState = { id, catalogId: "", note: "", item: null };
      if (role === "character") setCharacters((cur) => [...cur, row]);
      else setScenes((cur) => [...cur, row]);
      setNodes((current) => {
        if (current.some((n) => n.id === id)) return current;
        const prompt = current.find((n) => n.id === "prompt");
        const siblings = current.filter((n) =>
          ["source", "character", "scene"].includes(n.type || ""),
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
            title: role === "character" ? "Character" : "Scene",
            role,
            item: null,
            catalogId: "",
            note: "",
            catalog: role === "character" ? charCatalog : sceneCatalog,
            onClear: () => undefined,
            onOpenLibrary: () => setLibraryOpen(true),
            onAttach: () => undefined,
            onPickCatalog: () => undefined,
            onNote: () => undefined,
            onClose: () => closeNode(id),
          },
        };
        return [...current, node];
      });
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
      sceneCatalog,
      scenes,
      setEdges,
      setNodes,
      sourceItem,
    ],
  );

  const addCharacterNode = useCallback(
    () => addRefNode("character"),
    [addRefNode],
  );
  const addSceneNode = useCallback(() => addRefNode("scene"), [addRefNode]);

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

  useEffect(() => {
    if (!plan.characters && !plan.scenes) return;
    const ac = new AbortController();
    fetch("/characters", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body: { items?: RefCatalogEntry[] }) => {
        setCharCatalog(body.items ?? []);
      })
      .catch(() => undefined);
    fetch("/scenes", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body: { items?: RefCatalogEntry[] }) => {
        setSceneCatalog(body.items ?? []);
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, [plan.characters, plan.scenes]);

  const tryAttachSlot = useCallback(
    (slot: string, item: LibraryItem) => {
      if (slot.startsWith("char-") || slot.startsWith("scene-")) {
        if (!slotAccepts("image", item)) {
          toast(slotNeedLabel("image"), true);
          return false;
        }
        const isChar = slot.startsWith("char-");
        const rows = isChar ? characters : scenes;
        const setter = isChar ? setCharacters : setScenes;
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
        slot === "source" ? (plan.source ?? "image") : "image";
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
      scenes,
      sourceItem,
    ],
  );

  const attachMedia = useCallback(
    (item: LibraryItem) => {
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
      characters,
      firstItem,
      lastItem,
      plan,
      scenes,
      sourceItem,
      tryAttachSlot,
    ],
  );

  const pickCatalog = useCallback(
    (slotId: string, role: "character" | "scene", catalogId: string) => {
      const catalog = role === "character" ? charCatalog : sceneCatalog;
      const setter = role === "character" ? setCharacters : setScenes;
      const entry = catalog.find((r) => r.id === catalogId) ?? null;
      const mapped = entry ? catalogToItem(entry) : null;
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
          };
        }),
      );
    },
    [atRefLimit, charCatalog, maxRefs, sceneCatalog],
  );

  useEffect(() => {
    if (plan.source === "image" && sourceItem?.kind === "video") {
      setSourceItem(null);
    }
    if (plan.source === "video" && sourceItem && sourceItem.kind !== "video") {
      setSourceItem(null);
    }
    if (firstItem?.kind === "video") setFirstItem(null);
    if (lastItem?.kind === "video") setLastItem(null);
  }, [plan.source, sourceItem, firstItem, lastItem]);

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
              onAddFirst: addFirstNode,
              onAddLast: addLastNode,
              onAddCharacter: addCharacterNode,
              onAddScene: addSceneNode,
              onModalityChange,
              source: sourceItem,
              first: firstItem,
              last: lastItem,
              characters,
              scenes,
              maxRefs,
            },
          };
        }
        if (n.id === SOURCE_ID) {
          return {
            ...n,
            type: "source",
            data: {
              title: "Source",
              accept: plan.source ?? "any",
              item: sourceItem,
              onClear: () => setSourceItem(null),
              onOpenLibrary: () => setLibraryOpen(true),
              onAttach: (item) => setSourceItem(item),
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
              onOpenLibrary: () => setLibraryOpen(true),
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
              onOpenLibrary: () => setLibraryOpen(true),
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
          return {
            ...n,
            type: "result",
            data: {
              result,
              onClose: () => closeNode(n.id),
              onTool: (kind) => spawnTool(n.id, kind, result),
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
              onOpenLibrary: () => setLibraryOpen(true),
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
              catalog: charCatalog,
              onClear: () =>
                setCharacters((cur) =>
                  cur.map((r) =>
                    r.id === n.id
                      ? { ...r, item: null, catalogId: "", note: "" }
                      : r,
                  ),
                ),
              onOpenLibrary: () => setLibraryOpen(true),
              onAttach: (item) => tryAttachSlot(n.id, item),
              onPickCatalog: (id) => pickCatalog(n.id, "character", id),
              onNote: (note) =>
                setCharacters((cur) =>
                  cur.map((r) => (r.id === n.id ? { ...r, note } : r)),
                ),
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
              catalog: sceneCatalog,
              onClear: () =>
                setScenes((cur) =>
                  cur.map((r) =>
                    r.id === n.id
                      ? { ...r, item: null, catalogId: "", note: "" }
                      : r,
                  ),
                ),
              onOpenLibrary: () => setLibraryOpen(true),
              onAttach: (item) => tryAttachSlot(n.id, item),
              onPickCatalog: (id) => pickCatalog(n.id, "scene", id),
              onNote: (note) =>
                setScenes((cur) =>
                  cur.map((r) => (r.id === n.id ? { ...r, note } : r)),
                ),
              onClose: () => closeNode(n.id),
            },
          };
        }
        return n;
      }),
    );
  }, [
    addCharacterNode,
    addFirstNode,
    closeNode,
    addLastNode,
    addSceneNode,
    addSourceNode,
    charCatalog,
    characters,
    firstItem,
    lastItem,
    maxRefs,
    onModalityChange,
    pickCatalog,
    plan.source,
    sceneCatalog,
    scenes,
    setNodes,
    sourceItem,
    spawnResult,
    spawnResultNear,
    spawnTool,
    toolSources,
    tryAttachSlot,
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
          setLibraryOpen(true);
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
  }, [tryAttachSlot]);

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
              setLibraryOpen(true);
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
          !["source", "first", "last", "character", "scene"].includes(n.type)
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
        hit.id.startsWith("scene-")
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
        (src === FIRST_ID && tgt === "prompt") ||
        (src === LAST_ID && tgt === "prompt") ||
        (src.startsWith("char-") && tgt === "prompt") ||
        (src.startsWith("scene-") && tgt === "prompt") ||
        (src === "prompt" && tgt.startsWith("result")) ||
        (src.startsWith("result") &&
          TOOL_TYPES.some((t) => tgt.startsWith(`${t}-`))) ||
        (TOOL_TYPES.some((t) => src.startsWith(`${t}-`)) &&
          tgt.startsWith("result"));
      if (!ok) return;
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
            className="library-toggle settings-toggle"
            aria-label="Settings"
            title="Settings"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            ⚙
          </button>
          <div>
            <h1>AI Media Studio V2</h1>
            <p>Wheel zoom · Middle-drag pan</p>
          </div>
        </div>
        <button
          type="button"
          className="library-toggle"
          onClick={() => setLibraryOpen((v) => !v)}
        >
          Library
        </button>
      </header>
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onFlowDragOver}
        onDrop={onFlowDrop}
        nodeTypes={nodeTypes}
        colorMode="light"
        proOptions={{ hideAttribution: true }}
        panOnDrag={[1]}
        panOnScroll={false}
        selectionOnDrag={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={0.4}
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
        defaultViewport={{ x: 40, y: 36, zoom: 1 }}
        preventScrolling
      >
        <Background
          id="dots"
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.5}
          color="#c5c9d1"
        />
      </ReactFlow>
      <LibraryPanel
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onPick={attachMedia}
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
