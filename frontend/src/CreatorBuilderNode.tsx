import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import NodeErrorBoundary from "./NodeErrorBoundary";
import { spawnAngleResult } from "./angleSpawn";
import { readJson as readJsonSafe } from "./http";
import { toast } from "./toast";
import { importOsFiles, isOsFileDrag } from "./osImport";
import {
  CORE_SLOTS,
  COSTUME_COLORS,
  COSTUME_CONDITIONS,
  COSTUME_ERAS,
  COSTUME_FITS,
  COSTUME_GENDERS,
  COSTUME_MATERIALS,
  type CostumeLayer,
  COSTUME_REGIONS,
  COSTUME_SILHOUETTES,
  COSTUME_SLOTS,
  COSTUME_TAGS,
  EXTRA_SLOTS,
  bodyLayerItemsFor,
  layerItemsFor,
  signatureItemsFor,
  PROP_CONDITIONS,
  PROP_MATERIALS,
  PROP_SCALES,
  PROP_TYPES,
  SCENE_ARCHITECTURE,
  SCENE_CAMERA,
  SCENE_GRADES,
  SCENE_LIGHTING,
  SCENE_LOCATIONS,
  SCENE_MOODS,
  SCENE_TIMES,
  SCENE_WEATHER,
  SLOT_LABEL,
  WARDROBE_F,
  WARDROBE_M,
  composeAnglePrompt,
  composeCharacterIdentity,
  composeCostumeBrief,
  collectDressFrontRefs,
  composeCostumePrompt,
  composeDressPrompt,
  composePropBrief,
  composePropStill,
  composeSceneBrief,
  composeSceneStill,
  pickDefaultResolution,
  qualityChoices,
  sheetR2iRefCap,
  sizeChoices,
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

const LAYER_LABEL: Record<string, string> = {
  top: "Top",
  bottom: "Bottom",
  footwear: "Footwear",
  over: "Over",
  head: "Head",
  hands: "Hands",
  accessories: "Accessories",
};

const SINGLE_SLOTS = ["bottom", "footwear", "head", "hands", "accessories"] as const;
const MAX_BODY_LAYERS = 5;

export default function CreatorBuilderNode({
  data,
  id,
  selected,
}: NodeProps<CreatorBuilderFlowNode>) {
  const kind = data?.kind || "character";
  const safe: CreatorBuilderNodeData = {
    kind,
    attachSlotId: data?.attachSlotId,
    bases: Array.isArray(data?.bases) ? data.bases : [],
    sessionAssetId: data?.sessionAssetId,
    doneSlots: data?.doneSlots,
    onClose: data?.onClose,
    onAngle: typeof data?.onAngle === "function" ? data.onAngle : () => undefined,
    onSession: data?.onSession,
    onSaved: typeof data?.onSaved === "function" ? data.onSaved : () => undefined,
  };
  const builderId = id || "";
  const costume = kind === "costume";
  return (
    <div
      className={
        costume
          ? "studio-node creator-builder-node costume-builder nowheel"
          : "studio-node creator-builder-node"
      }
    >
      {costume ? (
        <NodeResizer
          minWidth={560}
          minHeight={240}
          isVisible={selected}
          lineClassName="node-resize-line"
          handleClassName="node-resize-handle"
        />
      ) : null}
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">
        <span>
          {kind === "costume"
            ? "Costume Designer"
            : kind === "dress"
              ? "Dress Character"
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
            : kind === "dress"
              ? "Dress Character"
              : kind === "scene"
                ? "Scene Builder"
                : kind === "prop"
                  ? "Prop Builder"
                  : "Character Builder"
        }
      >
        <div className="node-body nodrag">
          {kind === "scene" ? (
            <SceneForm data={safe} builderId={builderId} />
          ) : kind === "prop" ? (
            <PropForm data={safe} builderId={builderId} />
          ) : kind === "costume" ? (
            <CostumeForm data={safe} builderId={builderId} />
          ) : kind === "dress" ? (
            <DressForm data={safe} builderId={builderId} />
          ) : (
            <CharacterForm data={safe} builderId={builderId} />
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
const BODY_HAIR = ["none", "light", "medium", "heavy"];
const BUST = ["small", "medium", "large"];

function pickField(value?: string | null, custom?: string | null) {
  const v = String(value ?? "");
  const c = String(custom ?? "");
  if (v === "Custom") return c.trim();
  return v.trim();
}

const ANGLE_ACTIONS = [...CORE_SLOTS, ...EXTRA_SLOTS] as const;

function CharacterForm({
  data,
  builderId,
}: {
  data: CreatorBuilderNodeData;
  builderId: string;
}) {
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
  const [bodyHair, setBodyHair] = useState("none");
  const [bodyHairC, setBodyHairC] = useState("");
  const [bust, setBust] = useState("medium");
  const [bustC, setBustC] = useState("");
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"generate" | "upload" | "ref">("generate");
  const [refStill, setRefStill] = useState("");
  const models = useSheetModels();
  const locked = gender === "Female" ? WARDROBE_F : WARDROBE_M;
  const haveFront = Boolean(data.doneSlots?.front);
  const t2iRow = models.t2i.find((m) => m.id === models.t2iId);
  const r2iRow = models.r2i.find((m) => m.id === models.r2iId);
  const frontSizes = sizeChoices(t2iRow);
  const angleSizes = sizeChoices(r2iRow);
  const frontQualities = qualityChoices(t2iRow);
  const angleQualities = qualityChoices(r2iRow);
  const frontSizeKey = frontSizes.join("|");
  const angleSizeKey = angleSizes.join("|");
  const [frontRes, setFrontRes] = useState("");
  const [angleRes, setAngleRes] = useState("");
  const [frontQuality, setFrontQuality] = useState("");
  const [angleQuality, setAngleQuality] = useState("");
  useEffect(() => {
    setFrontRes((cur) =>
      frontSizes.includes(cur) ? cur : pickDefaultResolution(frontSizes),
    );
    setFrontQuality((cur) =>
      frontQualities.includes(cur) ? cur : pickDefaultResolution(frontQualities),
    );
  }, [models.t2iId, frontSizeKey]);
  useEffect(() => {
    setAngleRes((cur) =>
      angleSizes.includes(cur) ? cur : pickDefaultResolution(angleSizes),
    );
    setAngleQuality((cur) =>
      angleQualities.includes(cur) ? cur : pickDefaultResolution(angleQualities),
    );
  }, [models.r2iId, angleSizeKey]);
  const estimate = useSheetEstimate(
    "character",
    models.t2iId,
    models.r2iId,
    ["front"],
    models,
    { t2i: frontRes, r2i: angleRes },
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
      body_hair: gender === "Male" ? pickField(bodyHair, bodyHairC) : "",
      bust: gender === "Female" ? pickField(bust, bustC) : "",
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
    bodyHair,
    bodyHairC,
    bust,
    bustC,
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

  function sessionPayload(id: string, ident: string, label: string) {
    return {
      assetId: id,
      t2iModel: models.t2iId,
      r2iModel: models.r2iId || models.t2iId,
      slots: [...CORE_SLOTS, ...EXTRA_SLOTS],
      name: label,
      fields: { ...identityFields, identity_prompt: ident },
      wardrobe: identityFields.wardrobe,
      notes: notes.trim(),
      t2iResolution: frontRes,
      r2iResolution: angleRes,
    };
  }

  async function ensureDraft(ident: string, label: string): Promise<string> {
    if (data.sessionAssetId) return data.sessionAssetId;
    const created = await fetch("/assets/sheet/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "character",
        name: label,
        notes: notes.trim(),
        fields: { ...identityFields, identity_prompt: ident },
      }),
    });
    const draft = await readJson<GenBody>(created);
    if (!created.ok || !draft.item?.id) {
      throw new Error(errOf(draft, "Could not create character draft.", created));
    }
    data.onSession?.(sessionPayload(draft.item.id, ident, label));
    return draft.item.id;
  }

  function openAngle(slot: string) {
    try {
      const label = name.trim() || "Character";
      const ident = ensureIdentity();
      if (mode === "ref" && slot === "front" && !refStill) {
        setError("Upload a face/body ref first.");
        return;
      }
      const anglePrompt = composeAnglePrompt(slot, ident, { hasFront: haveFront });
      const sourceStill =
        slot === "front"
          ? mode === "ref"
            ? refStill
            : ""
          : data.doneSlots?.front || "";
      const patch = {
        slot,
        label: SLOT_LABEL[slot] || slot,
        prompt: anglePrompt,
        generating: false,
        error: null as string | null,
        cost: estimate,
        focus: true,
        resolution: slot === "front" ? frontQuality || frontRes : angleQuality || angleRes,
        resolutionChoices: slot === "front" ? frontSizes : angleSizes,
        aspect: slot === "front" ? frontRes : angleRes,
        quality: slot === "front" ? frontQuality : angleQuality,
        qualityChoices: slot === "front" ? frontQualities : angleQualities,
        t2iModel: models.t2iId,
        r2iModel: models.r2iId || models.t2iId,
        assetId: data.sessionAssetId || "",
        sourceStill,
        wardrobe: identityFields.wardrobe,
        name: label,
      };
      const session = sessionPayload(data.sessionAssetId || "", ident, label);
      spawnAngleResult({
        builderId,
        ...patch,
        t2iModel: session.t2iModel,
        r2iModel: session.r2iModel,
        name: session.name,
        fields: session.fields,
        wardrobe: session.wardrobe,
        notes: session.notes,
        t2iResolution: session.t2iResolution,
        r2iResolution: session.r2iResolution,
      });
      setError(null);
      data.onSession?.(session);
    } catch (err: unknown) {
      console.error("Angle Result spawn failed", err);
      const msg = err instanceof Error ? err.message : "Could not open Result node.";
      setError(msg);
      toast(msg, true);
    }
  }

  async function attachFilesToSlot(slot: string, files: File[]) {
    const image = files.find((f) => f.type.startsWith("image/")) || files[0];
    if (!image) return;
    setError(null);
    try {
      const ident = ensureIdentity();
      const label = name.trim() || "Character";
      const id = await ensureDraft(ident, label);
      const fd = new FormData();
      fd.append("slot", slot);
      fd.append("files", image);
      const res = await fetch(`/assets/${id}/slot`, { method: "POST", body: fd });
      const body = await readJson<GenBody>(res);
      if (!res.ok || !body.item) {
        throw new Error(errOf(body, "Upload failed.", res));
      }
      const path = body.item.identity?.[slot] || body.item.still_path || "";
      data.onSession?.({
        ...sessionPayload(id, ident, label),
        done: { ...(data.doneSlots || {}), [slot]: path },
      });
      data.onAngle(slot, {
        slot,
        path,
        url: body.item.identity_urls?.[slot] || body.item.url || "",
        generating: false,
        error: null,
      });
      toast(`${SLOT_LABEL[slot] || slot} attached.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
      toast(msg, true);
    }
  }

  async function attachRef(files: File[]) {
    try {
      const items = await importOsFiles(files);
      const path = items[0]?.path || "";
      if (!path) throw new Error("Could not import ref still.");
      setRefStill(path);
      toast("Ref still attached.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ref import failed.";
      setError(msg);
      toast(msg, true);
    }
  }

  async function save() {
    if (!haveFront) {
      setError("Need a Front still — generate, upload, or ref-edit Front first.");
      return;
    }
    const ident = ensureIdentity();
    const label = name.trim() || "Character";
    setSaving(true);
    setError(null);
    try {
      const id = await ensureDraft(ident, label);
      const res = await fetch("/assets/sheet/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: id,
          name: label,
          notes: notes.trim(),
          fields: { ...identityFields, identity_prompt: ident },
          require_front: true,
        }),
      });
      const body = await readJson<GenBody>(res);
      if (!res.ok || !body.item) {
        throw new Error(errOf(body, "Save failed.", res));
      }
      const missing = CORE_SLOTS.filter((s) => !data.doneSlots?.[s] && !body.item?.identity?.[s]);
      if (missing.length) {
        toast(`Saved with Front. Prefer also ${missing.map((s) => SLOT_LABEL[s] || s).join(", ")}.`);
      }
      data.onSaved(body.item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setSaving(false);
    }
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
        Generate opens a Result node — run Generate on the node. Upload drops stills
        into Front / Side / Close-up. Ref edit I2I’s Front from a face/body still.
      </p>
      <div className="pills chips">
        {(["generate", "upload", "ref"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={mode === id ? "pill modality on" : "pill modality"}
            onClick={() => setMode(id)}
          >
            {id === "generate" ? "Generate" : id === "upload" ? "Upload" : "Ref edit"}
          </button>
        ))}
      </div>
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
          <FieldSelect
            label="Body hair"
            value={bodyHair}
            custom={bodyHairC}
            options={BODY_HAIR}
            onValue={setBodyHair}
            onCustom={setBodyHairC}
          />
        </div>
      ) : (
        <div className="params">
          <FieldSelect
            label="Bust size"
            value={bust}
            custom={bustC}
            options={BUST}
            onValue={setBust}
            onCustom={setBustC}
          />
        </div>
      )}
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
      <div className="params">
        <label className="param">
          <span>Front size</span>
          <select
            className="model"
            value={frontRes}
            onChange={(e) => setFrontRes(e.target.value)}
          >
            {frontSizes.length === 0 ? <option value="">Default</option> : null}
            {frontSizes.map((s) => (
              <option key={`front-${s}`} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="param">
          <span>Angle size</span>
          <select
            className="model"
            value={angleRes}
            onChange={(e) => setAngleRes(e.target.value)}
          >
            {angleSizes.length === 0 ? <option value="">Default</option> : null}
            {angleSizes.map((s) => (
              <option key={`angle-${s}`} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {frontQualities.length ? (
          <label className="param">
            <span>Front quality</span>
            <select
              className="model"
              value={frontQuality}
              onChange={(e) => setFrontQuality(e.target.value)}
            >
              {frontQualities.map((s) => (
                <option key={`fq-${s}`} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {angleQualities.length ? (
          <label className="param">
            <span>Angle quality</span>
            <select
              className="model"
              value={angleQuality}
              onChange={(e) => setAngleQuality(e.target.value)}
            >
              {angleQualities.map((s) => (
                <option key={`aq-${s}`} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="prompt-actions">
        <button
          type="button"
          className="ghost"
          disabled={enhancing}
          onClick={applySelection}
        >
          Apply selection
        </button>
        <button
          type="button"
          className="ghost enhance"
          disabled={enhancing}
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
      {mode === "upload" ? (
        <>
          <p className="hint">Drop 1–3 stills into Front / Side / Close-up, then Save.</p>
          <div className="sheet-progress">
            {CORE_SLOTS.map((slot) => (
              <SlotDrop
                key={slot}
                label={SLOT_LABEL[slot] || slot}
                filled={Boolean(data.doneSlots?.[slot])}
                onFiles={(files) => void attachFilesToSlot(slot, files)}
              />
            ))}
          </div>
        </>
      ) : null}
      {mode === "ref" ? (
        <>
          <p className="hint">Upload a face/body ref, Apply identity, then Generate Front (I2I).</p>
          <SlotDrop
            label={refStill ? "Ref still attached" : "Drop face/body ref"}
            filled={Boolean(refStill)}
            onFiles={(files) => void attachRef(files)}
          />
        </>
      ) : null}
      {mode !== "upload" ? (
        <>
          <p className="hint">Opens a Result node immediately — Generate on the node runs the still.</p>
          <div className="prompt-actions">
            {ANGLE_ACTIONS.slice(0, 3).map((slot) => (
              <button
                key={slot}
                type="button"
                className="generate"
                onClick={() => openAngle(slot)}
              >
                Generate {SLOT_LABEL[slot]}
              </button>
            ))}
          </div>
          <span className="field-label">Extra angles</span>
          <div className="prompt-actions">
            {ANGLE_ACTIONS.slice(3).map((slot) => (
              <button
                key={slot}
                type="button"
                className="ghost"
                onClick={() => openAngle(slot)}
              >
                Generate {SLOT_LABEL[slot]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="hint">Optional: after one hero upload, Generate Side / Close-up from Front.</p>
      )}
      {mode === "upload" ? (
        <div className="prompt-actions">
          {CORE_SLOTS.slice(1).map((slot) => (
            <button
              key={slot}
              type="button"
              className="ghost"
              disabled={!haveFront}
              onClick={() => openAngle(slot)}
            >
              Generate {SLOT_LABEL[slot]}
            </button>
          ))}
        </div>
      ) : null}
      <div className="prompt-actions">
        <button
          type="button"
          className="ghost"
          disabled={!haveFront || saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save Character"}
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

function SlotDrop({
  label,
  filled,
  onFiles,
}: {
  label: string;
  filled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [hot, setHot] = useState(false);
  function take(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name));
    if (images.length) onFiles(images);
  }
  return (
    <div
      className={hot ? "slot-drop hot" : "slot-drop"}
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        if (!isOsFileDrag(e.dataTransfer)) return;
        e.preventDefault();
        setHot(true);
      }}
      onDragLeave={() => setHot(false)}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setHot(false);
        take(Array.from(e.dataTransfer.files || []));
      }}
    >
      <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
        {filled ? `✓ ${label}` : label}
      </button>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept="image/*"
        onChange={(e) => {
          const list = e.target.files ? Array.from(e.target.files) : [];
          if (list.length) take(list);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function CostumeForm({
  data,
  builderId,
}: {
  data: CreatorBuilderNodeData;
  builderId: string;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"Male" | "Female">("Male");
  const [category, setCategory] = useState("fantasy");
  const [categoryC, setCategoryC] = useState("");
  const [era, setEra] = useState("medieval");
  const [eraC, setEraC] = useState("");
  const [region, setRegion] = useState("");
  const [regionC, setRegionC] = useState("");
  const [silhouette, setSilhouette] = useState("bulky armor");
  const [silhouetteC, setSilhouetteC] = useState("");
  const [palette, setPalette] = useState("");
  const [paletteC, setPaletteC] = useState("");
  const [signature, setSignature] = useState("");
  const [signatureC, setSignatureC] = useState("");
  const [bodyLayers, setBodyLayers] = useState<LayerState[]>(() => [emptyLayer()]);
  const [slots, setSlots] = useState<Record<string, LayerState>>(() =>
    Object.fromEntries(SINGLE_SLOTS.map((k) => [k, emptyLayer()])),
  );
  const [notes, setNotes] = useState("");
  const [outfitPrompt, setOutfitPrompt] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const models = useSheetModels();
  const haveFront = Boolean(data.doneSlots?.front);
  const t2iRow = models.t2i.find((m) => m.id === models.t2iId);
  const r2iRow = models.r2i.find((m) => m.id === models.r2iId);
  const frontSizes = sizeChoices(t2iRow);
  const angleSizes = sizeChoices(r2iRow);
  const frontQualities = qualityChoices(t2iRow);
  const angleQualities = qualityChoices(r2iRow);
  const estimate = useSheetEstimate(
    "costume",
    models.t2iId,
    models.r2iId,
    [...COSTUME_SLOTS],
    models,
  );
  const catKey = pickField(category, categoryC);
  const eraKey = pickField(era, eraC);
  const signatureOpts = signatureItemsFor(catKey);

  function remapLayer(layer: LayerState, allowed: string[]): LayerState {
    if (layer.item === "Custom" || !layer.item) return layer;
    const item = pickField(layer.item, layer.itemC);
    if (item && !allowed.includes(item)) {
      return { ...layer, item: "Custom", itemC: item };
    }
    return layer;
  }

  function remapBody(cat: string, eraVal: string, gen: string, cur: LayerState[]) {
    const allowed = bodyLayerItemsFor(cat, eraVal, gen);
    return cur.map((L) => remapLayer(L, allowed));
  }

  function remapSlots(cat: string, eraVal: string, gen: string, cur: Record<string, LayerState>) {
    const next: Record<string, LayerState> = { ...cur };
    for (const key of SINGLE_SLOTS) {
      const allowed = layerItemsFor(key as CostumeLayer, cat, eraVal, gen);
      next[key] = remapLayer(cur[key] || emptyLayer(), allowed);
    }
    return next;
  }

  function onGender(v: string) {
    const gen = (v === "Female" ? "Female" : "Male") as "Male" | "Female";
    setGender(gen);
    setBodyLayers((cur) => remapBody(catKey, eraKey, gen, cur));
    setSlots((cur) => remapSlots(catKey, eraKey, gen, cur));
  }

  function onCategory(v: string) {
    setCategory(v);
    const cat = v === "Custom" ? categoryC : v;
    setBodyLayers((cur) => remapBody(cat, eraKey, gender, cur));
    setSlots((cur) => remapSlots(cat, eraKey, gender, cur));
    if (signature && signature !== "Custom" && !signatureItemsFor(cat).includes(signature)) {
      setSignature("Custom");
      setSignatureC(signature);
    }
    if (cat === "everyday" && silhouette === "bulky armor") setSilhouette("");
  }

  function onEra(v: string) {
    setEra(v);
    const eraVal = v === "Custom" ? eraC : v;
    setBodyLayers((cur) => remapBody(catKey, eraVal, gender, cur));
    setSlots((cur) => remapSlots(catKey, eraVal, gender, cur));
  }

  const costumeFields = useMemo(() => {
    const flat: Record<string, string> = {
      gender,
      category: pickField(category, categoryC),
      era: pickField(era, eraC),
      region: pickField(region, regionC),
      silhouette: pickField(silhouette, silhouetteC),
      palette: pickField(palette, paletteC),
      signature: pickField(signature, signatureC),
    };
    bodyLayers.forEach((layer, i) => {
      const key = i === 0 ? "top" : `top_${i + 1}`;
      Object.assign(flat, flattenLayer(key, layer));
    });
    for (const key of SINGLE_SLOTS) {
      Object.assign(flat, flattenLayer(key, slots[key] || emptyLayer()));
    }
    return flat;
  }, [
    gender,
    category,
    categoryC,
    era,
    eraC,
    region,
    regionC,
    silhouette,
    silhouetteC,
    palette,
    paletteC,
    signature,
    signatureC,
    bodyLayers,
    slots,
  ]);

  function outfitText() {
    return outfitPrompt.trim() || composeCostumeBrief(costumeFields, notes);
  }

  async function ensureDraft() {
    const label = name.trim() || "Costume";
    const outfit = outfitText();
    if (data.sessionAssetId) return data.sessionAssetId;
    const created = await fetch("/assets/sheet/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "costume",
        name: label,
        notes: notes.trim(),
        fields: { ...costumeFields, wardrobe: outfit, notes: notes.trim() },
      }),
    });
    const draft = await readJson<GenBody>(created);
    if (!created.ok || !draft.item?.id) throw new Error(errOf(draft, "Create failed.", created));
    data.onSession?.({
      assetId: draft.item.id,
      t2iModel: models.t2iId,
      r2iModel: models.r2iId || models.t2iId,
      slots: [...COSTUME_SLOTS],
      name: label,
      fields: { ...costumeFields, wardrobe: outfit },
      notes: notes.trim(),
    });
    return draft.item.id;
  }

  function openPlate(slot: string) {
    const outfit = outfitText();
    if (!outfit) {
      setError("Apply selection first — pick a category or at least one layer.");
      return;
    }
    try {
      const label = name.trim() || "Costume";
      void ensureDraft().then((id) => {
        spawnAngleResult({
          builderId,
          slot,
          label: SLOT_LABEL[slot] || slot,
          prompt: composeCostumePrompt(slot, outfit),
          generating: false,
          error: null,
          focus: true,
          resolution: slot === "front" ? pickDefaultResolution(frontQualities) || pickDefaultResolution(frontSizes) : pickDefaultResolution(angleSizes),
          resolutionChoices: slot === "front" ? frontSizes : angleSizes,
          aspect: slot === "front" ? pickDefaultResolution(frontSizes) : pickDefaultResolution(angleSizes),
          quality: slot === "front" ? pickDefaultResolution(frontQualities) : pickDefaultResolution(angleQualities),
          qualityChoices: slot === "front" ? frontQualities : angleQualities,
          t2iModel: models.t2iId,
          r2iModel: models.r2iId || models.t2iId,
          assetId: id,
          sourceStill: slot === "front" ? "" : data.doneSlots?.front || "",
          wardrobe: outfit,
          name: label,
        });
      });
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not open plate.";
      setError(msg);
    }
  }

  async function save() {
    if (!haveFront) {
      setError("Generate a Front mannequin plate first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await ensureDraft();
      const res = await fetch("/assets/sheet/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: id,
          name: name.trim() || "Costume",
          notes: notes.trim(),
          fields: { ...costumeFields, wardrobe: outfitText() },
          require_front: true,
        }),
      });
      const body = await readJson<GenBody>(res);
      if (!res.ok || !body.item) throw new Error(errOf(body, "Save failed.", res));
      data.onSaved(body.item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="hint">
        Faceless mannequin plates — no identity. Gender filters garments with Category/Era
        and nudges cut/fit on Apply. Stack body layers innermost first.
      </p>
      <label className="builder-field">
        <span className="field-label">Costume name</span>
        <input className="model" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="params costume-row-4">
        <label className="param">
          <span>Gender</span>
          <select
            className="model"
            value={gender}
            onChange={(e) => onGender(e.target.value)}
          >
            {COSTUME_GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <FieldSelect
          label="Category"
          value={category}
          custom={categoryC}
          options={COSTUME_TAGS}
          allowEmpty
          onValue={onCategory}
          onCustom={setCategoryC}
        />
        <FieldSelect
          label="Era"
          value={era}
          custom={eraC}
          options={COSTUME_ERAS}
          allowEmpty
          onValue={onEra}
          onCustom={setEraC}
        />
        <FieldSelect
          label="Region"
          value={region}
          custom={regionC}
          options={COSTUME_REGIONS}
          allowEmpty
          onValue={setRegion}
          onCustom={setRegionC}
        />
      </div>
      <div className="params costume-row-3">
        <FieldSelect
          label="Silhouette"
          value={silhouette}
          custom={silhouetteC}
          options={COSTUME_SILHOUETTES}
          allowEmpty
          onValue={setSilhouette}
          onCustom={setSilhouetteC}
        />
        <FieldSelect
          label="Palette"
          value={palette}
          custom={paletteC}
          options={COSTUME_COLORS}
          allowEmpty
          onValue={setPalette}
          onCustom={setPaletteC}
        />
        <FieldSelect
          label="Signature"
          value={signature}
          custom={signatureC}
          options={signatureOpts}
          allowEmpty
          onValue={setSignature}
          onCustom={setSignatureC}
        />
      </div>
      <div className="layer-stack">
        <span className="field-label layer-title">Body layers (innermost first)</span>
        {bodyLayers.map((layer, i) => (
          <LayerBlock
            key={`body-${i}`}
            label={i === 0 ? "Layer 1 (innermost)" : `Layer ${i + 1}`}
            itemOpts={bodyLayerItemsFor(catKey, eraKey, gender)}
            layer={layer}
            showFit
            onRemove={
              bodyLayers.length > 1
                ? () => setBodyLayers((cur) => cur.filter((_, j) => j !== i))
                : undefined
            }
            onChange={(next) =>
              setBodyLayers((cur) => cur.map((row, j) => (j === i ? next : row)))
            }
          />
        ))}
        {bodyLayers.length < MAX_BODY_LAYERS ? (
          <button
            type="button"
            className="ghost add-layer"
            onClick={() => setBodyLayers((cur) => [...cur, emptyLayer()])}
          >
            + Layer
          </button>
        ) : (
          <p className="hint">Maximum {MAX_BODY_LAYERS} body layers.</p>
        )}
      </div>
      {SINGLE_SLOTS.map((key) => (
        <LayerBlock
          key={key}
          label={LAYER_LABEL[key] || key}
          itemOpts={layerItemsFor(key, catKey, eraKey, gender)}
          layer={slots[key] || emptyLayer()}
          onChange={(next) => setSlots((cur) => ({ ...cur, [key]: next }))}
        />
      ))}
      <label className="builder-field">
        <span className="field-label">Notes</span>
        <textarea
          className="prompt nowheel"
          rows={2}
          placeholder="Optional extras"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="prompt-actions">
        <button
          type="button"
          className="ghost"
          onClick={() => {
            const text = composeCostumeBrief(costumeFields, notes);
            setOutfitPrompt(text);
            setError(null);
            toast(text ? "Outfit prompt applied." : "Nothing to compose yet.");
          }}
        >
          Apply selection
        </button>
        <button
          type="button"
          className="ghost enhance"
          disabled={enhancing}
          onClick={() => {
            const raw = outfitText();
            setEnhancing(true);
            setError(null);
            void enhancePrompt(raw, models.t2iId)
              .then((text) => {
                setOutfitPrompt(text);
                toast("Outfit enhanced.");
              })
              .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : "Enhance failed.";
                setError(msg);
                toast(msg, true);
              })
              .finally(() => setEnhancing(false));
          }}
        >
          {enhancing ? "Enhancing…" : "Enhance"}
        </button>
      </div>
      <label className="builder-field">
        <span className="field-label">Outfit prompt</span>
        <textarea
          className="prompt nowheel"
          rows={5}
          placeholder="Apply selection composes the mannequin outfit here. Enhance rewrites this."
          value={outfitPrompt}
          onChange={(e) => setOutfitPrompt(e.target.value)}
        />
      </label>
      <ModelPickers models={models} />
      <p className="estimate">{estimate}</p>
      <div className="prompt-actions">
        {COSTUME_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            className="generate"
            onClick={() => openPlate(slot)}
          >
            Generate {SLOT_LABEL[slot] || slot}
          </button>
        ))}
      </div>
      <div className="prompt-actions">
        <button
          type="button"
          className="ghost"
          disabled={!haveFront || saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save Costume"}
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

function DressForm({
  data,
  builderId,
}: {
  data: CreatorBuilderNodeData;
  builderId: string;
}) {
  const [characters, setCharacters] = useState<StudioAsset[]>([]);
  const [costumes, setCostumes] = useState<StudioAsset[]>([]);
  const [characterId, setCharacterId] = useState(data.seedCharacterId || "");
  const [costumeId, setCostumeId] = useState(data.seedCostumeId || "");
  const [name, setName] = useState("");
  const [lockFace, setLockFace] = useState(false);
  const [useFullPacks, setUseFullPacks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const models = useSheetModels();
  const haveFront = Boolean(data.doneSlots?.front);
  const char = characters.find((c) => c.id === characterId);
  const costume = costumes.find((c) => c.id === costumeId);
  const r2iRow = models.r2i.find((m) => m.id === models.r2iId);
  const maxRefs = sheetR2iRefCap(r2iRow);
  const canFullPacks = maxRefs > 3;
  const hasCloseup = Boolean(char?.identity?.closeup);
  const estimate = useSheetEstimate("character", models.r2iId, models.r2iId, [...CORE_SLOTS], models);

  useEffect(() => {
    fetch("/assets?kind=character")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body: { items?: StudioAsset[] }) => {
        const rows = (body.items ?? []).filter((a) => !a.parent_id && a.has_still);
        setCharacters(rows);
        setCharacterId((cur) => cur || data.seedCharacterId || rows[0]?.id || "");
      })
      .catch(() => undefined);
    fetch("/assets?kind=costume")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body: { items?: StudioAsset[] }) => {
        const rows = body.items ?? [];
        setCostumes(rows);
        setCostumeId((cur) => cur || data.seedCostumeId || rows[0]?.id || "");
      })
      .catch(() => undefined);
  }, [data.seedCharacterId, data.seedCostumeId]);

  function dressFrontRefs(): string[] {
    return collectDressFrontRefs({
      characterIdentity: char?.identity,
      characterPrimarySlot: char?.primary_slot,
      characterStill: char?.still_path || "",
      costumeIdentity: costume?.identity,
      costumePrimarySlot: costume?.primary_slot,
      costumeStill: costume?.still_path || "",
      lockFace: lockFace && hasCloseup,
      useFullPacks: useFullPacks && canFullPacks,
    });
  }

  async function ensureVariant() {
    if (data.sessionAssetId) return data.sessionAssetId;
    if (!characterId || !costumeId) throw new Error("Pick a Character and a Costume.");
    const res = await fetch("/assets/dress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        character_id: characterId,
        costume_id: costumeId,
        name: name.trim(),
      }),
    });
    const body = await readJson<GenBody>(res);
    if (!res.ok || !body.item?.id) throw new Error(errOf(body, "Dress draft failed.", res));
    data.onSession?.({
      assetId: body.item.id,
      t2iModel: models.t2iId,
      r2iModel: models.r2iId || models.t2iId,
      slots: [...CORE_SLOTS],
      name: body.item.name,
      wardrobe: costume?.fields?.wardrobe || "",
    });
    return body.item.id;
  }

  function openAngle(slot: string) {
    if (!char) {
      setError("Pick a saved Character.");
      return;
    }
    if (!costume) {
      setError("Pick a saved Costume.");
      return;
    }
    const ident =
      char.fields?.identity_prompt ||
      composeCharacterIdentity(char.fields || {}, char.notes || "");
    const outfit = costume.fields?.wardrobe || costume.name;
    let sourceStill = "";
    let extra: string[] = [];
    if (slot === "front") {
      const refs = dressFrontRefs();
      if (refs.length < 2) {
        setError("Need Character Front (or primary) and Costume Front (or primary) stills.");
        return;
      }
      if (refs.length > maxRefs) {
        const label = r2iRow?.label || "This model";
        setError(
          `${label} allows at most ${maxRefs} reference images (this Dress Front would send ${refs.length}). Turn off “use full packs” or “lock face”.`,
        );
        return;
      }
      sourceStill = refs[0];
      extra = refs.slice(1);
    } else {
      const costumed = data.doneSlots?.front || "";
      if (!costumed) {
        setError("Generate costumed Front first.");
        return;
      }
      sourceStill = costumed;
      extra = [];
    }
    const sizes = sizeChoices(r2iRow);
    const quals = qualityChoices(r2iRow);
    void ensureVariant()
      .then((id) => {
        spawnAngleResult({
          builderId,
          slot,
          label: SLOT_LABEL[slot] || slot,
          prompt: composeDressPrompt(slot, ident, outfit, { hasFront: haveFront || slot !== "front" }),
          generating: false,
          error: null,
          focus: true,
          resolution: pickDefaultResolution(quals) || pickDefaultResolution(sizes),
          resolutionChoices: sizes,
          aspect: pickDefaultResolution(sizes),
          quality: pickDefaultResolution(quals),
          qualityChoices: quals,
          t2iModel: models.t2iId,
          r2iModel: models.r2iId || models.t2iId,
          assetId: id,
          sourceStill,
          extraRefs: extra,
          maxRefs,
          wardrobe: outfit,
          name: name.trim() || `${char.name} / ${costume.name}`,
        });
        setError(null);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Could not open angle.";
        setError(msg);
        toast(msg, true);
      });
  }

  async function save() {
    if (!haveFront) {
      setError("Generate costumed Front first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await ensureVariant();
      const res = await fetch("/assets/sheet/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: id,
          name: name.trim() || `${char?.name || "Character"} / ${costume?.name || "Costume"}`,
          fields: { costume_id: costumeId },
          require_front: true,
        }),
      });
      const body = await readJson<GenBody>(res);
      if (!res.ok || !body.item) throw new Error(errOf(body, "Save failed.", res));
      data.onSaved(body.item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="hint">
        Dress Front refs: Character Front + Costume Front
        {maxRefs >= 3 ? " (optional Close-up if lock face)" : ""}. Side / Close-up
        R2I from the new costumed Front only — not the full angle packs.
      </p>
      <label className="builder-field">
        <span className="field-label">Character</span>
        <select className="model" value={characterId} onChange={(e) => setCharacterId(e.target.value)}>
          {characters.length === 0 ? <option value="">No saved characters</option> : null}
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label || c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="builder-field">
        <span className="field-label">Costume</span>
        <select className="model" value={costumeId} onChange={(e) => setCostumeId(e.target.value)}>
          {costumes.length === 0 ? <option value="">No saved costumes</option> : null}
          {costumes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label || c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="builder-field">
        <span className="field-label">Variant name</span>
        <input
          className="model"
          value={name}
          placeholder={char && costume ? `${char.name} / ${costume.name}` : ""}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <ModelPickers models={models} r2iOnly />
      <label className="param">
        <span>
          <input
            type="checkbox"
            checked={lockFace && hasCloseup}
            disabled={!hasCloseup || maxRefs < 3}
            onChange={(e) => setLockFace(e.target.checked)}
          />{" "}
          Lock face
          {hasCloseup ? " (adds Character Close-up as 3rd ref)" : " (Character has no Close-up still)"}
        </span>
      </label>
      {canFullPacks ? (
        <label className="param">
          <span>
            <input
              type="checkbox"
              checked={useFullPacks}
              onChange={(e) => setUseFullPacks(e.target.checked)}
            />{" "}
            Use full packs (all character + costume angles)
          </span>
        </label>
      ) : null}
      <p className="estimate">
        {char && costume
          ? `Front will send ${dressFrontRefs().length} / ${maxRefs} refs. ${estimate}`
          : estimate}
      </p>
      <div className="prompt-actions">
        {CORE_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            className="generate"
            disabled={slot !== "front" && !haveFront}
            onClick={() => openAngle(slot)}
          >
            Generate {SLOT_LABEL[slot]}
          </button>
        ))}
      </div>
      <div className="prompt-actions">
        <button type="button" className="ghost" disabled={!haveFront || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save variant"}
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

function SceneForm({
  data,
  builderId,
}: {
  data: CreatorBuilderNodeData;
  builderId: string;
}) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("bar");
  const [locationC, setLocationC] = useState("");
  const [setting, setSetting] = useState("interior");
  const [settingC, setSettingC] = useState("");
  const [time, setTime] = useState("night");
  const [timeC, setTimeC] = useState("");
  const [weather, setWeather] = useState("");
  const [weatherC, setWeatherC] = useState("");
  const [mood, setMood] = useState("gritty");
  const [moodC, setMoodC] = useState("");
  const [architecture, setArchitecture] = useState("");
  const [architectureC, setArchitectureC] = useState("");
  const [lighting, setLighting] = useState("neon");
  const [lightingC, setLightingC] = useState("");
  const [camera, setCamera] = useState("wide establishing");
  const [cameraC, setCameraC] = useState("");
  const [elements, setElements] = useState("");
  const [furniture, setFurniture] = useState("");
  const [grade, setGrade] = useState("");
  const [gradeC, setGradeC] = useState("");
  const [notes, setNotes] = useState("");
  const [scenePrompt, setScenePrompt] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const models = useSheetModels();
  const slots = sheet ? ["front", "side"] : ["front"];
  const estimate = useSheetEstimate("scene", models.t2iId, models.r2iId, slots, models);
  const haveFront = Boolean(data.doneSlots?.front);
  function sceneFields() {
    return {
      name: name.trim(),
      location: pickField(location, locationC),
      setting: pickField(setting, settingC),
      time: pickField(time, timeC),
      weather: pickField(weather, weatherC),
      mood: pickField(mood, moodC),
      architecture: pickField(architecture, architectureC),
      lighting: pickField(lighting, lightingC),
      camera: pickField(camera, cameraC),
      elements: elements.trim(),
      furniture: furniture.trim(),
      grade: pickField(grade, gradeC),
    };
  }
  const settingVal = pickField(setting, settingC);
  const showWeather = settingVal === "exterior" || settingVal === "mixed";
  function sceneText() {
    return scenePrompt.trim() || composeSceneBrief(sceneFields(), notes);
  }

  async function ensureDraft() {
    const label = name.trim();
    if (!label) throw new Error("Name is required.");
    if (data.sessionAssetId) return data.sessionAssetId;
    const created = await fetch("/assets/sheet/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "scene",
        name: label,
        notes: notes.trim(),
        fields: { ...sceneFields(), prompt: sceneText(), notes: notes.trim() },
      }),
    });
    const draft = await readJson<GenBody>(created);
    if (!created.ok || !draft.item?.id) throw new Error(errOf(draft, "Create failed.", created));
    data.onSession?.({
      assetId: draft.item.id,
      t2iModel: models.t2iId,
      r2iModel: models.r2iId || models.t2iId,
      slots,
      name: label,
    });
    return draft.item.id;
  }

  function openAngle(slot: string) {
    void ensureDraft()
      .then((id) => {
        spawnAngleResult({
          builderId,
          slot,
          label: slot === "front" ? "Hero" : "Detail",
          prompt: composeSceneStill(sceneText(), { detail: slot !== "front" }),
          generating: false,
          error: null,
          focus: true,
          t2iModel: models.t2iId,
          r2iModel: models.r2iId || models.t2iId,
          assetId: id,
          sourceStill: slot === "front" ? "" : data.doneSlots?.front || "",
          name: name.trim() || "Scene",
        });
        setError(null);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Could not open Result.";
        setError(msg);
      });
  }

  async function save() {
    if (!haveFront) {
      setError("Generate the hero still first.");
      return;
    }
    setSaving(true);
    try {
      const id = await ensureDraft();
      const res = await fetch("/assets/sheet/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: id,
          name: name.trim(),
          notes: notes.trim(),
          fields: { ...sceneFields(), prompt: sceneText() },
          require_front: true,
        }),
      });
      const body = await readJson<GenBody>(res);
      if (!res.ok || !body.item) throw new Error(errOf(body, "Save failed.", res));
      data.onSaved(body.item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="hint">
        Apply selection builds the location prompt. Generate Hero on a Result node, then Save.
      </p>
      <label className="builder-field">
        <span className="field-label">Name</span>
        <input className="model" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="params">
        <FieldSelect
          label="Location"
          value={location}
          custom={locationC}
          options={SCENE_LOCATIONS}
          allowEmpty
          onValue={setLocation}
          onCustom={setLocationC}
        />
        <FieldSelect
          label="Interior / ext."
          value={setting}
          custom={settingC}
          options={["interior", "exterior", "mixed"]}
          allowEmpty
          onValue={(v) => {
            setSetting(v);
            if (v === "interior") {
              setWeather("");
              setWeatherC("");
            }
          }}
          onCustom={setSettingC}
        />
        <FieldSelect
          label="Time"
          value={time}
          custom={timeC}
          options={SCENE_TIMES}
          allowEmpty
          onValue={setTime}
          onCustom={setTimeC}
        />
      </div>
      <div className="params">
        {showWeather ? (
          <FieldSelect
            label="Weather"
            value={weather}
            custom={weatherC}
            options={SCENE_WEATHER}
            allowEmpty
            onValue={setWeather}
            onCustom={setWeatherC}
          />
        ) : null}
        <FieldSelect
          label="Mood"
          value={mood}
          custom={moodC}
          options={SCENE_MOODS}
          allowEmpty
          onValue={setMood}
          onCustom={setMoodC}
        />
        <FieldSelect
          label="Architecture"
          value={architecture}
          custom={architectureC}
          options={SCENE_ARCHITECTURE}
          allowEmpty
          onValue={setArchitecture}
          onCustom={setArchitectureC}
        />
      </div>
      <div className="params">
        <FieldSelect
          label="Lighting"
          value={lighting}
          custom={lightingC}
          options={SCENE_LIGHTING}
          allowEmpty
          onValue={setLighting}
          onCustom={setLightingC}
        />
        <FieldSelect
          label="Camera"
          value={camera}
          custom={cameraC}
          options={SCENE_CAMERA}
          allowEmpty
          onValue={setCamera}
          onCustom={setCameraC}
        />
      </div>
      <label className="builder-field">
        <span className="field-label">Key elements</span>
        <input
          className="model"
          value={elements}
          placeholder="neon sign, wet bar top, bottles…"
          onChange={(e) => setElements(e.target.value)}
        />
      </label>
      <label className="builder-field">
        <span className="field-label">Furniture / fixtures</span>
        <input
          className="model"
          value={furniture}
          placeholder="bar stools, booths, pendant lamps…"
          onChange={(e) => setFurniture(e.target.value)}
        />
      </label>
      <div className="params">
        <FieldSelect
          label="Color grade"
          value={grade}
          custom={gradeC}
          options={SCENE_GRADES}
          allowEmpty
          onValue={setGrade}
          onCustom={setGradeC}
        />
      </div>
      <label className="builder-field">
        <span className="field-label">Notes</span>
        <textarea
          className="prompt nowheel"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="prompt-actions">
        <button
          type="button"
          className="ghost"
          onClick={() => {
            const text = composeSceneBrief(sceneFields(), notes);
            setScenePrompt(text);
            setError(null);
            toast(text ? "Scene prompt applied." : "Nothing to compose yet.");
          }}
        >
          Apply selection
        </button>
        <button
          type="button"
          className="ghost enhance"
          disabled={enhancing}
          onClick={() => {
            setEnhancing(true);
            setError(null);
            void enhancePrompt(sceneText(), models.t2iId)
              .then((text) => {
                setScenePrompt(text);
                toast("Scene enhanced.");
              })
              .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : "Enhance failed.";
                setError(msg);
                toast(msg, true);
              })
              .finally(() => setEnhancing(false));
          }}
        >
          {enhancing ? "Enhancing…" : "Enhance"}
        </button>
      </div>
      <label className="builder-field">
        <span className="field-label">Scene prompt</span>
        <textarea
          className="prompt nowheel"
          rows={4}
          placeholder="Apply selection composes the location here."
          value={scenePrompt}
          onChange={(e) => setScenePrompt(e.target.value)}
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
        <button type="button" className="generate" onClick={() => openAngle("front")}>
          Generate Hero
        </button>
        {sheet ? (
          <button type="button" className="generate" disabled={!haveFront} onClick={() => openAngle("side")}>
            Generate Detail
          </button>
        ) : null}
        <button type="button" className="ghost" disabled={!haveFront || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save Scene"}
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

function PropForm({
  data,
  builderId,
}: {
  data: CreatorBuilderNodeData;
  builderId: string;
}) {
  const [name, setName] = useState("");
  const [ptype, setPtype] = useState("object");
  const [ptypeC, setPtypeC] = useState("");
  const [material, setMaterial] = useState("metal");
  const [materialC, setMaterialC] = useState("");
  const [color, setColor] = useState("");
  const [colorC, setColorC] = useState("");
  const [scale, setScale] = useState("handheld");
  const [scaleC, setScaleC] = useState("");
  const [condition, setCondition] = useState("");
  const [conditionC, setConditionC] = useState("");
  const [notes, setNotes] = useState("");
  const [propPrompt, setPropPrompt] = useState("");
  const [enhancing, setEnhancing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const models = useSheetModels();
  const haveFront = Boolean(data.doneSlots?.front);
  const estimate = useSheetEstimate("prop", models.t2iId, models.r2iId, ["front"], models);
  function propFields() {
    return {
      name: name.trim(),
      ptype: pickField(ptype, ptypeC),
      material: pickField(material, materialC),
      color: pickField(color, colorC),
      scale: pickField(scale, scaleC),
      condition: pickField(condition, conditionC),
    };
  }
  function propText() {
    return propPrompt.trim() || composePropBrief(propFields(), notes);
  }

  async function ensureDraft() {
    const label = name.trim();
    if (!label) throw new Error("Name is required.");
    if (data.sessionAssetId) return data.sessionAssetId;
    const created = await fetch("/assets/sheet/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "prop",
        name: label,
        notes: notes.trim(),
        fields: { ...propFields(), prompt: propText(), notes: notes.trim() },
      }),
    });
    const draft = await readJson<GenBody>(created);
    if (!created.ok || !draft.item?.id) throw new Error(errOf(draft, "Create failed.", created));
    data.onSession?.({
      assetId: draft.item.id,
      t2iModel: models.t2iId,
      r2iModel: models.r2iId || models.t2iId,
      slots: ["front"],
      name: label,
    });
    return draft.item.id;
  }

  function openStill() {
    void ensureDraft()
      .then((id) => {
        spawnAngleResult({
          builderId,
          slot: "front",
          label: "Still",
          prompt: composePropStill(propText()),
          generating: false,
          error: null,
          focus: true,
          t2iModel: models.t2iId,
          r2iModel: models.r2iId || models.t2iId,
          assetId: id,
          name: name.trim() || "Prop",
        });
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not open Result.");
      });
  }

  async function save() {
    if (!haveFront) {
      setError("Generate the still first.");
      return;
    }
    setSaving(true);
    try {
      const id = await ensureDraft();
      const res = await fetch("/assets/sheet/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset_id: id,
          name: name.trim(),
          notes: notes.trim(),
          fields: { ...propFields(), prompt: propText() },
          require_front: true,
        }),
      });
      const body = await readJson<GenBody>(res);
      if (!res.ok || !body.item) throw new Error(errOf(body, "Save failed.", res));
      data.onSaved(body.item);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="hint">
        Apply selection builds the prop prompt. Generate the still on a Result node, then Save.
      </p>
      <label className="builder-field">
        <span className="field-label">Name</span>
        <input className="model" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="params">
        <FieldSelect
          label="Type"
          value={ptype}
          custom={ptypeC}
          options={PROP_TYPES}
          allowEmpty
          onValue={setPtype}
          onCustom={setPtypeC}
        />
        <FieldSelect
          label="Material"
          value={material}
          custom={materialC}
          options={PROP_MATERIALS}
          allowEmpty
          onValue={setMaterial}
          onCustom={setMaterialC}
        />
        <FieldSelect
          label="Color"
          value={color}
          custom={colorC}
          options={COSTUME_COLORS}
          allowEmpty
          onValue={setColor}
          onCustom={setColorC}
        />
      </div>
      <div className="params">
        <FieldSelect
          label="Scale"
          value={scale}
          custom={scaleC}
          options={PROP_SCALES}
          allowEmpty
          onValue={setScale}
          onCustom={setScaleC}
        />
        <FieldSelect
          label="Condition"
          value={condition}
          custom={conditionC}
          options={PROP_CONDITIONS}
          allowEmpty
          onValue={setCondition}
          onCustom={setConditionC}
        />
      </div>
      <label className="builder-field">
        <span className="field-label">Notes</span>
        <textarea
          className="prompt nowheel"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="prompt-actions">
        <button
          type="button"
          className="ghost"
          onClick={() => {
            const text = composePropBrief(propFields(), notes);
            setPropPrompt(text);
            setError(null);
            toast(text ? "Prop prompt applied." : "Nothing to compose yet.");
          }}
        >
          Apply selection
        </button>
        <button
          type="button"
          className="ghost enhance"
          disabled={enhancing}
          onClick={() => {
            setEnhancing(true);
            setError(null);
            void enhancePrompt(propText(), models.t2iId)
              .then((text) => {
                setPropPrompt(text);
                toast("Prop enhanced.");
              })
              .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : "Enhance failed.";
                setError(msg);
                toast(msg, true);
              })
              .finally(() => setEnhancing(false));
          }}
        >
          {enhancing ? "Enhancing…" : "Enhance"}
        </button>
      </div>
      <label className="builder-field">
        <span className="field-label">Prop prompt</span>
        <textarea
          className="prompt nowheel"
          rows={4}
          placeholder="Apply selection composes the prop here."
          value={propPrompt}
          onChange={(e) => setPropPrompt(e.target.value)}
        />
      </label>
      <ModelPickers models={models} t2iOnly />
      <p className="estimate">{estimate}</p>
      <div className="prompt-actions">
        <button
          type="button"
          className="generate"
          onClick={openStill}
        >
          Generate still
        </button>
        <button
          type="button"
          className="ghost"
          disabled={!haveFront || saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save Prop"}
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

async function enhancePrompt(text: string, modelId: string): Promise<string> {
  const raw = text.trim();
  if (!raw) throw new Error("Apply selection first so Enhance has text to rewrite.");
  const res = await fetch("/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: raw,
      model_id: modelId,
      modality: "t2i",
      mode: "image",
    }),
  });
  const body = await readJson<GenBody>(res);
  const rewritten = (body.prompt || "").trim();
  if (!res.ok || body.ok === false || !rewritten) {
    throw new Error(errOf(body, "Enhance returned an empty reply.", res));
  }
  return rewritten;
}

type LayerState = {
  item: string;
  itemC: string;
  material: string;
  materialC: string;
  color: string;
  colorC: string;
  fit: string;
  fitC: string;
  condition: string;
  conditionC: string;
};

function emptyLayer(): LayerState {
  return {
    item: "",
    itemC: "",
    material: "",
    materialC: "",
    color: "",
    colorC: "",
    fit: "",
    fitC: "",
    condition: "",
    conditionC: "",
  };
}

function flattenLayer(key: string, layer: LayerState): Record<string, string> {
  return {
    [key]: pickField(layer.item, layer.itemC),
    [`${key}_material`]: pickField(layer.material, layer.materialC),
    [`${key}_color`]: pickField(layer.color, layer.colorC),
    [`${key}_fit`]: pickField(layer.fit, layer.fitC),
    [`${key}_condition`]: pickField(layer.condition, layer.conditionC),
  };
}

function FieldSelect({
  label,
  value,
  custom,
  options,
  onValue,
  onCustom,
  allowEmpty,
}: {
  label: string;
  value: string;
  custom: string;
  options: readonly string[] | string[];
  onValue: (v: string) => void;
  onCustom: (v: string) => void;
  allowEmpty?: boolean;
}) {
  const opts = Array.isArray(options) ? options.filter(Boolean) : [];
  const known = opts.includes(value) || value === "Custom" || (allowEmpty && value === "");
  const safe = known ? value : allowEmpty ? "" : opts[0] || "";
  return (
    <label className="param">
      <span>{label}</span>
      <select
        className="model"
        value={safe}
        onChange={(e) => onValue(e.target.value)}
      >
        {allowEmpty ? <option value="">—</option> : null}
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

function LayerBlock({
  label,
  itemOpts,
  layer,
  onChange,
  showFit,
  onRemove,
}: {
  label: string;
  itemOpts: readonly string[];
  layer: LayerState;
  onChange: (next: LayerState) => void;
  showFit?: boolean;
  onRemove?: () => void;
}) {
  const set = (patch: Partial<LayerState>) => onChange({ ...layer, ...patch });
  return (
    <div className="layer-block">
      <div className="layer-head">
        <span className="field-label layer-title">{label}</span>
        {onRemove ? (
          <button type="button" className="ghost layer-remove" onClick={onRemove}>
            Remove
          </button>
        ) : null}
      </div>
      <div className={`params costume-layer-row${showFit ? " has-fit" : ""}`}>
        <FieldSelect
          label="Item"
          value={layer.item}
          custom={layer.itemC}
          options={itemOpts}
          allowEmpty
          onValue={(v) => set({ item: v })}
          onCustom={(v) => set({ itemC: v })}
        />
        <FieldSelect
          label="Material"
          value={layer.material}
          custom={layer.materialC}
          options={COSTUME_MATERIALS}
          allowEmpty
          onValue={(v) => set({ material: v })}
          onCustom={(v) => set({ materialC: v })}
        />
        <FieldSelect
          label="Color"
          value={layer.color}
          custom={layer.colorC}
          options={COSTUME_COLORS}
          allowEmpty
          onValue={(v) => set({ color: v })}
          onCustom={(v) => set({ colorC: v })}
        />
        <FieldSelect
          label="Condition"
          value={layer.condition}
          custom={layer.conditionC}
          options={COSTUME_CONDITIONS}
          allowEmpty
          onValue={(v) => set({ condition: v })}
          onCustom={(v) => set({ conditionC: v })}
        />
        {showFit ? (
          <FieldSelect
            label="Fit"
            value={layer.fit}
            custom={layer.fitC}
            options={COSTUME_FITS}
            allowEmpty
            onValue={(v) => set({ fit: v })}
            onCustom={(v) => set({ fitC: v })}
          />
        ) : null}
      </div>
    </div>
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
