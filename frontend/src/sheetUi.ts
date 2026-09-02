import { useEffect, useState } from "react";
import type { ModelRow } from "./types";

export const CORE_SLOTS = ["front", "side", "closeup"] as const;
export const COSTUME_SLOTS = ["front", "side", "back"] as const;
export const COSTUME_SHEET_SLOT = "sheet";
export const COSTUME_PLATE_SLOTS = ["front", "side", "back", "closeup"] as const;
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

export const SCENE_THEMES = [
  "contemporary",
  "noir",
  "fantasy",
  "sci-fi",
  "western",
  "historical",
  "horror",
  "coastal",
] as const;

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

const SCENE_THEME_STACK: Record<
  string,
  {
    locations: readonly string[];
    architecture: readonly string[];
    lighting: readonly string[];
    setting?: string;
  }
> = {
  fantasy: {
    locations: [
      "castle",
      "temple",
      "forest",
      "marketplace",
      "tavern",
      "throne hall",
      "ruins",
      "cavern",
      "village",
      "keep",
      "enchanted grove",
    ],
    architecture: ["stone", "gothic", "timber", "carved", "ancient masonry"],
    lighting: ["firelight", "candle", "moonlight", "torch", "overcast daylight"],
    setting: "mixed",
  },
  noir: {
    locations: ["bar", "alley", "street", "nightclub", "office", "rooftop", "diner", "warehouse"],
    architecture: ["art deco", "brick", "neon", "industrial"],
    lighting: ["neon", "sodium vapor", "practical", "streetlamp", "tungsten"],
    setting: "interior",
  },
  "sci-fi": {
    locations: ["hangar", "bridge", "lab", "corridor", "colony", "spaceport", "airlock", "server hall"],
    architecture: ["glass curtain", "brutalist", "metal", "neon"],
    lighting: ["RGB accent", "fluorescent", "cinematic", "practical"],
    setting: "interior",
  },
  western: {
    locations: ["saloon", "main street", "desert", "ranch", "jail", "stable", "canyon"],
    architecture: ["timber", "adobe", "brick", "colonial"],
    lighting: ["overcast daylight", "golden hour sun", "lantern", "firelight"],
    setting: "exterior",
  },
  historical: {
    locations: ["castle", "church", "temple", "palace", "market", "manor", "harbor"],
    architecture: ["victorian", "gothic", "colonial", "stone", "timber"],
    lighting: ["candle", "window light", "firelight", "overcast daylight"],
  },
  horror: {
    locations: ["cabin", "hospital", "church", "forest", "alley", "basement", "asylum", "graveyard"],
    architecture: ["gothic", "timber", "brutalist", "stone"],
    lighting: ["moonlight", "practical", "fluorescent", "firelight", "candle"],
    setting: "interior",
  },
  coastal: {
    locations: ["beach", "harbor", "boardwalk", "lighthouse", "cabin", "pier", "cliff"],
    architecture: ["timber", "colonial", "adobe", "modern"],
    lighting: ["overcast daylight", "golden hour sun", "window light", "moonlight"],
    setting: "exterior",
  },
  contemporary: {
    locations: [],
    architecture: [],
    lighting: [],
  },
};

export function sceneLocationsFor(theme: string): string[] {
  const stack = SCENE_THEME_STACK[theme.trim().toLowerCase()];
  if (stack?.locations?.length) return [...stack.locations];
  return [...SCENE_LOCATIONS];
}

export function sceneArchitectureFor(theme: string): string[] {
  const stack = SCENE_THEME_STACK[theme.trim().toLowerCase()];
  if (stack?.architecture?.length) return [...stack.architecture];
  return [...SCENE_ARCHITECTURE];
}

export function sceneLightingFor(theme: string): string[] {
  const stack = SCENE_THEME_STACK[theme.trim().toLowerCase()];
  if (stack?.lighting?.length) return [...stack.lighting];
  return [...SCENE_LIGHTING];
}

export function sceneThemeSetting(theme: string): string {
  return SCENE_THEME_STACK[theme.trim().toLowerCase()]?.setting || "";
}

export const PROP_THEMES = [
  "everyday",
  "fantasy",
  "military",
  "industrial",
  "luxury",
  "ancient",
] as const;

export const PROP_VIEWS = [
  "hero three-quarter",
  "front",
  "side",
  "top-down",
  "detail",
] as const;

