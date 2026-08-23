import { useEffect, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { isAudioPath, isVideoPath } from "./media";
import NodeClose from "./NodeClose";
import { peekLibraryDrag, slotAccepts, slotNeedLabel } from "./libraryDrag";
import { toast } from "./toast";
import {
  hasLibraryPayload,
  parseLibraryPayload,
  type GenerateResponse,
  type LibraryItem,
  type ToolModelRow,
  type ToolNodeData,
} from "./types";

export type ToolFlowNode = Node<
  ToolNodeData,
  "upscale" | "denoise" | "restore" | "deblur" | "interpolate"
>;

export default function ToolNode({ data }: NodeProps<ToolFlowNode>) {
  const [models, setModels] = useState<ToolModelRow[]>([]);
  const [modelId, setModelId] = useState("");
  const [factor, setFactor] = useState("");
  const [strength, setStrength] = useState(0.7);
  const [estimate, setEstimate] = useState("Est. cost: —");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = models.find((m) => m.id === modelId) ?? null;
  const item = data.source;

  useEffect(() => {
    const ac = new AbortController();
    const qs = new URLSearchParams({
      category: data.kind,
      kind: data.mediaKind,
    });
    fetch(`/tools?${qs}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : { models: [] }))
      .then((body: { models?: ToolModelRow[]; default_id?: string }) => {
        const rows = body.models ?? [];
        setModels(rows);
        const next =
          (body.default_id && rows.some((r) => r.id === body.default_id)
            ? body.default_id
            : rows[0]?.id) || "";
        setModelId(next);
        const row = rows.find((r) => r.id === next);
        setFactor(row?.default_factor || "");
        if (row?.default_strength != null) setStrength(row.default_strength);
        setEstimate(row?.cost || "Est. cost: —");
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, [data.kind, data.mediaKind]);

  useEffect(() => {
    if (!modelId) {
      setEstimate("Est. cost: —");
      return;
    }
    const ac = new AbortController();
    const qs = new URLSearchParams({
      mode: "tool",
      modality: data.kind,
      model_id: modelId,
      kind: data.mediaKind,
    });
    if (factor) qs.set("factor", factor);
    const dur = data.source?.duration_sec;
    if (dur && dur > 0) qs.set("duration", String(dur));
    fetch(`/estimate?${qs}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { ok?: boolean; cost?: string; error?: string | null } | null) => {
        if (!body) return;
        if (body.ok === false) {
          setEstimate(body.error || "Unknown model");
          return;
        }
        if (body.cost) setEstimate(body.cost);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => ac.abort();
  }, [modelId, factor, data.kind, data.mediaKind, data.source?.duration_sec]);

  function onDropReplace(itemIn: LibraryItem) {
    const accept = data.mediaKind === "video" ? "video" : "image";
    if (!slotAccepts(accept, itemIn)) {
      toast(slotNeedLabel(accept), true);
      return;
    }
    data.onReplace(itemIn);
  }

  async function onGenerate() {
    if (!modelId || !item?.path || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: data.kind,
          model_id: modelId,
          source_path: item.path,
          kind: data.mediaKind,
          factor: factor || null,
          strength: selected?.supports_strength ? strength : null,
        }),
      });
      const body = (await res.json()) as GenerateResponse & { detail?: string };
      if (!res.ok || !body.ok) {
        setError(
          body.error ||
            (typeof body.detail === "string" ? body.detail : null) ||
            "Tool failed.",
        );
        return;
      }
      data.onGenerated(body);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Tool request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="studio-node source-node tool-node"
      data-drop-slot={`tool-${data.kind}`}
      onDragOver={(e) => {
        if (peekLibraryDrag() || hasLibraryPayload(e.dataTransfer)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        const next = peekLibraryDrag() || parseLibraryPayload(e.dataTransfer);
        if (next) onDropReplace(next);
      }}
    >
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">
        <span>{data.title}</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag nopan">
        {item ? (
          <div className="source-preview">
            {item.kind === "video" || isVideoPath(item.url) ? (
              <video src={item.url} muted draggable={false} />
            ) : isAudioPath(item.url) ? (
              <div className="source-empty">{item.name}</div>
            ) : (
              <img src={item.thumb_url || item.url} alt={item.name} draggable={false} />
            )}
          </div>
        ) : (
          <div
            className="source-empty"
            role="button"
            tabIndex={0}
            onClick={data.onOpenLibrary}
          >
            Attach from Library
          </div>
        )}
        <p className="hint" title={item?.path}>
          {item?.name || "No source"}
        </p>
        <label className="field-label" htmlFor={`tool-model-${data.kind}`}>
          Model
        </label>
        <select
          id={`tool-model-${data.kind}`}
          className="model nodrag"
          value={modelId}
          onChange={(e) => {
            setModelId(e.target.value);
            const row = models.find((m) => m.id === e.target.value);
            setFactor(row?.default_factor || "");
          }}
        >
          {models.length === 0 ? (
            <option value="">Loading…</option>
          ) : (
            models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))
          )}
        </select>
        {selected?.notes ? <p className="hint">{selected.notes}</p> : null}
        {selected?.supports_factor && (selected.factor_choices?.length ?? 0) > 0 ? (
          <label className="param">
            <span>{data.kind === "interpolate" ? "Factor" : data.mediaKind === "video" && data.kind === "upscale" ? "Target" : "Factor"}</span>
            <select
              className="model nodrag"
              value={factor}
              onChange={(e) => setFactor(e.target.value)}
            >
              {(selected.factor_choices ?? []).map((tok) => (
                <option key={tok} value={tok}>
                  {tok}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {selected?.supports_strength ? (
          <label className="param">
            <span>Fidelity {strength.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
            />
          </label>
        ) : null}
        <button
          type="button"
          className="generate nodrag"
          disabled={!modelId || !item?.path || loading}
          onClick={() => void onGenerate()}
        >
          {loading ? "Working…" : "Generate"}
        </button>
        <p className="estimate">{estimate}</p>
        {error ? (
          <p className="hint warn" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}
