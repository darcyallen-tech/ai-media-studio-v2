/** Music Prompt Builder catalogs + compose. Genre first; Flare is color only. */

export const MUSIC_GENRES = [
  "Hard rock",
  "Rock",
  "Metal",
  "Pop",
  "Hip-hop",
  "Electronic",
  "Jazz",
  "Folk",
  "Country",
  "R&B / Soul",
  "Cinematic",
  "Ambient",
  "Latin",
  "World",
  "Classical",
] as const;

export const MUSIC_SUBGENRES: Record<string, readonly string[]> = {
  "Hard rock": [
    "Classic hard rock",
    "Blues hard rock",
    "Arena",
    "Glam",
    "Stoner",
    "Southern",
    "Post-grunge",
    "Garage",
    "Psychedelic",
  ],
  Rock: [
    "Classic rock",
    "Indie rock",
    "Punk",
    "Alternative",
    "Progressive",
    "Shoegaze",
    "Heartland",
  ],
  Metal: [
    "Heavy metal",
    "Thrash",
    "Doom",
    "Power metal",
    "Metalcore",
    "Djent",
    "Nu-metal",
    "Symphonic metal",
    "Black metal",
  ],
  Pop: ["Synth pop", "Dance pop", "Indie pop", "Electropop"],
  "Hip-hop": [
    "Boom bap",
    "Trap",
    "Drill",
    "G-funk",
    "Cloud rap",
    "Lo-fi hip-hop",
    "Old school",
    "Rage",
  ],
  Electronic: [
    "House",
    "Techno",
    "Synthwave",
    "Drum & bass",
    "Downtempo",
    "UK garage",
    "Breakbeat",
    "Afro house",
    "Trance",
    "Dubstep",
  ],
  Jazz: ["Swing", "Bebop", "Smooth jazz", "Fusion", "Jazzhop"],
  Folk: ["Americana", "Singer-songwriter", "Celtic folk", "Indie folk"],
  Country: ["Outlaw", "Americana", "Country rock", "Honky-tonk"],
  "R&B / Soul": ["Classic soul", "Neo-soul", "Funk", "Quiet storm"],
  Cinematic: ["Trailer", "Orchestral", "Hybrid", "Dark underscore"],
  Ambient: ["Drone", "New age", "Dark ambient", "Tape ambient"],
  Latin: ["Salsa", "Cumbia", "Bossa nova", "Reggaeton", "Andean"],
  World: ["Afrobeat", "Highlife", "Gamelan-inspired", "Desert blues"],
  Classical: ["Baroque", "Romantic", "Minimalist", "Chamber"],
};

export const MUSIC_FLARES = [
  "Peru",
  "Andes",
  "Brazil",
  "Mexico",
  "Cuba",
  "Jamaica",
  "West Africa",
  "North Africa",
  "Middle East",
  "India",
  "Japan",
  "Korea",
  "China",
  "Spain",
  "Ireland",
  "Scandinavia",
  "Balkans",
  "New Orleans",
] as const;

export const REGIONAL_INSTRUMENTS: Record<string, readonly string[]> = {
  Peru: ["cajón", "cajita", "quijada", "guitarra criolla"],
  Andes: ["charango", "quena", "zampoña (Andean siku)", "bombo"],
  Brazil: ["berimbau", "cavaquinho", "surdo", "pandeiro", "cuíca"],
  Mexico: ["vihuela", "guitarrón", "trumpet"],
  Cuba: ["congas", "bongos", "tres cubano", "timbales", "clave"],
  Jamaica: ["nyabinghi drums", "ska guitar", "reggae organ bubble", "steppers kick"],
  "West Africa": ["kora", "djembe", "talking drum", "balafon", "shekere"],
  "North Africa": ["oud", "qanun", "darbuka", "ney", "guembri", "qraqeb"],
  "Middle East": ["oud", "qanun", "darbuka", "riq", "ney"],
  India: ["sitar", "tabla", "tanpura", "bansuri", "sarod"],
  Japan: ["shamisen", "koto", "taiko", "shakuhachi"],
  Korea: ["gayageum", "janggu", "daegeum", "haegeum", "piri"],
  China: ["guzheng", "erhu", "pipa", "dizi", "sheng"],
  Spain: ["flamenco guitar", "cajón", "castanets"],
  Ireland: ["fiddle", "tin whistle", "bodhrán", "uilleann pipes", "Irish harp"],
  Scandinavia: ["nyckelharpa", "Hardanger fiddle", "jaw harp"],
  Balkans: ["accordion", "tapan", "gadulka"],
  "New Orleans": ["trombone", "washboard", "upright bass", "tuba / sousaphone"],
};

