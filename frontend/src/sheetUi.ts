import { useEffect, useState } from "react";
import type { ModelRow } from "./types";

export const CORE_SLOTS = ["front", "side", "closeup"] as const;
export const COSTUME_SLOTS = ["front", "side", "back"] as const;
export const EXTRA_SLOTS = [
  "back",
  "threequarter_front",
  "threequarter_back",
  "top",
] as const;
export const COSTUME_TAGS = [
  "everyday",
  "hero",
  "era",
  "fantasy",
  "formal",
  "sport",
  "workwear",
  "armor",
  "ceremonial",
] as const;

export const COSTUME_GENDERS = ["Male", "Female"] as const;

export const COSTUME_LAYERS = [
  "top",
  "bottom",
  "footwear",
  "over",
  "head",
  "hands",
  "accessories",
] as const;

export const COSTUME_ERAS = [
  "contemporary",
  "1920s",
  "1940s",
  "1960s",
  "1980s",
  "medieval",
  "victorian",
  "ancient",
  "far future",
] as const;

export const COSTUME_REGIONS = [
  "western",
  "east asian",
  "south asian",
  "middle eastern",
  "african",
  "nordic",
  "generic studio",
] as const;

export const COSTUME_SILHOUETTES = [
  "slim",
  "tailored",
  "bulky armor",
  "flowing",
  "layered",
  "utilitarian",
] as const;

export const COSTUME_MATERIALS = [
  "cotton",
  "linen",
  "wool",
  "silk",
  "leather",
  "denim",
  "velvet",
  "canvas",
  "metal plate",
  "chainmail",
  "rubber",
] as const;

export const COSTUME_COLORS = [
  "black",
  "white",
  "red",
  "blue",
  "green",
  "gold",
  "silver",
  "brown",
  "crimson",
  "steel",
] as const;

export const COSTUME_FITS = ["fitted", "tailored", "loose", "oversized", "layered"] as const;
export const COSTUME_CONDITIONS = [
  "pristine",
  "new",
  "worn",
  "weathered",
  "battle-damaged",
] as const;

export type CostumeLayer = (typeof COSTUME_LAYERS)[number];

const CLOTHES: Record<CostumeLayer, readonly string[]> = {
  top: [
    "t-shirt",
    "shirt",
    "blouse",
    "sweater",
    "hoodie",
    "tunic",
    "bodice",
    "vest",
  ],
  bottom: ["jeans", "trousers", "skirt", "shorts", "leggings", "chinos"],
  footwear: ["sneakers", "shoes", "boots", "sandals", "loafers", "barefoot"],
  over: ["cardigan", "denim jacket", "coat", "raincoat", "blazer", "hoodie zip"],
  head: ["beanie", "cap", "hat", "headband", "hood"],
  hands: ["none", "gloves", "watch"],
  accessories: ["belt", "bag", "scarf", "jewelry", "backpack"],
};

const LAYERED_CLOTHES: Record<CostumeLayer, readonly string[]> = {
  top: ["shirt", "tunic", "gambeson", "padded jacket", "doublet", "vest over shirt"],
  bottom: ["trousers", "hose", "skirt", "kilt"],
  footwear: ["boots", "soft shoes", "wraps"],
  over: ["cloak", "coat", "surcoat", "cape", "overcoat", "shawl"],
  head: ["hood", "hat", "kerchief", "circlet"],
  hands: ["gloves", "wraps"],
  accessories: ["belt", "pouch", "cloak pin", "sash"],
};

const ARMOR_STACK: Record<CostumeLayer, readonly string[]> = {
  top: ["gambeson", "mail shirt", "cuirass", "breastplate", "plate cuirass"],
  bottom: ["mail chausses", "greaves", "plate legs", "tassets"],
  footwear: ["sabatons", "armored boots"],
  over: ["cloak", "surcoat", "pauldron set", "cape"],
  head: ["helm", "great helm", "mail coif", "nasal helm"],
  hands: ["gauntlets", "mail mittens"],
  accessories: ["sword belt", "sheath", "gorget", "crest"],
};

const HERO_STACK: Record<CostumeLayer, readonly string[]> = {
  top: ["hero suit base", "bodysuit", "armored bodysuit", "unitard"],
  bottom: ["suit legs", "armored legs", "tights"],
  footwear: ["hero boots", "combat boots"],
  over: ["cape", "short cape", "hero cloak", "jacket over suit"],
  head: ["mask", "cowl", "domino mask", "helm"],
  hands: ["gauntlets", "hero gloves"],
  accessories: ["chest emblem", "utility belt", "emblem", "cape clasp"],
};

