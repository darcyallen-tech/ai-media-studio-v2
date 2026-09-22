# Music Prompt Builder — Options Inventory + Critique

**From:** Prompty  
**To:** Darcy + Alfred  
**Date:** 2026-09-21 (America/Edmonton)  
**App:** AI Media Studio V2 — Music Prompt Builder  
**Source of truth (verified live):** `C:\Users\Darcy\ai-media-studio-v2\frontend\src\musicUi.ts`  
**UI:** `PromptBuilderNode.tsx` (Music form)  
**Related:** `YuE2-Prompt-Builder-Apply-Contract.md`, `YuE2-Prompting-Guide.md`, `Ace-Step-Prompting-Guide.md`

> Verified against live `musicUi.ts` on DESKTOP-NJUJJF9 (this pass). Earlier draft was stale on sections / washboard / compose split — corrected below.

---

## What is already good (credit where due)

- **Genre primary / Flare secondary** policy is correct and model-safe (`light {flare} color` + regional `as texture only`).
- **Style vs Lyrics split** is real: `composeMusicStyle` = sonic tags; `composeMusicLyrics` = `[Tag]` + cues. That matches YuE2.
- **Instrumental gate** swaps real instrumental cues vs sung `(section — Enhance fills)`.
- **Regional hover tips** exist (`REGIONAL_INSTRUMENT_TIPS`) — keep them; they stop glass-instrument picks.
- **washboard** spelling and **zampoña (Andean siku)** naming are already fixed in live code.
- **North Africa** already has `guembri` / `qraqeb` (not a pure Middle East clone).
- **New Orleans** regional is concrete instruments (trombone, washboard, upright bass, tuba/sousaphone) — good.

Architecture is ahead of the menus. The menus still under-serve rock / hip-hop / electronic and vocals.

---

## Full inventory (live catalogs)

### Genre
Hard rock, Rock, Metal, Pop, Hip-hop, Electronic, Jazz, Folk, Country, R&B / Soul, Cinematic, Ambient, Latin, World, Classical

### Sub-genre (cascading)
| Genre | Sub-genres |
|-------|------------|
| Hard rock | Classic hard rock, Blues hard rock, Arena, Glam, Stoner, Southern |
| Rock | Hard rock, Classic rock, Indie rock, Punk, Alternative, Progressive |
| Metal | Heavy metal, Thrash, Doom, Power metal, Metalcore |
| Pop | Synth pop, Dance pop, Indie pop, Electropop |
| Hip-hop | Boom bap, Trap, Lo-fi hip-hop, Old school |
| Electronic | House, Techno, Synthwave, Drum & bass, Downtempo |
| Jazz | Swing, Bebop, Smooth jazz, Fusion, Jazzhop |
| Folk | Americana, Singer-songwriter, Celtic folk, Indie folk |
| Country | Outlaw, Americana, Country rock, Honky-tonk |
| R&B / Soul | Classic soul, Neo-soul, Funk, Quiet storm |
| Cinematic | Trailer, Orchestral, Hybrid, Dark underscore |
| Ambient | Drone, New age, Dark ambient, Tape ambient |
| Latin | Salsa, Cumbia, Bossa nova, Reggaeton, Andean |
| World | Afrobeat, Highlife, Gamelan-inspired, Desert blues |
| Classical | Baroque, Romantic, Minimalist, Chamber |

### Flare (global list — not per-genre)
Peru, Andes, Brazil, Mexico, Cuba, Jamaica, West Africa, North Africa, Middle East, India, Japan, Korea, China, Spain, Ireland, Scandinavia, Balkans, New Orleans (+ Custom)

### Era
1960s … 2000s, contemporary, timeless

### Energy
low, medium, **driving**, high, explosive, building

### Tempo
slow (~70 BPM), mid-tempo (~100 BPM), **driving (~120 BPM)**, fast (~140 BPM), Custom BPM

