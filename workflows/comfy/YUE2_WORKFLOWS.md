# YuE2 AIMS workflows

## 1. Text to Music — YuE2 TEXT TO MUSIC GROK ROCK.json
AIMS: yue2_grok_rock

- Generates ABC (full) -> Music.abc is a direct link from Generate ABC (node 24)
- Re-render without re-planning: copy ABC from the result -> YuE2 Re-render from ABC
- Default song: hard-rock Grok the Bot banger
- Checkpoint: yue2_3b_bf16.safetensors

## 2. Cover — YuE2 COVER.json
AIMS: yue2_cover

- Load reference audio -> SheetSage2 (melody) -> YuE2 Generate Music (melody)
- Encoder: audio_encoders/sheetsage2_bf16.safetensors (hard-linked from checkpoints)
- Set target style + lyrics for the new performance
- Pick your reference in LoadAudio (placeholder example.mp3 until you choose a file)

## 3. Re-render from ABC — YuE2 RERENDER FROM ABC.json
AIMS: yue2_rerender_abc

- Paste ABC only (fastest revise loop). No ABC generator node.

## Tips
- T2M style and lyrics live on PrimitiveStringMultiline nodes 113 and 114. Nodes 24 and 25 receive them as links — do not patch 24.style or 25.style
- Duration sets node 25 `max_duration` only. Node 5 `seconds` must stay the link `["25", 1]` (Music output 1, the encoded length). Do not replace that link with the request duration
- T2M ABC for the UI is `outputs["52"].text` (the score that fed Music). Node 14 is the planner preview. Cover is `outputs["44"].text`. See YUE2_ABC.md
- SheetSage melody + YuE2 melody is the cover pair; use full/full if you also want chords
- About 8GB VRAM on the 5070 Ti in testing — comfortable