const FORMAL_STACK: Record<CostumeLayer, readonly string[]> = {
  top: ["dress shirt", "blouse", "waistcoat", "tuxedo shirt"],
  bottom: ["dress trousers", "skirt", "gown lower"],
  footwear: ["oxfords", "heels", "dress boots"],
  over: ["blazer", "tuxedo jacket", "evening coat", "opera cloak"],
  head: ["none", "fascinator", "top hat"],
  hands: ["none", "dress gloves"],
  accessories: ["tie", "bow tie", "clutch", "cufflinks"],
};

const SPORT_STACK: Record<CostumeLayer, readonly string[]> = {
  top: ["jersey", "tank", "track top", "compression shirt"],
  bottom: ["shorts", "track pants", "leggings"],
  footwear: ["trainers", "cleats", "running shoes"],
  over: ["track jacket", "warmup", "none"],
  head: ["cap", "headband", "none"],
  hands: ["none", "wristbands", "grip gloves"],
  accessories: ["water bottle sling", "number bib"],
};

const WORK_STACK: Record<CostumeLayer, readonly string[]> = {
  top: ["work shirt", "coveralls torso", "hi-vis vest", "scrub top"],
  bottom: ["cargo trousers", "coveralls", "scrub pants"],
  footwear: ["work boots", "clogs", "safety shoes"],
  over: ["hi-vis jacket", "lab coat", "apron", "none"],
  head: ["hard hat", "cap", "none"],
  hands: ["work gloves", "none"],
  accessories: ["tool belt", "badge lanyard"],
};

const CEREMONIAL_STACK: Record<CostumeLayer, readonly string[]> = {
  top: ["robe", "ornate tunic", "ceremonial jacket"],
  bottom: ["robe lower", "ornate trousers", "skirt"],
  footwear: ["slippers", "ornate boots"],
  over: ["ceremonial cloak", "cape", "mantle"],
  head: ["crown", "circlet", "mitre", "veil"],
  hands: ["ornate gloves", "rings"],
  accessories: ["scepter", "amulet", "chain of office"],
};

const ERA_EXTRAS: Record<string, Partial<Record<CostumeLayer, readonly string[]>>> = {
  medieval: {
    top: ["tunic", "gambeson"],
    over: ["cloak", "surcoat"],
    head: ["coif", "hood"],
  },
  victorian: {
    top: ["waistcoat", "high-collar shirt"],
    over: ["frock coat", "capelet"],
    head: ["top hat", "bonnet"],
  },
  "1920s": {
    top: ["cloche-era blouse"],
    over: ["drop-waist coat"],
    head: ["cloche hat"],
  },
  "far future": {
    top: ["exo vest", "tech bodysuit"],
    over: ["hard-light cloak", "vac jacket"],
    head: ["visor helm"],
  },
  ancient: {
    top: ["linen tunic", "chiton"],
    over: ["himation", "cloak"],
    footwear: ["sandals"],
  },
};

const FEMALE_CODED = new Set(
  [
    "blouse",
    "bodice",
    "fitted bodice",
    "skirt",
    "heels",
    "flats",
    "mary janes",
    "fascinator",
    "gown lower",
    "gown",
    "evening gown",
    "dress",
    "clutch",
    "bonnet",
    "veil",
    "capelet",
    "cloche hat",
    "cloche-era blouse",
    "drop-waist coat",
    "kirtle",
    "cotehardie",
    "corset",
    "bustle skirt",
    "wrap",
    "bolero",
    "wrap top",
    "hairpin",
  ].map((s) => s.toLowerCase()),
);

const MALE_CODED = new Set(
  [
    "doublet",
    "kilt",
    "tuxedo shirt",
    "dress shirt",
    "top hat",
    "frock coat",
    "tie",
    "bow tie",
    "cufflinks",
    "braies",
  ].map((s) => s.toLowerCase()),
);

const GENDER_EXTRAS: Record<string, Partial<Record<CostumeLayer, readonly string[]>>> = {
  female: {
    top: ["blouse", "bodice", "dress", "fitted bodice", "kirtle", "gown"],
    bottom: ["skirt"],
    footwear: ["heels", "flats"],
    over: ["capelet", "wrap", "bolero"],
    head: ["bonnet", "fascinator", "veil"],
    accessories: ["clutch", "hairpin"],
  },
  male: {
    top: ["doublet", "dress shirt"],
    bottom: ["kilt", "trousers"],
    footwear: ["oxfords", "loafers"],
    over: ["frock coat"],
    head: ["top hat"],
    accessories: ["tie", "bow tie", "cufflinks"],
  },
};