### Mood
aggressive, dark, hopeful, tense, triumphant, melancholy, playful, epic, intimate

### Core instrumentation
electric guitar, acoustic guitar, bass, drums, kick drum, piano, keys / organ, synth, strings, brass, woodwinds, percussion

### Regional color (live)
| Flare | Chips |
|-------|-------|
| Peru | charango, cajón, quena, zampoña (Andean siku), bombo |
| Andes | charango, quena, zampoña (Andean siku), bombo |
| Brazil | berimbau, cavaquinho, surdo, pandeiro, cuíca |
| Mexico | vihuela, guitarrón, trumpet |
| Cuba | congas, bongos, tres cubano, timbales, clave |
| Jamaica | **nyabinghi drums only** |
| West Africa | kora, djembe, talking drum, balafon, shekere |
| North Africa | oud, qanun, darbuka, ney, guembri, qraqeb |
| Middle East | oud, qanun, darbuka, riq, ney |
| India | sitar, tabla, tanpura, bansuri, sarod |
| Japan | shamisen, koto, taiko, shakuhachi |
| Korea | gayageum, janggu, daegeum, haegeum, piri |
| China | guzheng, erhu, pipa, dizi, sheng |
| Spain | flamenco guitar, cajón, castanets |
| Ireland | fiddle, tin whistle, bodhrán, uilleann pipes, Irish harp |
| Scandinavia | nyckelharpa, Hardanger fiddle, jaw harp |
| Balkans | accordion, tapan, gadulka |
| New Orleans | trombone, washboard, upright bass, tuba / sousaphone |

### Vocals (cast only)
male lead, female lead, mixed leads, harmony stack, choir / chant

### Structure bookends
Intro: cold-open riff, pad swell, drum pickup, silence then hit, atmospheric fade-in  
Buildup: kick in at ~8s, full band at ~16s, gradual swell, immediate full arrangement  
Ending: hard stop, fade out, ringing last chord, ritardando  
**Sections chips:** Verse, Pre-Chorus, Chorus, Bridge (`MUSIC_SECTIONS`)

### Use case
listing / background bed, trailer, workout, lounge, game combat, underscore, dance floor

---

## Critique (model-pickup lens)

### P0 — real prompt footguns

1. **Energy `driving` × Tempo `driving (~120 BPM)`**  
   Compose emits both → `driving energy, driving (~120 BPM)`. Same word, two axes. Rename Energy to `forward` / `steady` or drop it.

2. **Vocals are casting only**  
   `male lead vocal` is necessary but weak. YuE2 / Ace-Step respond to **timbre + register + delivery**. Add a **Voice character** multi-select (max 2): warm, bright, airy, gritty / raspy, belted, intimate, southern drawl, rap cadence, spoken-sung, stacked doubles. Style fragment: `male lead, warm baritone, grit rock vocal`.

3. **Buildup steals section tags** (`lyricBlocks` + `seen` Set)  
   Buildup `kick in at ~8s` / `full band at ~16s` both push `[Verse]`. Verse chip is then ignored. Same for gradual swell → `[Pre-Chorus]`. Fix: Buildup should only set the **cue text** on the first matching section, or use a distinct `[Build]` that Enhance maps — never consume the Verse tag.

4. **Peru ≈ Andes**  
   Nearly identical chip sets (Peru adds cajón only). Users pick Flare expecting color change; models hear almost nothing different. Differentiate or merge.

### P1 — catalogs Darcy feels are thin (and models will hear)

5. **Sub-genre expansions (high signal only)**  
   - Hard rock: Post-grunge, Garage, Psychedelic  
   - Rock: Shoegaze, Heartland; **remove nested `Hard rock` sub** (fights Hard rock genre)  
   - Metal: Djent, Nu-metal, Symphonic, Black metal  
   - Hip-hop: Drill, G-funk, Cloud rap, Rage (Trap + Boom bap alone is 2010s-thin)  
   - Electronic: UK garage, Breakbeat, Afro house, Trance, Dubstep  
   Skip ultra-fine pairs models blur (Jazzhop vs Lo-fi; Quiet storm vs Neo-soul).