/** One-line hover text for regional instrument chips (~60–80 chars). */
export const REGIONAL_INSTRUMENT_TIPS: Record<string, string> = {
  charango: "Small Andean lute; bright, chiming strum",
  cajón: "Box drum, sit and slap; Afro-Peruvian / flamenco",
  cajita: "Small wooden box with a hinged lid; Afro-Peruvian slap",
  quijada: "Jawbone rattle; Afro-Peruvian coastal rhythm",
  "guitarra criolla": "Nylon-string creole guitar; coastal Peru, not the Andean lute",
  quena: "End-blown Andean flute; dark, breathy",
  "zampoña (Andean siku)": "Andean panpipes; interlocking rows",
  bombo: "Large folk bass drum; deep pulse",
  berimbau: "Single-string musical bow with gourd; leads capoeira",
  cavaquinho: "Small 4-string guitar; samba and choro chop",
  surdo: "Large deep bass drum; heartbeat of samba",
  pandeiro: "Brazilian frame drum with dry cupped jingles",
  cuíca: "Friction drum; high laughing squeak; carnival",
  vihuela: "Small 5-string Mexican rhythm guitar; mariachi armonía",
  guitarrón: "Large fretless 6-string bass; mariachi’s floor",
  trumpet: "Ordinary trumpet; mariachi lead brass voice",
  congas: "Tall Cuban barrel drums; rumba and son hands",
  bongos: "Pair of small joined hand drums; son and salsa",
  "tres cubano": "Three-course Cuban lute; son montuno chop",
  timbales: "Shallow metal drums with sticks; danzón/salsa",
  clave: "Hardwood sticks; also the 2-bar key pattern",
  "nyabinghi drums": "Rastafari hand-drum set; Count Ossie lineage",
  "ska guitar": "Off-beat guitar; Jamaican texture, not a bass part",
  "reggae organ bubble": "Organ bubble on the off-beat",
  "steppers kick": "Steppers kick pattern as texture, not a second bass",
  kora: "21-string Mandé harp-lute; jali/griot voice",
  djembe: "Rope-tuned goblet hand drum; bass, tone, slap",
  "talking drum": "Hourglass pressure drum; speech-like pitch",
  balafon: "Gourd-resonated xylophone; buzzing Mandé keys",
  shekere: "Beaded-net gourd rattle; West African shake",
  oud: "Fretless bowl lute; ancestor of the European lute",
  qanun: "Plucked trapezoidal zither with pitch levers",
  darbuka: "Goblet drum; doum and tek tones",
  ney: "End-blown reed flute; breathy, microtonal",
  riq: "Small tambourine with heavy jingles; Mashriq takht",
  guembri: "Gnawa three-string bass lute",
  qraqeb: "Iron castanets; Gnawa rhythm",
  sitar: "Long-necked fretted lute with sympathetic strings",
  tabla: "Pair of hand drums; bayan plus dayan",
  tanpura: "Fretless drone lute; tonal floor of raga",
  bansuri: "Side-blown bamboo flute; vocal-like slides",
  sarod: "Fretless plucked lute with skin resonator",
  shamisen: "Three-string skin-faced lute, played with bachi",
  koto: "13-string board zither with movable bridges",
  taiko: "Japanese stick-struck drums as a family",
  shakuhachi: "End-blown bamboo flute; airy, pitch-bent",
  gayageum: "Korean plucked zither; 12-string national gayageum",
  janggu: "Hourglass drum; one head hand, one stick",
  daegeum: "Large bamboo flute with a buzzing membrane",
  haegeum: "Two-string vertical fiddle; nasal Korean voice",
  piri: "Cylindrical double-reed oboe; piercing court/folk",
  guzheng: "Long plucked zither, ~21 strings, movable bridges",
  erhu: "Two-string bowed spike fiddle; no fingerboard",
  pipa: "Pear-shaped 4-string lute, held upright",
  dizi: "Transverse bamboo flute with a bright buzzing membrane",
  sheng: "Free-reed mouth organ; cluster of bamboo pipes",
  "flamenco guitar": "Percussive Spanish guitar; golpe and rasgueado",
  castanets: "Paired handheld wooden clackers; Iberian dance",
  fiddle: "Violin in Irish regional styles; not a different organ",
  "tin whistle": "Six-hole penny whistle; bright, piercing",
  bodhrán: "Irish frame drum, goatskin, played with a tipper",
  "uilleann pipes": "Bellows-blown Irish pipes; quiet, two-octave",
  "Irish harp": "Wire-strung cláirseach; ringing arpeggios",
  nyckelharpa: "Swedish keyed bowed fiddle with sympathetic strings",
  "Hardanger fiddle": "Norwegian fiddle with extra sympathetic strings",
  "jaw harp": "Mouth-held lamellophone; Nordic folk use is real",
  accordion: "Free-reed bellows; common in Balkan folk",
  tapan: "Large double-headed drum; tupan/davul family",
  gadulka: "Bulgarian bowed lute with sympathetic strings",
  trombone: "Slide brass; NOLA tailgate smears under the lead",
  washboard: "Corrugated metal scraped as trad-jazz percussion",
  "upright bass": "Acoustic double bass; sitting early-jazz rhythm",
  "tuba / sousaphone": "Parade bass brass; street second-line floor",
};