export const ARMOR_PIECES = new Set(
  [
    "cuirass",
    "breastplate",
    "plate cuirass",
    "mail",
    "mail shirt",
    "mail chausses",
    "mail coif",
    "mail mittens",
    "gambeson",
    "greaves",
    "plate legs",
    "tassets",
    "sabatons",
    "armored boots",
    "pauldron set",
    "helm",
    "great helm",
    "nasal helm",
    "helmet",
    "gauntlets",
    "gorget",
  ].map((s) => s.toLowerCase()),
);

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = String(raw || "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function stackForCategory(category: string): Record<CostumeLayer, readonly string[]> {
  const cat = category.trim().toLowerCase();
  if (cat === "armor" || cat === "fantasy") {
    const out = { ...LAYERED_CLOTHES };
    const merged = { ...out };
    for (const layer of COSTUME_LAYERS) {
      merged[layer] = uniq([...LAYERED_CLOTHES[layer], ...ARMOR_STACK[layer]]);
    }
    return merged;
  }
  if (cat === "hero") return HERO_STACK;
  if (cat === "formal") return FORMAL_STACK;
  if (cat === "sport") return SPORT_STACK;
  if (cat === "workwear") return WORK_STACK;
  if (cat === "ceremonial") return CEREMONIAL_STACK;
  if (cat === "era") return LAYERED_CLOTHES;
  return CLOTHES;
}

function genderKey(gender: string): "female" | "male" | "" {
  const g = gender.trim().toLowerCase();
  if (g.startsWith("f")) return "female";
  if (g.startsWith("m")) return "male";
  return "";
}

export function layerItemsFor(
  layer: CostumeLayer,
  category: string,
  era = "",
  gender = "",
): string[] {
  const cat = category.trim().toLowerCase();
  let items = [...(stackForCategory(cat)[layer] || [])];
  const eraKey = era.trim().toLowerCase();
  if (eraKey && ERA_EXTRAS[eraKey]?.[layer]) {
    items = uniq([...items, ...(ERA_EXTRAS[eraKey][layer] || [])]);
  }
  const g = genderKey(gender);
  if (g && GENDER_EXTRAS[g]?.[layer]) {
    items = uniq([...items, ...(GENDER_EXTRAS[g][layer] || [])]);
  }
  if (cat === "everyday" || cat === "sport" || cat === "workwear" || cat === "formal") {
    items = items.filter((s) => !ARMOR_PIECES.has(s.toLowerCase()));
  }
  if (g === "female") {
    items = items.filter((s) => !MALE_CODED.has(s.toLowerCase()));
  } else if (g === "male") {
    items = items.filter((s) => !FEMALE_CODED.has(s.toLowerCase()));
  }
  return items;
}

/** Item catalog for stacked body layers: union of Top + Over, still filtered by Category/Era/Gender. */
export function bodyLayerItemsFor(category: string, era = "", gender = ""): string[] {
  return uniq([
    ...layerItemsFor("top", category, era, gender),
    ...layerItemsFor("over", category, era, gender),
  ]);
}

export function signatureItemsFor(category: string): string[] {
  const cat = category.trim().toLowerCase();
  if (cat === "hero") return ["suit base", "cape", "emblem", "mask", "cowl"];
  if (cat === "armor" || cat === "fantasy") return ["helm", "cloak", "crest", "surcoat"];
  if (cat === "ceremonial") return ["crown", "cloak", "chain of office"];
  if (cat === "formal") return ["tie", "bow tie", "pocket square"];
  return ["watch", "bag", "scarf", "none"];
}

function allLayerItems(layer: CostumeLayer): string[] {
  return uniq([
    ...CLOTHES[layer],
    ...LAYERED_CLOTHES[layer],
    ...ARMOR_STACK[layer],
    ...HERO_STACK[layer],
    ...FORMAL_STACK[layer],
    ...SPORT_STACK[layer],
    ...WORK_STACK[layer],
    ...CEREMONIAL_STACK[layer],
  ]);
}

export const LAYER_ITEMS: Record<CostumeLayer, readonly string[]> = {
  top: allLayerItems("top"),
  bottom: allLayerItems("bottom"),
  footwear: allLayerItems("footwear"),
  over: allLayerItems("over"),
  head: allLayerItems("head"),
  hands: allLayerItems("hands"),
  accessories: allLayerItems("accessories"),
};

