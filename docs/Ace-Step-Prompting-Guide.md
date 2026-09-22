# Ace-Step (ACE-Step) Prompting Guide

**Audience:** Grok Build 4.7 / AI Media Studio V2 implementers  
**Family:** ACE-Step / AceStep open music generation (ACE Studio + StepFun)  
**Focus:** **ACE-Step 1.5** (current open stack); note **1.0 / fal.ai** differences  
**Last researched:** 2026-09-21 (America/Edmonton)

---

## What it is

ACE-Step 1.5 is an open music foundation model that generates **48 kHz stereo** tracks from a text **caption/tags** field plus optional **structured lyrics**, with duration typically **10–600 seconds**. Architecture: optional **5 Hz LM planner** (CoT metadata + semantic codes) + **DiT** synthesizer (flow matching). It is built for iterative, human-in-the-loop workflows (generate → cover/remix → repaint), not Suno-style single-box prompts. Variants: **turbo** (8-step, CFG distilled), **sft**, **base** (+ XL 4B counterparts).

---

## Input fields / schema

### ACE-Step 1.5 official (`GenerationParams`)

| Field | Alias / UI | Type | Default | Notes |
|-------|------------|------|---------|-------|
| `caption` | tags / prompt | str | `""` | Overall sound: genre, instruments, mood, vocals, production. **Max 512 characters** (official inference docs). |
| `lyrics` | lyrics | str | `""` | Temporal script: lyric lines + structure tags. Use `[Instrumental]` for instrumental. **Max 4096 characters**. |
| `instrumental` | checkbox | bool | `false` | Force instrumental even if lyrics present. |
| `duration` | audio_duration | float | `-1` | Target seconds **10–600**; `<=0` → auto from lyrics. |
| `bpm` | | int? | `None` | **30–300**; prefer dedicated field, not caption. |
| `keyscale` | key | str | `""` | e.g. `C Major`, `Am`, `F# minor`. |
| `timesignature` | | str | `""` | `2`/`3`/`4`/`6` → 2/4, 3/4, 4/4, 6/8. |
| `vocal_language` | language | str | `"unknown"` | ISO-ish: `en`, `zh`, `ja`, … or auto. |
| `task_type` | | str | `text2music` | Also: `cover`, `repaint`, `lego`, `extract`, `complete` (last three **base**). |
| `inference_steps` | steps | int | `8` | Turbo: ~8; base/sft often **30–60** for quality. |
| `guidance_scale` | CFG | float | `7.0` | **Base/SFT only**. Turbo ignores / forces ~1.0. Typical **5–9**. |
| `shift` | | float | `1.0` docs / **3.0** turbo practice | Timestep shift; **set 3.0 for turbo**. |
| `seed` | | int | `-1` | Random if -1. |
| `thinking` | LM CoT | bool | `True` | LM planning; auto-skipped for cover/repaint/extract. |
| `reference_audio` | | path | — | Global timbre/style reference. |
| `src_audio` | | path | — | Required for cover/repaint/lego/extract/complete. |
| `audio_cover_strength` | remix strength | float | `1.0` | 0–1; lower = freer style transfer. |

Diffusers `AceStepPipeline` names: `prompt` (= caption), `lyrics`, `audio_duration`, `num_inference_steps`, `guidance_scale`, `shift`, `bpm`, `keyscale`, `timesignature`, `vocal_language`. Token caps: `max_text_length=256`, `max_lyric_length=2048` (token lengths, not chars).

### ComfyUI 1.5 node (`TextEncodeAceStepAudio1.5`)

| Input | Default | Notes |
|-------|---------|-------|
| `tags` | — | Caption/tags string |
| `lyrics` | — | Structured lyrics |
| `bpm` | 120 | |
| `duration` | 120 | 0–2000 in node UI |
| `timesignature` | combo 2/3/4/6 | |
| `language` | `en` | many ISO codes + `unknown` |
| `keyscale` | root + major/minor | |
| `generate_audio_codes` | true | LM codes; off if using audio reference |
| LM sampling | cfg_scale 2.0, temp 0.85, top_p 0.9 | LM-side, not DiT CFG |

