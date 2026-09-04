import { useEffect, useState } from "react";

/** True when Settings has an xAI key (Enhance). Polls /health. */
export function useXaiKey(): boolean {
  const [hasXai, setHasXai] = useState(false);
  useEffect(() => {
    const ac = new AbortController();
    const load = () => {
      fetch("/health", { signal: ac.signal })
        .then((res) => (res.ok ? res.json() : null))
        .then((body: { keys?: { xai?: boolean } } | null) => {
          if (body) setHasXai(Boolean(body.keys?.xai));
        })
        .catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, 8000);
    return () => {
      ac.abort();
      window.clearInterval(id);
    };
  }, []);
  return hasXai;
}
