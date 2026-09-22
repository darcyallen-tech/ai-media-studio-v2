# Qwen Image 2.1 — Prompting Guide (T2I + R2I)

**Audience:** Grok Build 4.7 / AI Media Studio V2 implementers + prompt UX / Enhance  
**Family:** Alibaba Qwen — `Qwen/Qwen-Image-2.1` (unified T2I + edit / Ref2Image)  
**Aliases in Studio:** R2I = reference-to-image = Comfy **Ref2Image** = Diffusers `image=[...]` conditioning  
**Last researched:** 2026-09-21 (America/Edmonton / MDT)  
**Session lessons:** Prompty ↔ Darcy Allen, 2026-09-21 (character sheet / multi-ref battles)

---

## What it is

Qwen-Image-2.1 is a **unified** open-weight image model (7B visual DiT + Qwen3-VL text/vision encoder). One checkpoint does:

| Mode | What you feed | What you get |
|------|---------------|--------------|
| **T2I** | Text only | New image (RGB or native **RGBA**) |
| **Edit / R2I** | Text + 1–**10** reference images | New composition conditioned on refs |
| **Local edit** | Ref + circle / paint / separate mask image | Targeted change; rest should stay |

**Not** a classic SD img2img denoise-on-latent path by default in Comfy Ref2Image — refs ride through the **VL encoder + VAE latents into conditioning** (`TextEncodeQwenImage21` / Diffusers `image=`). Sampler often runs at **denoise=1** on an empty latent sized by you (or sized from image 1 for in-place edit).

**Uncertainty:** Host APIs (fal, third-party) may expose fewer refs, different size enums, or a separate “strength” dial. Always map to the **actual backend** Media Studio wires.

---

## Modes: T2I vs R2I / multi-ref

### T2I (no refs)

- Natural-language English (or Chinese) works; **longer, structured prompts outperform short tags**.
- Optional rewriter: `Qwen/Qwen-Image-2.1-PE-T2I` → `{ rewritten_prompt, wh_ratio }`.
- Official size table (map `wh_ratio` → W×H):

| Ratio | W×H (official) |
|-------|----------------|
| 1:1 | 2048×2048 |
| 16:9 | **2752×1536** |
| 9:16 | 1536×2752 |
| 4:3 | 2400×1792 |
| 3:4 | 1792×2400 |
| 3:2 | 2528×1696 |
| 2:3 | 1696×2528 |

Use **multiples of 32**. Comfy templates often use Resolution Selector ~**2–4 MP** (faster than full 2K).

### R2I / Ref2Image / Edit (1–10 refs)

- Wire refs as **Image1…ImageN** in **fixed upload order**.
- Prompt must name roles with **`<image1>` … `<imageN>`** (Comfy / PE-I2I) or **"image 1" / "Image1"** (some hosts). **Keep order and labels consistent.**
- Optional rewriter: `Qwen/Qwen-Image-2.1-PE-I2I` → `{ rewritten_prompt, wh_ratio | ratio_follow }`.
  - `ratio_follow: "<image1>"` → inherit aspect from first ref (Alfred / PE note).
  - `wh_ratio: "16:9"` → new cinematic frame (custom W×H from table).

### When to pick which

| Goal | Mode |
|------|------|
| New character sheet / lookdev on white | **T2I** |
| Same person, new pose/wardrobe/scene | **R2I single** |
| Multi-angle sheet from one identity ref | **R2I single** + anti-sheet language |
| Two distinct fighters / allies | **R2I multi** (2–4+ sheets) + slot map |
| Product + label + scene | **R2I multi** with explicit role lines |

---

## Input schema / Media Studio UX mapping

### Canonical fields (Build should expose)

