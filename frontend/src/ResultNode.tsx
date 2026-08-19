import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { beginLibraryDrag, endLibraryDrag } from "./libraryDrag";
import { formatDuration, isAudioPath, isVideoPath } from "./media";
import NodeClose from "./NodeClose";
import { openLightbox } from "./lightbox";
import ResizableMedia from "./ResizableMedia";
import { sendToResolve } from "./toast";
import { writeLibraryPayload, type ResultNodeData, type ToolKind } from "./types";

export type ResultFlowNode = Node<ResultNodeData, "result">;

export default function ResultNode({ data }: NodeProps<ResultFlowNode>) {
  const result = data.result;
  const paths = result.result_paths ?? [];
  const local = result.local_paths ?? [];
  const copyPath = local[0] || "";
  const sample = paths[0] || copyPath;
  const isVid = Boolean(sample && isVideoPath(sample));
  const isAud = Boolean(sample && isAudioPath(sample));
  const tools: { id: ToolKind; label: string }[] = isAud
    ? []
    : isVid
      ? [
          { id: "upscale", label: "Upscale" },
          { id: "denoise", label: "Denoise" },
          { id: "restore", label: "Restore" },
          { id: "deblur", label: "Deblur" },
          { id: "interpolate", label: "Interpolate" },
        ]
      : [
          { id: "upscale", label: "Upscale" },
          { id: "restore", label: "Restore" },
          { id: "deblur", label: "Deblur" },
        ];

  async function copyLocal() {
    if (!copyPath) return;
    try {
      await navigator.clipboard.writeText(copyPath);
    } catch {
      window.prompt("Copy path:", copyPath);
    }
  }

  async function showInFolder() {
    if (!copyPath) return;
    await fetch("/library/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: copyPath }),
    });
  }

  const title = (data.title || "").trim() || "Result";
  const isAngle = Boolean(data.slot || data.onRegen);
  const hasStill = paths.length > 0;

  return (
    <div className="studio-node result-node">
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">
        <span>{title}</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag">
        <p className="meta">
          <span>{result.cost || (data.generating ? "Generating…" : "Cost: —")}</span>
          {result.duration_sec ? (
            <span>{formatDuration(result.duration_sec)}</span>
          ) : null}
        </p>
        <div className="media">
          {paths.map((src) =>
            isVideoPath(src) ? (
              <ResizableMedia key={src} id={`result-vid-${src}`} minHeight={140} defaultHeight={220}>
              <video
                src={src}
                controls
                playsInline
                onDoubleClick={() =>
                  openLightbox({ src, kind: "video" })
                }
              />
              </ResizableMedia>
            ) : isAudioPath(src) ? (
              <audio key={src} src={src} controls />
            ) : (
              <div
                key={src}
                className="nodrag result-drag"
                draggable={Boolean(data.dragItem)}
                onPointerDown={() => {
                  if (data.dragItem) beginLibraryDrag(data.dragItem);
                }}
                onDragStart={(event) => {
                  if (!data.dragItem) {
                    event.preventDefault();
                    return;
                  }
                  event.stopPropagation();
                  beginLibraryDrag(data.dragItem);
                  writeLibraryPayload(event.dataTransfer, data.dragItem);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onDragEnd={() => endLibraryDrag()}
              >
              <ResizableMedia id={`result-img-${src}`} minHeight={120} defaultHeight={220}>
              <img
                src={src}
                alt="Generated result"
                draggable={false}
                onDoubleClick={() =>
                  openLightbox({ src, kind: "image" })
                }
              />
              </ResizableMedia>
              </div>
            ),
          )}
          {paths.length === 0 ? (
            <p className="hint">
              {data.generating
                ? "Generating…"
                : isAngle
                  ? "Angle prompt ready. Click Generate."
                  : "No media paths returned."}
            </p>
          ) : null}
        </div>
        {isAngle ? (
          <>
            <label className="builder-field">
              <span className="field-label">Angle prompt</span>
              <textarea
                className="prompt nowheel"
                rows={4}
                value={data.prompt || ""}
                disabled={data.generating}
                onChange={(e) => data.onPrompt?.(e.target.value)}
              />
            </label>
            <div className="prompt-actions">
              <button
                type="button"
                className="generate nodrag"
                disabled={data.generating || !String(data.prompt || "").trim()}
                onClick={data.onRegen}
              >
                {data.generating ? "Generating…" : hasStill ? "Regenerate" : "Generate"}
              </button>
            </div>
            {data.error ? (
              <p className="hint warn" role="alert">
                {data.error}
              </p>
            ) : null}
          </>
        ) : null}
        {tools.length && data.onTool && !isAngle ? (
          <div className="result-tools">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                className="ghost nodrag"
                onClick={() => data.onTool?.(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="result-actions" hidden={isAngle && !hasStill}>
          {data.onApplyToPin && !isVid && !isAud ? (
            <button
              type="button"
              className="generate nodrag apply-pin"
              disabled={!copyPath && !data.dragItem?.path && !data.dragItem?.url}
              onClick={data.onApplyToPin}
            >
              {data.applyLabel || "Apply to pin"}
            </button>
          ) : null}
          <button type="button" className="ghost nodrag" disabled={!copyPath} onClick={showInFolder}>
            Show in folder
          </button>
          <button type="button" className="ghost nodrag" disabled={!copyPath} onClick={copyLocal}>
            Copy path
          </button>
          <button
            type="button"
            className="ghost nodrag"
            disabled={!copyPath}
            onClick={() =>
              void sendToResolve(copyPath, {
                type: isAudioPath(copyPath)
                  ? "audio"
                  : isVideoPath(copyPath)
                    ? "video"
                    : "image",
                cost: result.cost,
              })
            }
          >
            Send to Resolve
          </button>
        </div>
      </div>
    </div>
  );
}
