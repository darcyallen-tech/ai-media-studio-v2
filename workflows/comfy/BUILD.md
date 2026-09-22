# Build briefs (AIMS ← Comfy workflows)

Hand these to **Grok Build / Cursor Build**. Graphs in this folder are the source of truth; AIMS wires them like ACE-Step (`backend/app/comfy_ace.py` + Music registry).

## Start here

1. **[BUILD_AIMS_YUE2.md](./BUILD_AIMS_YUE2.md)** — YuE2 Text-to-Music / Cover / Re-render from ABC (local Comfy, $0). **Do this first.**
2. **[YUE2_ABC.md](./YUE2_ABC.md)** — where ABC lives in Comfy `/history` (PreviewAny `text[]`).
2. Supporting notes: `YUE2_WORKFLOWS.md`, `YUE2_GROK_ROCK.md`
3. Binding map: `bindings.json` (fix T2M style/lyrics → nodes 113/114 before trusting older entries)
4. Runtime notes: `../../docs/COMFY_BINDINGS.md` (extend when YuE2 lands)

## Later (not this week unless asked)

- Qwen Image 2.1 T2I / Edit / Multi-Angle R2I already have API JSONs here — need a separate Build brief for Image tab wiring.
- Other T2V / H3 docs in this folder are reference only until a brief is written.

## Rule

Build implements AIMS UI + backend. Alfred / Comfy side owns graph authoring. Prefer API-format JSON. Prefer WAV for local music saves.

## Related Build docs

- Prompt Builder Apply / Enhance lyrics split: `../../YuE2-Prompt-Builder-Apply-Contract.md` (Prompty + Alfred, 2026-09-21)

- **YuE2 Music Builder P0 fixes (4.7 QA):** `../../docs/BUILD_YuE2_Music_Builder_Fixes.md`

- **YuE2 Comfy fail / stuck Generating:** `../../docs/BUILD_YuE2_Comfy_Fail_Stuck_UI.md`

- **YuE2 T2M duration wiring (keep latent link):** `../../docs/BUILD_YuE2_T2M_Duration_Wiring.md`

- **Music Prompt Builder options critique (Prompty):** `../../docs/Music-Prompt-Builder-Options-Critique.md` — P0: Energy `driving` vs Tempo, Voice character row, Buildup stealing Verse, Peru≈Andes
