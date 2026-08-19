import { useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import { readJson } from "./http";
import { toast } from "./toast";
import type { HubNodeData } from "./types";

export type HubFlowNode = Node<HubNodeData, "hub">;

export default function HubNode({ data }: NodeProps<HubFlowNode>) {
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assets = data.assets ?? [];
  const canEnhance = Boolean(data.notes.trim()) && !enhancing;

  async function onEnhance() {
    if (!canEnhance) return;
    setEnhancing(true);
    setError(null);
    try {
      const paths = assets
        .map((row) => row.item?.path)
        .filter((p): p is string => Boolean(p))
        .slice(0, 3);
      const res = await fetch("/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: data.notes.trim(),
          mode: "image",
          modality: "t2i",
          image_urls: paths,
          refs: assets
            .filter((row) => row.item?.path)
            .map((row) => ({
              path: row.item?.path,
              role: row.role === "prop" ? "scene" : row.role,
              name: row.label || row.item?.name || row.role,
              note: row.role,
            })),
        }),
      });
      const body = (await readJson(res)) as {
        ok?: boolean;
        prompt?: string;
        error?: string;
        detail?: string;
        vision?: boolean;
      };
      if (!res.ok || body.ok === false) {
        throw new Error(
          body.error ||
            (typeof body.detail === "string" ? body.detail : null) ||
            "Enhance failed.",
        );
      }
      if (body.prompt) data.onNotes(body.prompt);
      if (paths.length && body.vision === false) {
        toast("Enhance ran without image context", true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Enhance failed.");
    } finally {
      setEnhancing(false);
    }
  }

  return (
    <div className="studio-node hub-node">
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">
        <span>Asset Hub</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag">
        <p className="hint">
          Characters, scenes, and props collect here. Shots read this Hub.
        </p>
        {data.sequenceLine ? (
          <p className="hint">
            Sequence: {data.sequenceLine}
          </p>
        ) : (
          <p className="hint">No shots yet — Add Shot from the toolbar.</p>
        )}
        <label className="builder-field">
          <span className="field-label">Sequence title</span>
          <input
            className="model nodrag"
            type="text"
            placeholder="Optional"
            value={data.title}
            onChange={(e) => data.onTitle(e.target.value)}
          />
        </label>
        <label className="builder-field">
          <span className="field-label">Mood / style notes</span>
          <textarea
            className="prompt nodrag nowheel"
            rows={3}
            placeholder="Overall look, tone, palette…"
            value={data.notes}
            onChange={(e) => data.onNotes(e.target.value)}
          />
        </label>
        <div className="prompt-actions">
          <button
            type="button"
            className="ghost nodrag enhance"
            disabled={!canEnhance}
            onClick={() => void onEnhance()}
          >
            {enhancing ? "Enhancing…" : "Enhance"}
          </button>
        </div>
        <p className="field-label">Attached assets</p>
        {assets.length === 0 ? (
          <p className="hint">No assets yet — add Character / Scene / Prop.</p>
        ) : (
          <ul className="hub-list">
            {assets.map((row) => (
              <li key={row.id} className="hub-row">
                {row.item?.thumb_url || row.item?.url ? (
                  <img
                    src={row.item.thumb_url || row.item.url}
                    alt=""
                    draggable={false}
                  />
                ) : (
                  <span className="hub-thumb-empty" />
                )}
                <span>
                  <strong>{roleLabel(row.role)}</strong>
                  <br />
                  {row.label || row.item?.name || "Untitled"}
                </span>
              </li>
            ))}
          </ul>
        )}
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

function roleLabel(role: string) {
  if (role === "scene") return "Scene";
  if (role === "prop") return "Prop";
  return "Character";
}
