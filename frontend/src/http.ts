/** JSON-safe fetch helpers. Never call response.json() on empty / HTML bodies. */

export function extractPromptLoose(text: string): string {
  const raw = (text || "").trim();
  if (!raw) return "";
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const rec = parsed as Record<string, unknown>;
      for (const key of ["prompt", "optimized_prompt"]) {
        const val = rec[key];
        if (typeof val === "string" && val.trim()) return val.trim();
      }
    }
  } catch {
    /* truncated or wrapped JSON */
  }
  const quoted = raw.match(
    /"(?:prompt|optimized_prompt)"\s*:\s*"((?:\\.|[^"\\])*)"/s,
  );
  if (quoted?.[1]) {
    try {
      const decoded = JSON.parse(`"${quoted[1]}"`);
      if (typeof decoded === "string" && decoded.trim()) return decoded.trim();
    } catch {
      const cleaned = quoted[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim();
      if (cleaned) return cleaned;
    }
  }
  return "";
}

export async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    return {
      ok: false,
      error: res.statusText || `Empty response (${res.status})`,
    };
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    if (typeof parsed === "string" && parsed.trim()) {
      return { ok: true, prompt: parsed.trim() };
    }
    return { ok: true, data: parsed };
  } catch {
    const prompt = extractPromptLoose(text);
    if (prompt) return { ok: true, prompt };
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 160);
    return {
      ok: false,
      error: snippet
        ? `Reply was not valid JSON. ${snippet}`
        : res.statusText || `Invalid JSON (${res.status})`,
    };
  }
}
