export type LightboxKind = "image" | "video" | "audio";

export type LightboxPayload = {
  src: string;
  kind: LightboxKind;
  title?: string;
};

type Handler = (payload: LightboxPayload | null) => void;

let _show: Handler | null = null;

export function bindLightbox(fn: Handler | null) {
  _show = fn;
}

export function openLightbox(payload: LightboxPayload) {
  _show?.(payload);
}

export function closeLightbox() {
  _show?.(null);
}