| Studio UX | Wire to | Notes |
|-----------|---------|-------|
| **Prompt** | `prompt` | Primary; long OK. Prefer structured blocks (see templates). |
| **Negative** | `negative_prompt` | Only effective if CFG/`true_cfg_scale` **> 1** (Diffusers). Comfy often uses `ConditioningZeroOut` at cfg=1 — negatives may be **ignored** until CFG raised. |
| **Image1…ImageN** | `image` list / Comfy `images.image_1`…`image_10` | Cap **10** model-side. Host may be lower (e.g. fal Qwen Image 2 edit historically **1–3**). |
| **Aspect / size** | `width`/`height` or enum | T2I: user or PE `wh_ratio`. R2I edit-in-place: follow Image1. R2I cinematic: force **16:9** (2752×1536 or scaled). |
| **Steps** | `num_inference_steps` / KSampler steps | Diffusers default **40**. Comfy templates **25**. Soft identity → climb to 40 before CFG. |
| **CFG** | Comfy `cfg` / Diffusers `true_cfg_scale` | Default **1.0** (guidance off). Raise **only with** a negative (even `" "`). Doubles compute. |
| **Denoise / strength** | KSampler `denoise` / Diffusers `strength` (img2img pipelines) | **Ref2Image empty-latent path:** denoise usually **1.0**. Classic img2img: mid **0.55–0.75** preserves more of encoded latent — only if latent **is** VAE-encoded source (not EmptyLatent). |
| **Seed** | `seed` / generator | High variance; keep fixed when A/B testing prompts. |
| **Enhance / PE** | PE-T2I or PE-I2I | Optional; do **not** let rewriter strip anti-clone / slot-map lines. |

### Slot wiring rules (critical)

1. **Image1 = primary identity** unless the prompt says otherwise.
2. Prompt labels must match indices: Woman A → Image1, Woman B → Image2, …
3. If user reorders uploads, **rewrite prompt slots** (or auto-inject a slot map from UI).
4. Sheet compose / multi-character: validate `len(refs) == claimed_count` in prompt (“exactly two women” ↔ 2 refs).
5. Cap UI to `min(10, host_max_refs)` and print `N / cap`.

### Prompt length limits (**uncertain by host**)

| Stack | Observed limit | Guidance |
|-------|----------------|----------|
| Diffusers `max_sequence_length` | Docs cite **512** (pipeline) / encode helpers up to **1024** | Prefer dense prose over tag soup; PE expands short briefs. |
| fal `fal-ai/qwen-image-2/edit` (legacy 2.0 path; **marked unsupported**) | Prompt **800** chars; negative **500** | Truncation risk for multi-character packs — prefer local/Comfy or a 2.1 host with higher caps. |
| Community 2.1 APIs | Claims vary (e.g. ~5k chars) | **Verify Live** before locking Enhance max. |

**Mark uncertain:** Confirm the exact Media Studio backend endpoint’s char/token cap in catalog specs before clamping Enhance.

---

## Prompting rules that work

### Structure (recommended order)

1. **Slot map** — what each ImageN supplies (identity / garment / scene).  
2. **Count lock** — “exactly one woman” / “exactly two distinct women”.  
3. **Preserve** — face, hair, body proportions, skin tone from named ref(s).  
4. **Change** — scene, wardrobe, pose, camera, action.  
5. **Composition** — framing, formation, aspect intent.  
6. **Lighting / camera / style**.  
7. **Forbid** — sheet bleed, clones, labels, blending (positive “do not” lines **and** negatives).

Subject → action → environment → lighting → camera still works for pure T2I; for R2I **put slot map first**.

### Hard rules from session (2026-09-21)

1. **Character sheet refs are identity ONLY** unless you explicitly want a new sheet. Forbid recreating grid/panels/labels.
2. **Identity lock language beats vague “same person”.** Use: “Keep the exact same woman from the reference…”
3. **Multi-ref:** name distinct visual markers (hair, suit trim color) per slot — prevents hair-clone failure.
4. **Never copy one face onto another body** (quad-ref).
5. **Wide 16:9** for cinematic action; R2I may follow Image1 **or** custom W×H.

### RGBA (T2I stickers)

Scaffold required:

```text
This is an RGBA image with transparency. <subject>. The image has alpha channel and the background is transparent.
```

Save as PNG; confirm 4 channels.

---

## Character reference templates (copy-paste)

