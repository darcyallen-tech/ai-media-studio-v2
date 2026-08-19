import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";

type Props = {
  id: string;
  minHeight?: number;
  maxHeight?: number;
  defaultHeight?: number;
  className?: string;
  locked?: boolean;
  children: ReactNode;
};

export default function ResizableMedia({
  id,
  minHeight = 120,
  maxHeight = 520,
  defaultHeight = 180,
  className,
  locked = false,
  children,
}: Props) {
  const key = `ams-preview-${id}`;
  const [height, setHeight] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      const n = raw ? Number(raw) : defaultHeight;
      if (Number.isFinite(n)) return Math.min(maxHeight, Math.max(minHeight, n));
    } catch {
      /* ignore */
    }
    return defaultHeight;
  });
  const drag = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(key, String(height));
    } catch {
      /* ignore */
    }
  }, [height, key]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      drag.current = { startY: event.clientY, startH: height };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [height],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!drag.current) return;
      const next = drag.current.startH + (event.clientY - drag.current.startY);
      setHeight(Math.min(maxHeight, Math.max(minHeight, next)));
    },
    [maxHeight, minHeight],
  );

  const onPointerUp = useCallback(() => {
    drag.current = null;
  }, []);

  return (
    <div
      className={className ? `resize-media ${className}` : "resize-media"}
      style={{ height }}
    >
      <div className="resize-media-body">{children}</div>
      {locked ? null : (
      <button
        type="button"
        className="resize-handle nodrag nopan"
        aria-label="Resize preview"
        title="Drag to resize"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      )}
    </div>
  );
}
