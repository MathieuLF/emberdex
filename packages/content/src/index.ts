import { getRuleSetPreset, type ContentPack, type RouteDefinition, type ThemeTokens } from "@emberdex/core";

export const defaultTheme: ThemeTokens = {
  name: "Ember Tide",
  background: "#07111d",
  backgroundAlt: "#0b1726",
  surface: "rgba(12, 22, 36, 0.72)",
  surfaceStrong: "rgba(13, 27, 44, 0.94)",
  surfaceElevated: "rgba(18, 36, 56, 0.96)",
  line: "rgba(148, 163, 184, 0.14)",
  text: "#f6fbff",
  muted: "#9cb1cb",
  accent: "#7df7d3",
  accentSoft: "rgba(125, 247, 211, 0.16)",
  accentSecondary: "#f7a35c",
  success: "#6ef3a5",
  warning: "#ffd166",
  danger: "#ff7b87",
  glow: "rgba(125, 247, 211, 0.42)",
  shadow: "0 24px 80px rgba(0, 0, 0, 0.45)",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function r(
  id: string,
  name: string,
  gen: number,
  levelCap: number,
  versionGroups: string[],
  notes?: string
): RouteDefinition {
  return { id, name, generation: gen, levelCap, versionGroups, bosses: [], notes };
}

// Version-group shorthands
const RB   = ["red-blue", "yellow"];
const FRLG = ["firered-leafgreen"];
const KANTO_ALL = ["red-blue", "yellow", "firered-leafgreen", "lets-go-pikachu-lets-go-eevee"];

const GS   = ["gold-silver", "crystal"];
const HGSS = ["heartgold-soulsilver"];
const JOHTO_ALL = ["gold-silver", "crystal", "heartgold-soulsilver"];

const HOENN_ALL = ["ruby-sapphire", "emerald", "omega-ruby-alpha-sapphire"];

const SINNOH_ALL = ["diamond-pearl", "platinum", "brilliant-diamond-shining-pearl"];

const BW   = ["black-white"];
const B2W2 = ["black-2-white-2"];

const XY   = ["x-y"];

const ALOLA_ALL = ["sun-moon", "ultra-sun-ultra-moon"];

const SS   = ["sword-shield"];
const LA   = ["legends-arceus"];
const SV   = ["scarlet-violet"];

// ---------------------------------------------------------------------------
// Kanto - génération 1, remakes et Let's Go
// ---------------------------------------------------------------------------
const KANTO_ROUTES: RouteDefinition[] = [
  r("route-1",       "Route 1",           1,  4,  KANTO_ALL, "Première route entre Bourg Palette et Jadielle."),
  r("route-2",       "Route 2",           1,  5,  KANTO_ALL, "Deux sections séparées par la Forêt de Sapin."),
  r("viridian-forest","Forêt de Sapin",   1,  9,  KANTO_ALL, "Rencontres Bug distinctes de la Route 2."),
  r("route-3",       "Route 3",           1, 14,  KANTO_ALL, "Premier repère important pour l'équipe."),
  r("mt-moon",       "Mont Sélénite",     1, 15,  KANTO_ALL, "Grotte longue, avec sa propre règle de rencontre."),
  r("route-4",       "Route 4",           1, 16,  KANTO_ALL),
  r("route-5",       "Route 5",           1, 16,  KANTO_ALL),
  r("route-6",       "Route 6",           1, 17,  KANTO_ALL),
  r("route-7",       "Route 7",           1, 22,  KANTO_ALL),
  r("route-8",       "Route 8",           1, 22,  KANTO_ALL),
  r("route-9",       "Route 9",           1, 22,  KANTO_ALL),
  r("route-10",      "Route 10",          1, 22,  KANTO_ALL),
  r("rock-tunnel",   "Tunnel Roche",      1, 25,  KANTO_ALL, "Grotte avec sa propre règle de rencontre."),
  r("route-11",      "Route 11",          1, 20,  KANTO_ALL),
  r("route-12",      "Route 12",          1, 28,  KANTO_ALL),
  r("route-13",      "Route 13",          1, 28,  KANTO_ALL),
  r("route-14",      "Route 14",          1, 28,  KANTO_ALL),
  r("route-15",      "Route 15",          1, 30,  KANTO_ALL),
  r("route-16",      "Route 16",          1, 28,  KANTO_ALL),
  r("route-17",      "Route 17 (Cycling Road)", 1, 28, KANTO_ALL),
  r("route-18",      "Route 18",          1, 28,  KANTO_ALL),
  r("safari-zone",   "Zone Safari",       1, 30,  KANTO_ALL, "Une seule rencontre autorisée."),
  r("seafoam-islands","Îles Écume",       1, 40,  KANTO_ALL, "Grotte avec sa propre règle de rencontre."),
  r("route-19",      "Route 19",          1, 35,  KANTO_ALL),
  r("route-20",      "Route 20",          1, 35,  KANTO_ALL),
  r("route-21",      "Route 21",          1, 35,  KANTO_ALL),
  r("power-plant",   "Centrale Électrique",1,35, [...RB, ...FRLG]),
  r("cerulean-cave", "Grotte Azuria",     1, 60,  KANTO_ALL, "Après la Ligue, avec Mewtwo accessible."),
  r("route-22",      "Route 22",          1, 10,  KANTO_ALL),
  r("route-23",      "Route 23",          1, 43,  KANTO_ALL),
  r("victory-road-kanto","Route Victoire", 1, 47, KANTO_ALL, "Grotte avec sa propre règle de rencontre."),
  r("one-island",    "Île Cramique",      1, 38, [...FRLG], "FRLG uniquement, archipel Sevii."),
  r("two-island",    "Île Capucin",       1, 38, [...FRLG]),
  r("three-island",  "Île Laurier",       1, 38, [...FRLG]),
  r("five-island",   "Île Frêne",         1, 42, [...FRLG]),
  r("seven-island",  "Île Thym",          1, 45, [...FRLG]),
];

// ---------------------------------------------------------------------------
// Johto - génération 2 et remakes
// ---------------------------------------------------------------------------
const JOHTO_ROUTES: RouteDefinition[] = [
  r("route-29",      "Route 29",          2,  5,  JOHTO_ALL),
  r("route-30",      "Route 30",          2,  8,  JOHTO_ALL),
  r("route-31",      "Route 31",          2,  9,  JOHTO_ALL),
  r("dark-cave",     "Grotte Sombre",     2, 12,  JOHTO_ALL, "Grotte avec sa propre règle de rencontre."),
  r("route-32",      "Route 32",          2, 12,  JOHTO_ALL),
  r("ruins-of-alph", "Ruines d'Alph",     2, 14,  JOHTO_ALL, "Lieu à part, avec des espèces particulières."),
  r("route-33",      "Route 33",          2, 14,  JOHTO_ALL),
  r("union-cave",    "Caverne Union",      2, 13,  JOHTO_ALL, "Grotte avec sa propre règle de rencontre."),
  r("ilex-forest",   "Forêt Bois-Joli",   2, 12,  JOHTO_ALL),
  r("route-34",      "Route 34",          2, 15,  JOHTO_ALL),
  r("route-35",      "Route 35",          2, 16,  JOHTO_ALL),
  r("national-park", "Parc National",     2, 18,  JOHTO_ALL, "Le Concours de Capture d'Insecte peut compter comme une rencontre séparée."),
  r("route-36",      "Route 36",          2, 18,  JOHTO_ALL),
  r("route-37",      "Route 37",          2, 18,  JOHTO_ALL),
  r("route-38",      "Route 38",          2, 20,  JOHTO_ALL),
  r("route-39",      "Route 39",          2, 20,  JOHTO_ALL),
  r("route-40",      "Route 40",          2, 20,  JOHTO_ALL),
  r("route-41",      "Route 41",          2, 25,  JOHTO_ALL),
  r("route-42",      "Route 42",          2, 24,  JOHTO_ALL),
  r("mt-mortar",     "Mt. Mortimer",      2, 24,  JOHTO_ALL, "Grotte avec sa propre règle de rencontre."),
  r("route-43",      "Route 43",          2, 25,  JOHTO_ALL),
  r("lake-of-rage",  "Lac Colère",        2, 25,  JOHTO_ALL),
  r("route-44",      "Route 44",          2, 28,  JOHTO_ALL),
  r("ice-path",      "Chemin Glacé",      2, 30,  JOHTO_ALL, "Grotte avec sa propre règle de rencontre."),
  r("route-45",      "Route 45",          2, 30,  JOHTO_ALL),
  r("route-46",      "Route 46",          2, 10,  JOHTO_ALL),
  r("whirl-islands", "Îles Tourbillon",   2, 35, [...GS, ...HGSS], "Grotte avec sa propre règle de rencontre. Lugia est accessible."),
  r("mt-silver",     "Mont Argent",       2, 45,  JOHTO_ALL, "Après la Ligue, niveau très élevé."),
  r("victory-road-johto","Route Victoire", 2, 40, [...HGSS], "HGSS uniquement."),
];

// ---------------------------------------------------------------------------
// Hoenn - génération 3 et remakes
// ---------------------------------------------------------------------------
const HOENN_ROUTES: RouteDefinition[] = [
  r("route-101",     "Route 101",         3,  5,  HOENN_ALL),
  r("route-102",     "Route 102",         3,  6,  HOENN_ALL),
  r("route-103",     "Route 103",         3,  6,  HOENN_ALL),
  r("route-104",     "Route 104",         3,  7,  HOENN_ALL),
  r("petalburg-woods","Forêt de Petalia", 3, 10,  HOENN_ALL),
  r("route-105",     "Route 105",         3, 10,  HOENN_ALL),
  r("route-106",     "Route 106",         3, 11,  HOENN_ALL),
  r("granite-cave",  "Grotte Granit",     3, 16,  HOENN_ALL, "Grotte avec sa propre règle de rencontre."),
  r("route-107",     "Route 107",         3, 15,  HOENN_ALL),
  r("route-108",     "Route 108",         3, 18,  HOENN_ALL),
  r("route-109",     "Route 109",         3, 18,  HOENN_ALL),
  r("route-110",     "Route 110",         3, 18,  HOENN_ALL),
  r("route-111",     "Route 111",         3, 22,  HOENN_ALL),
  r("route-112",     "Route 112",         3, 22,  HOENN_ALL),
  r("fiery-path",    "Chemin Volcanique", 3, 25,  HOENN_ALL, "Grotte avec sa propre règle de rencontre."),
  r("jagged-pass",   "Passage Escarpé",   3, 25,  HOENN_ALL),
  r("route-113",     "Route 113",         3, 23,  HOENN_ALL),
  r("route-114",     "Route 114",         3, 23,  HOENN_ALL),
  r("meteor-falls",  "Cascade Météore",   3, 28,  HOENN_ALL, "Grotte avec sa propre règle de rencontre."),
  r("route-115",     "Route 115",         3, 28,  HOENN_ALL),
  r("route-116",     "Route 116",         3, 16,  HOENN_ALL),
  r("rusturf-tunnel","Tunnel Rusturf",    3, 16,  HOENN_ALL),
  r("route-117",     "Route 117",         3, 24,  HOENN_ALL),
  r("route-118",     "Route 118",         3, 27,  HOENN_ALL),
  r("route-119",     "Route 119",         3, 30,  HOENN_ALL),
  r("route-120",     "Route 120",         3, 32,  HOENN_ALL),
  r("route-121",     "Route 121",         3, 32,  HOENN_ALL),
  r("safari-zone-hoenn","Zone Safari Hoenn",3,30, HOENN_ALL, "Une rencontre par zone."),
  r("route-122",     "Route 122",         3, 28,  HOENN_ALL),
  r("mt-pyre",       "Mt. Funéral",       3, 34,  HOENN_ALL, "Rencontre intérieure distincte de l'extérieur."),
  r("route-123",     "Route 123",         3, 33,  HOENN_ALL),
  r("route-124",     "Route 124",         3, 35,  HOENN_ALL),
  r("route-125",     "Route 125",         3, 38,  HOENN_ALL),
  r("route-126",     "Route 126",         3, 38,  HOENN_ALL),
  r("route-127",     "Route 127",         3, 38,  HOENN_ALL),
  r("route-128",     "Route 128",         3, 40,  HOENN_ALL),
  r("seafloor-cavern","Grotte Abyssale",  3, 38,  HOENN_ALL, "Grotte avec sa propre règle de rencontre."),
  r("route-129",     "Route 129",         3, 38,  HOENN_ALL),
  r("route-130",     "Route 130",         3, 38,  HOENN_ALL),
  r("route-131",     "Route 131",         3, 40,  HOENN_ALL),
  r("route-132",     "Route 132",         3, 40,  HOENN_ALL),
  r("route-133",     "Route 133",         3, 40,  HOENN_ALL),
  r("route-134",     "Route 134",         3, 40,  HOENN_ALL),
  r("victory-road-hoenn","Route Victoire", 3, 45, HOENN_ALL, "Grotte avec sa propre règle de rencontre."),
];

// ---------------------------------------------------------------------------
// Sinnoh - génération 4 et remakes
// ---------------------------------------------------------------------------
const SINNOH_ROUTES: RouteDefinition[] = [
  r("route-201",     "Route 201",         4,  4,  SINNOH_ALL),
  r("route-202",     "Route 202",         4,  6,  SINNOH_ALL),
  r("route-203",     "Route 203",         4,  8,  SINNOH_ALL),
  r("oreburgh-gate", "Tunnel de Calamar", 4, 11,  SINNOH_ALL, "Grotte avec sa propre règle de rencontre."),
  r("route-204",     "Route 204",         4,  9,  SINNOH_ALL),
  r("route-205",     "Route 205",         4, 13,  SINNOH_ALL),
  r("eterna-forest", "Forêt d'Éternalia", 4, 18,  SINNOH_ALL),
  r("route-206",     "Route 206",         4, 20,  SINNOH_ALL),
  r("route-207",     "Route 207",         4, 17,  SINNOH_ALL),
  r("mt-coronet-1",  "Mt. Couronnet (entrée)", 4, 25, SINNOH_ALL, "Grotte, première zone."),
  r("route-208",     "Route 208",         4, 23,  SINNOH_ALL),
  r("route-209",     "Route 209",         4, 22,  SINNOH_ALL),
  r("route-210",     "Route 210",         4, 32,  SINNOH_ALL),
  r("route-211",     "Route 211",         4, 29,  SINNOH_ALL),
  r("route-212",     "Route 212",         4, 28,  SINNOH_ALL),
  r("route-213",     "Route 213",         4, 28,  SINNOH_ALL),
  r("route-214",     "Route 214",         4, 30,  SINNOH_ALL),
  r("route-215",     "Route 215",         4, 30,  SINNOH_ALL),
  r("mt-coronet-2",  "Mt. Couronnet (sommet)", 4, 40, SINNOH_ALL, "Zone haute, rencontre distincte."),
  r("route-216",     "Route 216",         4, 35,  SINNOH_ALL),
  r("route-217",     "Route 217",         4, 38,  SINNOH_ALL),
  r("acuity-lakefront","Bord du Lac Clarté",4,38, SINNOH_ALL),
  r("route-218",     "Route 218",         4, 30,  SINNOH_ALL),
  r("route-219",     "Route 219",         4, 32,  SINNOH_ALL),
  r("route-220",     "Route 220",         4, 33,  SINNOH_ALL),
  r("route-221",     "Route 221",         4, 35,  SINNOH_ALL),
  r("route-222",     "Route 222",         4, 42,  SINNOH_ALL),
  r("iron-island",   "Île du Fer",        4, 38,  SINNOH_ALL, "Grotte avec sa propre règle de rencontre."),
  r("route-223",     "Route 223",         4, 47,  SINNOH_ALL),
  r("victory-road-sinnoh","Route Victoire", 4, 50, SINNOH_ALL, "Grotte avec sa propre règle de rencontre."),
  r("route-224",     "Route 224",         4, 50,  SINNOH_ALL),
  r("route-225",     "Route 225",         4, 50,  SINNOH_ALL),
  r("route-226",     "Route 226",         4, 50,  SINNOH_ALL),
  r("route-227",     "Route 227",         4, 50,  SINNOH_ALL),
  r("stark-mountain","Mont Rocher",       4, 55,  SINNOH_ALL, "Grotte d'après-Ligue avec sa propre règle de rencontre."),
  r("route-228",     "Route 228",         4, 50,  SINNOH_ALL),
  r("route-229",     "Route 229",         4, 50,  SINNOH_ALL),
  r("route-230",     "Route 230",         4, 50,  SINNOH_ALL),
];

// ---------------------------------------------------------------------------
// Unova - Black / White
// ---------------------------------------------------------------------------
const BW_ROUTES: RouteDefinition[] = [
  r("route-1-unova",  "Route 1",           5,  5,  BW),
  r("route-2-unova",  "Route 2",           5,  7,  BW),
  r("dreamyard",      "Manoir des Rêves",  5, 12,  BW),
  r("route-3-unova",  "Route 3",           5, 14,  BW),
  r("wellspring-cave","Caverne Aquatique", 5, 15,  BW, "Grotte avec sa propre règle de rencontre."),
  r("route-4-unova",  "Route 4",           5, 16,  BW),
  r("desert-resort",  "Station du Désert", 5, 20,  BW, "Zone sableuse distincte de Route 4."),
  r("route-5-unova",  "Route 5",           5, 22,  BW),
  r("route-6-unova",  "Route 6",           5, 24,  BW),
  r("chargestone-cave","Caverne Électrique",5,28,  BW, "Grotte avec sa propre règle de rencontre."),
  r("route-7-unova",  "Route 7",           5, 28,  BW),
  r("mistralton-cave","Caverne Mistralton",5, 30,  BW, "Grotte avec sa propre règle de rencontre."),
  r("route-8-unova",  "Route 8",           5, 30,  BW),
  r("icirrus-area",   "Zone d'Icirrus",    5, 32,  BW),
  r("dragonspiral-tower","Tour Spirale",   5, 35,  BW, "Rencontre intérieure propre."),
  r("route-9-unova",  "Route 9",           5, 35,  BW),
  r("route-10-unova", "Route 10",          5, 38,  BW),
  r("route-11-unova", "Route 11",          5, 30,  BW),
  r("route-12-unova", "Route 12",          5, 32,  BW),
  r("route-13-unova", "Route 13",          5, 35,  BW),
  r("route-14-unova", "Route 14",          5, 38,  BW),
  r("route-15-unova", "Route 15",          5, 38,  BW),
  r("route-16-unova", "Route 16",          5, 38,  BW),
  r("route-17-unova", "Route 17",          5, 40,  BW),
  r("route-18-unova", "Route 18",          5, 42,  BW),
  r("twist-mountain", "Montagne Tordue",   5, 38,  BW, "Grotte avec sa propre règle de rencontre. Les saisons changent les rencontres."),
  r("victory-road-unova","Route Victoire", 5, 48,  BW, "Grotte avec sa propre règle de rencontre."),
];

// ---------------------------------------------------------------------------
// Unova - Black 2 / White 2
// ---------------------------------------------------------------------------
const B2W2_ROUTES: RouteDefinition[] = [
  r("floccesy-ranch",  "Ranch Floccesy",  5,  8,  B2W2),
  r("route-19-b2w2",   "Route 19",        5,  8,  B2W2),
  r("route-20-b2w2",   "Route 20",        5, 10,  B2W2),
  r("route-2-b2w2",    "Route 2",         5,  9,  B2W2),
  r("virbank-complex", "Complexe Virbank",5, 14,  B2W2),
  r("castelia-sewers", "Égouts de Camphre",5,15,  B2W2),
  r("route-4-b2w2",    "Route 4",         5, 17,  B2W2),
  r("route-5-b2w2",    "Route 5",         5, 20,  B2W2),
  r("route-6-b2w2",    "Route 6",         5, 24,  B2W2),
  r("route-7-b2w2",    "Route 7",         5, 27,  B2W2),
  r("route-8-b2w2",    "Route 8",         5, 30,  B2W2),
  r("route-9-b2w2",    "Route 9",         5, 35,  B2W2),
  r("lostlorn-forest", "Forêt Perdue",    5, 30,  B2W2),
  r("nature-preserve", "Réserve Naturelle",5,65,  B2W2, "Après la Ligue, rencontre avec le Haxorus Shiny."),
  r("reversal-mountain","Mont Renversé",  5, 40, [...B2W2], "Intérieur distinct de l'extérieur."),
  r("route-21-b2w2",   "Route 21",        5, 38,  B2W2),
  r("route-22-b2w2",   "Route 22",        5, 40,  B2W2),
  r("route-23-b2w2",   "Route 23",        5, 48,  B2W2),
  r("victory-road-b2w2","Route Victoire", 5, 55,  B2W2, "Grotte avec sa propre règle de rencontre."),
];

// ---------------------------------------------------------------------------
// Kalos - X / Y
// ---------------------------------------------------------------------------
const KALOS_ROUTES: RouteDefinition[] = [
  r("route-1-kalos",   "Route 1",          6,  4,  XY),
  r("santalune-forest","Forêt Rosavilla",  6,  8,  XY),
  r("route-2-kalos",   "Route 2",          6,  8,  XY),
  r("route-3-kalos",   "Route 3",          6, 10,  XY),
  r("route-4-kalos",   "Route 4",          6, 12,  XY),
  r("route-5-kalos",   "Route 5",          6, 13,  XY),
  r("connecting-cave", "Caverne Jonction",  6, 16,  XY, "Grotte avec sa propre règle de rencontre."),
  r("route-6-kalos",   "Route 6",          6, 16,  XY),
  r("route-7-kalos",   "Route 7",          6, 18,  XY),
  r("glittering-cave", "Grotte Brillante",  6, 24,  XY, "Grotte avec sa propre règle de rencontre."),
  r("route-8-kalos",   "Route 8",          6, 22,  XY),
  r("route-9-kalos",   "Route 9",          6, 24,  XY),
  r("route-10-kalos",  "Route 10",         6, 26,  XY),
  r("route-11-kalos",  "Route 11",         6, 28,  XY),
  r("reflection-cave", "Grotte Miroir",     6, 30,  XY, "Grotte avec sa propre règle de rencontre."),
  r("route-12-kalos",  "Route 12",         6, 28,  XY),
  r("route-13-kalos",  "Route 13",         6, 30,  XY),
  r("route-14-kalos",  "Route 14",         6, 33,  XY),
  r("route-15-kalos",  "Route 15",         6, 33,  XY),
  r("route-16-kalos",  "Route 16",         6, 35,  XY),
  r("route-17-kalos",  "Route 17",         6, 38,  XY),
  r("route-18-kalos",  "Route 18",         6, 40,  XY),
  r("lost-hotel",      "Hôtel Fantôme",     6, 38,  XY, "Zone intérieure distincte."),
  r("frost-cavern",    "Grotte Givrée",     6, 42,  XY, "Grotte avec sa propre règle de rencontre."),
  r("route-19-kalos",  "Route 19",         6, 42,  XY),
  r("route-20-kalos",  "Route 20 (Forêt Azur)", 6, 45, XY),
  r("route-21-kalos",  "Route 21",         6, 48,  XY),
  r("route-22-kalos",  "Route 22",         6, 52,  XY),
  r("victory-road-kalos","Route Victoire", 6, 55,  XY, "Grotte avec sa propre règle de rencontre."),
  r("sea-spirit-den",  "Antre de l'Esprit",6, 50,  XY, "Rencontre légendaire propre."),
];

// ---------------------------------------------------------------------------
// Alola - Sun / Moon et Ultra Sun / Ultra Moon
// ---------------------------------------------------------------------------
const ALOLA_ROUTES: RouteDefinition[] = [
  r("melemele-route-1","Route 1",          7,  5,  ALOLA_ALL),
  r("route-2-alola",  "Route 2",           7,  8,  ALOLA_ALL),
  r("route-3-alola",  "Route 3",           7, 10,  ALOLA_ALL),
  r("hau-oli-outskirts","Périphérie Hau'oli",7,10, ALOLA_ALL),
  r("ten-carat-hill", "Colline Dix Carats",7, 11,  ALOLA_ALL),
  r("route-4-alola",  "Route 4",           7, 14,  ALOLA_ALL),
  r("route-5-alola",  "Route 5",           7, 16,  ALOLA_ALL),
  r("route-6-alola",  "Route 6",           7, 17,  ALOLA_ALL),
  r("route-7-alola",  "Route 7",           7, 20,  ALOLA_ALL),
  r("route-8-alola",  "Route 8",           7, 22,  ALOLA_ALL),
  r("lush-jungle",    "Jungle Verdoyante", 7, 22,  ALOLA_ALL),
  r("akala-outskirts","Périphérie d'Akala",7, 22,  ALOLA_ALL),
  r("route-9-alola",  "Route 9",           7, 24,  ALOLA_ALL),
  r("route-10-alola", "Route 10",          7, 26,  ALOLA_ALL),
  r("route-11-alola", "Route 11",          7, 28,  ALOLA_ALL),
  r("route-12-alola", "Route 12",          7, 30,  ALOLA_ALL),
  r("route-13-alola", "Route 13",          7, 32,  ALOLA_ALL),
  r("route-14-alola", "Route 14",          7, 32,  ALOLA_ALL),
  r("route-15-alola", "Route 15",          7, 38,  ALOLA_ALL),
  r("route-16-alola", "Route 16",          7, 40,  ALOLA_ALL),
  r("mount-lanakila", "Mt. Lanakila",      7, 50,  ALOLA_ALL, "Grotte avec sa propre règle de rencontre."),
  r("route-17-alola", "Route 17",          7, 45,  ALOLA_ALL),
  r("poni-wilds",     "Étendues de Poni",  7, 45,  ALOLA_ALL),
  r("poni-grove",     "Bois de Poni",      7, 46,  ALOLA_ALL),
  r("poni-plains",    "Plaines de Poni",   7, 47,  ALOLA_ALL),
  r("poni-meadow",    "Prairie de Poni",   7, 47,  ALOLA_ALL),
  r("poni-coast",     "Côte de Poni",      7, 48,  ALOLA_ALL),
  r("vast-poni-canyon","Canyon Poni",      7, 49,  ALOLA_ALL, "Grotte avec sa propre règle de rencontre."),
  r("poni-gauntlet",  "Épreuve de Poni",   7, 50,  ALOLA_ALL),
];

// ---------------------------------------------------------------------------
// Galar - Sword / Shield
// ---------------------------------------------------------------------------
const GALAR_ROUTES: RouteDefinition[] = [
  r("route-1-galar",  "Route 1",           8,  6,  SS),
  r("route-2-galar",  "Route 2",           8,  9,  SS),
  r("route-3-galar",  "Route 3",           8, 14,  SS),
  r("galar-mine",     "Mines de Galar",    8, 16,  SS, "Zone intérieure avec sa propre règle de rencontre."),
  r("route-4-galar",  "Route 4",           8, 18,  SS),
  r("route-5-galar",  "Route 5",           8, 22,  SS),
  r("galar-mine-2",   "Mines de Galar no 2",8, 26, SS, "Zone intérieure avec sa propre règle de rencontre."),
  r("route-6-galar",  "Route 6",           8, 28,  SS),
  r("route-7-galar",  "Route 7",           8, 34,  SS),
  r("route-8-galar",  "Route 8",           8, 40,  SS),
  r("route-9-galar",  "Route 9",           8, 44,  SS),
  r("wild-area-south","Terres Sauvages (Sud)", 8, 28, SS, "Zone ouverte, rencontre séparée par sous-zone."),
  r("wild-area-north","Terres Sauvages (Nord)", 8, 40, SS),
  r("giant-mirror",   "Miroir Géant",      8, 40,  SS),
  r("dusty-bowl",     "Cuvette Poussiéreuse",8,42, SS),
  r("giant-cap",      "Chapeau Géant",     8, 44,  SS),
  r("lake-of-outrage","Lac des Remous",    8, 50,  SS),
  r("glimwood-tangle","Forêt Brillante",   8, 36,  SS),
  r("slumbering-weald","Bois Assoupi",     8, 60,  SS, "Légendaires uniquement après la Ligue."),
  r("crown-tundra",   "Toundra Couronné",  8, 60,  SS, "DLC, zone propre recommandée."),
  r("isle-of-armor",  "Île de l'Armure",   8, 60,  SS, "DLC, zone propre recommandée."),
];

// ---------------------------------------------------------------------------
// HISUI zones (Legends: Arceus)
// ---------------------------------------------------------------------------
const HISUI_ROUTES: RouteDefinition[] = [
  r("obsidian-fieldlands","Terres Sauvages d'Obsidienne", 8, 20, LA, "Première zone, règle de première capture par zone."),
  r("crimson-mirelands",  "Marécages Pourpres",           8, 35, LA, "Règle de première capture par zone."),
  r("cobalt-coastlands",  "Côtes Cobalt",                 8, 40, LA, "Règle de première capture par zone."),
  r("coronet-highlands",  "Hauts Couronnet",              8, 50, LA, "Règle de première capture par zone."),
  r("alabaster-icelands", "Terres de Glace d'Albâtre",   8, 58, LA, "Dernière zone, Dialga ou Palkia accessible."),
  r("space-time-distortions","Distorsions Spatio-temporelles",8,50, LA, "Rencontres aléatoires uniques."),
];

// ---------------------------------------------------------------------------
// PALDEA zones (Scarlet/Violet)
// ---------------------------------------------------------------------------
const PALDEA_ROUTES: RouteDefinition[] = [
  r("south-province-1",  "Province du Sud (Zone 1)",  9, 10, SV),
  r("south-province-2",  "Province du Sud (Zone 2)",  9, 12, SV),
  r("south-province-3",  "Province du Sud (Zone 3)",  9, 15, SV),
  r("south-province-4",  "Province du Sud (Zone 4)",  9, 18, SV),
  r("south-province-5",  "Province du Sud (Zone 5)",  9, 25, SV),
  r("south-province-6",  "Province du Sud (Zone 6)",  9, 22, SV),
  r("east-province-1",   "Province de l'Est (Zone 1)",9, 16, SV),
  r("east-province-2",   "Province de l'Est (Zone 2)",9, 24, SV),
  r("east-province-3",   "Province de l'Est (Zone 3)",9, 35, SV),
  r("west-province-1",   "Province de l'Ouest (Zone 1)",9,20, SV),
  r("west-province-2",   "Province de l'Ouest (Zone 2)",9,28, SV),
  r("west-province-3",   "Province de l'Ouest (Zone 3)",9,40, SV),
  r("north-province-1",  "Province du Nord (Zone 1)", 9, 45, SV),
  r("north-province-2",  "Province du Nord (Zone 2)", 9, 50, SV),
  r("north-province-3",  "Province du Nord (Zone 3)", 9, 55, SV),
  r("casseroya-lake",    "Lac de Casseroya",          9, 55, SV),
  r("poco-path",         "Piste Poco",                9, 60, SV, "Fin du parcours avec Pepper."),
  r("area-zero",         "Zone Zéro",                 9, 65, SV, "Rencontres très particulières avec les Pokémon Paradoxe."),
  r("glaseado-mountain", "Montagne Glaseado",         9, 50, SV),
  r("tagtree-thicket",   "Hallier Taguier",           9, 35, SV),
  r("alfornada-cavern",  "Caverne d'Alfornada",       9, 45, SV),
];

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
const now = "2026-07-18T12:00:00.000Z";

export const starterPack: ContentPack = {
  id: "mainline-core",
  name: "Mainline Core",
  description:
    "Règles Nuzlocke et routes complètes pour tous les jeux Pokémon officiels (générations 1 à 9). Les routes sont filtrées automatiquement selon le jeu en cours.",
  scope: "mainline",
  versionGroups: [
    "red-blue", "yellow", "gold-silver", "crystal", "ruby-sapphire", "emerald",
    "firered-leafgreen", "diamond-pearl", "platinum", "heartgold-soulsilver",
    "black-white", "black-2-white-2", "x-y", "omega-ruby-alpha-sapphire",
    "sun-moon", "ultra-sun-ultra-moon", "lets-go-pikachu-lets-go-eevee",
    "sword-shield", "brilliant-diamond-shining-pearl", "legends-arceus", "scarlet-violet",
  ],
  rules: getRuleSetPreset("standard"),
  routes: [
    ...KANTO_ROUTES,
    ...JOHTO_ROUTES,
    ...HOENN_ROUTES,
    ...SINNOH_ROUTES,
    ...BW_ROUTES,
    ...B2W2_ROUTES,
    ...KALOS_ROUTES,
    ...ALOLA_ROUTES,
    ...GALAR_ROUTES,
    ...HISUI_ROUTES,
    ...PALDEA_ROUTES,
  ],
  updatedAt: now,
};

export function createBlankPack(versionGroup: string, name = "Pack sans titre"): ContentPack {
  return {
    id: `pack-${versionGroup}`,
    name,
    description: "Pack vide prêt à recevoir vos routes et vos boss.",
    scope: "mainline",
    versionGroups: [versionGroup],
    rules: starterPack.rules,
    routes: [],
    updatedAt: new Date().toISOString(),
  };
}
