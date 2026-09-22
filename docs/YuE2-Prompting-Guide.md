# YuE2 Prompting Guide

**Audience:** Grok Build 4.7 / AI Media Studio V2 implementers  
**Model:** `m-a-p/YuE2-3B` (YuE2) — HKUST / M·A·P  
**Last researched:** 2026-09-21 (America/Edmonton)

---

## What it is

YuE2 is an open frontier music model (~3.6B) that turns a **style** prompt + **section-tagged lyrics** into a full 48 kHz stereo song (vocals + accompaniment). With `cot="full"` or `cot="melody"`, it first writes an editable **ABC score** (melody ± chords), then synthesizes audio from that plan. Quality is competitive with proprietary systems on WildSongBench; it is designed for compose → inspect/edit ABC → re-render workflows, not Suno-style one-box magic tags.

---

## Input fields / schema

### Core request (official HF / `YuE2Pipeline`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `style` | string | yes | Genre, instruments, vocal character, language, tempo/BPM feel, mood/mix. Free text / tag-like phrases. |
| `lyrics` | string | yes | Section-tagged lyric text. Blank lines between sections. |
| `cot` | `"full"` \| `"melody"` \| `"off"` | no (default `full`) | Planning mode. Also called **mode** in ComfyUI. |
| `abc` | string | no | Optional ABC score. Requires `cot` = `full` or `melody`. Empty ABC → ComfyUI forces `off`. |
| `seed` | int | no | Reproducibility. |
| `cfg_scale` | float | no | Text guidance. Defaults: **1.0** for full/melody; **1.01** for off. HF suggests trying **1.2**. |

### ComfyUI nodes (`YuE2GenerateABC` / `YuE2GenerateMusic`)

| Field | Default | Range / options | Notes |
|-------|---------|-----------------|-------|
| `style` | — | multiline string | Same as pipeline |
| `lyrics` | — | multiline string | Same as pipeline |
| `mode` | — | `full` \| `melody` | Maps to `cot` (ABC node has no `off`; empty ABC → music node uses `off`) |
| `abc` | `""` | string | Paste/edit score; empty → off mode |
| `max_duration` | **360** | **0.04–900** s | Cap on generation length; may stop earlier; auto-reduced for long prompts |
| `seed` | 0 | uint64 | |
| `cfg_scale` | 1.0 (or 1.01 if off) | 0–100 | AR guidance for style/lyrics |
| Sampling | temp / top_p / top_k / rep_penalty | advanced | ABC node defaults differ from music node |

### App UX mapping (recommended)

Align with prior Prompty / Media Studio patterns:

| UI label | Internal field | Generate ABC | Generate Music |
|----------|----------------|--------------|----------------|
| Style | `style` | same | same |
| Lyrics | `lyrics` | same | same |
| Mode | `cot` / `mode` | `full` (typical) | `full` / `melody` / `off` |
| Max duration | `max_duration` | n/a (use `max_abc_tokens`) | e.g. 280–360 |
| Fresh T2M | (no paste-ABC) | generate new ABC | use new ABC |
| Paste ABC | `abc` | off | on when editing |

**Rule:** Use the **same** `style` + `lyrics` for Generate ABC and Generate Music. Changing one without the other desyncs plan vs audio.

### Character / length limits

| Limit | Status | Source |
|-------|--------|--------|
| Suno-style **1000-char style** cap | **Does not apply** to YuE2 | Suno-only; do not invent |
| Official `style` / `lyrics` char max | **Not documented** in YuE2 HF/docs | No hard API limit found |
| Practical style length | Short tag phrases work; demo styles ~100 chars | `tonight-awake.json` style = 100 chars |
| Per-section lyrics density | Keep each section roughly **~30 s** of singing; avoid overcrowding | YuE1 README guidance (still cited for structure); community/YuE2 blogs |
| `max_duration` (Comfy) | **0.04–900 s**, default **360** | ComfyUI `nodes_yue2.py` |
| Token truncation | Audio can still save if model hits token limit | Official `generation.md` |

**Uncertainty:** If a hosted API adds its own caps, document those at the integration layer — they are not YuE2 model limits.

---

## Prompting rules that work

### Style (`style`)

Put **what it sounds like**, not the lyric words:

1. **Genre / subgenre** — e.g. `City Pop`, `English warm piano pop`, `Jazz-funk`
2. **Vocal type** — gender/character (`expressive female voice`, `warm lead vocal`); omit for instrumental attempts
3. **Instruments** — concrete: `Rhodes piano`, `groovy bass`, `tight drums`
4. **Tempo / BPM feel** — `88 BPM`, `upbeat`, `unhurried phrasing`
5. **Key / harmonic feel** (optional) — soft hints only; harmony often comes from ABC plan
6. **Mix / mood** — `energetic`, `joyful`, `neon city night`, `spacious`
7. **Language** — include when vocals matter (`English`, `Mandarin`); **omit** for instrumental tries

**Format:** Comma- or space-separated descriptive phrases (official examples use commas). Not Suno meta-tags (`[Super Hook]`, `v5`, etc.).

**Stability tip (YuE1 heritage, still useful):** A stable tag set often includes genre + instrument + mood + gender + timbre. Prefer open-vocabulary tags that match music vocabulary; YuE1 published a top-200 tag list for older checkpoints — YuE2 examples are freer prose-tags.

### Lyrics (`lyrics`)

1. Use **section tags** in square brackets.
2. Separate sections with a **blank line** (`\n\n`).
3. Keep lines singable; similar syllable counts within a section.
4. Start with **`[Verse]`** or **`[Chorus]`** when possible — YuE1 docs note **`[Intro]` is less stable**; YuE2 official demos still use `[Intro]` successfully, so Intro is OK but not required.
5. Instrumental passages: empty section bodies or `(instrumental, …)` descriptions under a tag — see Instrumental below.
6. Multilingual OK (EN, zh, yue, ja, ko, …). Keep language consistent with `style`.

### CoT / mode

| Mode | Behavior | When to use |
|------|----------|-------------|
| `full` | Melody + chord plan → audio | **Default** new songs; best musical coherence |
| `melody` | Melody plan, freer accompaniment | **Covers**; supply melody ABC without chords |
| `off` | No symbolic plan; style+lyrics only | Faster / more varied; empty ABC in Comfy |

### ABC workflow

1. Generate ABC with same style+lyrics (`cot=full` or `melody`).
2. Optionally edit ABC (or agent-edit).
3. Render music with **same** style+lyrics + edited `abc`.
4. Do not mutate a saved plan in place for “unchanged” reloads — copy ABC and resubmit as new `abc` input.

---

## Structure templates

### Vocal song (copy-paste)

**Style**
```text
English, indie pop, expressive female voice, acoustic guitar, warm bass, light drums, catchy melody, mid-tempo, 108 BPM, intimate bright mix
```

**Lyrics**
```text
[Verse 1]
Neon fades along the lane
Footsteps keep the time of rain
Fold the night and leave it here
Morning has a sky to clear

[Pre-Chorus]
Hold the quiet in your hands
Before the chorus lands

[Chorus]
Let the day come into view
Every road begins with you
Hold a little room for light
We will sing beyond the night

[Verse 2]
Coffee steam and open doors
Maps we never used before
Say the word and we will go
Where the softer evenings grow

[Bridge]
If the signal starts to break
We can still find our own way

[Chorus]
Let the day come into view
Every road begins with you
Hold a little room for light
We will sing beyond the night

[Outro]
Beyond the night
```

### Instrumental attempt (best-effort)

**Official reliability is limited** (community HF discussions: vocals often leak). Preferred pattern from community + engineering blogs:

**Style** — no language/vocalist:
```text
cinematic post-rock, wide guitars, driving drums, deep bass, ambient pads, building energy, 120 BPM, instrumental focus, no vocals
```

**Lyrics** — empty sections (structure only):
```text
[Intro]

[Verse]

[Chorus]

[Bridge]

[Chorus]

[Outro]
```

Alternative labels sometimes used: `[Instrumental]`, `[Interlude]`, `(instrumental, guitar solo)`. **Mark as unreliable** in UI copy — YuE2 is vocal-strong; true instrumental may need LoRA / post vocal-remove / ABC vocal-voice stripping (community workarounds).

### Cover (melody mode)

```text
style: Jazz-funk, warm lead vocal, Rhodes piano, electric bass, tight drums
lyrics: <section-tagged lyrics matching source form>
abc: <melody.abc without chord symbols>
cot: melody
```

---

## Full example (official-style)

From HF demo pattern (`今晚不眠` / city-pop) — English adaptation of schema:

