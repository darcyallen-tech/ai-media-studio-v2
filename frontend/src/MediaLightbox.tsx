import { useEffect, useState } from "react";
import { bindLightbox, closeLightbox, type LightboxPayload } from "./lightbox";

export default function MediaLightbox() {
  const [item, setItem] = useState<LightboxPayload | null>(null);

  useEffect(() => {
    bindLightbox(setItem);
    return () => bindLightbox(null);
  }, []);

  useEffect(() => {
    if (!item) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item]);

  if (!item) return null;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      onClick={closeLightbox}
    >
      <div className="lightbox-frame" onClick={(e) => e.stopPropagation()}>
        {item.kind === "video" ? (
          <video src={item.src} controls autoPlay playsInline />
        ) : item.kind === "audio" ? (
          <audio src={item.src} controls autoPlay />
        ) : (
          <img src={item.src} alt={item.title || "Preview"} />
        )}
        {item.title ? <p className="lightbox-title">{item.title}</p> : null}
      </div>
    </div>
  );
}