export function regionalTip(name: string): string {
  return REGIONAL_INSTRUMENT_TIPS[name] || "";
}

export const CORE_INSTRUMENTS = [
  "electric guitar",
  "acoustic guitar",
  "bass",
  "drums",
  "kick drum",
  "piano",
  "keys / organ",
  "synth",
  "strings",
  "brass",
  "woodwinds",
  "percussion",
  "Rhodes",
  "808",
  "drum machine",
  "pad",
  "banjo",
  "pedal steel",
  "harmonica",
] as const;

export const MUSIC_ERAS = [
  "1960s",
  "1970s",
  "1980s",
  "1990s",
  "2000s",
  "contemporary",
  "timeless",
] as const;

export const MUSIC_ENERGY = ["low", "medium", "forward", "high", "explosive", "building"] as const;

export const MUSIC_TEMPO = [
  "slow (~70 BPM)",
  "mid-tempo (~100 BPM)",
  "driving (~120 BPM)",
  "fast (~140 BPM)",
] as const;

export const MUSIC_MOODS = [
  "aggressive",
  "dark",
  "hopeful",
  "tense",
  "triumphant",
  "melancholy",
  "playful",
  "epic",
  "intimate",
] as const;

export const MUSIC_INTROS = [
  "cold-open riff",
  "pad swell",
  "drum pickup",
  "silence then hit",
  "atmospheric fade-in",
] as const;

export const MUSIC_BUILDS = [
  "kick in at ~8s",
  "full band at ~16s",
  "gradual swell",
  "immediate full arrangement",
] as const;

export const MUSIC_ENDINGS = [
  "hard stop",
  "fade out",
  "ringing last chord",
  "ritardando",
] as const;

export const MUSIC_VOCALS = [
  "male lead",
  "female lead",
  "mixed leads",
  "harmony stack",
  "choir / chant",
] as const;

/** Delivery / timbre. Multi-select, max 2. Style only — never lyric parentheses. */
export const MUSIC_VOICE_CHARACTER = [
  "warm",
  "bright",
  "airy",
  "gritty",
  "belted",
  "intimate",
  "southern drawl",
  "rap cadence",
  "spoken-sung",
  "stacked doubles",
] as const;

export const MUSIC_USE_CASES = [
  "listing / background bed",
  "trailer",
  "workout",
  "lounge",
  "game combat",
  "underscore",
  "dance floor",
] as const;

const USE_CASE_MIX: Record<string, string> = {
  "listing / background bed": "dry VO bed",
  trailer: "trailer impacts",
  workout: "workout mix",
  lounge: "lounge mix",
  "game combat": "combat hits",
  underscore: "sparse underscore",
  "dance floor": "club mix",
};

