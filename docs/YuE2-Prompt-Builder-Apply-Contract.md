# YuE2 Prompt Builder — Apply Contract (Build 4.x)

**Audience:** Grok Build / AI Media Studio V2  
**Owner:** Prompty + Alfred  
**Date:** 2026-09-21  
**Related:** `YuE2-Prompting-Guide.md`

---

## Goal

On **Apply selection**, Prompt Builder always fills **both** Style and Lyrics for YuE2. Enhance (Grok API) is optional and must not be required for a valid instrumental or sung payload.

---

## Field split (non-negotiable)

| Field | Contains | Never contains |
|-------|----------|----------------|
| **Style** | Sonic only: genre, subgenre, fusion, energy/tempo/BPM, mood, instruments, mix/production language | Lyric lines, section tags, “no vocals / no lyrics” dumps when Lyrics already carries structure |
| **Lyrics** | YuE2 section tags `[Intro]` / `[Verse]` / `[Chorus]` / `[Bridge]` / `[Outro]` with blank lines between sections | Empty string |

**Instrumental checkbox ON:** Lyrics = structure tags + `(instrumental, …)` parentheticals under each section. No sung words.  
**Instrumental checkbox OFF (sung):** Lyrics = same tags + real lyric lines (from Enhance or user). Style still sonic-only — never paste verse text into Style.

---

## Apply: Structure chips → Lyrics (local template, no Grok)

Map selected Structure / Ending chips into Lyrics blocks. Always emit `\n\n` between sections.

| Structure chip | Lyrics block |
|----------------|--------------|
| Intro (cold-open riff) | `[Intro]` + `(cold-open riff, no vocals)` |
| Kick in at ~8s | `[Verse]` + `(instrumental groove kicks in)` |
| Verse | `[Verse]` + `(instrumental groove)` |
| Chorus | `[Chorus]` + `(big instrumental hit)` |
| Pre-Chorus | `[Pre-Chorus]` + `(build, no vocals)` |
| Bridge | `[Bridge]` + `(instrumental break)` |
| Ending — Hard stop | `[Outro]` + `(hard stop)` |
| Ending — Soft fade | `[Outro]` + `(fade out, no vocals)` |

### Example — Instrumental Apply (hard rock ~140 BPM)

**Style** (sonic only — from Genre / Energy / Mood / Instruments chips):
```text
Classic hard rock, hip-hop fusion, explosive aggressive energy, ~140 BPM, thick overdrive electric guitars, bass, tight drums, kick drum, synth shadow, raw live mix
```

**Lyrics** (from Structure chips; Instrumental ON):
```text
[Intro]
(cold-open riff, no vocals)

[Verse]
(instrumental groove kicks in)

[Chorus]
(big riff hit)

[Outro]
(hard stop)
```

---

## Enhance (Grok API) — split JSON only

Enhance must return:

```json
{
  "style": "<sonic-only string>",
  "lyrics": "<section-tagged string>"
}
```

| Mode | `style` | `lyrics` |
|------|---------|----------|
| **Instrumental** | Sonic polish of chips; no lyric text | Keep structure tags; keep or refine `(instrumental, …)` lines; **no sung words** |
| **Sung** | Sonic only from chips + premise | Same tags; replace `(instrumental…)` with real `[Verse]` / `[Chorus]` words from Notes / premise |

**Rules for Enhance:**
- Never put lyric lines in `style`.
- Never leave `lyrics` empty.
- Do not invent Suno-only meta tags.
- If Notes say “with lyrics” but Instrumental is ON, prefer sung lyrics OR flag conflict — do not emit contradictory Style (“instrumental only… with lyrics”).

---

## UI / validation tips

1. Placeholder on empty Lyrics: *“YuE2 needs section tags — Apply fills these.”* (not “optional”)
2. Instrumental ON + blank Lyrics → block Generate or auto-Apply skeleton before send.
3. Same Style + Lyrics for Generate ABC and Generate Music.
4. See `YuE2-Prompting-Guide.md` for `cot` / `mode`, `max_duration`, and reliability notes (true instrumental can still leak vocals).

---

## Acceptance (Tester)

- [ ] Apply with Instrumental ON → Style sonic-only, Lyrics non-empty with `[…]` + `(…)`
- [ ] Apply does not require Enhance
- [ ] Enhance sung → JSON split; Lyrics has real words under tags
- [ ] Enhance instrumental → JSON split; Lyrics has tags + `(instrumental…)`, no sung lines
- [ ] No “Instrumental only… with lyrics” contradiction in Style

---

## Tester QA addendum (2026-09-21) — Build 4.7 code poke

Source: Tester report on `frontend/src/musicUi.ts`, `PromptBuilderNode.tsx`, `backend/app/enhance.py`.

### Confirmed bugs (must fix)

| Pri | Bug | Fix |
|-----|-----|-----|
| **P0** | Notes → Style contamination: `sonicNotes` does not strip lyric-premise Notes (`lyrics about…`). `notesAskForLyrics` only matches `with lyrics` / `write lyrics` / etc. | Strip lyric-premise Notes (`\blyrics?\b`, “about …”) out of Style; park them as Lyrics Notes / Enhance-only input |
| **P0** | Instrumental OFF still emits `(instrumental…)` / `(no vocals)` unless sung-Notes path triggers; SECTION_CUE / INTRO_CUE are instrumental-only | When Instrumental OFF: **never** emit `(no vocals)` / `(instrumental…)` on Apply; use sung placeholders or leave section bodies for Enhance |
| **P0** | Sung Apply dumps entire Notes line under **every** section (`composeMusicLyrics`) | Notes is premise for Enhance, not paste-under-every-tag; Apply sung = tags + short sung placeholders only |
| **P0** | Enhance sung can still return cue-style lyrics when `instrumental:false` | Assert no instrumental parentheticals when `instrumental:false`; fallback = replace cues from Notes |
| **P1** | Arrangement = boolean set + fixed order (`lyricBlocks` + `seen`); max one of each tag; Buildup can steal Verse | Ordered section stack: counts, reorder, V–C–V–C |
| **P1** | Duration vs section-count (e.g. 300s + one V/C) under-fills | Warn or auto-repeat sections from Duration |
| **P2** | Builder `data.instrumental !== false` defaults undefined → ON | Bind Builder instrumental = Prompt node exact boolean |

### Updated acceptance (add to Tester checklist)

- [ ] Notes containing “lyrics about…” / `\blyrics?\b` never appear in Style (Instrumental on or off)
- [ ] Instrumental OFF Apply: Lyrics has `[…]` tags and **zero** `(instrumental…)` / `(no vocals)` parentheticals
- [ ] Instrumental OFF Apply: Notes is not duplicated under every section
- [ ] Enhance with `instrumental:false`: returned `lyrics` has real (or placeholder sung) lines; no instrumental cues left
- [ ] (P1) Can emit V–C–V–C (counts >1, reorderable stack)
- [ ] (P1) Duration ≫ section count → warn or auto-expand
- [ ] (P2) Builder Instrumental checkbox mirrors Prompt node boolean exactly

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

### Sung Enhance cue requirement (Build)

When Instrumental is OFF, Enhance **must** emit one musical `(cue)` under each `[Section]` before sung lines (Creative on or off). Do not instruct the model to replace all parentheticals with sung lines. See `BUILD_YuE2_Music_Builder_Fixes.md` P0 cue section.