export const SCENE_LOCATIONS = [
  "bar",
  "nightclub",
  "diner",
  "street",
  "alley",
  "apartment",
  "kitchen",
  "office",
  "lobby",
  "hotel",
  "warehouse",
  "garage",
  "studio",
  "library",
  "hospital",
  "rooftop",
  "subway",
  "marketplace",
  "park",
  "forest",
  "beach",
  "cabin",
  "castle",
  "temple",
  "church",
] as const;
export const SCENE_TIMES = ["dawn", "day", "golden hour", "dusk", "night"] as const;
export const SCENE_WEATHER = ["clear", "overcast", "rain", "fog", "snow", "storm", "wind"] as const;
export const SCENE_MOODS = [
  "calm",
  "tense",
  "romantic",
  "gritty",
  "luxurious",
  "playful",
  "ominous",
  "melancholic",
  "energetic",
  "sterile",
  "cozy",
  "chaotic",
  "mysterious",
  "nostalgic",
] as const;
export const SCENE_ARCHITECTURE = [
  "modern",
  "industrial",
  "victorian",
  "brutalist",
  "timber",
  "stone",
  "neon",
  "art deco",
  "gothic",
  "mid-century",
  "colonial",
  "glass curtain",
  "brick",
  "adobe",
] as const;
export const SCENE_LIGHTING = [
  "practical",
  "neon",
  "candle",
  "moonlight",
  "fluorescent",
  "cinematic",
  "window light",
  "tungsten",
  "streetlamp",
  "firelight",
  "overcast daylight",
  "sodium vapor",
  "RGB accent",
] as const;
export const SCENE_CAMERA = [
  "wide establishing",
  "eye-level",
  "low angle",
  "high angle",
  "handheld",
  "locked-off still",
  "medium shot",
  "close-up",
  "dutch angle",
  "aerial",
  "over-the-shoulder",
  "anamorphic wide",
] as const;
export const SCENE_GRADES = [
  "natural",
  "warm tungsten",
  "cool moonlight",
  "teal-orange",
  "bleach bypass",
  "neon night",
  "faded film",
] as const;

export const PROP_TYPES = [
  "object",
  "handheld",
  "furniture",
  "vehicle",
  "food",
  "tool",
  "weapon",
  "other",
] as const;
export const PROP_MATERIALS = [
  "metal",
  "wood",
  "plastic",
  "glass",
  "fabric",
  "ceramic",
  "leather",
  "mixed",
] as const;
export const PROP_SCALES = ["miniature", "handheld", "tabletop", "life-size", "oversized"] as const;
export const PROP_CONDITIONS = ["pristine", "new", "worn", "rusty", "broken"] as const;

export const WARDROBE_M =
  "simple neutral athletic wear, non-revealing, studio character reference";
export const WARDROBE_F =
  "simple neutral athletic wear, non-revealing, studio character reference";

export const NANO_ASPECTS = [
  "auto",
  "21:9",
  "16:9",
  "3:2",
  "4:3",
  "5:4",
  "1:1",
  "4:5",
  "3:4",
  "2:3",
  "9:16",
] as const;

export const CLEAN_PLATE =
  "Pure solid black background only (#000000). Isolated subject on a clean plate — no environment, no floor, no props, no other people, no text, no logo. Clean silhouette, fully visible for the target angle.";

export const PROFILE_VIEWS: Record<string, string> = {
  front:
    "full body front view, entire figure visible including feet, standing straight, facing the camera, subject centered, no crop",
  side:
    "full body side view, entire figure visible including feet, standing straight, clean silhouette, subject centered, no crop",
  closeup:
    "face close-up, shoulders up, sharp facial features, correctly framed",
  back:
    "full body back view, entire figure visible including feet, standing straight, facing away from the camera",
  threequarter_front:
    "full body three-quarter front view (about 45°), entire figure visible including feet, standing straight",
  threequarter_back:
    "full body three-quarter back view (about 45° from behind), entire figure visible including feet, standing straight",
  top:
    "direct top-down view, camera directly above looking straight down, bird's-eye, full body visible including head and feet, subject centered, no three-quarter tilt",
};

export const SLOT_LABEL: Record<string, string> = {
  front: "Front",
  side: "Side",
  closeup: "Close-up",
  back: "Back",
  threequarter_front: "¾ front",
  threequarter_back: "¾ back",
  top: "Top",
};