### fal.ai `fal-ai/ace-step` (likely **1.0-era** API — different limits)

| Field | Notes |
|-------|-------|
| `tags` (required) | Comma-separated genre tags; also accept `prompt` |
| `lyrics` | `[verse]`/`[chorus]`/`[bridge]`; `[inst]`/`[instrumental]` = no vocals |
| `duration` | Default 60; range **5–240** |
| `number_of_steps` | Default 27; 3–60 |
| `guidance_scale` | Default 15; plus `tag_guidance_scale`, `lyric_guidance_scale` |

**Implementer note:** Prefer 1.5 field names (`caption`/`tags`, `lyrics`, `duration`, `bpm`, …) in Media Studio; map fal/1.0 separately if that host is used.

---

## Caption / tags vs lyrics

| Concern | Put in `caption` / `tags` | Put in `lyrics` |
|---------|---------------------------|-----------------|
| Genre, mood, instruments, production | ✓ | ✗ (except short section style suffixes) |
| Vocal gender / timbre | ✓ | Optional `[whispered]`-style tags |
| BPM / key / meter | Prefer **metadata fields** | Avoid duplicating conflicting BPM in caption (official tutorial) |
| Song words | ✗ | ✓ |
| Form over time | Light hints OK | **Structure tags** are authoritative |
| Solos / drops / energy arcs | Optional | `[Guitar Solo]`, `[Drop]`, `[building energy]` |

**Consistency rule:** Caption and lyrics must tell the same story. Conflict (caption: violin chamber; lyrics: `[Guitar Solo - distorted]`) degrades quality.

Official tutorial: caption formats may be simple words, comma tags, or natural language — model is trained to accept all. **Specific beats vague.**

---

## Prompting rules that work

### Caption / tags

1. Combine dimensions: genre + emotion + 2–3 instruments + vocal + production + tempo feel.
2. Prefer concrete instruments (`fingerpicked acoustic guitar`) over vague adjectives alone.
3. Avoid conflicting poles (`lo-fi` + `hi-fi`, `aggressive` + `serene`) unless framed as **time evolution** (“start soft strings, mid metal, end hip-hop”).
4. Repetition can reinforce a desired element in mixed styles.
5. Keep caption within **512 characters** (1.5 API). Practical sweet spot often ~5–12 strong tags (community guides).
6. Do **not** put BPM/key in caption when metadata fields exist — set `bpm` / `keyscale` / `timesignature` instead (official tutorial recommendation).

**Caption formula (practical):**
```text
[genre], [mood], [2-3 instruments], [vocal type], [production], [era optional]
```
Example: `pop ballad, emotional, intimate, piano, strings, soft female vocal, studio-polished, building chorus`

### Lyrics structure

**Common tags (official tutorial + HF tips):**

| Category | Tags |
|----------|------|
| Form | `[Intro]`, `[Verse]` / `[Verse 1]`, `[Pre-Chorus]`, `[Chorus]`, `[Bridge]`, `[Outro]` |
| Electronic | `[Build]`, `[Drop]`, `[Breakdown]` |
| Instrumental | `[Instrumental]`, `[Guitar Solo]`, `[Piano Interlude]` |
| Special | `[Fade Out]`, `[Silence]` |

**Composition tips:**

- Blank line between sections.
- Optional combined tags: `[Chorus - anthemic]` — **do not stack** five modifiers (model may sing the tags).
- ~**6–10 syllables per line** (tutorial); community often cites 4–8.
- `UPPERCASE` for intensity; `(parentheses)` for BVs/harmonies.
- Language: set `vocal_language`; some hosts also use `[en]` / `[ja]` section markers (community / deAPI) — prefer official language field when available.
- Instrumental: lyrics = `[Instrumental]` **or** structure tags with empty bodies **or** `instrumental=true`. Do not mix “no vocals” tags with full lyric text.

