import { useState, type DragEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { isAudioPath, isVideoPath } from "./media";
import ResizableMedia from "./ResizableMedia";
import NodeClose from "./NodeClose";
import { openLightbox } from "./lightbox";
import { peekLibraryDrag, slotAccepts, slotNeedLabel } from "./libraryDrag";
import { filesFromDataTransfer, isOsFileDrag } from "./osImport";
import { toast } from "./toast";
import {
  hasLibraryPayload,
  parseLibraryPayload,
  type LibraryItem,
  type SlotAccept,
  type SourceNodeData,
} from "./types";

export type SourceFlowNode = Node<SourceNodeData, "source" | "first" | "last">;

function itemFromEvent(event: DragEvent): LibraryItem | null {
  return peekLibraryDrag() || parseLibraryPayload(event.dataTransfer);
}

export default function SourceNode({ id, data }: NodeProps<SourceFlowNode>) {
  const item = data.item;
  const title = data.title || "Source";
  const accept: SlotAccept = data.accept || "any";
  const [hover, setHover] = useState<"ok" | "bad" | null>(null);

  function incomingItem(event: DragEvent): LibraryItem | null {
    return peekLibraryDrag() || (hasLibraryPayload(event.dataTransfer) ? peekLibraryDrag() : null);
  }

  function allowDrop(event: DragEvent) {
    if (data.locked) return false;
    if (isOsFileDrag(event.dataTransfer) && !peekLibraryDrag()) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
      return true;
    }
    const incoming = peekLibraryDrag() || (hasLibraryPayload(event.dataTransfer) ? true : null);
    if (!incoming) return false;
    event.preventDefault();
    event.stopPropagation();
    const itemNow = peekLibraryDrag();
    const ok = itemNow ? slotAccepts(accept, itemNow) : true;
    event.dataTransfer.dropEffect = ok ? "copy" : "none";
    return true;
  }

  function onDragEnter(event: DragEvent) {
    if (!allowDrop(event)) return;
    const next = incomingItem(event);
    setHover(next && !slotAccepts(accept, next) ? "bad" : "ok");
  }

  function onDragOver(event: DragEvent) {
    if (!allowDrop(event)) return;
    const next = peekLibraryDrag();
    setHover(next && !slotAccepts(accept, next) ? "bad" : "ok");
  }

  function onDragLeave(event: DragEvent) {
    const next = event.relatedTarget as globalThis.Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setHover(null);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setHover(null);
    if (isOsFileDrag(event.dataTransfer) && !peekLibraryDrag()) {
      const files = filesFromDataTransfer(event.dataTransfer);
      if (files.length && data.onOsFiles) {
        data.onOsFiles(files);
        return;
      }
    }
    const dragged = itemFromEvent(event);
    if (!dragged) return;
    if (!slotAccepts(accept, dragged)) {
      toast(slotNeedLabel(accept), true);
      return;
    }
    data.onAttach(dragged);
  }

  const hint =
    accept === "video"
      ? "Drop a video or open Library"
      : accept === "image"
        ? "Drop a still or open Library"
        : "Drop media or open Library";

  const cls =
    hover === "ok"
      ? "studio-node source-node drop-hot"
      : hover === "bad"
        ? "studio-node source-node drop-bad"
        : "studio-node source-node";

  return (
    <div
      className={cls}
      data-drop-slot={id}
      data-drop-accept={accept}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="node-header">
        <span>{title}</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag nopan">
        {item ? (
          <>
            <ResizableMedia id={`source-${id}`} minHeight={100} defaultHeight={140} className="source-preview">
            <div
              onDoubleClick={() => {
                const src = item.url || item.thumb_url;
                if (!src) return;
                const kind =
                  item.kind === "video" || isVideoPath(src)
                    ? "video"
                    : item.kind === "audio" || isAudioPath(src)
                      ? "audio"
                      : "image";
                openLightbox({ src, kind, title: item.name });
              }}
            >
              {item.kind === "video" || isVideoPath(item.url) ? (
                <video src={item.url} muted draggable={false} />
              ) : item.kind === "audio" || isAudioPath(item.url) ? (
                <div className="source-empty">{item.name}</div>
              ) : (
                <img src={item.thumb_url || item.url} alt={item.name} draggable={false} />
              )}
            </div>
            </ResizableMedia>
            <p className="hint" title={item.path}>
              {item.name}
            </p>
            {data.locked ? (
              <p className="hint">Locked to this pin still</p>
            ) : (
              <button type="button" className="ghost nodrag" onClick={data.onClear}>
                Clear
              </button>
            )}
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
