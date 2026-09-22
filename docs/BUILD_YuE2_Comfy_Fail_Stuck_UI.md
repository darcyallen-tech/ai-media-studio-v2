# BUILD — YuE2 Comfy fail + AIMS stuck Generating (2026-09-21)

**Audience:** Grok Build / Cursor Build  
**Repo:** `C:\Users\Darcy\ai-media-studio-v2`  
**Source:** Tester QA (Darcy: 59s latent mismatch, 240s `indices … 1537` OOB, AIMS stuck Generating / Library Queued)

**Code:** `backend/app/comfy_yue2.py`, Prompt/library UI that owns generate phase

---

## Symptoms

1. Comfy: `YuE2 latent duration must match the seconds output of YuE2 Text Encode`
2. Comfy: `indices[0, 1537] = 1537 is out of bounds for dimension 1 with size 1537` on Music Generation (~240s)
3. AIMS Prompt stays **Generating…** / Library **Queued** after Comfy Manager already shows **Failed**

---

## P0 — fail fast on Comfy error (stuck UI root cause)

### Bug (`comfy_yue2.py` poll loop ~634)

```python
if status.get("completed") or files:
    err = _status_error(status)
```

`_status_error` only runs when `completed` or audio files exist. If history has `status_str=error` **before** `completed`/outputs, AIMS keeps polling (up to `_POLL_MAX_S` ≈ 20 min) → UI stuck Generating while Comfy already Failed.

### Fix

Every poll iteration, **before** waiting on success:

1. `err = _status_error(status)` → if set, `_fail` immediately with Comfy `exception_message`.
2. Also fail on queue/`execution_error` / interrupted if present on the history entry.
3. Library: when generate returns `ok:false`, mark Queued → **Failed** (do not leave Queued).

`_status_error` already parses `messages` for `execution_error` + `exception_message` — reuse it; just call it unconditionally each poll.

### Acceptance

- [ ] Kill Comfy mid-job or force node error → AIMS shows error banner within one poll (~1–2s), not after 20 min timeout
- [ ] Library item leaves Queued → Failed with the Comfy message
- [ ] Happy path (WAV returns) unchanged

---

## P0 — UI must `setError` on YuE2 fail

### Bug (Prompt node ~1075 area)

`!body.ok` may toast for YuE2 but **never `setError(msg)`**, so the failure is easy to miss; phase only clears when `/generate` returns (which is delayed by the poll bug above).

### Fix

On YuE2/`comfy:yue2*` generate failure: `setError` with server `status` / `exception_message`, clear Generating phase, show persistent error on the Prompt node (not toast-only).

### Acceptance

- [ ] Failed generate → red error text on Prompt with Comfy exception text visible without opening toast history

---

## P1 — duration / latent / Text Encode alignment

**Superseded by `docs/BUILD_YuE2_T2M_Duration_Wiring.md`.** Do not soft-cap at 180s. Do not write the request duration into Empty latent `seconds`. That link stays Music output 1.

### Facts

- `_clamp_duration` allows **10–300s** (`comfy_yue2.py` ~304–312); T2M default 240.
- Successful tests were ~100s; **240s + dense lyrics** hit internal token/frame ceiling (`1537` OOB).
- Latent seconds ≠ Text Encode seconds → Comfy error (graph/link or scalar mismatch on nodes 5 / Generate Music / Text Encode).

### Fix

1. Soft-cap YuE2 T2M duration (recommend **≤120–180s** until longer is proven); UI warn or hard-clamp with message.
2. Preflight: after patch, assert Text Encode `seconds` (or linked output) == Empty latent / Generate Music duration scalars (same value AIMS sent).
3. Keep `_set_duration` replacing linked `seconds` with a scalar (already intended) — verify Cover/Rerender paths too.

### Acceptance

- [ ] Request 240s → clamp/warn to safe cap; no silent OOB
- [ ] Latent mismatch error never appears when AIMS sets duration (preflight catches wiring bugs)
- [ ] 120s sung T2M smoke still succeeds

---

## Out of scope

- Music Prompt Builder Style/Lyrics P0s (separate: `BUILD_YuE2_Music_Builder_Fixes.md`)
- ABC `/history` extraction (`workflows/comfy/YUE2_ABC.md`)

---

## Retest (@Tester)

1. Force Comfy node error → AIMS fails fast + Library Failed + error banner with exception text  
2. 120s T2M sung → OK  
3. 240s T2M → clamp/warn, no 20 min hang, no silent Queued

**Superseded on duration:** do not soft-cap at 180 or scalarize latent seconds — see `BUILD_YuE2_T2M_Duration_Wiring.md`.
