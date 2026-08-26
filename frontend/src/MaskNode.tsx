import { useCallback, useEffect, useRef, useState, type PointerEvent as PE } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import { openLightbox } from "./lightbox";
import { toast } from "./toast";
import {
  MASK_BOX_COLORS,
  type LibraryItem,
  type MaskApi,
  type MaskBox,
  type MaskNodeData,
  type MaskRasterResult,
} from "./types";

export type MaskFlowNode = Node<MaskNodeData, "mask">;

const MAX_BOXES = 8;
const BOX_COLORS = MASK_BOX_COLORS;
const MASK_HINT =
  "White = edit, black = keep. Mask must be the same pixel size as the source still.";

type Mode = "boxes" | "brush";
type View = "source" | "mask" | "overlay";
type Corner = "nw" | "ne" | "sw" | "se";
type Drag =
  | { kind: "new"; x0: number; y0: number }
  | { kind: "move"; id: string; x0: number; y0: number; bx: number; by: number }
  | { kind: "resize"; id: string; corner: Corner; start: MaskBox }
  | { kind: "brush"; lastX: number; lastY: number };

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function normBox(x0: number, y0: number, x1: number, y1: number): MaskBox {
  const x = Math.min(x0, x1);
  const y = Math.min(y0, y1);
  return {
    id: `box-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    x,
    y,
    w: Math.abs(x1 - x0),
    h: Math.abs(y1 - y0),
    label: "",
  };
}

function clientToNorm(event: { clientX: number; clientY: number }, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const w = r.width || 1;
  const h = r.height || 1;
  return {
    x: clamp01((event.clientX - r.left) / w),
    y: clamp01((event.clientY - r.top) / h),
  };
}

function stillSrc(item: LibraryItem | null | undefined) {
  return item?.url || item?.thumb_url || "";
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load still."));
    img.src = src;
  });
}

function labelSuffix(boxes: MaskBox[]) {
  const labels = boxes.map((b) => b.label.trim()).filter(Boolean);
  if (!labels.length) return "";
  return `In the marked regions: ${labels.join(", ")}. Do not change unmarked areas.`;
}

function isFullyBlack(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 16 || data[i + 1] > 16 || data[i + 2] > 16) return false;
  }
  return true;
}

function invertCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function growWhite(ctx: CanvasRenderingContext2D, w: number, h: number, radius: number) {
  if (radius <= 0) return;
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  tctx.filter = `blur(${Math.max(1, radius)}px)`;
  tctx.drawImage(ctx.canvas, 0, 0);
  tctx.filter = "none";
  const img = tctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] > 12 ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

async function uploadMaskPng(blob: Blob): Promise<LibraryItem> {
  const form = new FormData();
  form.append("files", blob, "mask.png");
  const res = await fetch("/library/import", { method: "POST", body: form });
  const body = (await res.json()) as {
    ok?: boolean;
    items?: LibraryItem[];
    errors?: string[];
    detail?: string;
  };
  if (!res.ok || !body.items?.[0]) {
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : body.errors?.join(" · ") || "Could not save mask PNG.",
    );
  }
  return body.items[0];
}

export default function MaskNode({ data }: NodeProps<MaskFlowNode>) {
  const source = data.source;
  const srcUrl = stillSrc(source);
  const [mode, setMode] = useState<Mode>("boxes");
  const [view, setView] = useState<View>("overlay");
  const [boxes, setBoxes] = useState<MaskBox[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<MaskBox | null>(null);
  const [invert, setInvert] = useState(false);
  const [grow, setGrow] = useState(0);
  const [brushSize, setBrushSize] = useState(28);
  const [eraser, setEraser] = useState(false);
  const [hardness, setHardness] = useState(0.85);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const brushRef = useRef<HTMLCanvasElement | null>(null);
  const undoRef = useRef<ImageData | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;
  const invertRef = useRef(invert);
  invertRef.current = invert;
  const growRef = useRef(grow);
  growRef.current = grow;
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const natRef = useRef(nat);
  natRef.current = nat;

  useEffect(() => {
    if (!srcUrl) {
      setNat(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setNat({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.src = srcUrl;
  }, [srcUrl]);

  useEffect(() => {
    setBoxes([]);
    setSelected(null);
    setDraft(null);
    undoRef.current = null;
    const c = brushRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
  }, [source?.path]);

  useEffect(() => {
    const c = brushRef.current;
    if (!c || !nat) return;
    if (c.width !== nat.w || c.height !== nat.h) {
      c.width = nat.w;
      c.height = nat.h;
    }
  }, [nat]);

  const brushHasPaint = useCallback(() => {
    const c = brushRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !c.width || !c.height) return false;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 8) return true;
    }
    return false;
  }, []);

  const hasContent = useCallback(
    () => boxesRef.current.length > 0 || brushHasPaint(),
    [brushHasPaint],
  );

  const boxesFn = useCallback(() => boxesRef.current, []);

  const rasterize = useCallback(async (): Promise<MaskRasterResult> => {
    const still = sourceRef.current;
    const url = stillSrc(still);
    const suffix = labelSuffix(boxesRef.current);
    if (!url || !still) return { item: null, suffix: "" };
    const img = await loadImage(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w < 1 || h < 1) return { item: null, suffix: "" };
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { item: null, suffix: "" };
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    for (const b of boxesRef.current) {
      ctx.fillRect(b.x * w, b.y * h, b.w * w, b.h * h);
    }
    const brush = brushRef.current;
    if (brush && brush.width && brush.height) {
      ctx.drawImage(brush, 0, 0, w, h);
    }
    if (invertRef.current) invertCanvas(ctx, w, h);
    growWhite(ctx, w, h, growRef.current);
    if (isFullyBlack(ctx, w, h)) return { item: null, suffix: "" };
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error("Could not encode mask PNG.");
    const item = await uploadMaskPng(blob);
    return { item, suffix };
  }, []);

  const suffixFn = useCallback(() => labelSuffix(boxesRef.current), []);

  useEffect(() => {
    const api: MaskApi = {
      rasterize,
      suffix: suffixFn,
      boxes: boxesFn,
      hasContent,
    };
    data.onRegister?.(api);
    return () => data.onRegister?.(null);
  }, [data.onRegister, rasterize, suffixFn, boxesFn, hasContent]);

  useEffect(() => {
    data.onContent?.(boxes.length > 0 || brushHasPaint());
  }, [boxes, data.onContent, brushHasPaint]);

  function paintBrush(x: number, y: number, last?: { x: number; y: number }) {
    const c = brushRef.current;
    const ctx = c?.getContext("2d");
    const n = natRef.current;
    if (!c || !ctx || !n) return;
    const px = x * n.w;
    const py = y * n.h;
    const size = brushSize;
    const pts = last
      ? interpolate(last.x * n.w, last.y * n.h, px, py, Math.max(2, size / 3))
      : [{ x: px, y: py }];
    ctx.save();
    ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
    for (const p of pts) {
      const rad = size / 2;
      if (hardness >= 0.92) {
        ctx.fillStyle = eraser ? "rgba(0,0,0,1)" : "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(
          p.x,
          p.y,
          Math.max(0.5, rad * hardness),
          p.x,
          p.y,
          rad,
        );
        g.addColorStop(0, eraser ? "rgba(0,0,0,1)" : "rgba(255,255,255,1)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function onStagePointerDown(event: PE<HTMLDivElement>) {
    event.stopPropagation();
    if (data.disabled) return;
    if (event.button !== 0) return;
    const stage = stageRef.current;
    if (!stage) return;
    const p = clientToNorm(event, stage);
    if (mode === "brush") {
      const ctx = brushRef.current?.getContext("2d");
      if (ctx && brushRef.current) {
        undoRef.current = ctx.getImageData(
          0,
          0,
          brushRef.current.width,
          brushRef.current.height,
        );
      }
      dragRef.current = { kind: "brush", lastX: p.x, lastY: p.y };
      paintBrush(p.x, p.y);
      data.onContent?.(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const hit = hitBox(boxes, p.x, p.y);
    if (hit) {
      setSelected(hit.id);
      dragRef.current = {
        kind: "move",
        id: hit.id,
        x0: p.x,
        y0: p.y,
        bx: hit.x,
        by: hit.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (boxes.length >= MAX_BOXES) {
      toast(`At most ${MAX_BOXES} boxes.`, true);
      return;
    }
    dragRef.current = { kind: "new", x0: p.x, y0: p.y };
    setSelected(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onStagePointerMove(event: PE<HTMLDivElement>) {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const p = clientToNorm(event, stage);
    if (drag.kind === "brush") {
      paintBrush(p.x, p.y, { x: drag.lastX, y: drag.lastY });
      dragRef.current = { kind: "brush", lastX: p.x, lastY: p.y };
      return;
    }
    if (drag.kind === "new") {
      const b = normBox(drag.x0, drag.y0, p.x, p.y);
      b.id = "draft";
      setDraft(b);
      return;
    }
    if (drag.kind === "move") {
      setBoxes((cur) =>
        cur.map((b) => {
          if (b.id !== drag.id) return b;
          const nx = clamp01(drag.bx + (p.x - drag.x0));
          const ny = clamp01(drag.by + (p.y - drag.y0));
          return {
            ...b,
            x: Math.min(nx, 1 - b.w),
            y: Math.min(ny, 1 - b.h),
          };
        }),
      );
      return;
    }
    if (drag.kind === "resize") {
      setBoxes((cur) =>
        cur.map((b) => (b.id === drag.id ? resizeBox(drag.start, drag.corner, p) : b)),
      );
    }
  }

  function onStagePointerUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === "new" && draft && draft.w > 0.012 && draft.h > 0.012) {
      const next = { ...draft, id: normBox(0, 0, 1, 1).id };
      setBoxes((cur) => (cur.length >= MAX_BOXES ? cur : [...cur, next]));
      setSelected(next.id);
    }
    setDraft(null);
  }

  function startResize(id: string, corner: Corner, event: PE<HTMLSpanElement>) {
    event.stopPropagation();
    event.preventDefault();
    const box = boxes.find((b) => b.id === id);
    if (!box) return;
    dragRef.current = { kind: "resize", id, corner, start: { ...box } };
    stageRef.current?.setPointerCapture(event.pointerId);
  }

  function clearMask() {
    setBoxes([]);
    setSelected(null);
    setDraft(null);
    undoRef.current = null;
    const c = brushRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    data.onContent?.(false);
  }

  function undoStroke() {
    const c = brushRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !undoRef.current) return;
    ctx.putImageData(undoRef.current, 0, 0);
    undoRef.current = null;
  }

  async function applyMask() {
    if (data.disabled) return;
    try {
      const out = await rasterize();
      if (!out.item && !out.suffix) {
        toast("Nothing marked — treated as no mask.");
        return;
      }
      toast("Mask ready — Generate on Prompt.");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Could not apply mask.", true);
    }
  }

  const shown = draft ? [...boxes.filter((b) => b.id !== "draft"), draft] : boxes;
  const ar = nat && nat.h > 0 ? nat.w / nat.h : 1;
  const disabled = Boolean(data.disabled);

  return (
    <div className="studio-node mask-node">
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">
        <span>MASK</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag nopan">
        {disabled ? (
          <p className="hint warn">{data.disabledNote || "Mask is single-ref only on this model"}</p>
        ) : null}
        {!srcUrl ? (
          <p className="hint warn">Attach a source still first.</p>
        ) : (
          <div
            ref={stageRef}
            className={`mask-stage nodrag nopan nowheel mode-${mode} view-${view}${disabled ? " is-disabled" : ""}`}
            style={{ ["--still-ar" as string]: String(ar) }}
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            onPointerCancel={onStagePointerUp}
            onDoubleClick={() => {
              if (!srcUrl) return;
              openLightbox({ src: srcUrl, kind: "image", title: source?.name || "Source" });
            }}
          >
            <img className="mask-src" src={srcUrl} alt="" draggable={false} />
            <canvas ref={brushRef} className="mask-brush" />
            {shown.map((b, i) => (
              <div
                key={b.id}
                className={b.id === selected ? "mask-box on" : "mask-box"}
                style={{
                  left: `${b.x * 100}%`,
                  top: `${b.y * 100}%`,
                  width: `${b.w * 100}%`,
                  height: `${b.h * 100}%`,
                  ["--box-color" as string]: BOX_COLORS[i % BOX_COLORS.length],
                }}
                onPointerDown={(e) => {
                  if (mode !== "boxes" || disabled) return;
                  e.stopPropagation();
                  const stage = stageRef.current;
                  if (!stage) return;
                  const p = clientToNorm(e, stage);
                  setSelected(b.id);
                  dragRef.current = {
                    kind: "move",
                    id: b.id,
                    x0: p.x,
                    y0: p.y,
                    bx: b.x,
                    by: b.y,
                  };
                  stage.setPointerCapture(e.pointerId);
                }}
              >
                {b.id === selected && mode === "boxes"
                  ? (["nw", "ne", "sw", "se"] as Corner[]).map((c) => (
                      <span
                        key={c}
                        className={`mask-handle ${c}`}
                        onPointerDown={(e) => startResize(b.id, c, e)}
                      />
                    ))
                  : null}
              </div>
            ))}
          </div>
        )}
        <div className="mask-toggles">
          <div className="pills" role="tablist" aria-label="Mask mode">
            <button
              type="button"
              className={mode === "boxes" ? "pill on" : "pill"}
              disabled={disabled}
              onClick={() => setMode("boxes")}
            >
              Boxes
            </button>
            <button
              type="button"
              className={mode === "brush" ? "pill on" : "pill"}
              disabled={disabled}
              onClick={() => setMode("brush")}
            >
              Brush
            </button>
          </div>
          <div className="pills" role="tablist" aria-label="Mask preview">
            {(["source", "mask", "overlay"] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                className={view === v ? "pill on" : "pill"}
                onClick={() => setView(v)}
              >
                {v === "source" ? "Source" : v === "mask" ? "Mask" : "Overlay"}
              </button>
            ))}
          </div>
        </div>
        {mode === "brush" ? (
          <div className="mask-brush-params">
            <label className="param">
              <span>Brush {brushSize}px</span>
              <input
                className="nowheel"
                type="range"
                min={4}
                max={96}
                value={brushSize}
                disabled={disabled}
                onChange={(e) => setBrushSize(Number(e.target.value))}
              />
            </label>
            <label className="param">
              <span>Hardness</span>
              <input
                className="nowheel"
                type="range"
                min={0}
                max={100}
                value={Math.round(hardness * 100)}
                disabled={disabled}
                onChange={(e) => setHardness(Number(e.target.value) / 100)}
              />
            </label>
            <label className="param check">
              <input
                type="checkbox"
                checked={eraser}
                disabled={disabled}
                onChange={(e) => setEraser(e.target.checked)}
              />
              <span>Eraser</span>
            </label>
            <button type="button" className="ghost nodrag" disabled={disabled} onClick={undoStroke}>
              Undo stroke
            </button>
          </div>
        ) : null}
        {shown.length ? (
          <ul className="mask-box-list">
            {boxes.map((b, i) => (
              <li key={b.id} className={b.id === selected ? "on" : ""}>
                <span
                  className="mask-swatch"
                  style={{ background: BOX_COLORS[i % BOX_COLORS.length] }}
                />
                <input
                  className="nodrag nowheel"
                  value={b.label}
                  disabled={disabled}
                  placeholder="label (optional)"
                  onFocus={() => setSelected(b.id)}
                  onChange={(e) =>
                    setBoxes((cur) =>
                      cur.map((row) =>
                        row.id === b.id ? { ...row, label: e.target.value } : row,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="ghost nodrag"
                  disabled={disabled}
                  onClick={() => {
                    setBoxes((cur) => cur.filter((row) => row.id !== b.id));
                    if (selected === b.id) setSelected(null);
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mask-actions">
          <button type="button" className="ghost nodrag" disabled={disabled} onClick={clearMask}>
            Clear mask
          </button>
          <label className="param check">
            <input
              type="checkbox"
              checked={invert}
              disabled={disabled}
              onChange={(e) => setInvert(e.target.checked)}
            />
            <span>Invert</span>
          </label>
          <label className="param">
            <span>Grow {grow}px</span>
            <input
              className="nowheel"
              type="range"
              min={0}
              max={24}
              value={grow}
              disabled={disabled}
              onChange={(e) => setGrow(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="ghost nodrag"
            disabled={disabled || !srcUrl}
            onClick={() => void applyMask()}
          >
            Apply mask
          </button>
        </div>
        <p className="hint" title={MASK_HINT}>
          {MASK_HINT} No extra API cost.
        </p>
      </div>
      <Handle type="source" position={Position.Right} className="node-handle" />
    </div>
  );
}

function hitBox(boxes: MaskBox[], x: number, y: number): MaskBox | null {
  for (let i = boxes.length - 1; i >= 0; i -= 1) {
    const b = boxes[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

function resizeBox(
  start: MaskBox,
  corner: Corner,
  p: { x: number; y: number },
): MaskBox {
  let x1 = start.x;
  let y1 = start.y;
  let x2 = start.x + start.w;
  let y2 = start.y + start.h;
  if (corner === "nw") {
    x1 = p.x;
    y1 = p.y;
  } else if (corner === "ne") {
    x2 = p.x;
    y1 = p.y;
  } else if (corner === "sw") {
    x1 = p.x;
    y2 = p.y;
  } else {
    x2 = p.x;
    y2 = p.y;
  }
  const x = clamp01(Math.min(x1, x2));
  const y = clamp01(Math.min(y1, y2));
  const w = Math.max(0.01, Math.abs(x2 - x1));
  const h = Math.max(0.01, Math.abs(y2 - y1));
  return { ...start, x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}

function interpolate(x0: number, y0: number, x1: number, y1: number, step: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const n = Math.max(1, Math.ceil(dist / step));
  const out: { x: number; y: number }[] = [];
  for (let i = 1; i <= n; i += 1) {
    const t = i / n;
    out.push({ x: x0 + dx * t, y: y0 + dy * t });
  }
  return out;
}