const PROP_THEME_TYPES: Record<string, readonly string[]> = {
  everyday: ["object", "handheld", "furniture", "food", "tool", "other"],
  fantasy: ["weapon", "object", "tool", "handheld"],
  military: ["weapon", "tool", "object", "vehicle"],
  industrial: ["tool", "object", "vehicle", "furniture"],
  luxury: ["object", "furniture", "handheld"],
  ancient: ["weapon", "object", "tool", "furniture"],
};

export function propTypesFor(theme: string): string[] {
  const extra = PROP_THEME_TYPES[theme.trim().toLowerCase()];
  if (extra?.length) return [...extra];
  return [...PROP_TYPES];
}

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
  sheet: "Costume sheet",
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
  const theme = bit(fields.theme);
  if (name && loc) parts.push(`${name}, a ${loc}`);
  else if (name) parts.push(name);
  else if (loc) parts.push(`${loc} location`);
  if (theme) parts.push(`${theme} setting`);
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
  const theme = bit(fields.theme);
  if (theme) parts.push(`${theme} prop`);
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
  const view = bit(fields.view);
  if (view) parts.push(`view: ${view}`);
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

export function composePropStill(brief: string, opts?: { detail?: boolean }): string {
  const head = bit(brief) || "the object";
  const view = opts?.detail
    ? "Tight detail of material, wear, and construction. Fill the frame with the object."
    : "Hero product still, full object visible, three-quarter or catalog angle.";
  return [
    `Product-style still of ${head}.`,
    view,
    "Isolated on a clean neutral studio background, even lighting, no people, no text, no logo, no watermark.",
  ].join(" ");
}

export function composeSceneSheetPrompt(brief: string, extra = ""): string {
  const bits = [
    `Production location SHEET of ${bit(brief) || "this place"}. One image only.`,
    "Clean studio grid of the same space: wide hero establishing, a medium view, and a detail of architecture or lighting. Match the attached stills.",
    "Empty of prominent people. Photoreal. Optional small clean labels only.",
    SHEET_NO_GARBLED,
  ];
  if (bit(extra)) bits.push(bit(extra));
  return bits.join(" ");
}

export function composePropSheetPrompt(brief: string, extra = ""): string {
  const bits = [
    `Product reference SHEET of ${bit(brief) || "this object"}. One image only.`,
    "Hero three-quarter of the full prop plus a tight detail of material, edge wear, and construction. Isolated studio. Match the attached stills.",
    SHEET_NO_GARBLED,
  ];
  if (bit(extra)) bits.push(bit(extra));
  return bits.join(" ");
}

/** Identity paragraph + one framing line for the angle. No API. */
const SHEET_NO_GARBLED =
  "No gibberish text, no watermarks, no logos, no random letters or captions.";

export function composeCostumeSheetPrompt(outfit: string, extra = ""): string {
  const bits = [
    `Single costume reference SHEET of: ${bit(outfit) || "the described costume"}. One image only.`,
    "Build the sheet from the attached costume angle stills: faceless mannequin Front, Side, and Back (full-body) plus detail callouts of fabric, trim, closures, and any emblem, and a small color-palette row.",
    "Labeled or clean unlabeled grid. Match the attached stills. No face, no human identity, no living model, no environment. Photoreal garments, even studio lighting. Dark studio ground.",
    SHEET_NO_GARBLED,
  ];
  if (bit(extra)) bits.push(bit(extra));
  return bits.join(" ");
}

export function composeCharacterSheetPrompt(name: string, extra = ""): string {
  const who = bit(name) || "this character";
  const bits = [
    `Production character SHEET of ${who}. One image only.`,
    "Clean studio grid built from the attached angle stills (front, side, back, close-up, and any extra views).",
    "Same person in every panel — identity, face, hair, body, and wardrobe consistent. Isolated on a clean plate. Photoreal. Optional small clean labels only.",
    SHEET_NO_GARBLED,
  ];
  if (bit(extra)) bits.push(bit(extra));
  return bits.join(" ");
}

export function composeDressSheetPrompt(identity: string, outfit: string, extra = ""): string {
  const bits = [
    `Production character SHEET of ${bit(identity) || "the character"} dressed in: ${bit(outfit) || "the attached costume"}. One image only.`,
    "Take the attached character sheet (or angle stills) and dress EVERY pose and angle in the attached costume. Keep identity, face, hair, age, skin, and body.",
    "Same grid layout: full-body front/side/back plus close-up, now wearing the costume. Match costume color, cut, and fabric. Isolated on a clean plate. Photoreal.",
    SHEET_NO_GARBLED,
  ];
  if (bit(extra)) bits.push(bit(extra));
  return bits.join(" ");
}

export const SHEET_NO_TEXT =
  "No text, no labels, no lettering, no captions anywhere on the image.";

