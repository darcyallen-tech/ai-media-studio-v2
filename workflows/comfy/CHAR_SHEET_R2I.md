# Character Sheet R2I (Qwen Edit 2511)

## Max reference images (your stack)

| Path | Max refs | Notes |
|------|----------|--------|
| **Qwen Edit native** TextEncodeQwenImageEditPlus | **3** | image1–image3 (your MULTI R2I / Char Sheet 3REF) |
| **Qwen Edit lrzjason** TextEncodeQwenImageEditPlus_lrzjason | **5** | image1–image5 (Char Sheet 5REF) |
| **FLUX.2 Klein** Flux2KleinMultiReferenceLatent | **8** | latent_1–latent_8 |
| **Krea 2 Style Reference** | **chain / ~10** | style moodboards, not identity edit sheets |
| **MiniMax H3 R2V** | **9** images (+ videos) | video identity, not still sheets |

For **character sheets**, Qwen Edit is the right tool. Use **3 refs** day-to-day; **5** if you have extra angles. Klein multi-ref (up to 8) is an alternative look, not usually better for identity locks than Qwen Edit.

## Graphs
- QWEN IMAGE EDIT 2511 CHAR SHEET 3REF.json — binding qwen_char_sheet_3ref
- QWEN IMAGE EDIT 2511 CHAR SHEET 5REF.json — binding qwen_char_sheet_5ref (optional extras)
- Existing general multi: QWEN IMAGE EDIT 2511 MULTI R2I.json

## Usage
1. REF_1 = best face/body hero still
2. REF_2 / REF_3 = other angles of the **same** person (not other characters)
3. Keep Lightning LoRA on for speed; use QUALITY multi graph if you need slower higher fidelity