export type MusicBuilderFields = {
  genre: string;
  subgenre: string;
  flare: string;
  flareCustom: string;
  era: string;
  energy: string;
  tempo: string;
  tempoCustom: string;
  mood: string;
  instruments: string[];
  regional: string[];
  vocals: string;
  voiceCharacter?: string[];
  intro: string;
  buildup: string;
  ending: string;
  sections?: string[];
  useCase: string;
  notes: string;
  instrumental: boolean;
};

function bit(v: string | undefined | null): string {
  const s = String(v ?? "").trim();
  if (!s || s === "—" || s.toLowerCase() === "custom") return "";
  return s;
}

export function subgenresFor(genre: string): string[] {
  return [...(MUSIC_SUBGENRES[genre] || [])];
}

export function regionalFor(flare: string): string[] {
  const key = bit(flare);
  return [...(REGIONAL_INSTRUMENTS[key] || [])];
}

export const MUSIC_SECTIONS = ["Verse", "Pre-Chorus", "Chorus", "Bridge"] as const;

const INTRO_CUE: Record<string, string> = {
  "cold-open riff": "(cold-open riff, no vocals)",
  "pad swell": "(pad swell, no vocals)",
  "drum pickup": "(drum pickup, no vocals)",
  "silence then hit": "(silence then hit, no vocals)",
  "atmospheric fade-in": "(atmospheric fade-in, no vocals)",
};

/** Cue text only. Buildup never owns [Verse], [Pre-Chorus], or [Chorus]. */
const BUILD_CUE: Record<string, string> = {
  "kick in at ~8s": "(instrumental groove kicks in)",
  "full band at ~16s": "(full band, instrumental groove)",
  "gradual swell": "(build, no vocals)",
  "immediate full arrangement": "(big instrumental hit)",
};

const SECTION_CUE: Record<string, string> = {
  Verse: "(instrumental groove)",
  "Pre-Chorus": "(build, no vocals)",
  Chorus: "(big instrumental hit)",
  Bridge: "(instrumental break)",
};

const END_CUE: Record<string, string> = {
  "hard stop": "(hard stop)",
  "fade out": "(fade out, no vocals)",
  "ringing last chord": "(ringing last chord)",
  ritardando: "(ritardando, no vocals)",
};

function tempoPhrase(tempo: string): string {
  const bpm = tempo.match(/~?\d+\s*BPM/i);
  if (bpm) return bpm[0].replace(/\s+/g, " ");
  return tempo;
}

const LYRIC_PREMISE = /\blyrics?\b|\babout\b|\bwrite verses\b/i;

function sonic(part: string): string {
  const text = part.replace(/\s+/g, " ").trim();
  if (!text || LYRIC_PREMISE.test(text)) return "";
  return text;
}