function bit(v: string | undefined | null): string {
  return String(v ?? "").trim();
}

/** Client-side identity paragraph from dropdowns + wardrobe + notes. No API. */
export function composeCharacterIdentity(
  fields: Record<string, string>,
  notes = "",
): string {
  const parts: string[] = [];
  const gender = bit(fields.gender);
  const age = bit(fields.age);
  if (gender && age) parts.push(`${gender.toLowerCase()} in their ${age}`);
  else if (gender) parts.push(gender.toLowerCase());
  else if (age) parts.push(`adult in their ${age}`);
  const height = bit(fields.height);
  if (height) parts.push(`height: ${height}`);
  const weight = bit(fields.weight) || bit(fields.build);
  if (weight) parts.push(`build: ${weight}`);
  const body = bit(fields.body);
  if (body) parts.push(`body type: ${body}`);
  const bodyHair = bit(fields.body_hair);
  if (bodyHair) {
    parts.push(
      bodyHair.toLowerCase() === "none"
        ? "no body hair"
        : `body hair: ${bodyHair}`,
    );
  }
  const bust = bit(fields.bust);
  if (bust) parts.push(`bust: ${bust}`);
  const hair = [
    bit(fields.hair_length),
    bit(fields.hair_style),
    bit(fields.hair_color),
  ].filter(Boolean);
  if (hair.length) parts.push(`hair: ${hair.join(", ")}`);
  const facial = bit(fields.facial_hair);
  if (facial) {
    parts.push(
      facial.toLowerCase() === "none"
        ? "clean-shaven, no facial hair"
        : `facial hair: ${facial}`,
    );
  }
  const eyes = bit(fields.eye_color);
  if (eyes) parts.push(`eyes: ${eyes}`);
  const skin = bit(fields.skin);
  if (skin) parts.push(`skin tone: ${skin}`);
  const face = bit(fields.face_shape);
  if (face) parts.push(`face shape: ${face}`);
  const nose = bit(fields.nose);
  if (nose) parts.push(`nose: ${nose}`);
  const jaw = bit(fields.jaw);
  if (jaw) parts.push(`jaw/chin: ${jaw}`);
  const wardrobe = bit(fields.wardrobe);
  if (wardrobe) parts.push(`wardrobe: ${wardrobe}`);
  let head = parts.join("; ");
  const extra = bit(notes);
  if (extra) head = head ? `${head}. Extra: ${extra}` : extra;
  return head || "photoreal adult person";
}

export function composeCostumeBrief(
  fields: Record<string, string>,
  notes = "",
): string {
  const parts: string[] = [];
  const cat = bit(fields.category) || bit(fields.tag);
  if (cat) parts.push(`${cat} costume`);
  const gender = bit(fields.gender);
  const g = genderKey(gender);
  if (g === "female") parts.push("cut/fit: female figure, defined waist, feminine drape");
  else if (g === "male") parts.push("cut/fit: male figure, broader shoulder, straighter hang");
  const era = bit(fields.era);
  if (era) parts.push(`era: ${era}`);
  const region = bit(fields.region);
  if (region) parts.push(`region: ${region}`);
  const sil = bit(fields.silhouette);
  if (sil) parts.push(`silhouette: ${sil}`);
  const pal = bit(fields.palette);
  if (pal) parts.push(`palette: ${pal}`);
  const sig = bit(fields.signature);
  if (sig) parts.push(`signature piece: ${sig}`);
  const emblem = bit(fields.emblem);
  if (emblem) parts.push(`emblem: ${emblem}`);
  const bodyStack: string[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const prefix = i === 1 ? "top" : `top_${i}`;
    const item = bit(fields[prefix]);
    if (!item) continue;
    const bits = [item];
    const col = bit(fields[`${prefix}_color`]);
    const mat = bit(fields[`${prefix}_material`]);
    const fit = bit(fields[`${prefix}_fit`]);
    const cond = bit(fields[`${prefix}_condition`]);
    if (col) bits.push(col);
    if (mat) bits.push(mat);
    if (fit) bits.push(`${fit} fit`);
    if (cond) bits.push(cond);
    bodyStack.push(bits.join(", "));
  }
  if (bodyStack.length) {
    parts.push(`body layers (innermost first): ${bodyStack.join(" → ")}`);
  }
  for (const layer of COSTUME_LAYERS) {
    if (layer === "top" || layer === "over") continue;
    const item = bit(fields[layer]);
    if (!item) continue;
    const bits = [item];
    const col = bit(fields[`${layer}_color`]);
    const mat = bit(fields[`${layer}_material`]);
    const fit = bit(fields[`${layer}_fit`]);
    const cond = bit(fields[`${layer}_condition`]);
    if (col) bits.push(col);
    if (mat) bits.push(mat);
    if (fit) bits.push(`${fit} fit`);
    if (cond) bits.push(cond);
    parts.push(`${layer}: ${bits.join(", ")}`);
  }
  let head = parts.join("; ");
  const extra = bit(notes) || bit(fields.notes);
  if (extra) head = head ? `${head}. Extra: ${extra}` : extra;
  return head;
}

