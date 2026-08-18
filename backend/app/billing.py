"""Quiet credit / billing probes for Settings. Never raises."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

import httpx

from app.errors import FAL_BILLING_URL, FAL_TOPUP_URL, XAI_TOPUP_URL
from app.secrets_store import effective_fal_key, effective_runware_key, effective_xai_key

FAL_BILLING_API = "https://api.fal.ai/v1/account/billing"
RUNWARE_API_URL = "https://api.runware.ai/v1"
RUNWARE_BILLING_URL = "https://my.runware.ai/"
FAL_KEYS_URL = "https://fal.ai/dashboard/keys"
XAI_KEYS_URL = "https://console.x.ai/team/default/api-keys"
RUNWARE_KEYS_URL = "https://my.runware.ai/keys"


@dataclass(frozen=True)
class ProviderBalance:
    ok: bool
    label: str
    amount: float | None = None
    currency: str = "USD"
    detail: str = ""
    billing_url: str = ""
    topup_url: str = ""


def format_money(amount: float, currency: str = "USD") -> str:
    cur = (currency or "USD").upper()
    if cur == "USD":
        return f"${amount:,.2f}"
    return f"{amount:,.2f} {cur}"


def _coerce_amount(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    if isinstance(value, str):
        s = value.strip().replace(",", "").replace("$", "")
        if not s:
            return None
        try:
            return float(s)
        except ValueError:
            return None
    if isinstance(value, dict):
        for k in ("current_balance", "balance", "available", "amount", "value"):
            if k in value:
                a = _coerce_amount(value.get(k))
                if a is not None:
                    return a
    return None


def _extract_credits(data: Any) -> tuple[float | None, str]:
    if not isinstance(data, dict):
        return None, "USD"
    for wrapper in (None, "data", "account", "result"):
        root = data if wrapper is None else data.get(wrapper)
        if not isinstance(root, dict):
            continue
        credits = root.get("credits")
        currency = "USD"
        if isinstance(credits, dict):
            currency = str(credits.get("currency") or root.get("currency") or "USD")
            for key in (
                "current_balance",
                "balance",
                "available",
                "available_balance",
                "remaining",
                "amount",
            ):
                amt = _coerce_amount(credits.get(key))
                if amt is not None:
                    return amt, currency
        elif credits is not None:
            amt = _coerce_amount(credits)
            if amt is not None:
                return amt, str(root.get("currency") or "USD")
        for key in ("current_balance", "balance", "credit_balance", "available_balance"):
            amt = _coerce_amount(root.get(key))
            if amt is not None:
                return amt, str(root.get("currency") or "USD")
    return None, "USD"


def fetch_fal_balance(*, timeout: float = 12.0) -> ProviderBalance:
    key = (effective_fal_key() or "").strip()
    if not key:
        return ProviderBalance(
            ok=False,
            label="fal · no key",
            detail="Add a FAL API key in Settings.",
            billing_url=FAL_BILLING_URL,
            topup_url=FAL_TOPUP_URL,
        )
    headers = {
        "Authorization": f"Key {key}",
        "Accept": "application/json",
    }
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(f"{FAL_BILLING_API}?expand=credits", headers=headers)
    except Exception as exc:
        return ProviderBalance(
            ok=False,
            label="fal · check billing",
            detail=f"Could not reach fal billing ({type(exc).__name__}).",
            billing_url=FAL_BILLING_URL,
            topup_url=FAL_TOPUP_URL,
        )
    if resp.status_code in (401, 403):
        return ProviderBalance(
            ok=False,
            label="fal · check billing",
            detail=(
                "This key cannot read balance (Admin scope required). "
                "Generation still works with a normal key."
            ),
            billing_url=FAL_BILLING_URL,
            topup_url=FAL_TOPUP_URL,
        )
    if resp.status_code >= 400:
        return ProviderBalance(
            ok=False,
            label="fal · check billing",
            detail=f"fal billing HTTP {resp.status_code}.",
            billing_url=FAL_BILLING_URL,
            topup_url=FAL_TOPUP_URL,
        )
    try:
        data = resp.json()
    except Exception:
        return ProviderBalance(
            ok=False,
            label="fal · check billing",
            detail="Unexpected billing response.",
            billing_url=FAL_BILLING_URL,
            topup_url=FAL_TOPUP_URL,
        )
    amount, currency = _extract_credits(data)
    if amount is None:
        return ProviderBalance(
            ok=False,
            label="fal · check billing",
            detail="No credit balance in response. Open fal billing.",
            billing_url=FAL_BILLING_URL,
            topup_url=FAL_TOPUP_URL,
        )
    money = format_money(float(amount), currency)
    return ProviderBalance(
        ok=True,
        label=f"fal {money}",
        amount=float(amount),
        currency=currency,
        detail=f"Balance {money}",
        billing_url=FAL_BILLING_URL,
        topup_url=FAL_TOPUP_URL,
    )


def fetch_xai_balance() -> ProviderBalance:
    key = (effective_xai_key() or "").strip()
    if not key:
        return ProviderBalance(
            ok=False,
            label="xAI · no key",
            detail="Add an xAI API key in Settings. Live balance is not available via API.",
            billing_url=XAI_TOPUP_URL,
            topup_url=XAI_TOPUP_URL,
        )
    return ProviderBalance(
        ok=True,
        label="xAI · key set (no live balance)",
        detail="xAI does not expose balance on a standard API key. Open billing to check credits.",
        billing_url=XAI_TOPUP_URL,
        topup_url=XAI_TOPUP_URL,
    )


def fetch_runware_balance(*, timeout: float = 12.0) -> ProviderBalance:
    key = (effective_runware_key() or "").strip()
    if not key:
        return ProviderBalance(
            ok=False,
            label="Runware · no key",
            detail="Optional — Frame / Aleph only. fal covers Studio generate.",
            billing_url=RUNWARE_BILLING_URL,
            topup_url=RUNWARE_BILLING_URL,
        )
    task = {
        "taskType": "accountManagement",
        "taskUUID": str(uuid.uuid4()),
        "operation": "getDetails",
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.post(RUNWARE_API_URL, headers=headers, json=[task])
    except Exception as exc:
        return ProviderBalance(
            ok=False,
            label="Runware · check billing",
            detail=f"Could not reach Runware ({type(exc).__name__}).",
            billing_url=RUNWARE_BILLING_URL,
            topup_url=RUNWARE_BILLING_URL,
        )
    if resp.status_code in (401, 403):
        return ProviderBalance(
            ok=False,
            label="Runware · check key",
            detail="Runware key rejected.",
            billing_url=RUNWARE_BILLING_URL,
            topup_url=RUNWARE_BILLING_URL,
        )
    if resp.status_code >= 400:
        return ProviderBalance(
            ok=False,
            label="Runware · connected",
            detail=f"Balance API HTTP {resp.status_code}.",
            billing_url=RUNWARE_BILLING_URL,
            topup_url=RUNWARE_BILLING_URL,
        )
    try:
        payload = resp.json()
    except Exception:
        return ProviderBalance(
            ok=False,
            label="Runware · connected",
            detail="Unexpected balance response.",
            billing_url=RUNWARE_BILLING_URL,
            topup_url=RUNWARE_BILLING_URL,
        )
    rows: list[Any] = []
    if isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            rows = [data]
    elif isinstance(payload, list):
        rows = [x for x in payload if isinstance(x, dict)]
    amount: float | None = None
    currency = "USD"
    for row in rows:
        if not isinstance(row, dict):
            continue
        bal = row.get("balance")
        if isinstance(bal, dict):
            currency = str(bal.get("currency") or currency)
            for name in ("amount", "freeBalance", "balance", "available"):
                amt = _coerce_amount(bal.get(name))
                if amt is not None:
                    amount = amt
                    break
        if amount is None:
            amount = _coerce_amount(row.get("balance"))
        if amount is not None:
            break
    if amount is None:
        return ProviderBalance(
            ok=True,
            label="Runware · connected",
            detail="Key present. Balance not in API response — check my.runware.ai.",
            billing_url=RUNWARE_BILLING_URL,
            topup_url=RUNWARE_BILLING_URL,
        )
    money = format_money(float(amount), currency)
    return ProviderBalance(
        ok=True,
        label=f"Runware · {money}",
        amount=float(amount),
        currency=currency,
        detail=f"Balance {money} (Frame / Aleph only)",
        billing_url=RUNWARE_BILLING_URL,
        topup_url=RUNWARE_BILLING_URL,
    )


def dashboard_urls() -> dict[str, str]:
    return {
        "fal": FAL_KEYS_URL,
        "fal_billing": FAL_BILLING_URL,
        "xai": XAI_KEYS_URL,
        "xai_billing": XAI_TOPUP_URL,
        "runware": RUNWARE_KEYS_URL,
        "runware_billing": RUNWARE_BILLING_URL,
    }
