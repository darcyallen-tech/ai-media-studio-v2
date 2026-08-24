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
  "Hard rock": ["Classic hard rock", "Blues hard rock", "Arena", "Glam", "Stoner", "Southern"],
  Rock: ["Hard rock", "Classic rock", "Indie rock", "Punk", "Alternative", "Progressive"],
  Metal: ["Heavy metal", "Thrash", "Doom", "Power metal", "Metalcore"],
  Pop: ["Synth pop", "Dance pop", "Indie pop", "Electropop"],
  "Hip-hop": ["Boom bap", "Trap", "Lo-fi hip-hop", "Old school"],
  Electronic: ["House", "Techno", "Synthwave", "Drum & bass", "Downtempo"],
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
  Peru: ["charango", "cajón", "quena", "zampoña (Andean siku)", "bombo"],
  Andes: ["charango", "quena", "zampoña (Andean siku)", "bombo"],
  Brazil: ["berimbau", "cavaquinho", "surdo", "pandeiro", "cuíca"],
  Mexico: ["vihuela", "guitarrón", "trumpet"],
  Cuba: ["congas", "bongos", "tres cubano", "timbales", "clave"],
  Jamaica: ["nyabinghi drums"],
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

export const MUSIC_ENERGY = ["low", "medium", "driving", "high", "explosive", "building"] as const;

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

export const MUSIC_USE_CASES = [
  "listing / background bed",
  "trailer",
  "workout",
  "lounge",
  "game combat",
  "underscore",
  "dance floor",
] as const;

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
  intro: string;
  buildup: string;
  ending: string;
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

export function composeMusicPrompt(fields: MusicBuilderFields): string {
  const genre = bit(fields.genre);
  const sub = bit(fields.subgenre);
  const flare = bit(fields.flareCustom) || bit(fields.flare);
  const era = bit(fields.era);
  const energy = bit(fields.energy);
  const tempo = bit(fields.tempoCustom) || bit(fields.tempo);
  const mood = bit(fields.mood);
  const intro = bit(fields.intro);
  const buildup = bit(fields.buildup);
  const ending = bit(fields.ending);
  const useCase = bit(fields.useCase);
  const notes = bit(fields.notes);
  const vocals = bit(fields.vocals);
  const core = (fields.instruments || []).map((s) => s.trim()).filter(Boolean);
  const regional = (fields.regional || []).map((s) => s.trim()).filter(Boolean);

  const lines: string[] = [];
  if (genre && sub) lines.push(`${genre} track (${sub}).`);
  else if (genre) lines.push(`${genre} track.`);
  else if (sub) lines.push(`${sub} track.`);
  else lines.push("Instrumental music track.");

  const feel = [era && `${era} feel`, energy && `${energy} energy`, tempo, mood]
    .filter(Boolean)
    .join(", ");
  if (feel) lines.push(feel.charAt(0).toUpperCase() + feel.slice(1) + ".");

  if (core.length) lines.push(`Core band: ${core.join(", ")}.`);
  if (regional.length && flare) {
    lines.push(
      `Optional color: ${regional.join(", ")} used sparingly as texture only — not the lead sound.`,
    );
  }

  if (flare && genre) {
    lines.push(
      `Flare: a light ${flare} color on top of the ${genre.toLowerCase()} core — do not replace the primary genre; keep ${genre.toLowerCase()} as the identity.`,
    );
  } else if (flare) {
    lines.push(`Flare: a light ${flare} color only — secondary influence, not a genre swap.`);
  }

  const struct: string[] = [];
  if (intro) struct.push(`Intro: ${intro}`);
  if (buildup) struct.push(buildup);
  if (ending) struct.push(`Ending: ${ending}`);
  if (struct.length) lines.push(struct.join(". ") + ".");

  if (useCase) lines.push(`Use: ${useCase}.`);

  if (fields.instrumental) {
    lines.push("Instrumental only — no vocals, no lyrics, no choir.");
  } else if (vocals) {
    lines.push(`Vocals: ${vocals}.`);
  }

  if (notes) lines.push(notes);

  return lines.join(" ").replace(/\s+/g, " ").trim();
}