export function composeSceneBrief(
  fields: Record<string, string>,
  notes = "",
): string {
  const parts: string[] = [];
  const name = bit(fields.name);
  const loc = bit(fields.location);
  const setting = bit(fields.setting);
  if (name && loc) parts.push(`${name}, a ${loc}`);
  else if (name) parts.push(name);
  else if (loc) parts.push(`${loc} location`);
  if (setting) parts.push(setting);
  const time = bit(fields.time);
  if (time) parts.push(`time: ${time}`);
  const weather = bit(fields.weather);
  if (weather && setting !== "interior") parts.push(`weather: ${weather}`);
  const mood = bit(fields.mood);
  if (mood) parts.push(`mood: ${mood}`);
  const arch = bit(fields.architecture);
  if (arch) parts.push(`architecture: ${arch}`);
  const light = bit(fields.lighting);
  if (light) parts.push(`lighting: ${light}`);
  const cam = bit(fields.camera);
  if (cam) parts.push(`camera: ${cam}`);
  const els = bit(fields.elements);
  if (els) parts.push(`key elements: ${els}`);
  const furn = bit(fields.furniture);
  if (furn) parts.push(`furniture / fixtures: ${furn}`);
  const grade = bit(fields.grade);
  if (grade) parts.push(`color grade: ${grade}`);
  let head = parts.join("; ");
  const extra = bit(notes) || bit(fields.notes);
  if (extra) head = head ? `${head}. Extra: ${extra}` : extra;
  return head;
}

export function composePropBrief(
  fields: Record<string, string>,
  notes = "",
): string {
  const parts: string[] = [];
  const name = bit(fields.name);
  if (name) parts.push(name);
  const ptype = bit(fields.ptype) || bit(fields.type);
  if (ptype) parts.push(`type: ${ptype}`);
  const mat = bit(fields.material);
  if (mat) parts.push(`material: ${mat}`);
  const col = bit(fields.color);
  if (col) parts.push(`color: ${col}`);
  const scale = bit(fields.scale);
  if (scale) parts.push(`scale: ${scale}`);
  const cond = bit(fields.condition);
  if (cond) parts.push(`condition: ${cond}`);
  let head = parts.join("; ");
  const extra = bit(notes) || bit(fields.notes);
  if (extra) head = head ? `${head}. Extra: ${extra}` : extra;
  return head;
}

export function composeSceneStill(brief: string, opts?: { detail?: boolean }): string {
  const head = bit(brief) || "a photoreal location";
  const view = opts?.detail
    ? "Closer detail angle of the same space, matching lighting and architecture."
    : "Wide hero establishing view so we know the space.";
  return [
    `Establishing still of ${head}.`,
    view,
    "Empty of prominent people. Photoreal. No text, no logo, no watermark.",
  ].join(" ");
}

export function composePropStill(brief: string): string {
  const head = bit(brief) || "the object";
  return [
    `Product-style still of ${head}.`,
    "Isolated on a clean neutral studio background, even lighting, no people, no text, no logo, no watermark.",
  ].join(" ");
}

/** Identity paragraph + one framing line for the angle. No API. */
export function composeCostumePrompt(slot: string, outfit: string, extra = ""): string {
  const framing: Record<string, string> = {
    front:
      "Front full-body costume plate on a faceless mannequin or headless dress form. Entire garment visible including hems and footwear.",
    side:
      "Side-view costume plate on a faceless mannequin or headless dress form. Clean silhouette of the outfit, entire garment visible.",
    back: "Back-view costume plate on a faceless mannequin. Entire garment visible.",
    closeup:
      "Close-up of garment details — fabric, closures, trim. No face, no person identity.",
  };
  const view = framing[slot] || framing.front;
  const bits = [
    `Studio costume reference still of: ${bit(outfit) || "the described costume"}. ${view}`,
    "No face, no human identity, no model, no head. Faceless mannequin only. Photoreal garment, even studio lighting.",
    CLEAN_PLATE,
  ];
  if (bit(extra)) bits.push(bit(extra));
  return bits.join("\n\n");
}

