import { useCallback, useEffect, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
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
import type {
  GenerateResponse,
  LibraryItem,
  PromptNodeData,
  ResultNodeData,
  SourceNodeData,
} from "./types";
import "./App.css";

type StudioNode =
  | Node<PromptNodeData, "prompt">
  | Node<ResultNodeData, "result">
  | Node<SourceNodeData, "source">;

const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  result: ResultNode,
  source: SourceNode,
};

const WORLD: [[number, number], [number, number]] = [
  [-200, -200],
  [3600, 2400],
];

const PROMPT_POS = { x: 420, y: 90 };
const SOURCE_ID = "source";
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
      source: null,
    },
  },
];

function StudioCanvas() {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [sourceItem, setSourceItem] = useState<LibraryItem | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<StudioNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

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

  const addSourceNode = useCallback(() => {
    setNodes((current) => {
      if (current.some((n) => n.id === SOURCE_ID)) return current;
      const prompt = current.find((n) => n.id === "prompt");
      const src: StudioNode = {
        id: SOURCE_ID,
        type: "source",
        position: {
          x: Math.max(-160, (prompt?.position.x ?? PROMPT_POS.x) - 300),
          y: (prompt?.position.y ?? PROMPT_POS.y) + 36,
        },
        dragHandle: ".node-header",
        data: {
          item: sourceItem,
          onClear: () => setSourceItem(null),
          onOpenLibrary: () => setLibraryOpen(true),
          onAttach: (item) => setSourceItem(item),
        },
      };
      return [...current, src];
    });
    setEdges((current) => {
      if (current.some((e) => e.id === "e-source-prompt")) return current;
      return addEdge(
        {
          id: "e-source-prompt",
          source: SOURCE_ID,
          target: "prompt",
          style: { stroke: "#8aa4c2", strokeWidth: 2 },
        },
        current,
      );
    });
  }, [setEdges, setNodes, sourceItem]);

  const attachSource = useCallback(
    (item: LibraryItem) => {
      setSourceItem(item);
      addSourceNode();
    },
    [addSourceNode],
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
              source: sourceItem,
            },
          };
        }
        if (n.id === SOURCE_ID) {
          return {
            ...n,
            type: "source",
            data: {
              item: sourceItem,
              onClear: () => setSourceItem(null),
              onOpenLibrary: () => setLibraryOpen(true),
              onAttach: (item) => setSourceItem(item),
            },
          };
        }
        return n;
      }),
    );
  }, [addSourceNode, setNodes, sourceItem, spawnResult]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const ok =
        (connection.source === SOURCE_ID && connection.target === "prompt") ||
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
        onPick={attachSource}
      />
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
