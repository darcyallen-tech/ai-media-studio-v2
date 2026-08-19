import { useEffect, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { readJson } from "./http";
import { beginLibraryDrag, endLibraryDrag } from "./libraryDrag";
import { formatDuration, isAudioPath, isVideoPath } from "./media";
import NodeClose from "./NodeClose";
import { openLightbox } from "./lightbox";
import ResizableMedia from "./ResizableMedia";
import { sendToResolve } from "./toast";
import { writeLibraryPayload, type ResultNodeData, type ToolKind } from "./types";

export type ResultFlowNode = Node<ResultNodeData, "result">;

export default function ResultNode({ data }: NodeProps<ResultFlowNode>) {
  const [anglePrompt, setAnglePrompt] = useState(data.prompt || "");
  const sizeChoices = Array.isArray(data.resolutionChoices)
    ? data.resolutionChoices.filter(Boolean)
    : [];
  const [size, setSize] = useState(
    data.aspect || data.resolution || sizeChoices[0] || "",
  );
  const qualityOpts = Array.isArray(data.qualityChoices)
    ? data.qualityChoices.filter(Boolean)
    : [];
  const [quality, setQuality] = useState(
    data.quality || qualityOpts[0] || "",
  );
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState("");
  useEffect(() => {
    setAnglePrompt(data.prompt || "");
  }, [data.prompt]);
  useEffect(() => {
    if (data.resolution && data.resolution !== size) setSize(data.resolution);
  }, [data.resolution]);
  useEffect(() => {
    if (!data.generating) setBusy(false);
  }, [data.generating]);

  const result = data.result;
  const paths = (result.result_paths ?? []).length
    ? result.result_paths ?? []
    : localUrl
      ? [localUrl]
      : [];
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
  const isAngle = Boolean(data.slot || data.builderId);
  const hasStill = paths.length > 0;

  function enlarge() {
    const src = paths[0] || "";
    if (!src) return;
    openLightbox({
      src,
      kind: isVid ? "video" : isAud ? "audio" : "image",
      title,
    });
  }

  async function runAngleJob(ev?: { preventDefault?: () => void; stopPropagation?: () => void }) {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    if (busy || data.generating) return;
    const prompt = anglePrompt.trim();
    const slot = data.slot || "front";
    if (!prompt) {
      setLocalError("Angle prompt is empty.");
      return;
    }
    if (slot !== "front" && !data.sourceStill) {
      setLocalError("Generate Front first");
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      let assetId = data.assetId || "";
      if (!assetId) {
        const created = await fetch("/assets/sheet/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "character",
            name: data.name || "Character",
            fields: {},
            notes: "",
          }),
        });
        const draft = await readJson(created);
        const item = (draft.item || null) as { id?: string } | null;
        if (!created.ok || !item?.id) {
          throw new Error(
            (typeof draft.detail === "string" && draft.detail) ||
              (typeof draft.error === "string" && draft.error) ||
              "Could not create character draft.",
          );
        }
        assetId = item.id;
      }
      const res = await fetch("/assets/sheet/angle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: assetId,
          slot,
          model_id:
            slot === "front"
              ? data.t2iModel || ""
              : data.r2iModel || data.t2iModel || "",
          prompt,
          source_still: slot === "front" ? "" : data.sourceStill || "",
          wardrobe: data.wardrobe || "",
          resolution: quality || size || data.resolution || "",
          aspect: data.aspect || size || "",
        }),
      });
      const body = await readJson(res);
      const item = (body.item || null) as {
        identity?: Record<string, string>;
        identity_urls?: Record<string, string>;
        still_path?: string;
        url?: string;
        prompt?: string;
        cost?: string;
      } | null;
      if (!res.ok || !item) {
        throw new Error(
          (typeof body.detail === "string" && body.detail) ||
            (typeof body.error === "string" && body.error) ||
            "Generate failed.",
        );
      }
      const path = item.identity?.[slot] || item.still_path || "";
      const url = item.identity_urls?.[slot] || item.url || "";
      const shown = url
        ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`
        : "";
      if (shown) setLocalUrl(shown);
      data.onGenerated?.({
        slot,
        assetId,
        path,
        url: shown,
        prompt: item.prompt || prompt,
        cost: item.cost,
        resolution: size || data.resolution,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generate failed.";
      console.error("Angle generate failed", err);
      setLocalError(msg);
    } finally {
      setBusy(false);
    }
  }

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
        <div className="media" onDoubleClick={enlarge}>
          {paths.map((src) =>
            isVideoPath(src) ? (
              <ResizableMedia key={src} id={`result-vid-${src}`} minHeight={140} defaultHeight={220} locked={busy || data.generating}>
              <video
                src={src}
                controls
                playsInline
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  openLightbox({ src, kind: "video", title });
                }}
              />
              </ResizableMedia>
            ) : isAudioPath(src) ? (
              <audio key={src} src={src} controls />
            ) : (
              <div
                key={src}
                className="nodrag result-drag"
                draggable={Boolean(data.dragItem)}
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
              <ResizableMedia id={`result-img-${src}`} minHeight={120} defaultHeight={220} locked={busy || data.generating}>
              <img
                src={src}
                alt="Generated result"
                draggable={false}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  openLightbox({ src, kind: "image", title });
                }}
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
            {sizeChoices.length ? (
              <label className="builder-field">
                <span className="field-label">Aspect / size</span>
                <select
                  className="model"
                  value={sizeChoices.includes(size) ? size : sizeChoices[0]}
                  disabled={data.generating || busy}
                  onChange={(e) => {
                    setSize(e.target.value);
                    data.onResolution?.(e.target.value);
                  }}
                >
                  {sizeChoices.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {qualityOpts.length ? (
              <label className="builder-field">
                <span className="field-label">Quality</span>
                <select
                  className="model"
                  value={qualityOpts.includes(quality) ? quality : qualityOpts[0]}
                  disabled={data.generating || busy}
                  onChange={(e) => setQuality(e.target.value)}
                >
                  {qualityOpts.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="builder-field">
              <span className="field-label">Angle prompt</span>
              <textarea
                className="prompt nowheel"
                rows={4}
                value={anglePrompt}
                disabled={data.generating}
                onChange={(e) => {
                  setAnglePrompt(e.target.value);
                  data.onPrompt?.(e.target.value);
                }}
              />
            </label>
            <div className="prompt-actions">
              <button
                type="button"
                className="generate nodrag"
                disabled={busy || data.generating}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => void runAngleJob(e)}
              >
                {busy || data.generating
                  ? "Generating…"
                  : hasStill
                    ? "Regenerate"
                    : "Generate"}
              </button>
            </div>
            {localError || data.error ? (
              <p className="hint warn" role="alert">
                {localError || data.error}
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