### Duration, CFG, steps

| Setting | Turbo | Base / SFT |
|---------|-------|------------|
| Steps | **8** (typical) | **32–64** common; up to 100+ |
| CFG `guidance_scale` | **Ignored** (distilled) | **5–9** sweet; >15 risk artifacts |
| `shift` | **3.0** recommended | Often 3.0 in HF defaults |
| Duration | 10–600 s (1.5); very long may drift | Same; XL better for long-form (community) |

LM (when `thinking=true`): `lm_temperature` ~0.85, `lm_cfg_scale` ~2.0; can rewrite caption / infer metas.

---

## Structure templates

### Vocal pop (1.5)

**Caption**
```text
indie pop, uplifting, electric guitar, synth bass, tight drums, bright female vocal, polished mix, catchy hook
```

**Metadata:** `bpm=118`, `keyscale=C Major`, `timesignature=4`, `duration=180`, `vocal_language=en`

**Lyrics**
```text
[Intro]

[Verse 1]
Coffee steam on window glass
Maps we folded in the past
Say the word and we can leave
Softer evenings up our sleeves

[Pre-Chorus]
Hold the quiet in your hands

[Chorus]
Let the morning find our names
Every street still feels the same
Open windows, open sky
We can learn to say goodbye

[Verse 2]
Neon humming down the block
Keys are ticking like a clock
If the signal starts to fade
We will walk the quieter grade

[Bridge - whispered]
If tomorrow pulls apart
Keep the chorus in your heart

[Chorus]
Let the morning find our names
Every street still feels the same
Open windows, open sky
We can learn to say goodbye

[Outro - fade out]
```

### Instrumental techno

**Caption**
```text
progressive techno, dark, hypnotic, analog modular, 909 drums, acid bass, atmospheric pad, no vocals, hi-fi, wide stereo
```

**Metadata:** `bpm=134`, `duration=240`, `instrumental=true`

**Lyrics**
```text
[Intro]

[Instrumental]

[Build]

[Drop]

[Breakdown]

[Build]

[Drop]

[Outro]
```

### Minimal fal / 1.0-style tags

```text
tags: lofi, hiphop, chill, vinyl crackle, soft male vocal, 88 bpm
lyrics: [verse]\n...\n[chorus]\n...
duration: 60
```

---

## Full example (complete Style+Lyrics equivalent)

```json
{
  "task_type": "text2music",
  "caption": "female vocal, piano ballad, emotional, intimate atmosphere, strings, building to powerful chorus",
  "lyrics": "[Intro - piano]\n\n[Verse 1]\nMoonlight on the window frame\nI can hear you breathe my name\nCity sleeping far away\nOnly we are still awake\n\n[Pre-Chorus]\nQuiet holds a rising tide\nSomething fierce we keep inside\n\n[Chorus - powerful]\nLet us burn against the night\nLike fireworks in open sky\nBrief and bright before we fall\nThis is our moment after all\n\n[Bridge - whispered]\nIf tomorrow comes undone\nWe still shone before the sun\n\n[Final Chorus]\nLet us burn against the night\nLike fireworks in open sky\nBrief and bright before we fall\nTHIS IS OUR MOMENT!\n\n[Outro - fade out]",
  "bpm": 72,
  "keyscale": "A minor",
  "timesignature": "4",
  "duration": 210,
  "vocal_language": "en",
  "inference_steps": 8,
  "guidance_scale": 7.0,
  "shift": 3.0,
  "thinking": true,
  "seed": 42
}
```

(For turbo: keep steps=8, shift=3.0; CFG value is ignored. For base quality pass: steps=40–60, guidance_scale=7–9.)

---

## Anti-patterns / what breaks quality

