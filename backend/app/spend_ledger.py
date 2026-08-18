"""Local spend ledger — one JSONL row per successful generate. Never committed."""

from __future__ import annotations

import csv
import io
import json
import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

from app.secrets_store import app_data_dir

LEDGER_NAME = "spend.jsonl"

_COST_RE = re.compile(
    r"(?:est\.?\s*cost|cost)\s*:\s*\$?\s*([0-9]+(?:\.[0-9]+)?)"
    r"|\$\s*([0-9]+(?:\.[0-9]+)?)",
    re.IGNORECASE,
)


def ledger_path() -> Path:
    return app_data_dir() / LEDGER_NAME


def parse_cost_usd(cost_text: str | None) -> float | None:
    raw = (cost_text or "").strip()
    if not raw or raw in ("—", "-", "n/a", "N/A", "none"):
        return None
    m = _COST_RE.search(raw)
    if not m:
        return None
    num = m.group(1) or m.group(2)
    try:
        val = float(num)
    except (TypeError, ValueError):
        return None
    if val <= 0 or val > 1_000_000:
        return None
    return val


def infer_provider(model_id: str | None, *, job_kind: str | None = None) -> str:
    blob = f"{model_id or ''} {job_kind or ''}".strip().lower()
    if "runware" in blob or "aleph" in blob:
        return "Runware"
    if "grok" in blob or "xai" in blob:
        return "xAI"
    if blob:
        return "fal"
    return "unknown"


def log_spend(
    *,
    cost: str | None,
    model_id: str | None = None,
    job_kind: str | None = None,
    job_id: str | None = None,
    amount: float | None = None,
) -> dict[str, Any] | None:
    """Append a ledger row. Never raises. Skips missing / zero cost."""
    usd = amount if amount is not None else parse_cost_usd(cost)
    if usd is None:
        return None
    now = datetime.now(timezone.utc)
    row = {
        "id": (job_id or "").strip() or uuid.uuid4().hex[:12],
        "ts": now.replace(microsecond=0).isoformat(),
        "date": now.date().isoformat(),
        "provider": infer_provider(model_id, job_kind=job_kind),
        "amount": round(usd, 4),
        "model_id": (model_id or "").strip(),
        "job_kind": (job_kind or "").strip(),
        "cost_label": (cost or "").strip(),
    }
    try:
        path = ledger_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")
    except OSError:
        return None
    return row


def _read_rows() -> list[dict[str, Any]]:
    path = ledger_path()
    if not path.is_file():
        return []
    out: list[dict[str, Any]] = []
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            if isinstance(item, dict) and item.get("amount"):
                out.append(item)
    except OSError:
        return []
    return out


def spend_summary(*, year: int | None = None) -> dict[str, Any]:
    rows = _read_rows()
    today = datetime.now().date()
    month_key = today.strftime("%Y-%m")
    by_month: dict[str, dict[str, Any]] = {}
    month_prov: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    month_count: dict[str, int] = defaultdict(int)
    this_prov: dict[str, dict[str, Any]] = {}
    this_total = 0.0
    this_count = 0

    for row in rows:
        d = str(row.get("date") or "")[:10]
        ym = d[:7] if len(d) >= 7 else str(row.get("ts") or "")[:7]
        if not ym:
            continue
        if year is not None and not ym.startswith(f"{year}-"):
            continue
        amt = float(row.get("amount") or 0)
        prov = str(row.get("provider") or "unknown")
        bucket = by_month.setdefault(ym, {"month": ym, "total": 0.0, "count": 0})
        bucket["total"] = round(bucket["total"] + amt, 4)
        bucket["count"] += 1
        month_prov[ym][prov] += amt
        month_count[ym] += 1
        if ym == month_key:
            this_total += amt
            this_count += 1
            p = this_prov.setdefault(prov, {"provider": prov, "total": 0.0, "count": 0})
            p["total"] = round(p["total"] + amt, 4)
            p["count"] += 1

    months = []
    for ym in sorted(by_month.keys(), reverse=True):
        months.append(
            {
                "month": ym,
                "total": by_month[ym]["total"],
                "count": by_month[ym]["count"],
                "by_provider": [
                    {"provider": p, "total": round(t, 4)}
                    for p, t in sorted(month_prov[ym].items())
                ],
            }
        )
    recent = list(reversed(rows[-40:]))
    return {
        "ok": True,
        "this_month": {
            "month": month_key,
            "total": round(this_total, 4),
            "count": this_count,
            "by_provider": sorted(this_prov.values(), key=lambda r: r["provider"]),
        },
        "months": months,
        "recent": [
            {
                "id": r.get("id"),
                "date": r.get("date"),
                "provider": r.get("provider"),
                "amount": r.get("amount"),
                "model_id": r.get("model_id"),
            }
            for r in recent
        ],
    }


def export_csv(*, year: int) -> tuple[str, str]:
    rows = _read_rows()
    prefix = f"{int(year):04d}-"
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date", "provider", "amount", "job_id", "model_id"])
    n = 0
    for row in rows:
        d = str(row.get("date") or "")
        if not d.startswith(prefix):
            continue
        writer.writerow(
            [
                d,
                row.get("provider") or "",
                f"{float(row.get('amount') or 0):.4f}",
                row.get("id") or "",
                row.get("model_id") or "",
            ]
        )
        n += 1
    name = f"ai-media-studio-spend-{year}.csv"
    return name, buf.getvalue()


def iter_year_rows(year: int) -> Iterable[dict[str, Any]]:
    prefix = f"{int(year):04d}-"
    for row in _read_rows():
        if str(row.get("date") or "").startswith(prefix):
            yield row
