# ACE 1.5 Turbo Dialog Rock Bed

**File:** `ACE STEP 1.5 TURBO DIALOG ROCK BED.json`  
**Model:** ACE-Step 1.5 **Turbo only** — **no rock LoRA** (plain turbo sounded better in your tests).

## Defaults
- BPM **124**, key **A minor**, **36s**, instrumental section markers only
- Modern Queens NY / 2020s alt-rock bed energy (no punk / Ramones)
- WAV via `SaveModernAudio`

## How to use
1. Open the JSON in Comfy (or queue via AIMS key `ace_dialog_rock_bed`).
2. Tweak **tags** on `TextEncodeAceStepAudio1.5` if needed; leave lyrics as section markers.
3. Randomize sampler seed a few times; pick the greasiest groove.
4. EQ midrange under dialog in Resolve.

## Optional kaola refine (when Comfy is up + pack models present)
- **Captioner:** Load a reference track you like, copy style tags into this graph's tags.
- **Repaint:** Fix a time range on a near-miss bed without full reroll.
- Needs `ACE-Step/acestep-captioner` (and full kaola checkpoint tree for Repaint).

## Why no LoRA
Rock LoRA was washing turbo quality even at 0.55. This graph stays on stock turbo.
