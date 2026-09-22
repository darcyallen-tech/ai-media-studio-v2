# BUILD — YuE2 Music Prompt Builder fixes (post 4.7 QA)

**Audience:** Grok Build / Cursor Build  
**Repo:** `C:\Users\Darcy\ai-media-studio-v2`  
**Date:** 2026-09-21  
**Contract (full):** `docs/YuE2-Prompt-Builder-Apply-Contract.md`  
**Code:** `frontend/src/musicUi.ts`, `PromptBuilderNode.tsx`, `backend/app/enhance.py`

Ship **P0** before more Builder features. P1/P2 can follow in the same PR if cheap.

---

## P0 — ship blockers

### 1. Notes must not leak into Style
- Today: `sonicNotes` appends Notes; lyric filter only matches `with lyrics` / `write lyrics` / similar.
- Fix: if Notes matches lyric premise (`\blyrics?\b`, “about …”, “write verses…”) → **exclude from Style**; keep as Lyrics Notes / Enhance input only.
- Style stays sonic chips only (genre, energy, instruments, mix).

### 2. Instrumental OFF → never emit instrumental cues on Apply
- Today: SECTION_CUE / INTRO_CUE still produce `(no vocals)`, `(instrumental groove)`, etc. when Instrumental is unchecked.
- Fix: branch on exact boolean `instrumental === true`:
  - **ON:** tags + `(instrumental…)` / `(no vocals)` cues (current skeleton).
  - **OFF:** tags + sung placeholders (e.g. `(verse — Enhance fills)` or empty body under tag) — **zero** instrumental parentheticals.

### 3. Sung Apply must not paste Notes under every section
- Today: `composeMusicLyrics` with `!instrumental` dumps the whole Notes line as body of every `[Intro]`/`[Verse]`/…
- Fix: Notes = Enhance premise only. Apply sung = structure tags (+ short sung placeholders). Do not duplicate Notes per section.

### 4. Enhance sung must assert mode
- When `instrumental: false`, returned `lyrics` must not contain `(instrumental…)` / `(no vocals)`.
- If model returns cues: strip/replace from Notes (fallback), then re-validate.

---

## P1 — arrangement / duration

5. Replace boolean section set (`seen`) with an **ordered stack**: add/remove/reorder, counts >1 (V–C–V–C). Buildup must not steal/drop Verse.
6. If Duration ≫ section count: warn in UI and/or auto-repeat Verse/Chorus to fill.

## P2 — checkbox bind

7. Builder Instrumental = Prompt node **exact** boolean. Stop `data.instrumental !== false` (undefined → ON).

---

## Acceptance (Tester retest)

- [ ] Notes “lyrics about…” never in Style (Instrumental on or off)
- [ ] Instrumental OFF Apply: `[…]` tags, **no** `(instrumental…)` / `(no vocals)`
- [ ] Instrumental OFF Apply: Notes not duplicated under every section
- [ ] Enhance `instrumental:false`: real/placeholder sung lines; no instrumental cues left
- [ ] (P1) V–C–V–C possible
- [ ] (P1) Duration vs structure warn or expand
- [ ] (P2) Builder Instrumental mirrors Prompt checkbox exactly

---

## Out of scope

- New genres / flares
- Comfy graph / ABC `/history` (see `workflows/comfy/YUE2_ABC.md`)

---

## Enhance polish rules (2026-09-21 room consensus)

### Style — Enhance SHOULD enrich
- Pull sonic fusion from Notes into **Style only** (e.g. hip-hop pocket, boom-bap, New Orleans color).
- Keep Style sonic: genre / energy / instruments / mix / vocal *timbre as Style* (`powerful male lead, raw grit`).
- Never put lyric themes or sung lines in Style.

### Lyrics — sung vs instrumental
| Mode | Under each `[Tag]` |
|------|---------------------|
| **Instrumental ON** | Full `(instrumental…)` / `(no vocals)` map (existing skeleton) |
| **Instrumental OFF (sung)** | Optional **one short musical cue** then singable lines, e.g. `[Verse]` → `(full band, groove)` → lyric lines. Skip the cue if lines are dense. |

### Hard bans in Lyrics (Apply + Enhance)
- No performance/timbre directives in lyric bodies or `(…)` cues (`male voice raw`, `spitting…` as stage direction).
- Those belong in Style. Lyric `(…)` = arrangement/musical only (`anthemic`, `full band enters`).

### Acceptance add-ons
- [ ] Enhance Style includes fusion from Notes when Notes imply it (hip-hop fuse, etc.)
- [ ] Sung Lyrics: tags + optional one musical `(cue)` + real lines; no timbre-in-parens
- [ ] Timbre cues in Style only after Enhance

- **Music Prompt Builder options critique (Prompty):** `Music-Prompt-Builder-Options-Critique.md` — P0: Energy `driving` vs Tempo, Voice character row, Buildup stealing Verse, Peru≈Andes

---

## P0 — Sung Enhance must keep musical `(…)` cues (2026-09-21)

**Bug:** With Instrumental OFF, Enhance returns `[Tag]` then sung lines only — no arrangement cue. Creative on/off both fail. Builder placeholder `(intro — Enhance fills)` never becomes a real cue.

**Cause (`backend/app/enhance.py` `YUE_JSON_RULE`):**
> Instrumental false: … **replace parentheticals with sung lines from the notes.**

That contradicts the Apply/Enhance contract. Musical cues are required; only timbre/performance parens are banned.

**Correct sung Lyrics shape (Creative on or off):**
```text
[Intro]
(cold-open riff, drums kick, record scratches under guitar)
Dust kicks up under the porch light glow
Amps humming loud in the trailer row

[Verse]
(full band, groove)
…
```

**Rules for Build:**
1. Change `YUE_JSON_RULE` (and any sung system addendum): when `instrumental:false`, **keep one short musical `(cue)` under each `[Section]`**, then sung lines. Do **not** “replace all parentheticals with sung lines.”
2. Allowed in `(…)`: arrangement / entry / texture (`drums kick in`, `full band`, `record scratches`, `guitar stab`).
3. Forbidden in `(…)` / lyric bodies: vocal timbre & stage direction (`gritty male voice`, `southern drawl`, `spitting`) — those stay in **Style** / Voice character chips.
4. `enforce_sung_lyrics` / `lift_timbre`: strip only instrumental/no-vocals and timbre cues — **do not** strip musical arrangement parens.
5. Creative OFF = tighter wording; still emit the cue line. Creative ON = richer cues + denser lyrics; still one cue per section (skip only if lines are extremely dense — prefer keep).

**Acceptance:**
- [ ] Instrumental OFF + Enhance (Creative on) → every `[Tag]` has a musical `(…)` then sung lines
- [ ] Same with Creative off
- [ ] No timbre-in-parens; Style carries voice character
- [ ] Instrumental ON still uses full `(instrumental…)` / `(no vocals)` map
