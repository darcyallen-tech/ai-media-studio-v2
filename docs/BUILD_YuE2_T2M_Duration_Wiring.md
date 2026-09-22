# BUILD — YuE2 T2M duration wiring + graph simplify (2026-09-21)

**Audience:** Grok Build / Cursor Build  
**Repo:** `C:\Users\Darcy\ai-media-studio-v2`  
**Sources:** Tester audit (upstream ComfyUI `b16023b`), Darcy native Comfy graph (~4:51 @ max_duration 400), live API JSON + `backend/app/comfy_yue2.py`

**Hold / supersede:** any 180s soft-cap and any “preflight that requires scalar seconds on EmptyYuE2LatentAudio”. Those disagree with Comfy semantics.

---

## Root cause (proven)

`_set_duration()` currently:

1. Sets `YuE2GenerateMusic.max_duration` (node **25**) ✓  
2. **Breaks** `EmptyYuE2LatentAudio.seconds` link `["25", 1]` and writes a **scalar** ✗  

Native Comfy greys out Empty Latent `seconds` because it is fed by Music **output 1** (resolved length). Stuffing the request duration into the latent is what produces:

`YuE2 latent duration must match the seconds output of YuE2 Text Encode`

**Do not** “fix” by copying the request seconds onto the latent. Fail-fast that ValueError as-is.

The separate `indices[0, 1537] = 1537` OOB is **not** proven as `240×25`; treat as a second bug — capture telemetry (below), do not blame the duration link alone.

---

## Upstream semantics (verified)

| Fact | Detail |
|------|--------|
| `max_duration` | Cap / budget. Default 360; widget ~0.04–900. Token budget ≈ `round(max_duration * 25)` (`FRAMES_PER_SECOND=25`); may shrink; gen may early-stop on end token |
| Music out 0 | Conditioning |
| Music **out 1 `seconds`** | Actual semantic length = `yue2_frames / 25` |
| Latent shape | `[batch, 64, round(seconds*25)]` |
| Official subgraph | Wires Music out1 → Empty Latent `seconds` |
| Sampler check | Integer **frames** vs chunk end (error text may say “seconds”) |
| No upstream 180s cap | 300s = 7500 tokens — OK unless style/lyrics/ABC prefix eats context |

---

## Target T2M API graph (simplify)

| Piece | Binding |
|-------|---------|
| Style / Lyrics primitives | → both `YuE2GenerateABC` and `YuE2GenerateMusic` |
| Mode `full` / `melody` | → **both** nodes’ `mode` |
| ABC | `GenerateABC` → `Music.abc` **direct** |
| Duration | AIMS (or one Primitive) → Music.`max_duration` **only** |
| Resolved length | Music **out1** → `EmptyYuE2LatentAudio.seconds` (**keep link**) |

**Remove from T2M:** pasted-ABC `PrimitiveString`, `PrimitiveBoolean`, `ComfySwitch` / If-Else. Empty abc forces `mode=off` and ignores combo — leave pasted scores to **Rerender-from-ABC**. AIMS already saves ABC for that path.

Cover / Rerender workflows: same rule for duration — patch `max_duration` only; never scalarize linked latent `seconds`.

---

## Patcher changes (`comfy_yue2.py`)

1. `_set_duration` / `preflight_duration`:  
   - Write request seconds → node 25 `max_duration` only.  
   - **Assert** node 5 `seconds` remains link `["25", 1]` (or equivalent Music node id).  
   - **Reject / fix** any code path that replaces that link with a float.  
2. Remove 180s (and any arbitrary) soft-cap for T2M. Allow UI values through to `max_duration` within node widget range (up to ~900 if exposed). Prefer offering **300 / 360 / 480** in UI once smoke-tested.  
3. `mode`: write the same `full` or `melody` to **ABC and Music**. Expose in AIMS Prompt UI.  
4. `patch_t2m`: drop `pasted_abc` / `use_pasted_abc` once graph is simplified (or no-op if nodes gone).  
5. On duration ValueError: surface Comfy message; **no retry** that writes request duration into latent seconds.  
6. On 1537-style OOB: include in error payload: `max_duration`, Music out1 seconds (if any), `yue2_frames`, latent `shape[-1]`, mode, ABC length, stack snippet.

---

## UI (AIMS)

- Duration dropdown: keep 10–300+, remove “capped at 180” banner; optional warn only if requesting extreme values still under widget max.  
- Add **Mode**: `full` | `melody` (default `full`).  
- Instrumental / Style / Lyrics unchanged from Builder contracts.  
- Fail-fast poll + Library Failed (see `BUILD_YuE2_Comfy_Fail_Stuck_UI.md`) still required so duration errors are visible.

---

## Acceptance / test matrix

**Graph asserts (no GPU):**

- [ ] Exactly one ABC, one Music, one Empty Latent on T2M  
- [ ] No ABC switch / pasted boolean on T2M  
- [ ] Latent `seconds` is link from Music out1  
- [ ] Duration input only sets Music `max_duration`

**Live (full & melody):**

- [ ] 120s  
- [ ] 240s  
- [ ] ≥300s (301 or 360; optionally 400/480 if VRAM allows)  

**Pass criteria each run:**

`latent_frames == yue2_frames == round(out1_seconds * 25)`  
and `latent_frames <= round(max_duration * 25)`

**Telemetry (log or status notes):** max_duration, out1 seconds, yue2_frames, latent shape[-1], “budget reduced” if logged by node, ABC char/token len, mode on both nodes.

---

## Risk

Flattening / re-exporting the API JSON can drop the Music→latent link and recreate the bug. After any graph edit, re-assert link 25→5 (or new ids) in CI or unit test.

---

## Out of scope

- Prompt Builder Style/Lyrics P0s (separate docs)  
- Proving 1537 root cause beyond telemetry capture  
- Selling tracks (YuE2 CC-BY-NC)
