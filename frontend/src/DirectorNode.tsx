import { useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import type { DirectorNodeData } from "./types";

export type DirectorFlowNode = Node<DirectorNodeData, "director">;

const MOVES = [
  "Static",
  "Push in",
  "Pull out",
  "Orbit",
  "Crane up",
  "Crane down",
  "Pan L",
  "Pan R",
  "Tilt",
  "Handheld",
];

const SPEEDS = ["Slow", "Medium", "Fast"];
const EASES = ["Linear", "Ease in", "Ease out", "Ease in-out"];

export default function DirectorNode({ data }: NodeProps<DirectorFlowNode>) {
  const [move, setMove] = useState("Push in");
  const [speed, setSpeed] = useState("Slow");
  const [ease, setEase] = useState("Ease in-out");
  const [framing, setFraming] = useState("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const staticMove = move === "Static";

  async function onApply() {
    if (applying) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/director/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: { move, speed, ease, framing },
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        prompt?: string;
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
      data.onApply((body.prompt || "").trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Apply failed.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="studio-node director-node">
      <div className="node-header">
        <span>Director</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag">
        <p className="hint">
          Lite camera language for video. Apply appends a camera block — Enhance
          stays optional.
        </p>
        <label className="builder-field">
          <span className="field-label">Move</span>
          <select
            className="model nodrag"
            value={move}
            onChange={(e) => setMove(e.target.value)}
          >
            {MOVES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="builder-field">
          <span className="field-label">Speed</span>
          <select
            className="model nodrag"
            value={speed}
            disabled={staticMove}
            onChange={(e) => setSpeed(e.target.value)}
          >
            {SPEEDS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="builder-field">
          <span className="field-label">Ease</span>
          <select
            className="model nodrag"
            value={ease}
            disabled={staticMove}
            onChange={(e) => setEase(e.target.value)}
          >
            {EASES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="builder-field">
          <span className="field-label">Framing notes</span>
          <textarea
            className="prompt nodrag nowheel"
            rows={3}
            placeholder="e.g. start medium, end close on the sofa"
            value={framing}
            onChange={(e) => setFraming(e.target.value)}
          />
        </label>
        <div className="prompt-actions">
          <button
            type="button"
            className="generate nodrag"
            disabled={applying}
            onClick={() => void onApply()}
          >
            {applying ? "Applying…" : "Apply to prompt"}
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