export function composeDressPrompt(
  slot: string,
  identity: string,
  outfit: string,
  opts?: { hasFront?: boolean },
): string {
  const view = PROFILE_VIEWS[slot] || PROFILE_VIEWS.front;
  const lines = [
    bit(identity) || "photoreal adult person",
    `Change only the wardrobe to: ${bit(outfit) || "the costume plates"}. Keep the same person.`,
    `Framing: ${view}.`,
  ];
  if (slot !== "front" && opts?.hasFront) {
    lines.push(
      "Same person as the Front still. Use Front as the R2I identity source and costume plates for wardrobe.",
    );
  }
  lines.push(CLEAN_PLATE);
  return lines.join("\n\n");
}

export function composeAnglePrompt(
  slot: string,
  identity: string,
  opts?: { hasFront?: boolean },
): string {
  const key = slot || "front";
  const view = PROFILE_VIEWS[key] || PROFILE_VIEWS.front;
  const ident = bit(identity) || "photoreal adult person";
  const lines = [ident, `Framing: ${view}.`];
  if (key !== "front" && opts?.hasFront) {
    lines.push(
      "Same person as the Front reference still. Use the Front still as the R2I identity source.",
    );
  }
  lines.push(CLEAN_PLATE);
  return lines.join("\n\n");
}

export function isNanoModel(row: ModelRow | null | undefined): boolean {
  const blob = `${row?.id || ""} ${row?.label || ""} ${row?.endpoint || ""}`.toLowerCase();
  return blob.includes("nano") || blob.includes("banana");
}

export function aspectChoices(row: ModelRow | null | undefined): string[] {
  if (isNanoModel(row)) return [...NANO_ASPECTS];
  return (row?.aspect_choices ?? []).map((s) => String(s).trim()).filter(Boolean);
}

export function qualityChoices(row: ModelRow | null | undefined): string[] {
  return (row?.resolution_choices ?? [])
    .map((s) => String(s).trim())
    .filter((s) => /^(0\.5K|1K|2K|4K)$/i.test(s));
}

export function sizeChoices(row: ModelRow | null | undefined): string[] {
  if (!row) return [];
  const qualities = qualityChoices(row);
  const res = (row.resolution_choices ?? []).map((s) => String(s).trim()).filter(Boolean);
  const sizes = res.filter((s) => !qualities.includes(s));
  if (sizes.length) return sizes;
  const aspects = aspectChoices(row);
  if (aspects.length) return aspects;
  return qualities;
}

export function pickDefaultResolution(choices: string[]): string {
  const opts = (Array.isArray(choices) ? choices : []).filter(Boolean);
  if (!opts.length) return "";
  const lower = new Map(opts.map((c) => [c.toLowerCase(), c]));
  const prefer = [
    "9:16",
    "portrait_16_9",
    "portrait_4_3",
    "9:16 portrait",
    "3:4 portrait",
    "auto_2k",
    "2k",
    "square_hd",
    "1:1 square hd",
    "auto_4k",
    "4k",
    "1k",
    "auto",
  ];
  for (const p of prefer) {
    const hit = lower.get(p);
    if (hit && (hit.toLowerCase() !== "auto" || opts.every((c) => c.toLowerCase() === "auto"))) {
      return hit;
    }
  }
  const nonAuto = opts.find((c) => c.toLowerCase() !== "auto");
  return nonAuto || opts[0] || "";
}

export function sheetModel(row: ModelRow | null | undefined) {
  if (!row || typeof row !== "object") return false;
  const blob = `${row.id || ""} ${row.label || ""}`.toLowerCase();
  return blob.includes("flux") || blob.includes("seedream") || blob.includes("nano");
}

function asModelRows(raw: unknown): ModelRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is ModelRow => Boolean(row && (row as ModelRow).id));
}

function pickModelId(cur: string, preferred: string | undefined, rows: ModelRow[]) {
  if (cur && rows.some((r) => r.id === cur)) return cur;
  if (preferred && rows.some((r) => r.id === preferred)) return preferred;
  return rows[0]?.id || "";
}

