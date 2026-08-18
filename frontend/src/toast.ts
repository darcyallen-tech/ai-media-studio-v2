type ToastFn = (message: string, error?: boolean) => void;

let _show: ToastFn | null = null;

export function bindToast(fn: ToastFn | null) {
  _show = fn;
}

export function toast(message: string, error = false) {
  _show?.(message, error);
}

export async function sendToResolve(
  path: string,
  extra?: { type?: string; model?: string; cost?: string },
) {
  if (!path) {
    toast("No file to send.", true);
    return;
  }
  try {
    const res = await fetch("/resolve/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, ...extra }),
    });
    const body = (await res.json()) as { ok?: boolean; message?: string; detail?: string };
    const msg =
      body.message ||
      (typeof body.detail === "string" ? body.detail : null) ||
      (res.ok ? "Sent to Resolve." : "Send to Resolve failed.");
    toast(msg, !body.ok);
  } catch (err: unknown) {
    toast(err instanceof Error ? err.message : "Send to Resolve failed.", true);
  }
}