### A. T2I — full-body front character sheet (lookdev)

```text
Full-body front character reference sheet of one adult woman, standing straight, facing camera, arms relaxed at sides, neutral expression.
Irish features: fair freckled skin, green eyes, auburn wavy hair to shoulders, soft jaw.
Fitted dark tactical suit, clean silhouette, studio lookdev.
Pure white seamless background, even softbox lighting, no props, no text, no logos.
Photoreal, sharp focus, head-to-toe visible, centered, generous margin.
```

**Negatives (pack: sheet_t2i):**  
`side profile, three-quarter view, back view, cropped head, cropped feet, close-up only, busy background, environment, crowd, collage, grid, multiple panels, labeled views, text, watermark, logo, twins, clone`

### B. R2I single — identity lock + new scene/wardrobe

```text
Keep the exact same woman from <image1> — same face, age, freckles, eye color, hair color and length, body proportions, and identity.
Do not invent a new person.
Change only: wardrobe to a charcoal tactical suit with crimson trim; place her in a rain-slick neon alley at night.
Full-body three-quarter, walking toward camera, cinematic lighting, wet asphalt reflections.
Exactly one woman. Single continuous scene. Not a character sheet.
```

**Mid denoise tip:** On empty-latent Ref2Image, keep denoise **1.0** and rely on prompt lock; if using true img2img (VAE-encoded Image1 as latent), try **strength/denoise 0.55–0.75** for wardrobe/scene change with stronger face lock. (**Backend-dependent.**)

### C. R2I single — multi-angle sheet challenge (ref = identity ONLY)

```text
Identity reference only: <image1> provides the woman's face and body identity. Do NOT recreate the reference layout.
Generate a new full-body multi-angle character sheet of exactly one woman matching <image1>'s identity.
Clean white background. Separate clear views only if needed for a single sheet of ONE person — no duplicate clones.
Forbid: recreating the input sheet, grid bleed, panel labels, text callouts, collage of the same face pasted repeatedly.
Exactly one woman. Same freckles, hair, proportions as <image1>.
```

**Strong negatives:**  
`character sheet recreation, input sheet copy, collage, grid, panels, labeled views, front/side/back labels, clone, twins, duplicates, identical copies, busy bg, watermark`

### D. Dual-ref battle — Image1 + Image2 = two sheets → exactly two women

```text
Slot map:
- Woman A = exact identity from <image1> (face, hair, body). Suit trim: electric blue.
- Woman B = exact identity from <image2> (face, hair, body). Suit trim: amber gold.
They are two distinct women. Do not blend faces. Do not average features. Do not copy Woman A's hair onto Woman B.
Scene: facing each other in a wide 16:9 cinematic sparring hall, dynamic combat-ready stances, volumetric light.
Exactly two women in frame. No third person. No twins. No clones.
Never recreate character sheets, grids, panels, or labels from the references.
```

**Anti-blend negatives:**  
`face morph, blended face, average face, same hair on both, identical twins, clone, triplicate, character sheet, collage, grid, labels, text`

### E. Quad-ref allies — Image1–4 → exactly four distinct faces

```text
Slot map (diamond formation, wide 16:9):
- Front point Woman A = identity from <image1>, hair: short black undercut, suit trim: cyan
- Left Woman B = identity from <image2>, hair: long auburn braid, suit trim: crimson
- Right Woman C = identity from <image3>, hair: silver bob, suit trim: violet
- Rear Woman D = identity from <image4>, hair: dark coils with gold beads, suit trim: lime
Exactly four distinct women. Never copy one face onto another body. Never swap identities across slots.
Unified tactical team portrait, cohesive lighting, readable faces, no sheet/grid/labels.
```

**Negatives:**  
`face swap error, shared face, clone army, identical faces, character sheet, collage, grid, panels, labels, fifth person, crowd blur`

### F. Failed pattern mitigation (2-ref hair clone)

**Symptom:** Two refs → output women share similar hair / soft-averaged look.  
**Fix:** Stronger distinct identity lines + unique visual markers:

```text
Woman A (<image1>): keep her EXACT hair — [describe unique cut/color from ref]. Trim: matte white.
Woman B (<image2>): keep her EXACT hair — [different cut/color]. Trim: gloss black.
Hair must remain different between A and B. If unsure, prioritize reference hair silhouette over fashion defaults.
Anti-clone: no shared hairstyle, no face blend, no suit trim color bleed between A and B.
```

---

## Negative prompt packs

Use when **CFG / true_cfg_scale > 1**. At cfg=1 many Comfy graphs zero-out negatives — treat packs as **Enhance-injected positive “Do not:” lines** as well.

### `neg_quality`

```text
low resolution, blurry, worst quality, jpeg artifacts, watermark, logo, text artifacts, deformed hands, extra fingers, bad anatomy
```

### `neg_sheet_bleed`

```text
character sheet, model sheet, turnaround sheet, collage, grid, multi-panel, labeled views, front side back labels, UI mockup, reference board
```

### `neg_clone`

```text
clone, twins, duplicate people, identical faces, face morph, blended identity, copy-paste face, same hair on multiple people
```

### `neg_crop_bg` (T2I sheet)

```text
side profile, cropped head, cropped feet, close-up only, busy background, cluttered set, crowd
```

### Combined multi-character (session default)

```text
character sheet, collage, grid, panels, labeled views, clone, twins, face morph, blended face, identical hair, watermark, text, logo, extra people
```

---

## Anti-clone / anti-sheet-bleed checklist

Before Generate (UX or Enhance validator):

- [ ] Slot map present for every uploaded ImageN used as identity  
- [ ] Explicit **exactly N** people matching ref count  
- [ ] “Identity / face / hair / proportions from `<imageK>`” per person  
- [ ] Unique markers (trim color, hair) when N≥2  
- [ ] “Never recreate sheet/grid/panels/labels” if any ref is a sheet  
- [ ] “Never copy one face onto another body” if N≥2  
- [ ] “Do not blend / average faces”  
- [ ] Neg pack `neg_sheet_bleed` + `neg_clone` (or positive Do-not block if cfg=1)  
- [ ] Aspect: 16:9 for action; follow Image1 only when editing in-place  
- [ ] Upload order matches prompt indices  

---

## Strength / denoise guidance

| Path | Typical | When |
|------|---------|------|
| Comfy Ref2Image / Edit (empty latent, refs in encoder) | **denoise 1.0**, cfg **1**, steps **25–40** | Default R2I |
| Soft type / drifting identity | steps → **40**, still cfg 1 | Before raising CFG |
| Need negatives to bite | `true_cfg_scale` / cfg **2–4** + negative (cost ↑) | Anti-clone emphasis |
| Classic img2img (VAE-encoded source latent) | strength **0.55–0.75** | Mid change, keep layout |
| Full replace on encoded latent | strength **0.9–1.0** | Ignores most pixels |
| Lightning / few-step LoRA (if used) | steps 4–8, cfg ~1, denoise 1 | Separate recipe |

**Session tip:** For “same woman, new suit/scene,” prefer **identity lock prose** over hunting for a magic mid-denoise if the graph is empty-latent R2I.

---

## Anti-patterns

| Don’t | Do instead |
|-------|------------|
| Short prompt: “same girl in alley” | Full identity lock + scene + count |
| Upload two sheets, prompt mentions one person | Dual slot map + “exactly two” |
| Hope model ignores sheet layout | Explicit forbid sheet/grid/labels |
| Same trim/hair descriptors for A and B | Unique markers per slot |
| Reorder refs without rewriting ImageN | Auto slot map from UI order |
| Expect negatives at cfg=1 | Raise CFG or fold into positive Do-not |
| Force 16:9 while PE `ratio_follow=<image1>` | Pick one: follow Image1 **or** cinematic |
| Truncate multi-char prompt on 800-char hosts | Shorter slot map + host with higher limit / local |

---

## Implementer notes for Build 4.7

### Validation

