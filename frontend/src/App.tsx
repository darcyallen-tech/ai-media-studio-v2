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
import PromptNode from "./PromptNode";
import ResultNode from "./ResultNode";
import SourceNode from "./SourceNode";
import { bindToast } from "./toast";
import {
  hasLibraryPayload,
  inputPlan,
  parseLibraryPayload,
  type GenerateResponse,
  type GraphInputs,
  type LibraryItem,
  type Mode,
  type PromptNodeData,
  type ResultNodeData,
  type SlotAccept,
  type SourceNodeData,
} from "./types";
import "./App.css";

type StudioNode =
  | Node<PromptNodeData, "prompt">
  | Node<ResultNodeData, "result">
  | Node<SourceNodeData, "source">
  | Node<SourceNodeData, "first">
  | Node<SourceNodeData, "last">;

const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  result: ResultNode,
  source: SourceNode,
  first: SourceNode,
  last: SourceNode,
};

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
      onModalityChange: () => undefined,
      source: null,
      first: null,
      last: null,
    },
  },
];

function StudioCanvas() {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [sourceItem, setSourceItem] = useState<LibraryItem | null>(null);
  const [firstItem, setFirstItem] = useState<LibraryItem | null>(null);
  const [lastItem, setLastItem] = useState<LibraryItem | null>(null);
  const [plan, setPlan] = useState<GraphInputs>({});
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
          data: { result },
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
    [setEdges, setNodes],
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
    [setEdges, setNodes],
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

  const onModalityChange = useCallback((_mode: Mode, modality: string) => {
    setPlan(inputPlan(modality));
  }, []);

  const attachMedia = useCallback(
    (item: LibraryItem) => {
      const kind = item.kind;
      if (plan.first || plan.last) {
        if (kind === "video") return;
        if (!firstItem) {
          setFirstItem(item);
          addFirstNode();
          return;
        }
        if (!lastItem) {
          setLastItem(item);
          addLastNode();
          return;
        }
        setLastItem(item);
        return;
      }
      if (plan.source === "video" && kind !== "video") return;
      if (plan.source === "image" && kind === "video") return;
      setSourceItem(item);
      addSourceNode();
    },
    [addFirstNode, addLastNode, addSourceNode, firstItem, lastItem, plan],
  );

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
              onModalityChange,
              source: sourceItem,
              first: firstItem,
              last: lastItem,
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
            },
          };
        }
        return n;
      }),
    );
  }, [
    addFirstNode,
    addLastNode,
    addSourceNode,
    firstItem,
    lastItem,
    onModalityChange,
    plan.source,
    setNodes,
    sourceItem,
    spawnResult,
  ]);

  const onFlowDragOver = useCallback((event: DragEvent) => {
    if (hasLibraryPayload(event.dataTransfer)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onFlowDrop = useCallback(
    (event: DragEvent) => {
      const item = parseLibraryPayload(event.dataTransfer);
      if (!item) return;
      event.preventDefault();
      const p = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const hit = getNodes().find((n) => {
        if (!n.type || !["source", "first", "last"].includes(n.type)) return false;
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
      if (hit.id === SOURCE_ID) setSourceItem(item);
      if (hit.id === FIRST_ID) setFirstItem(item);
      if (hit.id === LAST_ID) setLastItem(item);
    },
    [getNodes, screenToFlowPosition],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const ok =
        (connection.source === SOURCE_ID && connection.target === "prompt") ||
        (connection.source === FIRST_ID && connection.target === "prompt") ||
        (connection.source === LAST_ID && connection.target === "prompt") ||
        (connection.source === "prompt" && connection.target === RESULT_ID);
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
        <div>
          <h1>AI Media Studio V2</h1>
          <p>Wheel zoom · Middle-drag pan</p>
        </div>
        <button
          type="button"
          className="library-toggle"
          onClick={() => setLibraryOpen((v) => !v)}
        >
          Library
        </button>
      </header>
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
        isValidConnection={(c) =>
          (c.source === SOURCE_ID && c.target === "prompt") ||
          (c.source === FIRST_ID && c.target === "prompt") ||
          (c.source === LAST_ID && c.target === "prompt") ||
          (c.source === "prompt" && c.target === RESULT_ID)
        }
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
