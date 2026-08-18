/** JSON-safe fetch helpers. Never call response.json() on empty / HTML bodies. */

export async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  const ctype = (res.headers.get("content-type") || "").toLowerCase();
  if (!text.trim()) {
    throw new Error(res.statusText || `Empty response (${res.status})`);
  }
  if (!ctype.includes("json")) {
    throw new Error(res.statusText || `Expected JSON (${res.status})`);
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { ok: true, data: parsed };
  } catch {
    throw new Error(res.statusText || `Invalid JSON (${res.status})`);
  }
}
