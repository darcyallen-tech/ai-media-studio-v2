import { useCallback, useEffect } from "react";
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
import PromptNode from "./PromptNode";
import ResultNode from "./ResultNode";
import type { GenerateResponse, PromptNodeData, ResultNodeData } from "./types";
import "./App.css";

type StudioNode =
  | Node<PromptNodeData, "prompt">
  | Node<ResultNodeData, "result">;

const nodeTypes: NodeTypes = {
  prompt: PromptNode,
  result: ResultNode,
};

const WORLD: [[number, number], [number, number]] = [
  [-200, -200],
  [3600, 2400],
];

const PROMPT_POS = { x: 420, y: 90 };

const initialEdges: Edge[] = [];

const initialNodes: StudioNode[] = [
  {
    id: "prompt",
    type: "prompt",
    position: PROMPT_POS,
    dragHandle: ".node-header",
    data: {
      onGenerated: () => undefined,
    },
  },
];

function StudioCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<StudioNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const spawnResult = useCallback(
    (result: GenerateResponse) => {
      setNodes((current) => {
        const prompt = current.find((n) => n.id === "prompt");
        const existing = current.find((n) => n.id === "result");
        const position = existing?.position ?? {
          x: (prompt?.position.x ?? PROMPT_POS.x) + 500,
          y: prompt?.position.y ?? PROMPT_POS.y,
        };
        const next: StudioNode = {
          id: "result",
          type: "result",
          position,
          dragHandle: ".node-header",
          data: { result },
        };
        if (existing) {
          return current.map((n) => (n.id === "result" ? next : n));
        }
        return [...current, next];
      });
      setEdges((current) => {
        if (current.some((e) => e.id === "e-prompt-result")) return current;
        return addEdge(
          {
            id: "e-prompt-result",
            source: "prompt",
            target: "result",
            style: { stroke: "#8aa4c2", strokeWidth: 2 },
          },
          current,
        );
      });
    },
    [setEdges, setNodes],
  );

  useEffect(() => {
    setNodes((current) =>
      current.map((n): StudioNode => {
        if (n.id !== "prompt") return n;
        return {
          ...n,
          type: "prompt",
          data: { onGenerated: spawnResult },
        };
      }),
    );
  }, [setNodes, spawnResult]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges],
  );

  return (
    <div className="app">
      <header className="topbar">
        <h1>AI Media Studio V2</h1>
        <p>Wheel zoom · Middle-drag pan</p>
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
        nodesConnectable={false}
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
