import { useState, type DragEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import { peekLibraryDrag, slotAccepts, slotNeedLabel } from "./libraryDrag";
import { toast } from "./toast";
import {
  CAMERA_EASES,
  CAMERA_MOVES,
  CAMERA_SPEEDS,
  hasLibraryPayload,
  parseLibraryPayload,
  type LibraryItem,
  type ShotNodeData,
} from "./types";

export type ShotFlowNode = Node<ShotNodeData, "shot">;

function itemFromEvent(event: DragEvent): LibraryItem | null {
  return peekLibraryDrag() || parseLibraryPayload(event.dataTransfer);
}

export default function ShotNode({ id, data }: NodeProps<ShotFlowNode>) {
  const [hover, setHover] = useState<"ok" | "bad" | null>(null);
  const staticMove = data.move === "Static";
  const still = data.still;

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
    data.onAttachStill(dragged);
  }

  const cls =
    hover === "ok"
      ? "studio-node shot-node drop-hot"
      : hover === "bad"
        ? "studio-node shot-node drop-bad"
        : "studio-node shot-node";

  return (
    <div
      className={cls}
      data-drop-slot={id}
      data-drop-accept="image"
      onDragEnter={(e) => {
        if (!allowDrop(e)) return;
        const next = peekLibraryDrag();
        setHover(next && !slotAccepts("image", next) ? "bad" : "ok");
      }}
      onDragOver={(e) => {
        if (!allowDrop(e)) return;
        const next = peekLibraryDrag();
        setHover(next && !slotAccepts("image", next) ? "bad" : "ok");
      }}
      onDragLeave={(e) => {
        const next = e.relatedTarget as globalThis.Node | null;
        if (next && e.currentTarget.contains(next)) return;
        setHover(null);
      }}
      onDrop={onDrop}
    >
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">
        <span>
          Shot {data.order}
          {data.label && data.label !== `Shot ${data.order}`
            ? ` · ${data.label}`
            : ""}
        </span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag nopan">
        <p className={data.hubLinked ? "hint" : "hint warn"}>
          {data.hubLinked
            ? `Hub: ${data.hubTitle || "Asset Hub"}`
            : "No Hub linked — add a Hub so this shot has cast/location."}
        </p>
        {data.sequenceLine ? (
          <p className="hint">{data.sequenceLine}</p>
        ) : null}
        <label className="builder-field">
          <span className="field-label">Label</span>
          <input
            className="model nodrag"
            type="text"
            value={data.label}
            onChange={(e) => data.onPatch({ label: e.target.value })}
          />
        </label>
        <label className="builder-field">
          <span className="field-label">Action</span>
          <textarea
            className="prompt nodrag nowheel"
            rows={3}
            placeholder="What happens in this shot…"
            value={data.action}
            onChange={(e) => data.onPatch({ action: e.target.value })}
          />
        </label>
        <label className="builder-field">
          <span className="field-label">Move</span>
          <select
            className="model nodrag"
            value={data.move}
            onChange={(e) => data.onPatch({ move: e.target.value })}
          >
            {CAMERA_MOVES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="params">
          <label className="param">
            <span>Speed</span>
            <select
              className="model nodrag"
              value={data.speed}
              disabled={staticMove}
              onChange={(e) => data.onPatch({ speed: e.target.value })}
            >
              {CAMERA_SPEEDS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="param">
            <span>Ease</span>
            <select
              className="model nodrag"
              value={data.ease}
              disabled={staticMove}
              onChange={(e) => data.onPatch({ ease: e.target.value })}
            >
              {CAMERA_EASES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="param">
            <span>Duration</span>
            <input
              className="model nodrag"
              type="text"
              placeholder="e.g. 4s"
              value={data.duration}
              onChange={(e) => data.onPatch({ duration: e.target.value })}
            />
          </label>
        </div>
        <label className="builder-field">
          <span className="field-label">Framing notes</span>
          <input
            className="model nodrag"
            type="text"
            placeholder="e.g. start medium, end close"
            value={data.framing}
            onChange={(e) => data.onPatch({ framing: e.target.value })}
          />
        </label>
        <span className="field-label">Angle / start still</span>
        {still ? (
          <div className="source-preview">
            <img
              src={still.thumb_url || still.url}
              alt={still.name}
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
            Drop a still (image only)
          </div>
        )}
        <div className="source-row">
          {still ? (
            <button
              type="button"
              className="ghost nodrag"
              onClick={data.onClearStill}
            >
              Clear still
            </button>
          ) : (
            <button
              type="button"
              className="ghost nodrag"
              onClick={data.onOpenLibrary}
            >
              Attach still
            </button>
          )}
          {data.onAddBuilder ? (
            <button
              type="button"
              className="ghost nodrag"
              onClick={data.onAddBuilder}
            >
              Add Shot Prompt Builder
            </button>
          ) : null}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}