**Request JSON**
```json
{
  "style": "City Pop, upbeat, danceable, groovy bass, electric guitar, synth, energetic, joyful, neon city night",
  "lyrics": "[Intro]\n\n[Verse]\nStreetlights blink like they know my name\nSidewalk hums a lighter frame\nNight wind paints the neon gold\nFootsteps lock to drums of old\n\n[Pre-Chorus]\nRecords spin and cut the quiet\nBubbles rise and hearts go riot\nDrop the worry, let it slide\nMagic hanging in the night\n\n[Chorus]\nStay awake tonight, joy on fire\nCity in a carnival choir\nSway until the edges blur\nOpen up and ride the surge\n\n[Bridge]\nLike orange soda, sweet and light\nLike a meteor across the night\nNo reason needed, only feel\nThis second turning into real\n\n[Chorus]\nStay awake tonight, joy on fire\nCity in a carnival choir\nSway until the edges blur\nOpen up and ride the surge\n\n[Outro]\nNeon wind toward the dream\nSway\nShine\nYeah",
  "cot": "full",
  "seed": 12300
}
```

Official Mandarin demo: <https://huggingface.co/m-a-p/YuE2-3B> → `examples/tonight-awake.json`.

---

## Anti-patterns / what breaks quality

| Anti-pattern | Why it hurts |
|--------------|--------------|
| Suno-only tags (`[Hook]`, `@@`, `v4.5`, weird meta) | Not in YuE2 training surface; invents nothing useful |
| Style/lyrics mismatch (style: jazz trio; lyrics: metal scream cues) | Model does not resolve conflicts well |
| Overpacked sections (huge verse blocks) | Timing/token pressure; aim ~30 s per section |
| Different style/lyrics for ABC vs Music | Plan and audio diverge |
| Empty `abc` while expecting `full` plan | ComfyUI switches to `off` |
| Forcing instrumental with vocalist/language in style | Increases vocal leakage |
| Relying on `[Intro]` alone as first section | Historically less stable (YuE1); prefer Verse/Chorus start if Intro fails |
| Huge `cfg_scale` without testing | Defaults are tuned; only nudge (e.g. 1.2) |
| Assuming 1000-char style limit | That is Suno; do not enforce as YuE2 truth |

---

## Notes for app / Grok Build implementers

1. **Two-panel prompt UI:** Style (single-line or short multiline) + Lyrics (large multiline with section helper chips: Intro, Verse, Pre-Chorus, Chorus, Bridge, Outro, Instrumental).
2. **Mode enum:** `full` | `melody` | `off` — label for users: “Melody + chords (recommended)” / “Melody only (covers)” / “Direct (no ABC plan)”.
3. **Fresh T2M:** Boolean — when true, clear pasted ABC; Generate ABC then Generate Music with identical style/lyrics.
4. **Validation tips:**
   - Warn if lyrics lack any `[Section]` tags.
   - Warn if style contains known Suno meta patterns.
   - Soft-warn if a single section exceeds ~800–1200 characters (heuristic; not official).
   - Clamp `max_duration` to **0.04–900**; default **280–360** for studio UX.
   - Require same style+lyrics hash when pairing ABC→Music.
5. **Field names to prefer in code:** `style`, `lyrics`, `cot` (or `mode`), `abc`, `max_duration`, `seed`, `cfg_scale`.
6. **Outputs to expose:** audio, `score.abc`, seed, effective cot, truncation flags if API provides them.
7. **Do not** copy Suno style char counter as a hard YuE2 limit unless a specific host documents one.

---

## Sources

Primary:

- [m-a-p/YuE2-3B (Hugging Face)](https://huggingface.co/m-a-p/YuE2-3B)
- [YuE `docs/generation.md`](https://raw.githubusercontent.com/multimodal-art-projection/YuE/main/docs/generation.md)
- [examples/song.json](https://raw.githubusercontent.com/multimodal-art-projection/YuE/main/examples/song.json)
- [examples/tonight-awake.json](https://huggingface.co/m-a-p/YuE2-3B/raw/main/examples/tonight-awake.json)
- [ComfyUI `nodes_yue2.py`](https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/comfy_extras/nodes_yue2.py)
- [YuE2 project site](https://map-yue2.github.io/)

Secondary / heritage:

- [YuE README prompt engineering (YuE1)](https://github.com/multimodal-art-projection/YuE) — section tags, ~30 s/session, Intro caveat
- [Engineered.at YuE2 style/lyrics guide](https://engineered.at/articles/generate-music-with-yue2-a-simple-guide-to-style-and-lyrics-prompts)
- HF discussions on instrumental reliability: [YuE2-3B #1](https://huggingface.co/m-a-p/YuE2-3B/discussions/1)

### Open questions / uncertainty

- No official hard **character** limit for `style`/`lyrics` on YuE2 itself.
- Instrumental-only generation is **not** first-class / reliable per community reports.
- Exact `FRAMES_PER_SECOND` / token math is Comfy-internal; treat `max_duration` as the user-facing knob.