6. **Core instruments gaps**  
   Add (model-known): Rhodes / electric piano, 808, drum machine, pad, banjo, pedal steel, harmonica, turntable.  
   Soften: `kick drum` when `drums` already on; `brass`/`woodwinds`/`percussion` are families — OK as coarse chips, but Enhance should expand them.

7. **Flare / regional unevenness**  
   - **Jamaica = 1 chip** — too thin for “flare.” Add concrete: ska guitar, reggae organ bubble, steppers kick (as texture words, not “reggae bass” role colliding with Core bass).  
   - **Balkans** missing brass band color (optional `Balkan brass` as one texture chip).  
   - Keep Mexico mariachi kit as-is (clean).  
   - Do **not** reintroduce technique chips (`charango rasgueo`, `ska guitar chop`) — live code correctly killed those.

8. **Use case unused in Style compose**  
   Field exists; `composeMusicStyle` ignores it. Either map to mix tags (`dry VO bed`, `trailer impacts`) or hide until wired.

### P2 — polish

9. Mood: add `nostalgic`, `menacing`; optional drop one of `epic` / `triumphant` if Energy already carries “big.”  
10. Tempo: keep Custom BPM; optional `half-time feel` / `double-time feel` as Energy-adjacent chips, not more BPM synonyms.  
11. Flare list is geography-only — fine. Optional P2 flares only with real kits: Appalachia, Gnawa (or keep Gnawa inside North Africa chips — already started).  
12. Voice + fusion Notes: Enhance Style enrich (hip-hop pocket etc.) already agreed in room — stays Enhance rule, not a new dropdown.

---

## Suggested diffs for Alfred / Build

### Energy (replace)
```
low | medium | forward | high | explosive | building
```
Delete `driving`.

### Voice character (new row, multi max 2)
```
warm | bright | airy | gritty | belted | intimate | southern drawl | rap cadence | spoken-sung | stacked doubles
```
Compose: `{vocals}, {character1}, {character2}` → e.g. `male lead, gritty, belted vocal`

### Hip-hop subs (replace)
```
Boom bap | Trap | Drill | G-funk | Cloud rap | Lo-fi hip-hop | Old school | Rage
```

### Electronic (add)
```
UK garage | Breakbeat | Afro house | Trance | Dubstep
```

### Hard rock (add) / Rock (fix)
```
Hard rock +: Post-grunge, Garage, Psychedelic
Rock: drop nested "Hard rock"; add Shoegaze, Heartland
```

### Metal (add)
```
Djent | Nu-metal | Symphonic metal | Black metal
```

### Core instruments (add)
```
Rhodes | 808 | drum machine | pad | banjo | pedal steel | harmonica
```

### lyricBlocks bug
Do not `seen.has('[Verse]')` from Buildup before section chips. Prefer:
- Intro → `[Intro]` + cue  
- Sections in user order → `[Verse]` / `[Chorus]`…  
- Buildup modifies the **first Verse cue** (or inserts parenthetical on Intro) without owning the tag  
- Ending → `[Outro]`

---

## Bottom line

Your gut on **sub-genre + flare** is right: Flare *policy* is good; Flare *catalog* is uneven (Jamaica starved, Peru/Andes twins). Sub-genre is thin exactly where you work (hard rock / hip-hop / electronic). Biggest model wins are not more geography — they are **Voice character**, **Energy≠Tempo collision fix**, **Buildup/Verse tag steal fix**, and **high-signal sub-genres + a few core production instruments (808, Rhodes, drum machine)**.

Stay inside what models hear: concrete genre, BPM, named instruments, vocal timbre/delivery. Avoid technique-as-instrument and marketing use-case prose in Style.
