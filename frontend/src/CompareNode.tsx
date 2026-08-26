import { useMemo, useState, type CSSProperties, type SyntheticEvent } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import NodeClose from "./NodeClose";
import { openLightbox } from "./lightbox";
import type { CompareNodeData, LibraryItem } from "./types";

export type CompareFlowNode = Node<CompareNodeData, "compare">;

function stillSrc(item: LibraryItem | null | undefined): string {
  if (!item) return "";
  return item.url || item.thumb_url || "";
}

export default function CompareNode({ data }: NodeProps<CompareFlowNode>) {
  const [opacity, setOpacity] = useState(50);
  const [overlayOn, setOverlayOn] = useState(true);
  const [swapped, setSwapped] = useState(false);
  const [aspect, setAspect] = useState<number | null>(null);

  const sourceSrc = stillSrc(data.source);
  const resultSrc = stillSrc(data.result);
  const bottom = swapped ? data.result : data.source;
  const top = swapped ? data.source : data.result;
  const bottomSrc = stillSrc(bottom);
  const topSrc = stillSrc(top);
  const topOpacity = overlayOn ? opacity / 100 : 0;

  const arStyle = useMemo(
    () =>
      ({
        ["--still-ar" as string]: aspect && aspect > 0 ? String(aspect) : "1",
      }) as CSSProperties,
    [aspect],
  );

  function noteAspect(event: SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w > 0 && h > 0) setAspect(w / h);
  }

  function enlarge() {
    const item = topOpacity > 0.5 ? top : bottom;
    const src = stillSrc(item);
    if (!src) return;
    openLightbox({
      src,
      kind: "image",
      title: item === data.result ? "Result" : "Source",
    });
  }

  return (
    <div className="studio-node compare-node">
      <Handle type="target" position={Position.Left} className="node-handle" />
      <div className="node-header">
        <span>Compare Source</span>
        <NodeClose onClose={data.onClose} />
      </div>
      <div className="node-body nodrag nopan">
        <div
          className="compare-stack"
          style={arStyle}
          onDoubleClick={enlarge}
          title="Double-click to enlarge"
        >
          {bottomSrc ? (
            <img
              className="compare-bottom"
              src={bottomSrc}
              alt={bottom.name || "Source"}
              draggable={false}
              onLoad={noteAspect}
            />
          ) : null}
          {topSrc ? (
            <img
              className="compare-top"
              src={topSrc}
              alt={top.name || "Result"}
              draggable={false}
              style={{ opacity: topOpacity }}
              onLoad={noteAspect}
            />
          ) : null}
          {!sourceSrc || !resultSrc ? (
            <p className="hint">Missing still for overlay.</p>
          ) : null}
        </div>
        <label className="compare-slider">
          <span>Opacity {opacity}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={opacity}
            disabled={!overlayOn}
            onChange={(e) => setOpacity(Number(e.target.value))}
          />
        </label>
        <div className="compare-actions">
          <button
            type="button"
            className="ghost nodrag"
            onClick={() => setOverlayOn((v) => !v)}
          >
            Overlay {overlayOn ? "on" : "off"}
          </button>
          <button
            type="button"
            className="ghost nodrag"
            onClick={() => setSwapped((v) => !v)}
          >
            Swap
          </button>
        </div>
        <p className="hint">
          {overlayOn
            ? swapped
              ? "Source over result"
              : "Result over source"
            : swapped
              ? "Overlay off — result only"
              : "Overlay off — source only"}
        </p>
      </div>
    </div>
  );
}
