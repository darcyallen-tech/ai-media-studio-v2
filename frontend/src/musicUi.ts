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
  Peru: ["charango", "cajón", "quena", "zampoña / pan flute", "bombo"],
  Andes: ["charango", "quena", "zampoña / pan flute", "bombo", "charango rasgueo"],
  Brazil: ["berimbau", "cavaquinho", "surdo", "pandeiro", "cuíca"],
  Mexico: ["vihuela", "guitarrón", "trumpet mariachi", "jarana"],
  Cuba: ["congas", "bongos", "tres cubano", "timbales", "clave"],
  Jamaica: ["ska guitar chop", "reggae bass", "nyabinghi drums"],
  "West Africa": ["kora", "djembe", "talking drum", "balafon", "shekere"],
  "North Africa": ["oud", "qanun", "darbuka", "ney"],
  "Middle East": ["oud", "qanun", "darbuka", "riq", "ney"],
  India: ["sitar", "tabla", "tanpura", "bansuri", "sarod"],
  Japan: ["shamisen", "koto", "taiko", "shakuhachi"],
  Korea: ["gayageum", "janggu", "daegeum"],
  China: ["guzheng", "erhu", "pipa", "dizi"],
  Spain: ["flamenco guitar", "cajón", "castanets", "palmas"],
  Ireland: ["fiddle", "tin whistle", "bodhrán", "uilleann pipes"],
  Scandinavia: ["nyckelharpa", "Hardanger fiddle", "jaw harp"],
  Balkans: ["accordion", "brass band", "tapan", "gadulka"],
  "New Orleans": ["second-line brass", "trombone", "washbord", "upright bass"],
};

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