export function composeMusicStyle(fields: MusicBuilderFields): string {
  const genre = bit(fields.genre);
  const sub = bit(fields.subgenre);
  const flare = bit(fields.flareCustom) || bit(fields.flare);
  const era = bit(fields.era);
  let energy = bit(fields.energy);
  if (energy.toLowerCase() === "driving") energy = "forward";
  const tempo = tempoPhrase(bit(fields.tempoCustom) || bit(fields.tempo));
  const mood = bit(fields.mood);
  const vocals = bit(fields.vocals);
  const character = (fields.voiceCharacter || [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2);
  const core = (fields.instruments || []).map((s) => s.trim()).filter(Boolean);
  const regional = (fields.regional || []).map((s) => s.trim()).filter(Boolean);
  const parts: string[] = [];
  if (sub && genre && sub.toLowerCase() !== genre.toLowerCase()) {
    if (sub.toLowerCase().includes(genre.toLowerCase())) parts.push(sub);
    else parts.push(genre, sub);
  } else if (sub || genre) {
    parts.push(sub || genre);
  }
  if (flare) parts.push(`light ${flare} color`);
  if (era) parts.push(`${era} feel`);
  if (energy) parts.push(`${energy} energy`);
  if (tempo) parts.push(tempo);
  if (mood) parts.push(mood);
  const mix = USE_CASE_MIX[bit(fields.useCase)];
  if (mix) parts.push(mix);
  parts.push(...core);
  if (regional.length) parts.push(`${regional.join(", ")} as texture only`);
  if (fields.instrumental !== true) {
    const lead = [vocals, ...character].filter(Boolean);
    if (lead.length) parts.push(`${lead.join(", ")} vocal`);
  }
  return parts
    .map(sonic)
    .filter(Boolean)
    .join(", ")
    .replace(/\s+/g, " ")
    .replace(/\bdriving energy,\s*driving\b/gi, "forward energy, driving")
    .trim();
}

type LyricBlock = { tag: string; cue: string };

function sungPlaceholder(tag: string): string {
  const name = tag.replace(/[\[\]]/g, "").trim().toLowerCase() || "section";
  return `(${name} — Enhance fills)`;
}

function foldBuildCue(baseCue: string, buildCue: string): string {
  const base = baseCue.replace(/^\(/, "").replace(/\)$/, "").trim();
  const extra = buildCue.replace(/^\(/, "").replace(/\)$/, "").trim();
  if (!extra) return `(${base})`;
  if (base.toLowerCase().includes(extra.toLowerCase())) return `(${base})`;
  return `(${base}, ${extra})`;
}

function lyricBlocks(fields: MusicBuilderFields): LyricBlock[] {
  const instrumental = fields.instrumental === true;
  const blocks: LyricBlock[] = [];
  const sections = (fields.sections || []).map((name) => name.trim()).filter(Boolean);
  const hasVerse = sections.includes("Verse");
  const buildup = bit(fields.buildup);
  const buildCue = instrumental && buildup ? BUILD_CUE[buildup] || "" : "";
  const push = (tag: string, cue: string) => {
    blocks.push({ tag, cue: instrumental ? cue : sungPlaceholder(tag) });
  };
  const intro = bit(fields.intro);
  if (intro) {
    let cue = INTRO_CUE[intro] || `(${intro}, no vocals)`;
    if (buildCue && !hasVerse) cue = foldBuildCue(cue, buildCue);
    push("[Intro]", cue);
  }
  const seen = new Set<string>();
  let verseEdited = false;
  for (const name of sections) {
    const tag = `[${name}]`;
    if (seen.has(tag)) continue;
    seen.add(tag);
    let cue = SECTION_CUE[name] || `(${name})`;
    if (buildCue && name === "Verse" && !verseEdited) {
      cue = buildCue;
      verseEdited = true;
    }
    push(tag, cue);
  }
  const ending = bit(fields.ending);
  if (ending) push("[Outro]", END_CUE[ending] || `(${ending})`);
  if (!blocks.length) {
    push("[Intro]", "(instrumental, no vocals)");
    push("[Verse]", "(instrumental groove)");
    push("[Chorus]", "(big instrumental hit)");
    push("[Outro]", "(hard stop)");
  }
  return blocks;
}

export function composeMusicLyrics(fields: MusicBuilderFields): string {
  return lyricBlocks(fields)
    .map((block) => `${block.tag}\n${block.cue}`)
    .join("\n\n");
}

const TIMBRE_WORD =
  /\b(?:warm|bright|airy|gritty|raspy|belted|intimate|southern drawl|rap cadence|spoken-sung|stacked doubles|male voice|female voice|raw grit|spitting)\b/i;
const STAGE_PHRASE =
  /\b(?:gritty\s+male(?:\s+voice)?(?:\s+raw)?|male\s+voice(?:\s+raw)?|female\s+voice(?:\s+raw)?|southern\s+drawl|raw\s+grit|spitting|belted\s+vocal|rap\s+cadence|spoken-sung|stacked\s+doubles)\b/i;

function tidyCue(inner: string): string {
  return inner
    .replace(/\s+,/g, ",")
    .replace(/(?:,\s*){2,}/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;-]+|[\s,;-]+$/g, "");
}

function instrumentalInner(inner: string): string {
  return tidyCue(inner.replace(/\bno vocals\b/gi, "").replace(/\binstrumental\b/gi, ""));
}

function musicalInner(inner: string): string {
  return tidyCue(
    inner
      .replace(new RegExp(TIMBRE_WORD.source, "gi"), "")
      .replace(new RegExp(STAGE_PHRASE.source, "gi"), "")
      .replace(/\bno vocals\b/gi, "")
      .replace(/\binstrumental\b/gi, ""),
  );
}