export function useSheetModels() {
  const [t2i, setT2i] = useState<ModelRow[]>([]);
  const [r2i, setR2i] = useState<ModelRow[]>([]);
  const [t2iId, setT2iIdRaw] = useState("");
  const [r2iId, setR2iIdRaw] = useState("");
  useEffect(() => {
    const ac = new AbortController();
    fetch("/models?mode=image&modality=t2i", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : { models: [] }))
      .then((body: { models?: ModelRow[]; default_id?: string }) => {
        const rows = asModelRows(body.models).filter(sheetModel);
        setT2i(rows);
        setT2iIdRaw((cur) => pickModelId(cur, body.default_id, rows));
      })
      .catch((err: unknown) => {
        console.error("T2I catalog load failed", err);
      });
    fetch("/models?mode=image&modality=r2i", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : { models: [] }))
      .then((body: { models?: ModelRow[]; default_id?: string }) => {
        const rows = asModelRows(body.models).filter(sheetModel);
        setR2i(rows);
        setR2iIdRaw((cur) => pickModelId(cur, body.default_id, rows));
      })
      .catch((err: unknown) => {
        console.error("R2I catalog load failed", err);
      });
    return () => ac.abort();
  }, []);
  const t2iSafe = t2i.some((r) => r.id === t2iId) ? t2iId : t2i[0]?.id || "";
  const r2iSafe = r2i.some((r) => r.id === r2iId) ? r2iId : r2i[0]?.id || "";
  return {
    t2i,
    r2i,
    t2iId: t2iSafe,
    r2iId: r2iSafe,
    setT2iId: (id: string) =>
      setT2iIdRaw(t2i.some((r) => r.id === id) ? id : t2i[0]?.id || ""),
    setR2iId: (id: string) =>
      setR2iIdRaw(r2i.some((r) => r.id === id) ? id : r2i[0]?.id || ""),
  };
}

export function localSheetEstimate(
  kind: string,
  t2i: ModelRow | undefined,
  r2i: ModelRow | undefined,
  slots: string[],
) {
  try {
    const planned = (Array.isArray(slots) ? slots : []).filter(Boolean);
    const list = planned.length ? planned : ["front"];
    let total = 0;
    list.forEach((slot, i) => {
      const first = i === 0 || slot === "front";
      const costume = kind === "costume";
      const row = costume || !first ? r2i : t2i;
      const fallback = costume || !first ? 0.03 : 0.04;
      const usd = Number(row?.cost_estimate_usd);
      total += Number.isFinite(usd) && usd > 0 ? usd : fallback;
    });
    if (!Number.isFinite(total)) return "Est. cost: —";
    const n = list.length;
    return `Est. cost: $${total.toFixed(2)} · ${n} still${n === 1 ? "" : "s"}`;
  } catch (err) {
    console.error("localSheetEstimate failed", err);
    return "Est. cost: —";
  }
}

export function useSheetEstimate(
  kind: string,
  t2iId: string,
  r2iId: string,
  slots: string[],
  models?: { t2i: ModelRow[]; r2i: ModelRow[] },
  resolutions?: { t2i?: string; r2i?: string },
) {
  const key = Array.isArray(slots) ? slots.filter(Boolean).join("|") : "";
  const resKey = `${resolutions?.t2i || ""}|${resolutions?.r2i || ""}`;
  let local = "Est. cost: —";
  try {
    const t2iRows = Array.isArray(models?.t2i) ? models.t2i : [];
    const r2iRows = Array.isArray(models?.r2i) ? models.r2i : [];
    local = localSheetEstimate(
      kind,
      t2iRows.find((m) => m && m.id === t2iId),
      r2iRows.find((m) => m && m.id === r2iId),
      Array.isArray(slots) ? slots : [],
    );
  } catch (err) {
    console.error("useSheetEstimate local failed", err);
    local = "Est. cost: —";
  }
  const [estimate, setEstimate] = useState(local || "Est. cost: —");
  useEffect(() => {
    setEstimate(local || "Est. cost: —");
    const ac = new AbortController();
    fetch("/assets/sheet/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        t2i_model_id: t2iId || "",
        r2i_model_id: r2iId || "",
        slots: Array.isArray(slots) ? slots.filter(Boolean) : ["front"],
        t2i_resolution: resolutions?.t2i || "",
        r2i_resolution: resolutions?.r2i || "",
      }),
      signal: ac.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { cost?: string } | null) => {
        if (body?.cost && String(body.cost).includes("$")) setEstimate(body.cost);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("sheet estimate failed", err);
        setEstimate("Est. cost: —");
      });
    return () => ac.abort();
  }, [kind, t2iId, r2iId, key, local, resKey]);
  return estimate || "Est. cost: —";
}
