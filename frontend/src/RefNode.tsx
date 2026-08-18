import { useState, type DragEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { peekLibraryDrag, slotAccepts, slotNeedLabel } from "./libraryDrag";
import { toast } from "./toast";
import {
  hasLibraryPayload,
  parseLibraryPayload,
  type LibraryItem,
  type RefNodeData,
} from "./types";

export type RefFlowNode = Node<RefNodeData, "character" | "scene">;

function itemFromEvent(event: DragEvent): LibraryItem | null {
  return peekLibraryDrag() || parseLibraryPayload(event.dataTransfer);
}

export default function RefNode({ id, data }: NodeProps<RefFlowNode>) {
  const item = data.item;
  const title = data.title || (data.role === "scene" ? "Scene" : "Character");
  const [hover, setHover] = useState<"ok" | "bad" | null>(null);
  const placeholder =
    data.role === "scene"
      ? "this location is…"
      : "this character is…";

  function incomingItem(event: DragEvent): LibraryItem | null {
    return (
      peekLibraryDrag() ||
      (hasLibraryPayload(event.dataTransfer) ? peekLibraryDrag() : null)
    );
  }

  function allowDrop(event: DragEvent) {
    const incoming =
      peekLibraryDrag() || (hasLibraryPayload(event.dataTransfer) ? true : null);
    if (!incoming) return false;
    event.preventDefault();
    event.stopPropagation();
    const itemNow = peekLibraryDrag();
    const ok = itemNow ? slotAccepts("image", itemNow) : true;
    event.dataTransfer.dropEffect = ok ? "copy" : "none";
    return true;
  }

  function onDragEnter(event: DragEvent) {
    if (!allowDrop(event)) return;
    const next = incomingItem(event);
    setHover(next && !slotAccepts("image", next) ? "bad" : "ok");
  }

  function onDragOver(event: DragEvent) {
    if (!allowDrop(event)) return;
    const next = peekLibraryDrag();
    setHover(next && !slotAccepts("image", next) ? "bad" : "ok");
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
    const dragged = itemFromEvent(event);
    if (!dragged) return;
    if (!slotAccepts("image", dragged)) {
      toast(slotNeedLabel("image"), true);
      return;
    }
    data.onAttach(dragged);
  }

  const cls =
    hover === "ok"
      ? "studio-node source-node ref-node drop-hot"
      : hover === "bad"
        ? "studio-node source-node ref-node drop-bad"
        : "studio-node source-node ref-node";

  return (
    <div
      className={cls}
      data-drop-slot={id}
      data-drop-accept="image"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="node-header">{title}</div>
      <div className="node-body nodrag nopan">
        <select
          className="model nodrag"
          value={data.catalogId}
          onChange={(e) => data.onPickCatalog(e.target.value)}
        >
          <option value="">
            {data.catalog.length
              ? `Pick ${data.role}…`
              : `Known ${data.role} ids unavailable`}
          </option>
          {data.catalog.map((row) => (
            <option key={row.id} value={row.id}>
              {row.label || row.name || row.id}
              {row.has_still ? "" : " (no still)"}
            </option>
          ))}
        </select>

        {item ? (
          <div className="source-preview">
            <img
              src={item.thumb_url || item.url}
              alt={item.name}
              draggable={false}
            />
          </div>
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
            Drop a still or attach from Library
          </div>
        )}

        {item ? (
          <p className="hint" title={item.path}>
            {item.name}
          </p>
        ) : null}

        <textarea
          className="ref-note nodrag nowheel"
          rows={2}
          placeholder={placeholder}
          value={data.note}
          onChange={(e) => data.onNote(e.target.value)}
        />

        <div className="source-row">
          {item ? (
            <button type="button" className="ghost nodrag" onClick={data.onClear}>
              Clear
            </button>
          ) : (
            <button
              type="button"
              className="ghost nodrag"
              onClick={data.onOpenLibrary}
            >
              Attach still as {data.role} ref
            </button>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}
