import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import type { SheetAngleNodeData } from "./types";

export type SheetAngleFlowNode = Node<SheetAngleNodeData, "sheet-angle">;

export default function SheetAngleNode({ data }: NodeProps<SheetAngleFlowNode>) {
  return (
    <div className="studio-node sheet-angle-node">
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">
        <span>{data.label || data.slot}</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag">
        {data.url ? (
          <div className="source-preview">
            <img src={data.url} alt="" draggable={false} />
          </div>
        ) : (
          <div className="source-empty">
            {data.generating ? "Generating…" : "No still yet"}
          </div>
        )}
        <label className="builder-field">
          <span className="field-label">Angle prompt</span>
          <textarea
            className="prompt nowheel"
            rows={4}
            value={data.prompt}
            disabled={data.generating}
            onChange={(e) => data.onPrompt(e.target.value)}
          />
        </label>
        <div className="prompt-actions">
          <button
            type="button"
            className="generate nodrag"
            disabled={data.generating || !data.prompt.trim()}
            onClick={data.onRegen}
          >
            {data.generating ? "Generating…" : "Regenerate"}
          </button>
        </div>
        {data.error ? (
          <p className="hint warn" role="alert">
            {data.error}
          </p>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}
