import { useEffect, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import type { ShotBuilderNodeData } from "./types";

export type ShotBuilderFlowNode = Node<ShotBuilderNodeData, "shot-builder">;

type FieldSpec = {
  id: string;
  label: string;
  type?: string;
  choices?: string[];
  value?: string;
  placeholder?: string;
};

export default function ShotBuilderNode({
  data,
}: NodeProps<ShotBuilderFlowNode>) {
  const [fields, setFields] = useState<FieldSpec[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const whoKey = (data.whoChoices || []).join("|");

  useEffect(() => {
    const ac = new AbortController();
    const qs = new URLSearchParams({
      who: whoKey,
    });
    fetch(`/shot-builder/fields?${qs}`, { signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Shot builder ${res.status}`);
        return res.json();
      })
      .then((body: { fields?: FieldSpec[] }) => {
        const rows = Array.isArray(body.fields) ? body.fields : [];
        setFields(rows);
        const next: Record<string, string> = {};
        for (const row of rows) next[row.id] = row.value ?? "";
        setValues(next);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not load builder.");
      });
    return () => ac.abort();
  }, [whoKey]);

  async function onApply() {
    if (applying) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/shot-builder/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: values }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        action?: string;
        move?: string;
        speed?: string;
        ease?: string;
        framing?: string;
        detail?: string;
        error?: string;
      };
      if (!res.ok || body.ok === false) {
        throw new Error(
          body.error ||
            (typeof body.detail === "string" ? body.detail : null) ||
            "Apply failed.",
        );
      }
      data.onApply({
        action: body.action || "",
        move: body.move || "Push in",
        speed: body.speed || "Slow",
        ease: body.ease || "Ease in-out",
        framing: body.framing || "",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Apply failed.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="studio-node shot-builder-node">
      <div className="node-header">
        <span>Shot Prompt Builder</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag">
        <p className="hint">
          Fills {data.shotLabel || "this shot"} — existing action text is kept
          and the new beat is appended.
        </p>
        {fields.map((field) => (
          <label key={field.id} className="builder-field">
            <span className="field-label">{field.label}</span>
            {field.type === "text" || field.type === "textarea" ? (
              <input
                className="model nodrag"
                type="text"
                placeholder={field.placeholder || ""}
                value={values[field.id] ?? ""}
                onChange={(e) =>
                  setValues((cur) => ({ ...cur, [field.id]: e.target.value }))
                }
              />
            ) : (
              <select
                className="model nodrag"
                value={values[field.id] ?? ""}
                onChange={(e) =>
                  setValues((cur) => ({ ...cur, [field.id]: e.target.value }))
                }
              >
                {(field.choices ?? []).map((choice) => (
                  <option key={choice} value={choice}>
                    {choice}
                  </option>
                ))}
              </select>
            )}
          </label>
        ))}
        <div className="prompt-actions">
          <button
            type="button"
            className="generate nodrag"
            disabled={applying || fields.length === 0}
            onClick={() => void onApply()}
          >
            {applying ? "Applying…" : "Apply to shot"}
          </button>
        </div>
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