- `refCount === 0` → T2I path; hide R2I-only Enhance recipes.  
- `refCount >= 1` → inject base identity-lock + anti-sheet if `refLooksLikeSheet` heuristic (optional).  
- Multi-char presets: require `refCount >= N` for dual/quad templates.  
- Warn if prompt cites `<image3>` but only 2 refs uploaded.  
- Cap refs at host max; show `N / max`.

### Slot wiring Image1→N

```text
UI slots[i] → backend image_urls[i] / Comfy image_{i+1}
Enhance preamble:
  "Image1 = <user label or 'Reference 1'>. Image2 = ..."
Rewrite prompt tokens if user renames slots.
```

### Enhance system-prompt fragments (suggested)

1. Always preserve user slot map and count locks.  
2. Expand scene/lighting/camera; **do not drop** anti-clone / anti-sheet lines.  
3. For PE-I2I: prefer `ratio_follow=<image1>` for edits; `wh_ratio=16:9` for new cinematic action.  
4. If cfg stays 1, duplicate critical negatives as positive “Do not:” sentences.

### Catalog / license

- Weights: `Qwen/Qwen-Image-2.1` (+ Comfy-Org repack).  
- **Qwen Research License** (non-commercial by default unless separately licensed) — product policy decision for Studio.  
- Prefer official Diffusers `QwenImage21Pipeline` / Comfy `TextEncodeQwenImage21` over deprecated fal `qwen-image-2` if still listed.

---

## Sources

| Source | URL / id | Used for |
|--------|----------|----------|
| HF model card | https://huggingface.co/Qwen/Qwen-Image-2.1 | Capabilities, T2I/edit examples, aspect table, RGBA scaffold |
| PE-T2I | https://huggingface.co/Qwen/Qwen-Image-2.1-PE-T2I | Rewriter + `wh_ratio` |
| PE-I2I | https://huggingface.co/Qwen/Qwen-Image-2.1-PE-I2I | Edit rewrite + `ratio_follow` / multi-image |
| Comfy blog | https://blog.comfy.org/p/qwen-image-21-in-comfyui-open-weight | 10 refs, native 2K, RGBA, day-0 templates |
| Comfy-Org weights | https://huggingface.co/Comfy-Org/Qwen-Image-2.1 | File layout |
| Nomadoor Comfy guide | https://comfyui.nomadoor.net/en/basic-workflows/qwen-image-2-1/ | Ref2Image node, `<image1>` prompt style, 25/cfg1, edit vs R2I sizing |
| Diffusers QwenImage docs | https://huggingface.co/docs/diffusers/api/pipelines/qwenimage | `true_cfg_scale`, negatives, strength (img2img), max_sequence_length |
| Weshop overview | https://www.weshop.ai/solutions/models/qwen-image-2-1-ai-image-generation-and-editing-guide | Preserve/change prompt structure, multi-ref order |
| QWE local guide | https://www.qwe.edu.pl/tutorial/qwen-image-2-1-tutorial/ | 40 steps default, CFG cost, PE note, license |
| fal edit API (legacy 2.0) | https://fal.ai/models/fal-ai/qwen-image-2/edit/api | 800-char prompt, 1–3 refs, image_size — **marked unsupported**; treat as host-limit warning only |
| Session | Prompty ↔ Darcy Allen, 2026-09-21 | Character sheet / dual / quad / anti-clone lessons |

---

## Open questions / uncertainty

1. **Exact Media Studio host** for Qwen 2.1 (local Comfy vs fal vs other) — char caps and `strength` exposure differ.  
2. Whether Studio R2I graphs use **empty-latent denoise=1** or **VAE-encoded strength** — affects mid-denoise UX defaults.  
3. Diffusers `QwenImage21Pipeline` multi-ref parameter surface vs older `QwenImageEditPlusPipeline` — confirm wired API in repo.  
4. PE rewriter may soften anti-clone lines — needs Enhance post-check.  
5. Commercial license status for shipping Studio features on open weights.

---

*Guide version: 2026-09-21. Practical defaults favor Comfy/Diffusers 2.1 behavior; host-specific clamps must be verified in catalog.*
