import type { DragEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { isAudioPath, isVideoPath } from "./media";
import {
  hasLibraryPayload,
  parseLibraryPayload,
  type LibraryItem,
  type SlotAccept,
  type SourceNodeData,
} from "./types";

export type SourceFlowNode = Node<SourceNodeData, "source" | "first" | "last">;

function accepts(accept: SlotAccept, item: LibraryItem): boolean {
  if (accept === "any") return true;
  if (accept === "image") return item.kind !== "video" && item.kind !== "audio";
  if (accept === "video") return item.kind === "video";
  return true;
}

export default function SourceNode({ data }: NodeProps<SourceFlowNode>) {
  const item = data.item;
  const title = data.title || "Source";
  const accept = data.accept || "any";

  function onDragOver(event: DragEvent) {
    if (!hasLibraryPayload(event.dataTransfer) && ![...event.dataTransfer.types].includes("Files")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const dragged = parseLibraryPayload(event.dataTransfer);
    if (dragged && accepts(accept, dragged)) {
      data.onAttach(dragged);
    }
  }

  const hint =
    accept === "video"
      ? "Drop a video or open Library"
      : accept === "image"
        ? "Drop a still or open Library"
        : "Drop media or open Library";

  return (
    <div
      className="studio-node source-node"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="node-header">{title}</div>
      <div className="node-body nodrag">
        {item ? (
          <>
            <div className="source-preview">
              {item.kind === "video" || isVideoPath(item.url) ? (
                <video src={item.url} muted />
              ) : item.kind === "audio" || isAudioPath(item.url) ? (
                <div className="source-empty">{item.name}</div>
              ) : (
                <img src={item.thumb_url || item.url} alt={item.name} />
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
              {hint}
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