/** Move vocal timbre out of lyric parentheses and onto Style. Musical cues stay. */
export function liftTimbre(style: string, lyrics: string): { style: string; lyrics: string } {
  const found: string[] = [];
  const next = lyrics.replace(/\(([^)\n]*)\)/g, (full, inner: string) => {
    const text = String(inner || "").trim();
    if (!text || (!TIMBRE_WORD.test(text) && !STAGE_PHRASE.test(text))) return full;
    const bits = [
      ...(text.match(new RegExp(TIMBRE_WORD.source, "gi")) || []),
      ...(text.match(new RegExp(STAGE_PHRASE.source, "gi")) || []),
    ];
    for (const bit of bits) found.push(bit);
    const kept = musicalInner(text);
    return kept ? `(${kept})` : "";
  });
  const cleaned = next
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("[") || trimmed.startsWith("(")) return trimmed;
      if (!STAGE_PHRASE.test(trimmed)) return trimmed;
      const bits = trimmed.match(new RegExp(STAGE_PHRASE.source, "gi")) || [];
      for (const bit of bits) found.push(bit);
      return trimmed
        .replace(new RegExp(STAGE_PHRASE.source, "gi"), "")
        .replace(/\s{2,}/g, " ")
        .replace(/^[\s,;-]+|[\s,;-]+$/g, "");
    })
    .filter((line, index, all) => line.trim() || (all[index - 1] && all[index + 1]))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  let nextStyle = style.trim();
  for (const phrase of found) {
    if (!nextStyle.toLowerCase().includes(phrase.toLowerCase())) {
      nextStyle = nextStyle ? `${nextStyle}, ${phrase}` : phrase;
    }
  }
  return { style: nextStyle.replace(/\s+/g, " ").trim(), lyrics: cleaned };
}

/** Strip instrumental / no-vocals words. Keep musical arrangement cues. */
export function scrubSungLyrics(lyrics: string, notes: string): string {
  void notes;
  const lines = lyrics.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }
    if (/^\[[^\]]+\]$/.test(trimmed)) {
      out.push(trimmed);
      continue;
    }
    if (/^\([^)\n]*—\s*Enhance fills\)$/i.test(trimmed)) continue;
    if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
      const inner = instrumentalInner(trimmed.slice(1, -1));
      if (inner) out.push(`(${inner})`);
      continue;
    }
    out.push(line);
  }
  return out
    .join("\n")
    .replace(/\bno vocals\b/gi, "")
    .replace(/\binstrumental\b/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CUE_SHORT: Record<string, string> = {
  intro: "(cold-open riff, drums kick)",
  verse: "(full band, groove)",
  "pre-chorus": "(build, guitar stab)",
  chorus: "(full band, big hit)",
  bridge: "(strip back, guitar stab)",
  outro: "(ring out)",
};
const CUE_RICH: Record<string, string> = {
  intro: "(cold-open riff, drums kick, record scratches under guitar)",
  verse: "(full band, groove, guitar stab)",
  "pre-chorus": "(gradual build, guitar stab)",
  chorus: "(full band, big hit, record scratches)",
  bridge: "(strip back, then guitar stab)",
  outro: "(ring out, soft fade)",
};

/** One musical cue under each section, then the sung lines. */
export function shapeSungLyrics(lyrics: string, creative = false): string {
  const text = lyrics.trim();
  if (!text.includes("[")) return text;
  const table = creative ? CUE_RICH : CUE_SHORT;
  const chunks = text.split(/(?=^\[[^\]]+\])/m).map((chunk) => chunk.trim()).filter(Boolean);
  const blocks: string[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const tag = lines[0] || "";
    if (!/^\[[^\]]+\]$/.test(tag)) {
      blocks.push(chunk);
      continue;
    }
    const name = tag.slice(1, -1).split("-")[0].split(":")[0].trim().toLowerCase();
    let cue = "";
    const bodies: string[] = [];
    for (const line of lines.slice(1)) {
      if (line.startsWith("(") && line.endsWith(")") && !line.slice(1).includes("(")) {
        const inner = musicalInner(line.slice(1, -1));
        if (inner && !cue) cue = `(${inner})`;
        continue;
      }
      if (line) bodies.push(line);
    }
    if (!cue) {
      cue = table[name] || (creative ? "(full band, groove, guitar stab)" : "(full band, groove)");
    }
    blocks.push([tag, cue, ...bodies].join("\n"));
  }
  return blocks.join("\n\n").trim();
}

export function composeMusicPrompt(fields: MusicBuilderFields): string {
  return composeMusicStyle(fields);
}
