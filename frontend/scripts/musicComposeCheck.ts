import assert from "node:assert/strict";
import {
  CORE_INSTRUMENTS,
  MUSIC_ENERGY,
  MUSIC_SUBGENRES,
  REGIONAL_INSTRUMENTS,
  composeMusicLyrics,
  composeMusicStyle,
  scrubSungLyrics,
  shapeSungLyrics,
  type MusicBuilderFields,
} from "../src/musicUi.ts";

function fields(patch: Partial<MusicBuilderFields> = {}): MusicBuilderFields {
  return {
    genre: "Hard rock",
    subgenre: "",
    flare: "",
    flareCustom: "",
    era: "",
    energy: "forward",
    tempo: "driving (~120 BPM)",
    tempoCustom: "",
    mood: "",
    instruments: ["electric guitar"],
    regional: [],
    vocals: "male lead",
    voiceCharacter: ["gritty", "belted"],
    intro: "cold-open riff",
    buildup: "full band at ~16s",
    ending: "hard stop",
    sections: ["Verse", "Chorus"],
    useCase: "",
    notes: "lyrics about the mountain and write verses of freedom",
    instrumental: false,
    ...patch,
  };
}

const sung = fields();
const style = composeMusicStyle(sung);
const lyrics = composeMusicLyrics(sung);
assert.equal(style.includes("lyrics about"), false);
assert.equal(/\babout\b/i.test(style), false);
assert.equal(style.includes("driving energy"), false);
assert.equal(style.includes("driving energy, driving"), false);
assert.match(style, /forward energy/);
assert.match(style, /male lead, gritty, belted vocal/);
assert.equal(lyrics.includes("gritty"), false);
assert.equal(lyrics.includes("belted"), false);
assert.equal(/\((?:instrumental|no vocals)/i.test(lyrics), false);
assert.match(lyrics, /\[Verse\]\n\(verse — Enhance fills\)/);
assert.equal(lyrics.includes("lyrics about"), false);
assert.equal((lyrics.match(/\[Verse\]/g) || []).length, 1);

const built = composeMusicLyrics(
  fields({
    instrumental: true,
    vocals: "",
    voiceCharacter: [],
    sections: ["Verse", "Pre-Chorus"],
    buildup: "full band at ~16s",
  }),
);
assert.match(built, /\[Verse\]\n\(full band, instrumental groove\)/);
assert.match(built, /\[Pre-Chorus\]/);
assert.equal((built.match(/\[Verse\]/g) || []).length, 1);
assert.equal(/\[Chorus\]/.test(built), false);

const legacy = composeMusicStyle(fields({ energy: "driving", voiceCharacter: [], vocals: "" }));
assert.equal(legacy.includes("driving energy"), false);
assert.match(legacy, /forward energy/);

assert.equal(MUSIC_ENERGY.includes("driving" as never), false);
assert.ok(MUSIC_ENERGY.includes("forward"));

const peru = new Set(REGIONAL_INSTRUMENTS.Peru);
const andes = new Set(REGIONAL_INSTRUMENTS.Andes);
const overlap = [...peru].filter((name) => andes.has(name));
assert.deepEqual(overlap, []);
assert.notDeepEqual([...peru].sort(), [...andes].sort());

assert.ok(MUSIC_SUBGENRES["Hard rock"].includes("Post-grunge"));
assert.ok(MUSIC_SUBGENRES["Hard rock"].includes("Garage"));
assert.ok(MUSIC_SUBGENRES["Hard rock"].includes("Psychedelic"));
assert.equal(MUSIC_SUBGENRES.Rock.includes("Hard rock"), false);
assert.ok(MUSIC_SUBGENRES.Rock.includes("Shoegaze"));
assert.ok(MUSIC_SUBGENRES.Rock.includes("Heartland"));
assert.ok(MUSIC_SUBGENRES.Metal.includes("Djent"));
assert.ok(MUSIC_SUBGENRES.Metal.includes("Nu-metal"));
assert.ok(MUSIC_SUBGENRES.Metal.includes("Symphonic metal"));
assert.ok(MUSIC_SUBGENRES.Metal.includes("Black metal"));
for (const name of ["Boom bap", "Trap", "Drill", "G-funk", "Cloud rap", "Lo-fi hip-hop", "Old school", "Rage"]) {
  assert.ok(MUSIC_SUBGENRES["Hip-hop"].includes(name), name);
}
for (const name of ["UK garage", "Breakbeat", "Afro house", "Trance", "Dubstep"]) {
  assert.ok(MUSIC_SUBGENRES.Electronic.includes(name), name);
}
for (const name of ["Rhodes", "808", "drum machine", "pad", "banjo", "pedal steel", "harmonica"]) {
  assert.ok(CORE_INSTRUMENTS.includes(name as (typeof CORE_INSTRUMENTS)[number]), name);
}
for (const name of ["ska guitar", "reggae organ bubble", "steppers kick"]) {
  assert.ok(REGIONAL_INSTRUMENTS.Jamaica.includes(name), name);
}

const withGear = composeMusicStyle(
  fields({
    instruments: ["808", "Rhodes"],
    useCase: "trailer",
    voiceCharacter: [],
    vocals: "",
    instrumental: true,
  }),
);
assert.match(withGear, /808/);
assert.match(withGear, /Rhodes/);
assert.match(withGear, /trailer impacts/);

const kept = scrubSungLyrics(
  "[Verse]\n(full band, groove)\n(cold-open riff, no vocals)\nwe ride",
  "lyrics about the mountain",
);
assert.match(kept, /\(full band, groove\)/);
assert.match(kept, /\(cold-open riff\)/);
assert.equal(/no vocals/i.test(kept), false);
assert.equal(kept.includes("lyrics about"), false);
assert.match(kept, /we ride/);
const shaped = shapeSungLyrics("[Chorus]\nsing the night", false);
assert.match(shaped, /\[Chorus\]\n\(full band, big hit\)\nsing the night/);

console.log("music compose checks ok");
