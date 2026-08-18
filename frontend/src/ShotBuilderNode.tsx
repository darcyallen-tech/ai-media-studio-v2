import { useMemo, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import type { ShotBuilderNodeData } from "./types";

export type ShotBuilderFlowNode = Node<ShotBuilderNodeData, "shot-builder">;

const BEATS = [
  "Establish",
  "Entrance",
  "Dialogue",
  "Action",
  "Reaction",
  "Hold",
];
const EMOTIONS = [
  "Calm",
  "Tense",
  "Joyful",
  "Somber",
  "Urgent",
  "Mysterious",
  "Confident",
  "Fearful",
  "Angry",
  "Playful",
  "Determined",
  "Exhausted",
  "Romantic",
  "Neutral",
  "Custom",
];
const ACTIONS = [
  "walks into",
  "enters",
  "exits",
  "turns to",
  "picks up",
  "throws",
  "sits",
  "stands",
  "runs",
  "fights",
  "flies",
  "lands",
  "looks at",
  "reacts",
  "freezes",
  "custom",
];
const STEP_CHOICES = [
  "",
  "crouch",
  "jump",
  "fly",
  "run",
  "land",
  "turn",
  "grab",
  "throw",
  "sit",
  "stand",
  "look",
  "freeze",
];
const CAMERAS = [
  "Static hold",
  "Push in",
  "Pull back",
  "Orbit",
  "Crane reveal",
  "Handheld energy",
];

export default function ShotBuilderNode({
  data,
}: NodeProps<ShotBuilderFlowNode>) {
  const characters = data.characters ?? data.whoChoices ?? [];
  const scenes = data.scenes ?? [];
  const props = data.props ?? [];
  const [beat, setBeat] = useState("Establish");
  const [emotion, setEmotion] = useState("Calm");
  const [emotionCustom, setEmotionCustom] = useState("");
  const [camera, setCamera] = useState("Push in");
  const [who, setWho] = useState<string[]>([]);
  const [where, setWhere] = useState("");
  const [whereTo, setWhereTo] = useState("");
  const [pickedProps, setPickedProps] = useState<string[]>([]);
  const [actionPreset, setActionPreset] = useState("walks into");
  const [actionLine, setActionLine] = useState("");
  const [steps, setSteps] = useState<[string, string, string]>(["", "", ""]);
  const [framing, setFraming] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const preview = useMemo(() => {
    const names = who.join(" and ");
    const stuff = pickedProps.join(" and ");
    if (names && stuff && where) {
      return `${names} picks up ${stuff} in ${where}`;
    }
    if (where && whereTo) return `from ${where} into ${whereTo}`;
    return "";
  }, [pickedProps, where, whereTo, who]);

  function toggle(list: string[], value: string) {
    return list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
  }

  async function onApply() {
    if (applying) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/shot-builder/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: {
            beat,
            emotion,
            camera,
            who: who.join("|"),
            where,
            where_to: whereTo,
            props: pickedProps.join("|"),
            action_preset: actionPreset,
            action_line: actionLine,
            sequence: steps.filter(Boolean).join("|"),
            emotion_custom: emotionCustom,
            framing,
          },
        }),
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
        framing: body.framing || framing,
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
        <label className="builder-field">
          <span className="field-label">Beat type</span>
          <select
            className="model nodrag"
            value={beat}
            onChange={(e) => setBeat(e.target.value)}
          >
            {BEATS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <span className="field-label">Who</span>
        {characters.length ? (
          <div className="chip-row">
            {characters.map((name) => (
              <button
                key={name}
                type="button"
                className={
                  who.includes(name) ? "pill modality on" : "pill modality"
                }
                onClick={() => setWho((cur) => toggle(cur, name))}
              >
                {name}
              </button>
            ))}
          </div>
        ) : (
          <p className="hint">Add Hub characters to pick subjects.</p>
        )}
        <span className="field-label">Where</span>
        {scenes.length ? (
          <div className="chip-row">
            {scenes.map((name) => (
              <button
                key={name}
                type="button"
                className={where === name ? "pill modality on" : "pill modality"}
                onClick={() => setWhere((cur) => (cur === name ? "" : name))}
              >
                {name}
              </button>
            ))}
          </div>
        ) : (
          <p className="hint">Add a Hub scene to set location.</p>
        )}
        <span className="field-label">Into (optional second location)</span>
        {scenes.length ? (
          <div className="chip-row">
            {scenes.map((name) => (
              <button
                key={name}
                type="button"
                className={
                  whereTo === name ? "pill modality on" : "pill modality"
                }
                onClick={() => setWhereTo((cur) => (cur === name ? "" : name))}
              >
                {name}
              </button>
            ))}
          </div>
        ) : (
          <p className="hint">Pick a second scene for a move between rooms.</p>
        )}
        <span className="field-label">With prop</span>
        {props.length ? (
          <div className="chip-row">
            {props.map((name) => (
              <button
                key={name}
                type="button"
                className={
                  pickedProps.includes(name) ? "pill modality on" : "pill modality"
                }
                onClick={() => setPickedProps((cur) => toggle(cur, name))}
              >
                {name}
              </button>
            ))}
          </div>
        ) : (
          <p className="hint">Add Hub props to mention them by name.</p>
        )}
        <label className="builder-field">
          <span className="field-label">Emotion / mood</span>
          <select
            className="model nodrag"
            value={emotion}
            onChange={(e) => setEmotion(e.target.value)}
          >
            {EMOTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {emotion === "Custom" ? (
          <label className="builder-field">
            <span className="field-label">Custom mood</span>
            <input
              className="model nodrag"
              type="text"
              placeholder="e.g. bittersweet, wired"
              value={emotionCustom}
              onChange={(e) => setEmotionCustom(e.target.value)}
            />
          </label>
        ) : null}
        <label className="builder-field">
          <span className="field-label">Action</span>
          <select
            className="model nodrag"
            value={actionPreset}
            onChange={(e) => setActionPreset(e.target.value)}
          >
            {ACTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <span className="field-label">Sequence (optional, 2–3 steps)</span>
        <div className="params">
          {([0, 1, 2] as const).map((i) => (
            <label key={i} className="param">
              <span>Step {i + 1}</span>
              <select
                className="model nodrag"
                value={steps[i]}
                onChange={(e) =>
                  setSteps((cur) => {
                    const next: [string, string, string] = [...cur];
                    next[i] = e.target.value;
                    return next;
                  })
                }
              >
                {STEP_CHOICES.map((item) => (
                  <option key={item || `none-${i}`} value={item}>
                    {item || "—"}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label className="builder-field">
          <span className="field-label">Camera preset</span>
          <select
            className="model nodrag"
            value={camera}
            onChange={(e) => setCamera(e.target.value)}
          >
            {CAMERAS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="builder-field">
          <span className="field-label">Action (1 line, optional)</span>
          <input
            className="model nodrag"
            type="text"
            placeholder="Leave blank to use the Action preset"
            value={actionLine}
            onChange={(e) => setActionLine(e.target.value)}
          />
        </label>
        <label className="builder-field">
          <span className="field-label">Framing notes (optional)</span>
          <input
            className="model nodrag"
            type="text"
            placeholder="e.g. start medium, end close"
            value={framing}
            onChange={(e) => setFraming(e.target.value)}
          />
        </label>
        {preview ? <p className="hint">{preview}</p> : null}
        <div className="prompt-actions">
          <button
            type="button"
            className="generate nodrag"
            disabled={applying}
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