export function collectSheetAngleRefs(
  identity?: Record<string, string> | null,
  kind: "character" | "costume" = "character",
): string[] {
  const slots =
    kind === "costume" ? COSTUME_PLATE_SLOTS : [...CORE_SLOTS, ...EXTRA_SLOTS];
  const out: string[] = [];
  for (const slot of slots) {
    const p = String(identity?.[slot] || "").trim();
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

export function collectAssetSheetRefs(asset: {
  kind?: string;
  identity?: Record<string, string> | null;
  still_path?: string | null;
  still_paths?: string[];
}): string[] {
  const kind = asset.kind === "costume" ? "costume" : "character";
  const out = collectSheetAngleRefs(asset.identity, kind);
  const add = (p?: string | null) => {
    const s = String(p || "").trim();
    if (s && !out.includes(s)) out.push(s);
  };
  add(asset.still_path);
  for (const p of asset.still_paths || []) add(p);
  return out;
}

export function preferredIdentityPaths(
  identity?: Record<string, string> | null,
  primarySlot?: string,
  still?: string,
): string[] {
  const sheet = String(identity?.sheet || "").trim();
  if (sheet) return [sheet];
  const primary = sheetPrimaryPath(identity, primarySlot, still);
  return primary ? [primary] : [];
}

export function modelCostLabel(row?: ModelRow | null): string {
  const usd = Number(row?.cost_estimate_usd);
  if (Number.isFinite(usd) && usd > 0) return `Est. cost: $${usd.toFixed(2)}`;
  const cost = String(row?.cost || "").trim();
  if (cost) return cost.startsWith("Est.") ? cost : `Est. cost: ${cost}`;
  return "Est. cost: —";
}

export function composeCostumePrompt(slot: string, outfit: string, extra = ""): string {
  if (slot === "sheet") return composeCostumeSheetPrompt(outfit, extra);
  if (slot === "closeup") {
    const bits = [
      `Studio costume DETAIL plate of: ${bit(outfit) || "the described costume"}.`,
      "NOT a full-body shot. NOT a standing mannequin from head to toe.",
      "Tight macro close-ups filling the frame: fabric weave and texture, stitching, trim, closures, hardware, and any emblem or signature piece. Optional small inset material callouts.",
      "No face, no person, no full figure, no environment. Photoreal garment details. Pure solid black background only (#000000).",
    ];
    if (bit(extra)) bits.push(bit(extra));
    return bits.join(" ");
  }
  const framing: Record<string, string> = {
    front:
      "Front full-body costume plate on a faceless mannequin or headless dress form. Entire garment visible including hems and footwear.",
    side:
      "Side-view costume plate on a faceless mannequin or headless dress form. Clean silhouette of the outfit, entire garment visible.",
    back: "Back-view costume plate on a faceless mannequin. Entire garment visible.",
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
      "Same person and wardrobe as the costumed Front still. Use that Front as the only R2I source.",
    );
  }
  lines.push(CLEAN_PLATE);
  return lines.join("\n\n");
}

/** Catalog max_ref_images for sheet / extra-angle R2I. Never clamp Seedream to 3. */
export function sheetR2iRefCap(model?: ModelRow | null): number {
  const blob = `${model?.id || ""} ${model?.label || ""} ${model?.endpoint || ""}`.toLowerCase();
  const raw = Number(model?.size_limits?.max_ref_images ?? model?.size_limits?.max_refs ?? 0) || 0;
  if (blob.includes("muse") || blob.includes("seedream")) return 10;
  if (blob.includes("qwen")) return raw > 0 ? raw : 3;
  if (
    blob.includes("nano") ||
    blob.includes("flux") ||
    blob.includes("fibo")
  ) {
    return raw > 0 ? raw : 4;
  }
  return raw > 0 ? raw : 4;
}

export function sheetPrimaryPath(
  identity?: Record<string, string> | null,
  primarySlot?: string,
  fallback = "",
): string {
  const ident = identity || {};
  const slot = (primarySlot || "front").trim().toLowerCase() || "front";
  return (ident[slot] || ident.front || fallback || "").trim();
}

export type DressRefChip = {
  id: string;
  label: string;
  path: string;
  url: string;
};

function chipUrl(
  asset: {
    id?: string;
    identity_urls?: Record<string, string> | null;
    url?: string | null;
    thumb_url?: string | null;
  } | null | undefined,
  slot: string,
): string {
  const urls = asset?.identity_urls || {};
  return (
    urls[slot] ||
    (asset?.id ? `/assets/${asset.id}/still?slot=${slot}` : "") ||
    asset?.thumb_url ||
    asset?.url ||
    ""
  );
}

export function dressDefaultRefChips(
  char?: {
    id?: string;
    identity?: Record<string, string> | null;
    identity_urls?: Record<string, string> | null;
    still_path?: string | null;
    url?: string | null;
    thumb_url?: string | null;
    primary_slot?: string;
  } | null,
  costume?: {
    id?: string;
    identity?: Record<string, string> | null;
    identity_urls?: Record<string, string> | null;
    still_path?: string | null;
    url?: string | null;
    thumb_url?: string | null;
    primary_slot?: string;
  } | null,
): DressRefChip[] {
  const one = (
    id: string,
    asset: typeof char,
    sheetLabel: string,
    frontLabel: string,
  ): DressRefChip | null => {
    if (!asset) return null;
    const ident = asset.identity || {};
    if (ident.sheet) {
      return {
        id,
        label: sheetLabel,
        path: ident.sheet,
        url: chipUrl(asset, "sheet"),
      };
    }
    const path =
      ident.front ||
      sheetPrimaryPath(ident, asset.primary_slot, asset.still_path || "") ||
      asset.still_path ||
      "";
    if (!path) return null;
    return {
      id,
      label: frontLabel,
      path,
      url: chipUrl(asset, "front"),
    };
  };
  return [
    one("character", char, "Character Sheet", "Character Front"),
    one("costume", costume, "Costume Sheet", "Costume Front"),
  ].filter((c): c is DressRefChip => Boolean(c));
}

export function collectDressFrontRefs(opts: {
  characterIdentity?: Record<string, string> | null;
  characterPrimarySlot?: string;
  characterStill?: string;
  costumeIdentity?: Record<string, string> | null;
  costumePrimarySlot?: string;
  costumeStill?: string;
  lockFace?: boolean;
  useFullPacks?: boolean;
  extraPaths?: string[];
  maxRefs?: number;
}): string[] {
  const out: string[] = [];
  const add = (p?: string) => {
    const s = String(p || "").trim();
    if (s && !out.includes(s)) out.push(s);
  };
  add(
    opts.characterIdentity?.sheet ||
      sheetPrimaryPath(opts.characterIdentity, opts.characterPrimarySlot, opts.characterStill),
  );
  add(
    opts.costumeIdentity?.sheet ||
      sheetPrimaryPath(opts.costumeIdentity, opts.costumePrimarySlot, opts.costumeStill),
  );
  const cap = opts.maxRefs && opts.maxRefs > 0 ? opts.maxRefs : 3;
  if (opts.lockFace && out.length < cap) add(opts.characterIdentity?.closeup);
  for (const p of opts.extraPaths || []) {
    if (out.length >= cap) break;
    add(p);
  }
  if (opts.useFullPacks) {
    for (const slot of CORE_SLOTS) {
      if (out.length >= cap) break;
      add(opts.characterIdentity?.[slot]);
    }
    for (const slot of COSTUME_SLOTS) {
      if (out.length >= cap) break;
      add(opts.costumeIdentity?.[slot]);
    }
  }
  return out;
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

export function isFluxEditModel(row: ModelRow | null | undefined): boolean {
  const blob = `${row?.id || ""} ${row?.label || ""} ${row?.endpoint || ""}`.toLowerCase();
  if (!blob.includes("flux")) return false;
  if (blob.includes("t2i") || blob.includes("text-to-image")) return false;
  return (
    blob.includes("edit") ||
    blob.includes("r2i") ||
    blob.includes("/edit") ||
    blob.includes("studio:img:flux")
  );
}

const VIDEO_SIZE_TOKEN = /^(360p|480p|540p|720p|1080p|1440p|2160p)$/i;

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
  const dropVideo = (s: string) => s && !VIDEO_SIZE_TOKEN.test(s);
  const qualities = qualityChoices(row).filter(dropVideo);
  const res = (row.resolution_choices ?? [])
    .map((s) => String(s).trim())
    .filter(dropVideo);
  const sizes = res.filter((s) => !qualities.includes(s));
  if (sizes.length) return sizes;
  const aspects = aspectChoices(row).filter(dropVideo);
  if (aspects.length) return aspects;
  return qualities;
}

function pickPreferredResolution(choices: string[], prefer: string[]): string {
  const opts = (Array.isArray(choices) ? choices : []).filter(Boolean);
  if (!opts.length) return "";
  const lower = new Map(opts.map((c) => [c.toLowerCase(), c]));
  for (const p of prefer) {
    const hit = lower.get(p);
    if (hit && (hit.toLowerCase() !== "auto" || opts.every((c) => c.toLowerCase() === "auto"))) {
      return hit;
    }
  }
  const nonAuto = opts.find((c) => c.toLowerCase() !== "auto");
  return nonAuto || opts[0] || "";
}

export function pickDefaultResolution(choices: string[]): string {
  return pickPreferredResolution(choices, [
    "auto_2k",
    "2k",
    "portrait_16_9",
    "9:16",
    "portrait_4_3",
    "9:16 portrait",
    "3:4 portrait",
    "square_hd",
    "1:1 square hd",
    "auto_4k",
    "4k",
    "1k",
    "auto",
  ]);
}

export function pickSheetResolution(choices: string[]): string {
  return pickPreferredResolution(choices, [
    "match source",
    "landscape_16_9",
    "16:9",
    "auto_2k",
    "2k",
    "square_hd",
    "1:1 square hd",
    "auto_4k",
    "4k",
    "1k",
    "auto",
  ]);
}

export function isMuseEditModel(row: ModelRow | null | undefined): boolean {
  const blob = `${row?.id || ""} ${row?.label || ""} ${row?.endpoint || ""}`.toLowerCase();
  if (!blob.includes("muse")) return false;
  if (blob.includes("t2i") || blob.includes("text-to-image")) return false;
  return (
    blob.includes("edit") ||
    blob.includes("r2i") ||
    blob.includes("muse-image/edit")
  );
}

function modelBlob(row: ModelRow | null | undefined): string {
  return `${row?.id || ""} ${row?.label || ""} ${row?.endpoint || ""}`.toLowerCase();
}

function modelRefCap(row: ModelRow | null | undefined): number {
  return (
    Number(row?.size_limits?.max_ref_images ?? row?.size_limits?.max_refs ?? 0) || 0
  );
}

export function sheetModel(row: ModelRow | null | undefined) {
  if (!row || typeof row !== "object") return false;
  const blob = modelBlob(row);
  if (
    blob.includes("flux") ||
    blob.includes("seedream") ||
    blob.includes("nano") ||
    blob.includes("qwen") ||
    blob.includes("recraft")
  ) {
    return true;
  }
  // Muse Image Edit (not Muse T2I) — Character Sheet + extra-angle R2I list.
  return isMuseEditModel(row);
}

/** Character Sheet compose picker: R2I/edit only. Always includes Muse Edit. Never T2I. */
export function sheetComposeModel(row: ModelRow | null | undefined) {
  if (!row || typeof row !== "object") return false;
  const blob = modelBlob(row);
  const id = String(row.id || "").toLowerCase();
  const endpoint = String(row.endpoint || "").toLowerCase();
  if (blob.includes("t2i") || blob.includes("text-to-image") || endpoint.includes("text-to-image")) {
    return false;
  }
  if (isMuseEditModel(row)) return true;
  if (id.includes("studio:img:muse image edit") || endpoint.includes("muse-image/edit")) {
    return true;
  }
  if (sheetModel(row)) return true;
  const modalities = Array.isArray(row.modalities) ? row.modalities : [];
  const isEdit =
    blob.includes("edit") ||
    blob.includes("r2i") ||
    modalities.includes("r2i") ||
    modalities.includes("i2i");
  return isEdit && modelRefCap(row) >= 4;
}

/** Nano, Flux, Seedream, Qwen, Muse, Fibo — T2I omitted (compose is multi-ref edit). */
export function sortSheetComposeModels(rows: ModelRow[]): ModelRow[] {
  const rank = (row: ModelRow): number => {
    const blob = modelBlob(row);
    if (blob.includes("t2i") || blob.includes("text-to-image")) return 90;
    if (blob.includes("nano banana pro")) return 0;
    if (blob.includes("nano")) return 1;
    if (blob.includes("flux 2 pro")) return 2;
    if (blob.includes("flux 2 max")) return 3;
    if (blob.includes("flux")) return 4;
    if (blob.includes("seedream")) return 5;
    if (blob.includes("qwen")) return 6;
    if (blob.includes("muse")) return 7;
    if (blob.includes("fibo")) return 8;
    return 50;
  };
  return [...rows].sort((a, b) => rank(a) - rank(b) || (a.label || a.id).localeCompare(b.label || b.id));
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
  const [composeR2i, setComposeR2i] = useState<ModelRow[]>([]);
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
        const all = asModelRows(body.models);
        const rows = all.filter(sheetModel);
        const compose = all.filter(sheetComposeModel);
        setR2i(rows);
        setComposeR2i(compose);
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
    composeR2i,
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
