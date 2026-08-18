import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  consumeLibraryDrag,
  itemMediaKind,
  peekLibraryDrag,
  slotAccepts,
  slotNeedLabel,
} from "./libraryDrag";
import { toast } from "./toast";
import {
  hasLibraryPayload,
  type LibraryItem,
} from "./types";

export const ALEPH_MIN_S = 2;
export const ALEPH_MAX_S = 30;
export const ALEPH_MAX_PINS = 5;

export type FramePin = {
  id: string;
  timestamp_s: number;
  pin: "first" | "last" | "timestamp";
  image: LibraryItem;
};

type Props = {
  source: LibraryItem | null;
  pins: FramePin[];
  onPinsChange: (pins: FramePin[]) => void;
  onDuration: (seconds: number) => void;
  hasRunwareKey: boolean;
  onOpenSettings?: () => void;
  onAddSource: () => void;
  onAttachSource?: (item: LibraryItem) => void;
  preparing?: boolean;
};

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.00";
  const m = Math.floor(seconds / 60);
  const rem = seconds - m * 60;
  const whole = Math.floor(rem);
  const frac = Math.round((rem - whole) * 100);
  const sec = frac === 100 ? whole + 1 : whole;
  const cs = frac === 100 ? 0 : frac;
  return `${m}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function pinKind(t: number, duration: number): FramePin["pin"] {
  if (t <= 0.05) return "first";
  if (duration > 0 && t >= duration - 0.08) return "last";
  return "timestamp";
}

export default function FrameEdit({
  source,
  pins,
  onPinsChange,
  onDuration,
  hasRunwareKey,
  onOpenSettings,
  onAddSource,
  onAttachSource,
  preparing,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [jumps, setJumps] = useState<{ t: number; url: string }[]>([]);
  const [hover, setHover] = useState<"ok" | "bad" | null>(null);

  const src = typeof source?.url === "string" ? source.url : "";
  const hasVideo = itemMediaKind(source) === "video" && Boolean(src);

  useEffect(() => {
    setCurrent(0);
    setDuration(0);
    setPlaying(false);
    setJumps([]);
    onDuration?.(0);
  }, [source?.path, onDuration]);

  function syncFromVideo() {
    const el = videoRef.current;
    if (!el || el.readyState < 1) return;
    const t = Number(el.currentTime);
    const d = Number(el.duration);
    if (Number.isFinite(t) && t >= 0) setCurrent(t);
    if (Number.isFinite(d) && d > 0) {
      setDuration(d);
      onDuration?.(d);
    }
    setPlaying(!el.paused);
  }

  async function pinCurrent() {
    if (!source?.path || pinning) return;
    if (pins.length >= ALEPH_MAX_PINS) {
      toast(`Aleph allows at most ${ALEPH_MAX_PINS} pins.`, true);
      return;
    }
    const el = videoRef.current;
    const raw =
      el && el.readyState >= 1 && Number.isFinite(el.currentTime)
        ? el.currentTime
        : current;
    const t = Math.max(0, Math.round(raw * 100) / 100);
    const near = pins.find((p) => Math.abs(p.timestamp_s - t) < 0.05);
    setPinning(true);
    try {
      const res = await fetch("/extract-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_path: source.path, seconds: t }),
      });
      const body = (await res.json()) as LibraryItem & {
        ok?: boolean;
        detail?: string;
        timestamp_s?: number;
      };
      if (!res.ok) {
        toast(
          typeof body.detail === "string"
            ? body.detail
            : "Could not extract this frame.",
          true,
        );
        return;
      }
      const pin: FramePin = {
        id: near?.id || `pin-${Date.now().toString(36)}`,
        timestamp_s: body.timestamp_s ?? t,
        pin: pinKind(body.timestamp_s ?? t, duration),
        image: body,
      };
      if (near) {
        onPinsChange(pins.map((p) => (p.id === near.id ? pin : p)));
      } else {
        onPinsChange(
          [...pins, pin].sort((a, b) => a.timestamp_s - b.timestamp_s),
        );
      }
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Pin failed.", true);
    } finally {
      setPinning(false);
    }
  }

  function seekTo(t: number) {
    const el = videoRef.current;
    if (!el || el.readyState < 1) return;
    const cap = duration > 0 ? duration : t;
    const next = Math.max(0, Math.min(cap, t));
    try {
      el.currentTime = next;
    } catch (err) {
      console.error("Frame seek failed", err);
      return;
    }
    setCurrent(next);
  }

  function togglePlay() {
    const el = videoRef.current;
    if (!el || el.readyState < 1) return;
    if (el.paused) void el.play().catch((err) => console.error("Frame play failed", err));
    else el.pause();
  }

  function replacePin(id: string, item: LibraryItem) {
    onPinsChange(
      pins.map((p) => (p.id === id ? { ...p, image: item } : p)),
    );
  }

  const outOfRange =
    duration > 0 && duration + 0.05 < ALEPH_MIN_S;
  const willTrim = duration > ALEPH_MAX_S + 0.25;

  function allowVideoDrop(event: DragEvent) {
    if (!peekLibraryDrag() && !hasLibraryPayload(event.dataTransfer)) return false;
    event.preventDefault();
    event.stopPropagation();
    const item = peekLibraryDrag();
    const ok = item ? slotAccepts("video", item) : true;
    event.dataTransfer.dropEffect = ok ? "copy" : "none";
    return true;
  }

  function onVideoDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    setHover(null);
    const item = consumeLibraryDrag() || peekLibraryDrag();
    if (!item) return;
    if (!slotAccepts("video", item)) {
      toast(slotNeedLabel("video"), true);
      return;
    }
    onAddSource();
    onAttachSource?.(item);
  }

  return (
    <div className="frame-edit">
      <div className="req-row">
        <span className="req-badge">Requires Runware</span>
        {!hasRunwareKey ? (
          <button
            type="button"
            className="ghost nodrag"
            onClick={() => onOpenSettings?.()}
          >
            Settings
          </button>
        ) : null}
      </div>
      {!hasRunwareKey ? (
        <p className="hint warn" role="alert">
          Runware / Aleph API key is not set. Open Settings and paste your
          Runware key — Frame generate will not run without it.
        </p>
      ) : null}

      {preparing ? (
        <p className="hint">Preparing clip for Aleph…</p>
      ) : null}

      {hasVideo ? (
        <>
          <div
            className={
              hover === "ok"
                ? "frame-preview drop-hot"
                : hover === "bad"
                  ? "frame-preview drop-bad"
                  : "frame-preview"
            }
            data-drop-slot="source"
            data-drop-accept="video"
            onDragEnter={(e) => {
              if (!allowVideoDrop(e)) return;
              const item = peekLibraryDrag();
              setHover(item && !slotAccepts("video", item) ? "bad" : "ok");
            }}
            onDragOver={(e) => {
              if (!allowVideoDrop(e)) return;
              const item = peekLibraryDrag();
              setHover(item && !slotAccepts("video", item) ? "bad" : "ok");
            }}
            onDragLeave={(e) => {
              const next = e.relatedTarget as globalThis.Node | null;
              if (next && e.currentTarget.contains(next)) return;
              setHover(null);
            }}
            onDrop={onVideoDrop}
          >
            <video
              ref={videoRef}
              src={src}
              playsInline
              preload="metadata"
              draggable={false}
              onLoadedMetadata={syncFromVideo}
              onLoadedData={syncFromVideo}
              onDurationChange={syncFromVideo}
              onTimeUpdate={syncFromVideo}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onClick={togglePlay}
            />
          </div>
          {duration > 0 ? (
          <input
            type="range"
            className="frame-scrub nodrag nowheel"
            min={0}
            max={duration}
            step={0.01}
            value={Math.min(current, duration)}
            onChange={(e) => seekTo(Number(e.target.value))}
            aria-label="Scrub source video"
          />
          ) : (
            <p className="hint">Loading clip metadata…</p>
          )}
          <div className="frame-transport">
            <button type="button" className="ghost nodrag" onClick={togglePlay}>
              {playing ? "Pause" : "Play"}
            </button>
            <span className="hint">
              {formatClock(current)} / {formatClock(duration)}
            </span>
            <button
              type="button"
              className="ghost nodrag"
              disabled={pinning || pins.length >= ALEPH_MAX_PINS}
              onClick={() => void pinCurrent()}
            >
              {pinning ? "Pinning…" : `Pin current frame · t=${current.toFixed(2)}s`}
            </button>
          </div>
          <JumpThumbs src={src} duration={duration} onJump={seekTo} thumbs={jumps} setThumbs={setJumps} />
          {outOfRange ? (
            <p className="hint warn">
              Aleph needs at least {ALEPH_MIN_S}s (yours is {duration.toFixed(1)}s).
            </p>
          ) : willTrim ? (
            <p className="hint">
              Clip is {duration.toFixed(1)}s — Aleph will use the first {ALEPH_MAX_S}s.
            </p>
          ) : (
            <p className="hint">
              Output length follows the source ({ALEPH_MIN_S}–{ALEPH_MAX_S}s). Up to{" "}
              {ALEPH_MAX_PINS} pins. Oversize clips are auto-prepared.
            </p>
          )}
        </>
      ) : (
        <div
          className={
            hover === "ok"
              ? "source-empty nodrag drop-hot"
              : hover === "bad"
                ? "source-empty nodrag drop-bad"
                : "source-empty nodrag"
          }
          role="button"
          tabIndex={0}
          data-drop-slot="source"
          data-drop-accept="video"
          onClick={onAddSource}
          onDragEnter={(e) => {
            if (!allowVideoDrop(e)) return;
            const item = peekLibraryDrag();
            setHover(item && !slotAccepts("video", item) ? "bad" : "ok");
          }}
          onDragOver={(e) => {
            if (!allowVideoDrop(e)) return;
            const item = peekLibraryDrag();
            setHover(item && !slotAccepts("video", item) ? "bad" : "ok");
          }}
          onDragLeave={(e) => {
            const next = e.relatedTarget as globalThis.Node | null;
            if (next && e.currentTarget.contains(next)) return;
            setHover(null);
          }}
          onDrop={onVideoDrop}
        >
          Attach a Source video (Library drag, video only)
        </div>
      )}

      {pins.length ? (
        <ul className="pin-list">
          {pins.map((p) => (
            <PinRow
              key={p.id}
              pin={p}
              onClear={() => onPinsChange(pins.filter((x) => x.id !== p.id))}
              onReplace={(item) => replacePin(p.id, item)}
              onSeek={() => seekTo(p.timestamp_s)}
            />
          ))}
        </ul>
      ) : hasVideo ? (
        <p className="hint">No pins yet — scrub, then pin the frame to edit.</p>
      ) : null}
    </div>
  );
}

function PinRow({
  pin,
  onClear,
  onReplace,
  onSeek,
}: {
  pin: FramePin;
  onClear: () => void;
  onReplace: (item: LibraryItem) => void;
  onSeek: () => void;
}) {
  const [hover, setHover] = useState<"ok" | "bad" | null>(null);
  const thumb = pin.image.thumb_url || pin.image.url;

  function allow(event: DragEvent) {
    if (!peekLibraryDrag() && !hasLibraryPayload(event.dataTransfer)) return false;
    event.preventDefault();
    event.stopPropagation();
    const item = peekLibraryDrag();
    const ok = item ? slotAccepts("image", item) : true;
    event.dataTransfer.dropEffect = ok ? "copy" : "none";
    return true;
  }

  return (
    <li
      className={
        hover === "ok"
          ? "pin-row drop-hot"
          : hover === "bad"
            ? "pin-row drop-bad"
            : "pin-row"
      }
      onDragEnter={(e) => {
        if (!allow(e)) return;
        const item = peekLibraryDrag();
        setHover(item && !slotAccepts("image", item) ? "bad" : "ok");
      }}
      onDragOver={(e) => {
        if (!allow(e)) return;
        const item = peekLibraryDrag();
        setHover(item && !slotAccepts("image", item) ? "bad" : "ok");
      }}
      onDragLeave={(e) => {
        const next = e.relatedTarget as globalThis.Node | null;
        if (next && e.currentTarget.contains(next)) return;
        setHover(null);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setHover(null);
        const item = consumeLibraryDrag() || peekLibraryDrag();
        if (!item) return;
        if (!slotAccepts("image", item)) {
          toast(slotNeedLabel("image"), true);
          return;
        }
        onReplace(item);
      }}
    >
      <button type="button" className="pin-thumb nodrag" onClick={onSeek} title="Jump to pin">
        {thumb ? <img src={thumb} alt="" draggable={false} /> : <span />}
      </button>
      <div className="pin-meta">
        <span>
          t={Number.isFinite(pin.timestamp_s) ? pin.timestamp_s.toFixed(2) : "—"}s
        </span>
        <span className="hint">Drop a Library still to replace</span>
      </div>
      <button type="button" className="ghost nodrag" onClick={onClear}>
        Clear
      </button>
    </li>
  );
}

function JumpThumbs({
  src,
  duration,
  onJump,
  thumbs,
  setThumbs,
}: {
  src: string;
  duration: number;
  onJump: (t: number) => void;
  thumbs: { t: number; url: string }[];
  setThumbs: (rows: { t: number; url: string }[]) => void;
}) {
  useEffect(() => {
    if (!src || !duration || duration < 0.2) return;
    let cancelled = false;
    const times = [0, 0.25, 0.5, 0.75, 1].map((f) =>
      Math.max(0, Math.min(duration - 0.04, Math.round(duration * f * 100) / 100)),
    );
    const unique = [...new Set(times)];
    const video = document.createElement("video");
    video.src = src;
    video.muted = true;
    video.preload = "auto";
    video.playsInline = true;
    const canvas = document.createElement("canvas");
    const grab = () =>
      new Promise<{ t: number; url: string }[]>((resolve) => {
        const out: { t: number; url: string }[] = [];
        let i = 0;
        const next = () => {
          if (cancelled || i >= unique.length) {
            resolve(out);
            return;
          }
          const t = unique[i++];
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            try {
              const w = video.videoWidth || 160;
              const h = video.videoHeight || 90;
              canvas.width = 96;
              canvas.height = Math.max(36, Math.round((96 * h) / w));
              const ctx = canvas.getContext("2d");
              ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
              out.push({ t, url: canvas.toDataURL("image/jpeg", 0.7) });
            } catch {
              out.push({ t, url: "" });
            }
            next();
          };
          video.addEventListener("seeked", onSeeked);
          try {
            video.currentTime = t;
          } catch {
            next();
          }
        };
        const ready = () => next();
        if (video.readyState >= 1) ready();
        else video.addEventListener("loadedmetadata", ready, { once: true });
      });
    void grab().then((rows) => {
      if (!cancelled && rows.length) setThumbs(rows);
    });
    return () => {
      cancelled = true;
      video.src = "";
    };
  }, [src, duration, setThumbs]);

  if (!thumbs.length) return null;
  return (
    <div className="frame-jumps" aria-label="Jump to thumbnail">
      {thumbs.map((row) => (
        <button
          key={row.t}
          type="button"
          className="nodrag"
          title={`Jump to ${row.t.toFixed(2)}s`}
          onClick={() => onJump(row.t)}
        >
          {row.url ? <img src={row.url} alt="" draggable={false} /> : <span>{row.t.toFixed(1)}s</span>}
        </button>
      ))}
    </div>
  );
}
