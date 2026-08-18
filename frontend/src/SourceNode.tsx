import type { DragEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { isAudioPath, isVideoPath } from "./media";
import { LIBRARY_DRAG_MIME, type LibraryItem, type SourceNodeData } from "./types";

export type SourceFlowNode = Node<SourceNodeData, "source">;

function parseLibraryDrag(event: DragEvent): LibraryItem | null {
  const raw = event.dataTransfer.getData(LIBRARY_DRAG_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LibraryItem;
  } catch {
    return null;
  }
}

export default function SourceNode({ data }: NodeProps<SourceFlowNode>) {
  const item = data.item;

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    const dragged = parseLibraryDrag(event);
    if (dragged) {
      data.onAttach(dragged);
    }
  }

  return (
    <div
      className="studio-node source-node"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="node-header">Source</div>
      <div className="node-body nodrag">
        {item ? (
          <>
            <div className="source-preview">
              {item.kind === "image" || (!isVideoPath(item.url) && !isAudioPath(item.url)) ? (
                <img src={item.thumb_url || item.url} alt={item.name} />
              ) : item.kind === "video" || isVideoPath(item.url) ? (
                <video src={item.url} muted />
              ) : (
                <div className="source-empty">{item.name}</div>
              )}
            </div>
            <p className="hint" title={item.path}>
              {item.name}
            </p>
            <button type="button" className="ghost nodrag" onClick={data.onClear}>
              Clear
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="source-empty nodrag"
              onClick={data.onOpenLibrary}
            >
              Drop media or open Library
            </button>
            <button type="button" className="ghost nodrag" onClick={data.onOpenLibrary}>
              Open Library
            </button>
          </>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}
