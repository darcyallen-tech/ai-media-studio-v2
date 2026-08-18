import { useState, type DragEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { isAudioPath, isVideoPath } from "./media";
import { peekLibraryDrag } from "./libraryDrag";
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

function itemFromEvent(event: DragEvent): LibraryItem | null {
  return peekLibraryDrag() || parseLibraryPayload(event.dataTransfer);
}

export default function SourceNode({ data }: NodeProps<SourceFlowNode>) {
  const item = data.item;
  const title = data.title || "Source";
  const accept = data.accept || "any";
  const [hot, setHot] = useState(false);

  function allowDrop(event: DragEvent) {
    const incoming = peekLibraryDrag();
    if (!incoming && !hasLibraryPayload(event.dataTransfer)) return false;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    return true;
  }

  function onDragEnter(event: DragEvent) {
    if (allowDrop(event)) setHot(true);
  }

  function onDragOver(event: DragEvent) {
    allowDrop(event);
  }

  function onDragLeave(event: DragEvent) {
    const next = event.relatedTarget as globalThis.Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setHot(false);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setHot(false);
    const dragged = itemFromEvent(event);
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
      className={hot ? "studio-node source-node drop-hot" : "studio-node source-node"}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="node-header">{title}</div>
      <div className="node-body nodrag nopan">
        {item ? (
          <>
            <div className="source-preview">
              {item.kind === "video" || isVideoPath(item.url) ? (
                <video src={item.url} muted draggable={false} />
              ) : item.kind === "audio" || isAudioPath(item.url) ? (
                <div className="source-empty">{item.name}</div>
              ) : (
                <img src={item.thumb_url || item.url} alt={item.name} draggable={false} />
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
          <div
            className="source-empty nodrag"
            role="button"
            tabIndex={0}
            onClick={data.onOpenLibrary}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") data.onOpenLibrary();
            }}
          >
            {hint}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}