| Anti-pattern | Effect |
|--------------|--------|
| One vague sentence as caption (`good sad song`) | Weak anchoring |
| Contradictory caption vs lyrics tags | Confused arrangement |
| Stacked section tags (`[Chorus - anthemic - epic - powerful - …]`) | Tags sung as lyrics / muddled control |
| 15+ competing genre tags | Dilution / noise |
| Lines with 12–18+ syllables | Fractured vocal timing |
| `no vocals` in tags **and** full lyric text | Weird wordless vocals |
| BPM in caption fighting `bpm` field | Metadata conflict |
| Extreme BPM (30 or 280) / rare meters | Sparse training → unstable |
| Expecting turbo CFG to do something | Distilled; ignored |
| `shift=1.0` on turbo without trying 3.0 | Weaker structure (docs recommend 3.0) |
| Suno-only meta syntax | Not ACE-Step native; prefer tags + section headers |

---

## Notes for app / Grok Build implementers

1. **UI split (required):**  
   - **Tags/Caption** (short; show **512** soft/hard limit for 1.5)  
   - **Lyrics** (large; show **4096** soft/hard limit)  
   - Optional metadata: duration, BPM, key, time signature, language, instrumental toggle  
   - Advanced: steps, CFG (disable/hide when turbo), shift, seed, thinking/LM

2. **Field name aliases to accept:** `caption` ↔ `tags` ↔ `prompt`; `duration` ↔ `audio_duration`.

3. **Section chip helpers:** Intro, Verse, Pre-Chorus, Chorus, Bridge, Outro, Instrumental, Build, Drop, Breakdown.

4. **Validation:**
   - Caption length ≤ 512 (1.5).
   - Lyrics length ≤ 4096 (1.5).
   - Duration clamp **10–600** (1.5) or **5–240** if fal 1.0 host.
   - Warn on caption/lyrics instrument conflicts (heuristic).
   - Warn if lyrics have no `[` tags for vocal songs.
   - If `instrumental`, prefer clearing lyric lines or setting lyrics to `[Instrumental]`.

5. **Defaults for studio:** turbo path → steps 8, shift 3.0, thinking on, duration -1 or 120–180, batch 2 when supported.

6. **Do not** present ACE-Step as Suno; document two-field model clearly in tooltips.

7. **Version badge in UI:** “ACE-Step 1.5” vs “ACE-Step (fal/1.0)” so limits/CFG behavior stay honest.

---

## Sources

Primary (1.5):

- [ACE-Step-1.5 Tutorial](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Tutorial.md)
- [ACE-Step-1.5 INFERENCE.md](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/INFERENCE.md)
- [ACE-Step-1.5 GRADIO_GUIDE.md](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/GRADIO_GUIDE.md)
- [Diffusers AceStepPipeline](https://huggingface.co/docs/diffusers/api/pipelines/ace_step)
- [ComfyUI `nodes_ace.py`](https://raw.githubusercontent.com/Comfy-Org/ComfyUI/master/comfy_extras/nodes_ace.py)

Secondary:

- [deAPI ACE-Step 1.5 prompting guide](https://deapi.ai/blog/ace-step-1-5-prompting-guide-how-to-write-tags-structure-lyrics-and-generate-better-music) — strong examples; some host-specific claims
- [fal.ai ACE-Step API](https://fal.ai/models/fal-ai/ace-step/llms.txt) — **1.0-style** schema/limits

### Open questions / uncertainty

- fal.ai endpoint schema differs from 1.5 (duration max 240, dual guidance scales) — treat as separate integration.
- Community lowercase `[verse]` vs official tutorial Title Case `[Verse]` — both appear; model accepts both in practice (**uncertain** which is strictly preferred).
- deAPI claims (XL long-form coherence, exact CFG bands) are useful but not all mirrored in upstream docs — prefer Tutorial/INFERENCE on conflicts.
- Exact behavior of language markers like `[ja]` inside lyrics vs `vocal_language` alone is host-dependent.
