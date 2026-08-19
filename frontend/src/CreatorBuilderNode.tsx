import { useEffect, useMemo, useRef, useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import NodeErrorBoundary from "./NodeErrorBoundary";
import { readJson as readJsonSafe } from "./http";
import { toast } from "./toast";
import {
  CORE_SLOTS,
  EXTRA_SLOTS,
  SLOT_LABEL,
  WARDROBE_F,
  WARDROBE_M,
  composeCharacterIdentity,
  useSheetEstimate,
  useSheetModels,
} from "./sheetUi";
import type {
  CreatorBuilderNodeData,
  StudioAsset,
} from "./types";

export type CreatorBuilderFlowNode = Node<CreatorBuilderNodeData, "creator-builder">;

type GenBody = {
  ok?: boolean;
  item?: StudioAsset;
  prompt?: string;
  detail?: string;
  error?: string;
};

async function readJson<T>(res: Response): Promise<T> {
  return (await readJsonSafe(res)) as T;
}

function errOf(body: GenBody, fallback: string, res?: Response) {
  const error = typeof body.error === "string" ? body.error.trim() : "";
  if (error && !/^not found$/i.test(error)) return error;
  const detail = body.detail;
  if (typeof detail === "string" && detail.trim() && !/^not found$/i.test(detail.trim())) {
    return detail.trim();
  }
  if (res && res.status === 404) {
    return `${fallback} (${res.status} ${res.statusText || "Not Found"}). Check POST /enhance.`;
  }
  return error || (typeof detail === "string" ? detail : "") || res?.statusText || fallback;
}

export default function CreatorBuilderNode({
  data,
}: NodeProps<CreatorBuilderFlowNode>) {
  const kind = data?.kind || "character";
  const safe: CreatorBuilderNodeData = {
    kind,
    attachSlotId: data?.attachSlotId,
    bases: Array.isArray(data?.bases) ? data.bases : [],
    onClose: data?.onClose,
    onAngle: typeof data?.onAngle === "function" ? data.onAngle : () => undefined,
    onSession: data?.onSession,
    onSaved: typeof data?.onSaved === "function" ? data.onSaved : () => undefined,
  };
  return (
    <div className="studio-node creator-builder-node">
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">
        <span>
          {kind === "costume"
            ? "Costume Designer"
            : kind === "scene"
              ? "Scene Builder"
              : kind === "prop"
                ? "Prop Builder"
                : "Character Builder"}
        </span>
        <NodeClose onClose={safe.onClose} />
      </div>
      <NodeErrorBoundary
        label={
          kind === "costume"
            ? "Costume Designer"
            : kind === "scene"
              ? "Scene Builder"
              : kind === "prop"
                ? "Prop Builder"
                : "Character Builder"
        }
      >
        <div className="node-body nodrag">
          {kind === "scene" ? (
            <SceneForm data={safe} />
          ) : kind === "prop" ? (
            <PropForm data={safe} />
          ) : kind === "costume" ? (
            <CostumeForm data={safe} />
          ) : (
            <CharacterForm data={safe} />
          )}
        </div>
      </NodeErrorBoundary>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}

const HAIR_LEN = ["bald", "buzz", "short", "medium", "long", "very long"];
const HAIR_STYLE = [
  "straight",
  "wavy",
  "curly",
  "coily",
  "pulled back",
  "bun",
  "ponytail",
  "cropped",
];
const HAIR_COLOR = [
  "black",
  "dark brown",
  "brown",
  "auburn",
  "blonde",
  "red",
  "gray",
  "white",
];
const FACIAL = ["none", "stubble", "short beard", "full beard", "mustache", "goatee"];
const EYES = ["brown", "dark brown", "hazel", "green", "blue", "gray", "amber"];
const SKIN = ["fair", "light", "medium", "olive", "tan", "brown", "deep"];
const HEIGHT = ["short", "average", "tall", "5'4\"", "5'8\"", "6'0\"", "6'2\""];
const WEIGHT = ["slim", "average", "athletic", "heavy", "stocky"];
const BODY = ["lean", "average", "muscular", "curvy", "lanky", "hourglass", "rectangle"];
const FACE = ["oval", "round", "square", "heart", "diamond", "oblong"];
const NOSE = ["straight", "button", "roman", "wide", "narrow", "upturned"];
const JAW = ["soft", "defined", "square", "rounded", "pointed", "cleft"];

function pickField(value?: string | null, custom?: string | null) {
  const v = String(value ?? "");
  const c = String(custom ?? "");
  if (v === "Custom") return c.trim();
  return v.trim();
}

function CharacterForm({ data }: { data: CreatorBuilderNodeData }) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [age, setAge] = useState("30s");
  const [hairLen, setHairLen] = useState("short");
  const [hairLenC, setHairLenC] = useState("");
  const [hairStyle, setHairStyle] = useState("straight");
  const [hairStyleC, setHairStyleC] = useState("");
  const [hairColor, setHairColor] = useState("dark brown");
  const [hairColorC, setHairColorC] = useState("");
  const [facial, setFacial] = useState("none");
  const [facialC, setFacialC] = useState("");
  const [eyes, setEyes] = useState("brown");
  const [eyesC, setEyesC] = useState("");
  const [skin, setSkin] = useState("medium");
  const [skinC, setSkinC] = useState("");
  const [height, setHeight] = useState("average");
  const [heightC, setHeightC] = useState("");
  const [weight, setWeight] = useState("average");
  const [weightC, setWeightC] = useState("");
  const [body, setBody] = useState("average");
  const [bodyC, setBodyC] = useState("");
  const [faceShape, setFaceShape] = useState("oval");
  const [faceShapeC, setFaceShapeC] = useState("");
  const [nose, setNose] = useState("straight");
  const [noseC, setNoseC] = useState("");
  const [jaw, setJaw] = useState("defined");
  const [jawC, setJawC] = useState("");
  const [notes, setNotes] = useState("");
  const [overrideWardrobe, setOverrideWardrobe] = useState(false);
  const [wardrobe, setWardrobe] = useState("");
  const [identityPrompt, setIdentityPrompt] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const models = useSheetModels();
  const locked = gender === "Female" ? WARDROBE_F : WARDROBE_M;
  const haveFront = Boolean(done.front);
  const estimate = useSheetEstimate(
    "character",
    models.t2iId,
    models.r2iId,
    ["front"],
    models,
  );
  const identityFields = useMemo(() => {
    const clothes = overrideWardrobe ? wardrobe.trim() : locked;
    return {
      gender,
      age,
      hair_length: pickField(hairLen, hairLenC),
      hair_style: pickField(hairStyle, hairStyleC),
      hair_color: pickField(hairColor, hairColorC),
      facial_hair: gender === "Male" ? pickField(facial, facialC) : "",
      eye_color: pickField(eyes, eyesC),
      skin: pickField(skin, skinC),
      height: pickField(height, heightC),
      weight: pickField(weight, weightC),
      body: pickField(body, bodyC),
      face_shape: pickField(faceShape, faceShapeC),
      nose: pickField(nose, noseC),
      jaw: pickField(jaw, jawC),
      wardrobe: clothes,
    };
  }, [
    gender,
    age,
    hairLen,
    hairLenC,
    hairStyle,
    hairStyleC,
    hairColor,
    hairColorC,
    facial,
    facialC,
    eyes,
    eyesC,
    skin,
    skinC,
    height,
    heightC,
    weight,
    weightC,
    body,
    bodyC,
    faceShape,
    faceShapeC,
    nose,
    noseC,
    jaw,
    jawC,
    overrideWardrobe,
    wardrobe,
    locked,
  ]);

  function composeIdentity(): string {
    return composeCharacterIdentity(identityFields, notes);
  }

  function applySelection() {
    setError(null);
    const text = composeIdentity();
    setIdentityPrompt(text);
    toast("Identity prompt applied.");
  }

  function ensureIdentity(): string {
    const cur = identityPrompt.trim();
    if (cur) return cur;
    const text = composeIdentity();
    setIdentityPrompt(text);
    return text;
  }

  async function generateSlot(slot: string) {
    const label = name.trim();
    if (!label) {
      setError("Name is required.");
      return;
    }
    if (slot !== "front" && !haveFront) {
      setError("Generate Front first.");
      return;
    }
    setBusy(true);
    setBusySlot(slot);
    setError(null);
    try {
      const ident = ensureIdentity();
      if (!ident) throw new Error("Apply selection first so Generate has an identity prompt.");
      const fields = { ...identityFields, identity_prompt: ident };
      let id = assetId;
      if (!id) {
        const created = await fetch("/assets/sheet/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "character",
            name: label,
            notes: notes.trim(),
            fields,
          }),
        });
        const draft = await readJson<GenBody>(created);
        if (!created.ok || !draft.item) throw new Error(errOf(draft, "Create failed.", created));
        id = draft.item.id;
        setAssetId(id);
        data.onSession?.({
          assetId: id,
          t2iModel: models.t2iId,
          r2iModel: models.r2iId || models.t2iId,
          slots: [...CORE_SLOTS, ...EXTRA_SLOTS],
        });
      }
      const source = slot === "front" ? "" : done.front || "";
      data.onAngle(slot, {
        slot,
        label: SLOT_LABEL[slot] || slot,
        prompt: ident,
        generating: true,
        error: null,
      });
      const res = await fetch("/assets/sheet/angle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: id,
          slot,
          model_id: slot === "front" ? models.t2iId : models.r2iId || models.t2iId,
          source_still: source,
          wardrobe: identityFields.wardrobe,
        }),
      });
      const body = await readJson<GenBody>(res);
      if (!res.ok || !body.item) {
        data.onAngle(slot, {
          slot,
          generating: false,
          error: errOf(body, `${SLOT_LABEL[slot] || slot} failed.`, res),
        });
        throw new Error(errOf(body, `${SLOT_LABEL[slot] || slot} failed.`, res));
      }
      const path = body.item.identity?.[slot] || body.item.still_path || "";
      const url = body.item.identity_urls?.[slot] || body.item.url || "";
      setDone((cur) => ({ ...cur, [slot]: path }));
      data.onAngle(slot, {
        slot,
        prompt: body.item.prompt || ident,
        path,
        url: url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : "",
        generating: false,
        error: null,
      });
      toast(`Generated ${SLOT_LABEL[slot] || slot}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
      setBusySlot(null);
    }
  }

  function save() {
    if (!assetId || !haveFront) {
      setError("Generate Front first.");
      return;
    }
    data.onSaved({
      id: assetId,
      name: name.trim(),
      kind: "character",
      has_still: true,
      still_path: assetId,
      url: `/assets/${assetId}/still`,
    });
  }

  async function onEnhance() {
    setEnhancing(true);
    setError(null);
    try {
      const raw = ensureIdentity();
      if (!raw) {
        throw new Error("Apply selection first so Enhance has identity + wardrobe text.");
      }
      const res = await fetch("/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: raw,
          model_id: models.t2iId,
          modality: "t2i",
          mode: "image",
        }),
      });
      const body = await readJson<GenBody>(res);
      const rewritten = (body.prompt || "").trim();
      if (!res.ok || body.ok === false || !rewritten) {
        throw new Error(
          errOf(body, "Enhance returned an empty or incomplete reply. Try again.", res),
        );
      }
      setIdentityPrompt(rewritten);
      toast("Identity enhanced.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Enhance failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setEnhancing(false);
    }
  }

  return (
    <>
      <p className="hint">
        Dropdowns stay. Apply selection builds the identity prompt (fields + notes + wardrobe).
        Generate Front first (1 still). Side / Close-up use Front as reference.
      </p>
      <label className="builder-field">
        <span className="field-label">Name</span>
        <input className="model" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="params">
        <label className="param">
          <span>Gender</span>
          <select
            className="model"
            value={gender}
            onChange={(e) => setGender(e.target.value as "Male" | "Female")}
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </label>
        <label className="param">
          <span>Age</span>
          <select className="model" value={age} onChange={(e) => setAge(e.target.value)}>
            {["20s", "30s", "40s", "50s", "60+"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="params">
        <FieldSelect
          label="Hair length"
          value={hairLen}
          custom={hairLenC}
          options={HAIR_LEN}
          onValue={setHairLen}
          onCustom={setHairLenC}
        />
        <FieldSelect
          label="Hair style"
          value={hairStyle}
          custom={hairStyleC}
          options={HAIR_STYLE}
          onValue={setHairStyle}
          onCustom={setHairStyleC}
        />
        <FieldSelect
          label="Hair color"
          value={hairColor}
          custom={hairColorC}
          options={HAIR_COLOR}
          onValue={setHairColor}
          onCustom={setHairColorC}
        />
      </div>
      {gender === "Male" ? (
        <div className="params">
          <FieldSelect
            label="Facial hair"
            value={facial}
            custom={facialC}
            options={FACIAL}
            onValue={setFacial}
            onCustom={setFacialC}
          />
        </div>
      ) : null}
      <div className="params">
        <FieldSelect
          label="Eye color"
          value={eyes}
          custom={eyesC}
          options={EYES}
          onValue={setEyes}
          onCustom={setEyesC}
        />
        <FieldSelect
          label="Skin tone"
          value={skin}
          custom={skinC}
          options={SKIN}
          onValue={setSkin}
          onCustom={setSkinC}
        />
        <FieldSelect
          label="Height"
          value={height}
          custom={heightC}
          options={HEIGHT}
          onValue={setHeight}
          onCustom={setHeightC}
        />
      </div>
      <div className="params">
        <FieldSelect
          label="Weight / build"
          value={weight}
          custom={weightC}
          options={WEIGHT}
          onValue={setWeight}
          onCustom={setWeightC}
        />
        <FieldSelect
          label="Body type"
          value={body}
          custom={bodyC}
          options={BODY}
          onValue={setBody}
          onCustom={setBodyC}
        />
      </div>
      <div className="params">
        <FieldSelect
          label="Face shape"
          value={faceShape}
          custom={faceShapeC}
          options={FACE}
          onValue={setFaceShape}
          onCustom={setFaceShapeC}
        />
        <FieldSelect
          label="Nose"
          value={nose}
          custom={noseC}
          options={NOSE}
          onValue={setNose}
          onCustom={setNoseC}
        />
        <FieldSelect
          label="Jaw / chin"
          value={jaw}
          custom={jawC}
          options={JAW}
          onValue={setJaw}
          onCustom={setJawC}
        />
      </div>
      <label className="builder-field">
        <span className="field-label">Notes (extra only)</span>
        <textarea
          className="prompt nowheel"
          rows={2}
          placeholder="Optional extras — not the whole prompt"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <label className="builder-field">
        <span className="field-label">
          <input
            type="checkbox"
            checked={overrideWardrobe}
            onChange={(e) => setOverrideWardrobe(e.target.checked)}
          />{" "}
          Override base wardrobe
        </span>
        <textarea
          className="prompt nowheel"
          rows={2}
          disabled={!overrideWardrobe}
          value={overrideWardrobe ? wardrobe : locked}
          onChange={(e) => setWardrobe(e.target.value)}
        />
      </label>
      <ModelPickers models={models} />
      <div className="prompt-actions">
        <button
          type="button"
          className="ghost"
          disabled={enhancing || busy}
          onClick={applySelection}
        >
          Apply selection
        </button>
        <button
          type="button"
          className="ghost enhance"
          disabled={enhancing || busy}
          onClick={() => void onEnhance()}
        >
          {enhancing ? "Enhancing…" : "Enhance"}
        </button>
      </div>
      <label className="builder-field">
        <span className="field-label">Identity prompt</span>
        <textarea
          className="prompt nowheel"
          rows={5}
          placeholder="Apply selection composes identity + wardrobe here. Enhance rewrites this."
          value={identityPrompt}
          onChange={(e) => setIdentityPrompt(e.target.value)}
        />
      </label>
      <p className="estimate">{estimate}</p>
      <p className="hint">Each extra angle is billed separately (1 still).</p>
      <div className="prompt-actions">
        <button
          type="button"
          className="generate"
          disabled={busy || enhancing || !name.trim()}
          onClick={() => void generateSlot("front")}
        >
          {busySlot === "front" ? "Generating Front…" : "Generate Front"}
        </button>
        <button
          type="button"
          className="generate"
          disabled={busy || enhancing || !haveFront}
          onClick={() => void generateSlot("side")}
        >
          {busySlot === "side" ? "Generating Side…" : "Generate Side"}
        </button>
        <button
          type="button"
          className="generate"
          disabled={busy || enhancing || !haveFront}
          onClick={() => void generateSlot("closeup")}
        >
          {busySlot === "closeup" ? "Generating Close-up…" : "Generate Close-up"}
        </button>
      </div>
      <span className="field-label">Extra angles</span>
      <div className="prompt-actions">
        {EXTRA_SLOTS.map((id) => (
          <button
            key={id}
            type="button"
            className="ghost"
            disabled={busy || enhancing || !haveFront}
            onClick={() => void generateSlot(id)}
          >
            {busySlot === id ? `Generating ${SLOT_LABEL[id]}…` : `Generate ${SLOT_LABEL[id]}`}
          </button>
        ))}
      </div>
      <div className="prompt-actions">
        <button type="button" className="ghost" disabled={busy || !haveFront} onClick={save}>
          Save Character
        </button>
      </div>
      {error ? (
        <p className="hint warn" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function CostumeForm({ data }: { data: CreatorBuilderNodeData }) {
  const [bases, setBases] = useState<StudioAsset[]>(data.bases ?? []);
  const [parentId, setParentId] = useState(data.bases?.[0]?.id || "");
  const [name, setName] = useState("");
  const [top, setTop] = useState("");
  const [bottom, setBottom] = useState("");
  const [footwear, setFootwear] = useState("");
  const [extra, setExtra] = useState("");
  const [costumeRef, setCostumeRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const models = useSheetModels();
  const estimate = useSheetEstimate(
    "costume",
    models.t2iId,
    models.r2iId,
    [...CORE_SLOTS],
    models,
  );

  useEffect(() => {
    fetch("/assets?kind=character")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body: { items?: StudioAsset[] }) => {
        const rows = (body.items ?? []).filter((a) => !a.parent_id && a.has_still);
        setBases(rows);
        setParentId((cur) => cur || rows[0]?.id || "");
      })
      .catch(() => undefined);
  }, []);

  async function generate() {
    const outfitName = name.trim();
    const outfit = [top, bottom, footwear, extra].map((s) => s.trim()).filter(Boolean).join(". ");
    if (!outfitName) {
      setError("Costume name is required.");
      return;
    }
    if (!parentId) {
      setError("Pick a base character.");
      return;
    }
    if (!outfit && !costumeRef) {
      setError("Describe the wardrobe or upload a costume still.");
      return;
    }
    setBusy(true);
    setError(null);
    setReady(false);
    try {
      const created = await fetch("/assets/sheet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "character",
          name: outfitName,
          parent_id: parentId,
          notes: extra.trim(),
          fields: { wardrobe: outfit },
        }),
      });
      const draft = await readJson<GenBody>(created);
      if (!created.ok || !draft.item) throw new Error(errOf(draft, "Create failed."));
      setAssetId(draft.item.id);
      data.onSession?.({
        assetId: draft.item.id,
        t2iModel: models.t2iId,
        r2iModel: models.r2iId || models.t2iId,
        slots: [...CORE_SLOTS],
      });
      const parent = bases.find((b) => b.id === parentId);
      let prior = parent?.still_path || "";
      let last = draft.item;
      for (const slot of CORE_SLOTS) {
        data.onAngle(slot, {
          slot,
          label: SLOT_LABEL[slot] || slot,
          generating: true,
          error: null,
        });
        const res = await fetch("/assets/sheet/angle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_id: draft.item.id,
            slot,
            model_id: models.r2iId || models.t2iId,
            source_still: prior,
            costume_ref: costumeRef,
            wardrobe: outfit,
          }),
        });
        const body = await readJson<GenBody>(res);
        if (!res.ok || !body.item) {
          data.onAngle(slot, {
            slot,
            generating: false,
            error: errOf(body, `${slot} failed.`),
          });
          throw new Error(errOf(body, `${slot} failed.`));
        }
        last = body.item;
        const path = body.item.identity?.[slot] || body.item.still_path || "";
        const url = body.item.identity_urls?.[slot] || body.item.url || "";
        prior = path;
        data.onAngle(slot, {
          slot,
          prompt: body.item.prompt || "",
          path,
          url: url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : "",
          generating: false,
          error: null,
        });
      }
      setReady(CORE_SLOTS.every((s) => last.identity?.[s]));
      toast(`Generated costume ${outfitName}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Costume generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className="builder-field">
        <span className="field-label">Base character</span>
        <select
          className="model"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          {bases.length === 0 ? (
            <option value="">No base sheets yet</option>
          ) : (
            bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label || b.name}
              </option>
            ))
          )}
        </select>
      </label>
      <label className="builder-field">
        <span className="field-label">Costume name</span>
        <input className="model" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="builder-field">
        <span className="field-label">Top</span>
        <input className="model" value={top} onChange={(e) => setTop(e.target.value)} />
      </label>
      <label className="builder-field">
        <span className="field-label">Bottom</span>
        <input className="model" value={bottom} onChange={(e) => setBottom(e.target.value)} />
      </label>
      <label className="builder-field">
        <span className="field-label">Footwear</span>
        <input
          className="model"
          value={footwear}
          onChange={(e) => setFootwear(e.target.value)}
        />
      </label>
      <label className="builder-field">
        <span className="field-label">Extra</span>
        <textarea
          className="prompt nowheel"
          rows={2}
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
        />
      </label>
      <div className="library-actions">
        <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
          {costumeRef ? "Costume still attached" : "Upload costume still"}
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.append("files", file);
            void fetch("/library/import", { method: "POST", body: fd })
              .then((res) => res.json())
              .then((body: { items?: { path?: string }[] }) => {
                setCostumeRef(body.items?.[0]?.path || "");
              });
            e.target.value = "";
          }}
        />
      </div>
      <ModelPickers models={models} r2iOnly />
      <p className="estimate">{estimate}</p>
      <div className="prompt-actions">
        <button
          type="button"
          className="generate"
          disabled={busy}
          onClick={() => void generate()}
        >
          {busy ? "Generating…" : "Generate costume sheet"}
        </button>
        <button
          type="button"
          className="ghost"
          disabled={busy || !ready || !assetId}
          onClick={() =>
            assetId &&
            data.onSaved({
              id: assetId,
              name: name.trim(),
              kind: "character",
              parent_id: parentId,
              is_costume: true,
              has_still: true,
              url: `/assets/${assetId}/still`,
            })
          }
        >
          Save costume
        </button>
      </div>
      {error ? (
        <p className="hint warn" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function SceneForm({ data }: { data: CreatorBuilderNodeData }) {
  const [name, setName] = useState("");
  const [setting, setSetting] = useState("interior");
  const [time, setTime] = useState("day");
  const [mood, setMood] = useState("calm");
  const [elements, setElements] = useState("");
  const [notes, setNotes] = useState("");
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const models = useSheetModels();
  const slots = sheet ? ["front", "side"] : ["front"];
  const estimate = useSheetEstimate("scene", models.t2iId, models.r2iId, slots, models);

  async function generate() {
    const label = name.trim();
    if (!label) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await fetch("/assets/sheet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "scene",
          name: label,
          notes: notes.trim(),
          fields: { setting, time, mood, elements: elements.trim(), notes: notes.trim() },
        }),
      });
      const draft = await readJson<GenBody>(created);
      if (!created.ok || !draft.item) throw new Error(errOf(draft, "Create failed."));
      data.onSession?.({
        assetId: draft.item.id,
        t2iModel: models.t2iId,
        r2iModel: models.r2iId || models.t2iId,
        slots,
      });
      let prior = "";
      let last = draft.item;
      for (const slot of slots) {
        data.onAngle(slot, {
          slot,
          label: slot === "front" ? "Hero" : "Detail",
          generating: true,
          error: null,
        });
        const res = await fetch("/assets/sheet/angle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asset_id: draft.item.id,
            slot,
            model_id: slot === "front" ? models.t2iId : models.r2iId || models.t2iId,
            source_still: prior,
          }),
        });
        const body = await readJson<GenBody>(res);
        if (!res.ok || !body.item) {
          data.onAngle(slot, { slot, generating: false, error: errOf(body, "Failed.") });
          throw new Error(errOf(body, "Failed."));
        }
        last = body.item;
        const path = body.item.identity?.[slot] || body.item.still_path || "";
        const url = body.item.identity_urls?.[slot] || body.item.url || "";
        prior = path;
        data.onAngle(slot, {
          slot,
          prompt: body.item.prompt || "",
          path,
          url: url ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : "",
          generating: false,
          error: null,
        });
      }
      data.onSaved(last);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scene generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className="builder-field">
        <span className="field-label">Name</span>
        <input className="model" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="params">
        <label className="param">
          <span>Setting</span>
          <select className="model" value={setting} onChange={(e) => setSetting(e.target.value)}>
            <option>interior</option>
            <option>exterior</option>
          </select>
        </label>
        <label className="param">
          <span>Time</span>
          <select className="model" value={time} onChange={(e) => setTime(e.target.value)}>
            {["dawn", "day", "golden hour", "dusk", "night"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="param">
          <span>Mood</span>
          <select className="model" value={mood} onChange={(e) => setMood(e.target.value)}>
            {["calm", "tense", "romantic", "gritty", "luxurious", "playful"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="builder-field">
        <span className="field-label">Key elements</span>
        <input className="model" value={elements} onChange={(e) => setElements(e.target.value)} />
      </label>
      <label className="builder-field">
        <span className="field-label">Notes</span>
        <textarea
          className="prompt nowheel"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <label className="builder-field">
        <span className="field-label">
          <input type="checkbox" checked={sheet} onChange={(e) => setSheet(e.target.checked)} />{" "}
          Second angle
        </span>
      </label>
      <ModelPickers models={models} />
      <p className="estimate">{estimate}</p>
      <div className="prompt-actions">
        <button
          type="button"
          className="generate"
          disabled={busy || !name.trim()}
          onClick={() => void generate()}
        >
          {busy ? "Generating…" : "Generate scene"}
        </button>
      </div>
      {error ? (
        <p className="hint warn" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function PropForm({ data }: { data: CreatorBuilderNodeData }) {
  const [name, setName] = useState("");
  const [ptype, setPtype] = useState("object");
  const [material, setMaterial] = useState("metal");
  const [color, setColor] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const models = useSheetModels();
  const estimate = useSheetEstimate("prop", models.t2iId, models.r2iId, ["front"], models);

  async function generate() {
    const label = name.trim();
    if (!label) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await fetch("/assets/sheet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "prop",
          name: label,
          notes: notes.trim(),
          fields: { ptype, material, color: color.trim(), notes: notes.trim() },
        }),
      });
      const draft = await readJson<GenBody>(created);
      if (!created.ok || !draft.item) throw new Error(errOf(draft, "Create failed."));
      data.onSession?.({
        assetId: draft.item.id,
        t2iModel: models.t2iId,
        r2iModel: models.r2iId || models.t2iId,
        slots: ["front"],
      });
      data.onAngle("front", {
        slot: "front",
        label: "Still",
        generating: true,
        error: null,
      });
      const res = await fetch("/assets/sheet/angle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: draft.item.id,
          slot: "front",
          model_id: models.t2iId,
        }),
      });
      const body = await readJson<GenBody>(res);
      if (!res.ok || !body.item) {
        data.onAngle("front", { slot: "front", generating: false, error: errOf(body, "Failed.") });
        throw new Error(errOf(body, "Failed."));
      }
      const url = body.item.url || "";
      data.onAngle("front", {
        slot: "front",
        prompt: body.item.prompt || "",
        path: body.item.still_path || "",
        url: url ? `${url}?t=${Date.now()}` : "",
        generating: false,
        error: null,
      });
      data.onSaved(body.item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Prop generate failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <label className="builder-field">
        <span className="field-label">Name</span>
        <input className="model" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="params">
        <label className="param">
          <span>Type</span>
          <select className="model" value={ptype} onChange={(e) => setPtype(e.target.value)}>
            {["object", "handheld", "furniture", "vehicle", "food", "other"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="param">
          <span>Material</span>
          <select className="model" value={material} onChange={(e) => setMaterial(e.target.value)}>
            {["metal", "wood", "plastic", "glass", "fabric", "ceramic", "mixed"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="builder-field">
        <span className="field-label">Color</span>
        <input className="model" value={color} onChange={(e) => setColor(e.target.value)} />
      </label>
      <label className="builder-field">
        <span className="field-label">Notes</span>
        <textarea
          className="prompt nowheel"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <ModelPickers models={models} t2iOnly />
      <p className="estimate">{estimate}</p>
      <div className="prompt-actions">
        <button
          type="button"
          className="generate"
          disabled={busy || !name.trim()}
          onClick={() => void generate()}
        >
          {busy ? "Generating…" : "Generate still"}
        </button>
      </div>
      {error ? (
        <p className="hint warn" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function FieldSelect({
  label,
  value,
  custom,
  options,
  onValue,
  onCustom,
}: {
  label: string;
  value: string;
  custom: string;
  options: string[];
  onValue: (v: string) => void;
  onCustom: (v: string) => void;
}) {
  const opts = Array.isArray(options) ? options.filter(Boolean) : [];
  const safe = opts.includes(value) || value === "Custom" ? value || opts[0] || "" : opts[0] || "";
  return (
    <label className="param">
      <span>{label}</span>
      <select
        className="model"
        value={safe}
        onChange={(e) => onValue(e.target.value)}
      >
        {opts.map((item) => (
          <option key={`${label}-${item}`} value={item}>
            {item}
          </option>
        ))}
        <option value="Custom">Custom</option>
      </select>
      {value === "Custom" ? (
        <input
          className="model"
          value={custom}
          placeholder="Custom…"
          onChange={(e) => onCustom(e.target.value)}
        />
      ) : null}
    </label>
  );
}

function ModelPickers({
  models,
  t2iOnly,
  r2iOnly,
}: {
  models: ReturnType<typeof useSheetModels>;
  t2iOnly?: boolean;
  r2iOnly?: boolean;
}) {
  const t2i = Array.isArray(models?.t2i) ? models.t2i.filter((m) => m?.id) : [];
  const r2i = Array.isArray(models?.r2i) ? models.r2i.filter((m) => m?.id) : [];
  const t2iId = t2i.some((m) => m.id === models?.t2iId) ? models.t2iId : t2i[0]?.id || "";
  const r2iId = r2i.some((m) => m.id === models?.r2iId) ? models.r2iId : r2i[0]?.id || "";
  return (
    <div className="params">
      {!r2iOnly ? (
        <label className="param">
          <span>Front model (T2I)</span>
          <select
            className="model"
            value={t2iId}
            onChange={(e) => models.setT2iId(e.target.value)}
          >
            {t2i.length === 0 ? <option value="">Loading models…</option> : null}
            {t2i.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label || m.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!t2iOnly ? (
        <label className="param">
          <span>Angle model (R2I)</span>
          <select
            className="model"
            value={r2iId}
            onChange={(e) => models.setR2iId(e.target.value)}
          >
            {r2i.length === 0 ? <option value="">Loading models…</option> : null}
            {r2i.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label || m.id}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
