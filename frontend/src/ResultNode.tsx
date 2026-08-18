import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { formatDuration, isAudioPath, isVideoPath } from "./media";
import type { ResultNodeData } from "./types";

export type ResultFlowNode = Node<ResultNodeData, "result">;

export default function ResultNode({ data }: NodeProps<ResultFlowNode>) {
  const result = data.result;
  const paths = result.result_paths ?? [];

  return (
    <div className="studio-node result-node">
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">Result</div>
      <div className="node-body nodrag">
        <p className="meta">
          <span>{result.cost || "Cost: —"}</span>
          <span>{formatDuration(result.duration_sec)}</span>
        </p>
        <div className="media">
          {paths.map((src) =>
            isVideoPath(src) ? (
              <video key={src} src={src} controls playsInline />
            ) : isAudioPath(src) ? (
              <audio key={src} src={src} controls />
            ) : (
              <img key={src} src={src} alt="Generated result" />
            ),
          )}
          {paths.length === 0 ? (
            <p className="hint">No media paths returned.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
