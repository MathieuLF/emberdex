import type { RuleMode, RuleSet } from "@emberdex/core";
import { pokemonArtworkUrl } from "./pokemon-assets";

export type ChallengeMode = "standard" | "hardcore";

export type StarterProfile = {
  id: string;
  name: string;
  dexNumber: number;
  types: string[];
  tip: string;
  spriteUrl: string;
};

export type BossSlot = {
  species: string;
  level: number;
  types: string[];
};

/**
 * Une étape de progression peut définir une équipe fixe, une équipe liée au
 * starter ou une équipe différente selon la version du jeu.
 */
export type ProgressMilestone = {
  name: string;
  levelCap: number;
  objective: string;
  advice: string;
  bossTeam?: BossSlot[];
  starterBossTeams?: Record<"grass" | "fire" | "water", BossSlot[]>;
  versionBossTeams?: Record<string, BossSlot[]>;
};

export type GameProfile = {
  id: string;
  title: string;
  versionGroup: string;
  generation: number;
  startingLocation: string;
  starterIds: string[];
  milestones: ProgressMilestone[];
  specialRules?: string[];
  ruleContexts: GameRuleContext[];
};

export type GameRuleContext = {
  id: string;
  label: string;
  category: "encounter" | "gift" | "static" | "raid" | "safari" | "contest" | "dlc" | "postgame" | "boss";
  defaultPolicy: "allow" | "count" | "separate" | "ignore" | "advisory";
};

/** Choisit l'équipe de boss à afficher selon le contexte du run. */
export function resolveBossTeam(
  milestone: ProgressMilestone,
  starterType?: string | null,
  versionGroup?: string | null
): BossSlot[] | undefined {
  if (milestone.versionBossTeams && versionGroup) {
    const match = milestone.versionBossTeams[versionGroup];
    if (match) return match;
  }
  if (milestone.starterBossTeams && starterType) {
    const lower = starterType.toLowerCase() as "grass" | "fire" | "water";
    const match = milestone.starterBossTeams[lower];
    if (match) return match;
  }
  return milestone.bossTeam;
}

export type PlayerRunSetup = {
  gameId: string;
  starterId: string;
  challengeMode: ChallengeMode;
  ruleMode?: RuleMode;
  rules?: RuleSet;
  ruleTemplateId?: string;
};

type GameRuleContextDraft = Omit<GameRuleContext, "id"> & {
  slug: string;
};

function slugContext(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferContextCategory(label: string): GameRuleContext["category"] {
  const lower = label.toLowerCase();

  if (lower.includes("dlc") || lower.includes("academy") || lower.includes("blueberry")) return "dlc";
  if (lower.includes("frontier") || lower.includes("après") || lower.includes("pwt") || lower.includes("ramanas")) return "postgame";
  if (lower.includes("raid") || lower.includes("dynamax")) return "raid";
  if (lower.includes("safari")) return "safari";
  if (lower.includes("contest")) return "contest";
  if (lower.includes("cadeau") || lower.includes("gift") || lower.includes("fossile")) return "gift";
  if (lower.includes("starter") || lower.includes("totem") || lower.includes("alpha")) return "static";
  if (lower.includes("boss") || lower.includes("arène") || lower.includes("team star") || lower.includes("titan")) return "boss";

  return "encounter";
}

function inferContextPolicy(label: string): GameRuleContext["defaultPolicy"] {
  const lower = label.toLowerCase();

  if (lower.includes("non compt")) return "ignore";
  if (lower.includes("distinct") || lower.includes("propre") || lower.includes("sépar")) return "separate";
  if (lower.includes("compte")) return "count";
  if (lower.includes("libre") || lower.includes("allow")) return "allow";

  return "advisory";
}

function buildRuleContexts(gameId: string, labels?: string[]): GameRuleContext[] {
  const structured = STRUCTURED_RULE_CONTEXTS[gameId];
  if (structured) {
    return structured.map((context) => ({
      id: `${gameId}-${context.slug}`,
      label: context.label,
      category: context.category,
      defaultPolicy: context.defaultPolicy,
    }));
  }

  return (labels ?? []).map((label, index) => ({
    id: `${gameId}-${slugContext(label) || `context-${index + 1}`}`,
    label,
    category: inferContextCategory(label),
    defaultPolicy: inferContextPolicy(label),
  }));
}

function context(
  slug: string,
  label: string,
  category: GameRuleContext["category"],
  defaultPolicy: GameRuleContext["defaultPolicy"]
): GameRuleContextDraft {
  return { slug, label, category, defaultPolicy };
}

const kantoContexts = [
  context("safari-zone", "Safari Zone : une rencontre par zone interne", "safari", "separate"),
  context("fishing-surf", "Pêche et Surf : méthode distincte si activée", "encounter", "separate"),
  context("static-gifts", "Pokémon offerts et statiques : comptent pour leur lieu", "gift", "count"),
];

const johtoContexts = [
  context("bug-catching-contest", "Concours de Capture d'Insecte : rencontre séparée", "contest", "separate"),
  context("headbutt", "Arbres à Coup d'Boule : rencontre du lieu actuel", "encounter", "count"),
  context("safari-zone", "Safari Zone : une rencontre par zone", "safari", "separate"),
];

const hoennContexts = [
  context("safari-zone", "Safari Zone : une rencontre par zone", "safari", "separate"),
  context("dexnav", "DexNav : la rencontre cherchée compte pour le lieu", "encounter", "count"),
  context("mirage-spots", "Mirages : rencontre séparée si accessible", "encounter", "separate"),
  context("battle-frontier", "Zone de Combat : non comptabilisée", "postgame", "ignore"),
];

const sinnohContexts = [
  context("honey-trees", "Arbres au Miel : rencontre propre par arbre", "encounter", "separate"),
  context("grand-underground", "Grand Souterrain : non comptabilisé par défaut", "encounter", "ignore"),
  context("static-legendaries", "Rencontres statiques majeures : exception documentée", "static", "advisory"),
];

const unovaContexts = [
  context("striaton-starter", "Striaton : boss déterminé par le starter", "boss", "advisory"),
  context("seasons", "Saisons : noter la saison de capture", "encounter", "advisory"),
  context("hidden-grotto", "Trouées Cachées : non comptabilisées en standard", "encounter", "ignore"),
  context("gift-clause", "Pokémon offerts en ville : comptent pour leur lieu", "gift", "count"),
];

const kalosContexts = [
  context("horde", "Horde : première espèce visible seulement", "encounter", "count"),
  context("friend-safari", "Safari des Amis : rencontre séparée par safari ami", "safari", "separate"),
  context("fossil-gift", "Fossiles : cadeau libre par défaut", "gift", "allow"),
];

const alolaContexts = [
  context("sos", "Combat SOS : appel allié ignoré comme nouvelle rencontre", "encounter", "ignore"),
  context("ultra-wormholes", "Ultra-Brèches : rencontre séparée par dimension", "encounter", "separate"),
  context("island-gifts", "Cadeaux et fossiles : rencontre libre par défaut", "gift", "allow"),
];

const letsGoContexts = [
  context("visible-encounters", "Rencontres visibles : première capture visible seulement", "encounter", "count"),
  context("catch-chains", "Chaînes de capture : non comptabilisées", "encounter", "ignore"),
  context("partner-pokemon", "Pokémon partenaire : règle statique propre à la version", "static", "advisory"),
];

const galarContexts = [
  context("wild-area", "Terres Sauvages : chaque sous-zone peut être une route séparée", "encounter", "separate"),
  context("max-raid", "Raid Dynamax : rencontre libre si capturée", "raid", "allow"),
  context("dynamax-adventures", "Expéditions Dynamax : non comptabilisées en standard", "raid", "ignore"),
  context("version-gyms", "Arènes de version : boss Sword/Shield distincts", "boss", "advisory"),
];

const hisuiContexts = [
  context("zone-based", "Hisui : première capture par grande zone", "encounter", "separate"),
  context("alpha-pokemon", "Alpha Pokémon : comptent comme rencontre normale", "static", "count"),
  context("research-missions", "Missions de recherche : non comptabilisées", "postgame", "ignore"),
];

const paldeaContexts = [
  context("open-world-zones", "Paldea : première rencontre par zone ou biome", "encounter", "separate"),
  context("tera-raids", "Tera Raid : non comptabilisé en standard", "raid", "ignore"),
  context("titans", "Titans : boss de progression sans capture automatique", "boss", "advisory"),
  context("team-star", "Team Star : boss de progression", "boss", "advisory"),
  context("dlc-zones", "Kitakami et Institut Myrtille : zones DLC séparées", "dlc", "separate"),
];

const STRUCTURED_RULE_CONTEXTS: Record<string, GameRuleContextDraft[]> = {
  red: kantoContexts,
  blue: kantoContexts,
  yellow: [
    ...kantoContexts,
    context("yellow-starter", "Yellow : Pikachu partenaire de départ", "static", "advisory"),
  ],
  firered: kantoContexts,
  leafgreen: kantoContexts,
  gold: johtoContexts,
  silver: johtoContexts,
  crystal: johtoContexts,
  heartgold: johtoContexts,
  soulsilver: johtoContexts,
  ruby: hoennContexts,
  sapphire: hoennContexts,
  emerald: hoennContexts,
  "omega-ruby": hoennContexts,
  "alpha-sapphire": hoennContexts,
  diamond: sinnohContexts,
  pearl: sinnohContexts,
  platinum: sinnohContexts,
  "brilliant-diamond": sinnohContexts,
  "shining-pearl": sinnohContexts,
  black: unovaContexts,
  white: unovaContexts,
  "black-2": unovaContexts,
  "white-2": unovaContexts,
  x: kalosContexts,
  y: kalosContexts,
  sun: alolaContexts,
  moon: alolaContexts,
  "ultra-sun": alolaContexts,
  "ultra-moon": alolaContexts,
  "lets-go-pikachu": letsGoContexts,
  "lets-go-eevee": letsGoContexts,
  sword: galarContexts,
  shield: galarContexts,
  "legends-arceus": hisuiContexts,
  scarlet: paldeaContexts,
  violet: paldeaContexts,
};

function artwork(dexNumber: number) {
  return pokemonArtworkUrl(dexNumber);
}

export const STARTERS: Record<string, StarterProfile> = {
  bulbasaur: { id: "bulbasaur", name: "Bulbasaur", dexNumber: 1, types: ["grass", "poison"], tip: "Un départ très sûr à Kanto, particulièrement confortable face aux premiers grands combats.", spriteUrl: artwork(1) },
  charmander: { id: "charmander", name: "Charmander", dexNumber: 4, types: ["fire"], tip: "Un début plus exigeant, mais une excellente récompense si votre équipe couvre rapidement ses faiblesses.", spriteUrl: artwork(4) },
  squirtle: { id: "squirtle", name: "Squirtle", dexNumber: 7, types: ["water"], tip: "Un choix régulier et solide, capable de sécuriser plusieurs passages délicats du début de partie.", spriteUrl: artwork(7) },
  pikachu: { id: "pikachu", name: "Pikachu", dexNumber: 25, types: ["electric"], tip: "Rapide et offensif, mais fragile : prévoyez vite un partenaire capable d'encaisser les coups.", spriteUrl: artwork(25) },
  eevee: { id: "eevee", name: "Eevee", dexNumber: 133, types: ["normal"], tip: "Très flexible. Gardez vos options ouvertes jusqu'à ce que les besoins de l'équipe deviennent clairs.", spriteUrl: artwork(133) },
  chikorita: { id: "chikorita", name: "Chikorita", dexNumber: 152, types: ["grass"], tip: "Un choix défensif qui demande une équipe bien construite pour traverser les premiers badges de Johto.", spriteUrl: artwork(152) },
  cyndaquil: { id: "cyndaquil", name: "Cyndaquil", dexNumber: 155, types: ["fire"], tip: "Une pression offensive immédiate et un parcours de début de jeu généralement confortable.", spriteUrl: artwork(155) },
  totodile: { id: "totodile", name: "Totodile", dexNumber: 158, types: ["water"], tip: "Robuste et fiable, idéal pour stabiliser une équipe encore courte en options.", spriteUrl: artwork(158) },
  treecko: { id: "treecko", name: "Treecko", dexNumber: 252, types: ["grass"], tip: "Rapide et précis, mais il apprécie des partenaires capables de prendre les coups à sa place.", spriteUrl: artwork(252) },
  torchic: { id: "torchic", name: "Torchic", dexNumber: 255, types: ["fire"], tip: "Un potentiel offensif remarquable qui devient encore meilleur après son évolution.", spriteUrl: artwork(255) },
  mudkip: { id: "mudkip", name: "Mudkip", dexNumber: 258, types: ["water"], tip: "L'un des départs les plus rassurants de Hoenn, avec très peu de mauvais affrontements au début.", spriteUrl: artwork(258) },
  turtwig: { id: "turtwig", name: "Turtwig", dexNumber: 387, types: ["grass"], tip: "Un starter solide qui apporte rapidement de la tenue à une équipe fragile.", spriteUrl: artwork(387) },
  chimchar: { id: "chimchar", name: "Chimchar", dexNumber: 390, types: ["fire"], tip: "Une excellente réponse au manque de Pokémon Fire dans Sinnoh, avec beaucoup de valeur offensive.", spriteUrl: artwork(390) },
  piplup: { id: "piplup", name: "Piplup", dexNumber: 393, types: ["water"], tip: "Un choix équilibré qui gagne en résistance et facilite plusieurs étapes importantes.", spriteUrl: artwork(393) },
  snivy: { id: "snivy", name: "Snivy", dexNumber: 495, types: ["grass"], tip: "Rapide et défensif, mais votre équipe devra lui apporter davantage de puissance brute.", spriteUrl: artwork(495) },
  tepig: { id: "tepig", name: "Tepig", dexNumber: 498, types: ["fire"], tip: "Puissant et polyvalent, avec de bonnes réponses pour plusieurs combats importants d'Unova.", spriteUrl: artwork(498) },
  oshawott: { id: "oshawott", name: "Oshawott", dexNumber: 501, types: ["water"], tip: "Un choix stable et simple à intégrer dans presque toutes les compositions.", spriteUrl: artwork(501) },
  chespin: { id: "chespin", name: "Chespin", dexNumber: 650, types: ["grass"], tip: "Résistant et utile pour construire une équipe qui ne dépend pas seulement de la vitesse.", spriteUrl: artwork(650) },
  fennekin: { id: "fennekin", name: "Fennekin", dexNumber: 653, types: ["fire"], tip: "Une belle présence spéciale qui récompense une progression prudente pendant les premiers niveaux.", spriteUrl: artwork(653) },
  froakie: { id: "froakie", name: "Froakie", dexNumber: 656, types: ["water"], tip: "Très rapide et flexible, parfait pour prendre l'initiative dans les combats courts.", spriteUrl: artwork(656) },
  rowlet: { id: "rowlet", name: "Rowlet", dexNumber: 722, types: ["grass", "flying"], tip: "Sa double couverture offre de belles options, mais surveillez attentivement ses nombreuses faiblesses.", spriteUrl: artwork(722) },
  litten: { id: "litten", name: "Litten", dexNumber: 725, types: ["fire"], tip: "Un excellent attaquant qui devient naturellement un pilier des combats difficiles.", spriteUrl: artwork(725) },
  popplio: { id: "popplio", name: "Popplio", dexNumber: 728, types: ["water"], tip: "Une valeur sûre à Alola, avec une excellente présence spéciale après évolution.", spriteUrl: artwork(728) },
  grookey: { id: "grookey", name: "Grookey", dexNumber: 810, types: ["grass"], tip: "Robuste et direct, il apporte une base fiable pour découvrir les premières routes de Galar.", spriteUrl: artwork(810) },
  scorbunny: { id: "scorbunny", name: "Scorbunny", dexNumber: 813, types: ["fire"], tip: "Rapide et agressif, il aide à garder le contrôle du rythme dès le début.", spriteUrl: artwork(813) },
  sobble: { id: "sobble", name: "Sobble", dexNumber: 816, types: ["water"], tip: "Fragile au départ, mais très dangereux si vous protégez bien ses occasions d'attaquer.", spriteUrl: artwork(816) },
  sprigatito: { id: "sprigatito", name: "Sprigatito", dexNumber: 906, types: ["grass"], tip: "Rapide et offensif, il profite beaucoup d'une équipe capable de couvrir les types Fire et Flying.", spriteUrl: artwork(906) },
  fuecoco: { id: "fuecoco", name: "Fuecoco", dexNumber: 909, types: ["fire"], tip: "Résistant et puissant, c'est un excellent point d'ancrage pour une première équipe à Paldea.", spriteUrl: artwork(909) },
  quaxly: { id: "quaxly", name: "Quaxly", dexNumber: 912, types: ["water"], tip: "Un attaquant équilibré qui se combine facilement avec les premières captures de Paldea.", spriteUrl: artwork(912) },
};

const PROGRESSION = {
  kanto: [
    { name: "Viridian Forest", levelCap: 9, objective: "Construire le premier noyau", advice: "Cherchez une réponse fiable aux types Bug et Flying avant de quitter la forêt." },
    { name: "Arène de Argenta - Brock", levelCap: 14, objective: "Premier badge", advice: "Évitez de dépendre d'un seul Pokémon : une mauvaise attaque critique peut suffire à faire basculer le combat.", bossTeam: [
      { species: "Geodude", level: 12, types: ["rock", "ground"] },
      { species: "Onix", level: 14, types: ["rock", "ground"] },
    ]},
    { name: "Mt. Moon", levelCap: 16, objective: "Traversée longue", advice: "Prévoyez de la profondeur dans l'équipe et gardez vos meilleurs points de vie pour la fin de la zone." },
    { name: "Arène de Azuria - Misty", levelCap: 21, objective: "Cascade Badge", advice: "Une réponse Grass ou Electric fiable évite de laisser Misty imposer le rythme.", bossTeam: [
      { species: "Staryu", level: 18, types: ["water"] },
      { species: "Starmie", level: 21, types: ["water", "psychic"] },
    ]},
    { name: "Arène de Carmin - Lt. Surge", levelCap: 24, objective: "Thunder Badge", advice: "Un type Ground sécurise le combat, mais vérifiez les couvertures avant de vous engager.", bossTeam: [
      { species: "Voltorb", level: 21, types: ["electric"] },
      { species: "Pikachu", level: 18, types: ["electric"] },
      { species: "Raichu", level: 24, types: ["electric"] },
    ]},
    { name: "Arène de Céladopole - Erika", levelCap: 29, objective: "Rainbow Badge", advice: "Fire, Flying et Psychic sont précieux; protégez surtout vos Pokémon fragiles des altérations de statut.", bossTeam: [
      { species: "Victreebel", level: 29, types: ["grass", "poison"] },
      { species: "Tangela", level: 24, types: ["grass"] },
      { species: "Vileplume", level: 29, types: ["grass", "poison"] },
    ]},
    { name: "Arène de Cramois - Koga", levelCap: 43, objective: "Soul Badge", advice: "Préparez une réponse à Poison et gardez de quoi absorber les dégâts résiduels.", bossTeam: [
      { species: "Koffing", level: 37, types: ["poison"] },
      { species: "Muk", level: 39, types: ["poison"] },
      { species: "Koffing", level: 37, types: ["poison"] },
      { species: "Weezing", level: 43, types: ["poison"] },
    ]},
    { name: "Arène de Parmanie - Sabrina", levelCap: 43, objective: "Marsh Badge", advice: "Les attaques physiques et une bonne résistance spéciale limitent les risques face à Sabrina.", bossTeam: [
      { species: "Kadabra", level: 38, types: ["psychic"] },
      { species: "Mr. Mime", level: 37, types: ["psychic"] },
      { species: "Venomoth", level: 38, types: ["bug", "poison"] },
      { species: "Alakazam", level: 43, types: ["psychic"] },
    ]},
    { name: "Arène de Cramois - Blaine", levelCap: 47, objective: "Volcano Badge", advice: "Water, Rock et Ground donnent un plan clair, à condition de ne pas sous-estimer la vitesse adverse.", bossTeam: [
      { species: "Growlithe", level: 42, types: ["fire"] },
      { species: "Ponyta", level: 40, types: ["fire"] },
      { species: "Rapidash", level: 42, types: ["fire"] },
      { species: "Arcanine", level: 47, types: ["fire"] },
    ]},
    { name: "Arène de Jadielle - Giovanni", levelCap: 50, objective: "Earth Badge", advice: "Gardez au moins deux réponses à Ground pour ne pas dépendre d'un seul changement.", bossTeam: [
      { species: "Rhyhorn", level: 45, types: ["ground", "rock"] },
      { species: "Dugtrio", level: 42, types: ["ground"] },
      { species: "Nidoqueen", level: 44, types: ["poison", "ground"] },
      { species: "Nidoking", level: 45, types: ["poison", "ground"] },
      { species: "Rhyhorn", level: 50, types: ["ground", "rock"] },
    ]},
    { name: "Ligue Pokémon", levelCap: 63, objective: "Champion", advice: "Figez une équipe de six rôles complémentaires et préparez chaque membre de la League comme un combat distinct." },
  ],
  johto: [
    { name: "Route 29", levelCap: 6, objective: "Premières captures", advice: "Variez rapidement les types : votre starter ne doit pas porter seul toute la progression." },
    { name: "Tour Pousse-Pousse", levelCap: 10, objective: "Premier vrai test", advice: "Profitez de la tour pour mesurer la solidité de vos remplaçants avant le badge." },
    { name: "Arène d'Ébène - Falkner", levelCap: 13, objective: "Zephyr Badge", advice: "Une réponse au type Flying est prioritaire, surtout si votre starter est Chikorita.", bossTeam: [
      { species: "Pidgey", level: 7, types: ["normal", "flying"] },
      { species: "Pidgeotto", level: 9, types: ["normal", "flying"] },
    ]},
    { name: "Arène de Lentauré - Bugsy", levelCap: 17, objective: "Hive Badge", advice: "Bug peut surprendre avec sa vitesse : gardez un plan Fire, Flying ou Rock en bonne santé.", bossTeam: [
      { species: "Metapod", level: 14, types: ["bug"] },
      { species: "Kakuna", level: 14, types: ["bug", "poison"] },
      { species: "Scyther", level: 16, types: ["bug", "flying"] },
    ]},
    { name: "Arène de Doublonville - Whitney", levelCap: 20, objective: "Plain Badge", advice: "Whitney récompense les équipes capables d'encaisser et de casser son élan rapidement.", bossTeam: [
      { species: "Clefairy", level: 18, types: ["normal"] },
      { species: "Miltank", level: 20, types: ["normal"] },
    ]},
    { name: "Arène d'Ecarlagne - Morty", levelCap: 25, objective: "Fog Badge", advice: "Prévoyez une réponse à Ghost et une façon fiable de gérer les altérations de statut.", bossTeam: [
      { species: "Gastly", level: 21, types: ["ghost", "poison"] },
      { species: "Haunter", level: 21, types: ["ghost", "poison"] },
      { species: "Haunter", level: 23, types: ["ghost", "poison"] },
      { species: "Gengar", level: 25, types: ["ghost", "poison"] },
    ]},
    { name: "Arène de Bonijour - Chuck", levelCap: 31, objective: "Storm Badge", advice: "Psychic et Flying sont utiles, mais un changement défensif reste indispensable.", bossTeam: [
      { species: "Primeape", level: 27, types: ["fighting"] },
      { species: "Poliwrath", level: 30, types: ["water", "fighting"] },
    ]},
    { name: "Arène d'Oliville - Jasmine", levelCap: 35, objective: "Mineral Badge", advice: "Steel demande de la puissance Fire, Fighting ou Ground et une équipe qui supporte les combats longs.", bossTeam: [
      { species: "Magnemite", level: 30, types: ["electric", "steel"] },
      { species: "Magnemite", level: 30, types: ["electric", "steel"] },
      { species: "Steelix", level: 35, types: ["steel", "ground"] },
    ]},
    { name: "Arène de Bourg-en-Glace - Pryce", levelCap: 34, objective: "Glacier Badge", advice: "Le niveau redescend légèrement : surveillez les dépassements avant de préparer Pryce.", bossTeam: [
      { species: "Seel", level: 27, types: ["water"] },
      { species: "Dewgong", level: 29, types: ["water", "ice"] },
      { species: "Piloswine", level: 31, types: ["ice", "ground"] },
    ]},
    { name: "Arène de Verticyl - Clair", levelCap: 41, objective: "Rising Badge", advice: "Dragon exige de la profondeur; ne laissez pas toute la responsabilité à une seule option Ice.", bossTeam: [
      { species: "Dragonair", level: 37, types: ["dragon"] },
      { species: "Dragonair", level: 37, types: ["dragon"] },
      { species: "Dragonair", level: 37, types: ["dragon"] },
      { species: "Kingdra", level: 40, types: ["water", "dragon"] },
    ]},
    { name: "Plateau Indigo", levelCap: 50, objective: "Champion", advice: "Préparez plusieurs plans de sortie : les cinq combats consécutifs punissent les équipes trop spécialisées." },
  ],
  hoenn: [
    { name: "Route 102", levelCap: 7, objective: "Équilibrer l'équipe", advice: "Sécurisez plusieurs captures avant Petalburg Woods pour ne pas dépendre du starter." },
    { name: "Forêt de Petalia", levelCap: 11, objective: "Préparer Rustboro", advice: "Gardez un Pokémon en bonne santé pour les combats qui s'enchaînent dans les bois." },
    { name: "Arène de Roccia - Roxanne", levelCap: 15, objective: "Stone Badge", advice: "Grass et Water facilitent ce badge; avec Torchic, prévoyez impérativement une autre réponse.", bossTeam: [
      { species: "Geodude", level: 14, types: ["rock", "ground"] },
      { species: "Geodude", level: 14, types: ["rock", "ground"] },
      { species: "Nosepass", level: 15, types: ["rock"] },
    ]},
    { name: "Arène de Mérouville - Brawly", levelCap: 19, objective: "Knuckle Badge", advice: "Flying et Psychic sont efficaces, mais évitez de donner trop de tours de placement à Brawly.", bossTeam: [
      { species: "Machop", level: 17, types: ["fighting"] },
      { species: "Makuhita", level: 18, types: ["fighting"] },
    ]},
    { name: "Arène d'Ampéville - Wattson", levelCap: 24, objective: "Dynamo Badge", advice: "Ground est la réponse la plus sûre; gardez une solution de secours aux Pokémon qui lévitent.", bossTeam: [
      { species: "Voltorb", level: 20, types: ["electric"] },
      { species: "Electrike", level: 20, types: ["electric"] },
      { species: "Magneton", level: 22, types: ["electric", "steel"] },
      { species: "Manectric", level: 24, types: ["electric"] },
    ]},
    { name: "Arène de Lavalith - Flannery", levelCap: 29, objective: "Heat Badge", advice: "Water, Rock et Ground sont attendus, mais les dégâts résiduels peuvent ruiner un plan trop lent.", bossTeam: [
      { species: "Numel", level: 24, types: ["fire", "ground"] },
      { species: "Slugma", level: 19, types: ["fire"] },
      { species: "Slugma", level: 19, types: ["fire"] },
      { species: "Torkoal", level: 29, types: ["fire"] },
    ]},
    { name: "Arène de Petalia - Norman", levelCap: 31, objective: "Balance Badge", advice: "Norman frappe fort sans faiblesse simple : privilégiez le contrôle, la résistance et les changements sûrs.", bossTeam: [
      { species: "Spinda", level: 27, types: ["normal"] },
      { species: "Vigoroth", level: 27, types: ["normal"] },
      { species: "Linoone", level: 29, types: ["normal"] },
      { species: "Slaking", level: 31, types: ["normal"] },
    ]},
    { name: "Arène de Sylvaq - Winona", levelCap: 33, objective: "Feather Badge", advice: "Electric, Ice et Rock doivent être accompagnés d'une réponse aux couvertures de Winona.", bossTeam: [
      { species: "Swablu", level: 29, types: ["normal", "flying"] },
      { species: "Tropius", level: 29, types: ["grass", "flying"] },
      { species: "Pelipper", level: 30, types: ["water", "flying"] },
      { species: "Skarmory", level: 31, types: ["steel", "flying"] },
      { species: "Altaria", level: 33, types: ["dragon", "flying"] },
    ]},
    { name: "Arène de Azureva - Tate & Liza", levelCap: 42, objective: "Mind Badge", advice: "Le double combat récompense les synergies; préparez vos deux Pokémon actifs comme un duo.", bossTeam: [
      { species: "Lunatone", level: 42, types: ["rock", "psychic"] },
      { species: "Solrock", level: 42, types: ["rock", "psychic"] },
    ]},
    { name: "Arène de Lavandia - Wallace", levelCap: 46, objective: "Rain Badge", advice: "Grass et Electric aident, mais gardez une réponse aux types secondaires de l'équipe adverse.", bossTeam: [
      { species: "Luvdisc", level: 40, types: ["water"] },
      { species: "Whiscash", level: 42, types: ["water", "ground"] },
      { species: "Sealeo", level: 40, types: ["ice", "water"] },
      { species: "Seaking", level: 42, types: ["water"] },
      { species: "Milotic", level: 46, types: ["water"] },
    ]},
    { name: "Ligue Pokémon", levelCap: 58, objective: "Champion", advice: "Répartissez objets et couvertures pour cinq combats consécutifs sans sacrifier votre plan de secours." },
  ],
  sinnoh: [
    { name: "Route 202", levelCap: 7, objective: "Former une équipe complète", advice: "Les premières routes offrent peu de variété : protégez chaque nouvelle capture utile." },
    { name: "Tunnel de Calamar", levelCap: 11, objective: "Préparer le premier badge", advice: "Vérifiez que votre équipe peut gérer Rock sans exposer inutilement votre starter." },
    { name: "Arène de Coalsdale - Roark", levelCap: 14, objective: "Coal Badge", advice: "Une option Grass ou Water sûre vaut mieux qu'un plan trop offensif.", bossTeam: [
      { species: "Geodude", level: 12, types: ["rock", "ground"] },
      { species: "Onix", level: 12, types: ["rock", "ground"] },
      { species: "Cranidos", level: 14, types: ["rock"] },
    ]},
    { name: "Arène d'Éternalia - Gardenia", levelCap: 22, objective: "Forest Badge", advice: "Fire, Flying et Bug donnent l'avantage; surveillez toutefois les attaques de couverture.", bossTeam: [
      { species: "Cherubi", level: 19, types: ["grass"] },
      { species: "Turtwig", level: 19, types: ["grass"] },
      { species: "Roserade", level: 22, types: ["grass", "poison"] },
    ]},
    { name: "Arène de Festivalia - Fantina", levelCap: 26, objective: "Relic Badge", advice: "Ghost peut bloquer vos plans habituels : prévoyez une attaque Dark ou Ghost fiable.", bossTeam: [
      { species: "Duskull", level: 24, types: ["ghost"] },
      { species: "Haunter", level: 24, types: ["ghost", "poison"] },
      { species: "Mismagius", level: 26, types: ["ghost"] },
    ]},
    { name: "Arène de Baccanal - Maylene", levelCap: 32, objective: "Cobble Badge", advice: "Flying et Psychic sont précieux, mais gardez un Pokémon capable d'absorber un coup physique.", bossTeam: [
      { species: "Meditite", level: 28, types: ["fighting", "psychic"] },
      { species: "Machoke", level: 29, types: ["fighting"] },
      { species: "Lucario", level: 32, types: ["fighting", "steel"] },
    ]},
    { name: "Arène de Cognac - Crasher Wake", levelCap: 37, objective: "Fen Badge", advice: "Electric et Grass doivent couvrir les doubles types plutôt que viser seulement Water.", bossTeam: [
      { species: "Gyarados", level: 33, types: ["water", "flying"] },
      { species: "Quagsire", level: 34, types: ["water", "ground"] },
      { species: "Floatzel", level: 37, types: ["water"] },
    ]},
    { name: "Arène de Joliberge - Byron", levelCap: 41, objective: "Mine Badge", advice: "Fire, Fighting et Ground font le travail; préparez une réponse aux défenses élevées.", bossTeam: [
      { species: "Magneton", level: 37, types: ["electric", "steel"] },
      { species: "Steelix", level: 38, types: ["steel", "ground"] },
      { species: "Bastiodon", level: 41, types: ["rock", "steel"] },
    ]},
    { name: "Arène de Congélard - Candice", levelCap: 44, objective: "Icicle Badge", advice: "Fire, Fighting, Rock et Steel sont forts, mais la glace peut punir un mauvais changement.", bossTeam: [
      { species: "Sneasel", level: 40, types: ["dark", "ice"] },
      { species: "Piloswine", level: 40, types: ["ice", "ground"] },
      { species: "Abomasnow", level: 42, types: ["grass", "ice"] },
      { species: "Froslass", level: 44, types: ["ice", "ghost"] },
    ]},
    { name: "Arène de Rivamar - Volkner", levelCap: 50, objective: "Beacon Badge", advice: "Ground sécurise l'arène à condition de gérer les Pokémon qui échappent à son plan principal.", bossTeam: [
      { species: "Jolteon", level: 46, types: ["electric"] },
      { species: "Raichu", level: 46, types: ["electric"] },
      { species: "Ambipom", level: 47, types: ["normal"] },
      { species: "Luxray", level: 48, types: ["electric"] },
    ]},
    { name: "Ligue Pokémon", levelCap: 62, objective: "Champion", advice: "Cynthia exige une équipe complète : vitesse, résistance et réponses de secours comptent autant que les avantages de type." },
  ],
  unova: [
    { name: "Route 1", levelCap: 7, objective: "Créer de la couverture", advice: "Votre premier partenaire doit idéalement répondre au type qui menace votre starter." },
    { name: "Manoir des Rêves", levelCap: 12, objective: "Compléter le trio", advice: "Le Pokémon reçu ici peut corriger immédiatement une faiblesse importante de l'équipe." },
    { name: "Arène de Mégaline - Striaton", levelCap: 14, objective: "Trio Badge",
      advice: "Chili (Feu) si starter Plante, Cress (Eau) si starter Feu, Cilan (Plante) si starter Eau. Le chef change selon votre starter, donc préparez votre contre avant d'entrer.",
      starterBossTeams: {
        grass: [
          // Starter Plante: Chili (Feu)
          { species: "Lillipup", level: 12, types: ["normal"] },
          { species: "Pansear", level: 12, types: ["fire"] },
          { species: "Simisear", level: 14, types: ["fire"] },
        ],
        fire: [
          // Starter Feu: Cress (Eau)
          { species: "Lillipup", level: 12, types: ["normal"] },
          { species: "Panpour", level: 12, types: ["water"] },
          { species: "Simipour", level: 14, types: ["water"] },
        ],
        water: [
          // Starter Eau: Cilan (Plante)
          { species: "Lillipup", level: 12, types: ["normal"] },
          { species: "Pansage", level: 12, types: ["grass"] },
          { species: "Simisage", level: 14, types: ["grass"] },
        ],
      },
    },
    { name: "Arène de Maillard - Lenora", levelCap: 20, objective: "Basic Badge", advice: "Normal frappe fort au début; Fighting et le contrôle des statistiques rendent le combat plus stable.", bossTeam: [
      { species: "Herdier", level: 18, types: ["normal"] },
      { species: "Watchog", level: 20, types: ["normal"] },
    ]},
    { name: "Arène de Camphre - Burgh", levelCap: 23, objective: "Insect Badge", advice: "Fire, Flying et Rock sont utiles, mais surveillez les doubles types de Burgh.", bossTeam: [
      { species: "Whirlipede", level: 21, types: ["bug", "poison"] },
      { species: "Dwebble", level: 21, types: ["bug", "rock"] },
      { species: "Leavanny", level: 23, types: ["bug", "grass"] },
    ]},
    { name: "Arène de Nimbassa - Elesa", levelCap: 27, objective: "Bolt Badge", advice: "Ground ne suffit pas toujours face aux immunités : prévoyez un second moyen de ralentir le combat.", bossTeam: [
      { species: "Emolga", level: 25, types: ["electric", "flying"] },
      { species: "Emolga", level: 25, types: ["electric", "flying"] },
      { species: "Zebstrika", level: 27, types: ["electric"] },
    ]},
    { name: "Arène de Poudreige - Clay", levelCap: 31, objective: "Quake Badge", advice: "Water, Grass et Ice sont forts; protégez-les des couvertures Rock et Steel.", bossTeam: [
      { species: "Krokorok", level: 29, types: ["dark", "ground"] },
      { species: "Palpitoad", level: 29, types: ["water", "ground"] },
      { species: "Excadrill", level: 31, types: ["ground", "steel"] },
    ]},
    { name: "Arène de Survolant - Skyla", levelCap: 35, objective: "Jet Badge", advice: "Electric, Ice et Rock doivent être soutenus par une bonne résistance aux attaques Flying.", bossTeam: [
      { species: "Swoobat", level: 33, types: ["psychic", "flying"] },
      { species: "Unfezant", level: 33, types: ["normal", "flying"] },
      { species: "Swanna", level: 35, types: ["water", "flying"] },
    ]},
    { name: "Arène de Verglas - Brycen", levelCap: 39, objective: "Freeze Badge", advice: "Une équipe trop lente peut subir les altérations : cherchez une victoire nette avec Fire, Fighting, Rock ou Steel.", bossTeam: [
      { species: "Vanillish", level: 37, types: ["ice"] },
      { species: "Cryogonal", level: 37, types: ["ice"] },
      { species: "Beartic", level: 39, types: ["ice"] },
    ]},
    { name: "Arène de Moufouet - Drayden/Iris", levelCap: 43, objective: "Legend Badge", advice: "Dragon demande plusieurs réponses et une façon de terminer le combat avant que les boosts ne s'accumulent.", bossTeam: [
      { species: "Fraxure", level: 41, types: ["dragon"] },
      { species: "Druddigon", level: 41, types: ["dragon"] },
      { species: "Haxorus", level: 43, types: ["dragon"] },
    ]},
    { name: "Château du Plasma", levelCap: 54, objective: "Combat final", advice: "Gardez des ressources pour deux combats majeurs consécutifs et ne construisez pas un plan autour d'un seul Pokémon." },
  ],
  unova2: [
    { name: "Ranch Floccesy", levelCap: 8, objective: "Première équipe", advice: "Profitez de la variété du ranch pour construire une vraie rotation de Pokémon." },
    { name: "Arène d'Artisanat - Chérine", levelCap: 13, objective: "Basic Badge", advice: "Les attaques Normal frappent fort au début : privilégiez la résistance et les baisses de statistiques.", bossTeam: [
      { species: "Patrat", level: 11, types: ["normal"] },
      { species: "Lillipup", level: 13, types: ["normal"] },
    ]},
    { name: "Complexe de Virbank", levelCap: 16, objective: "Préparer Roxie", advice: "Une réponse au type Poison rend la prochaine étape beaucoup plus sûre." },
    { name: "Arène de Virbank - Roxie", levelCap: 18, objective: "Toxic Badge", advice: "Ground et Psychic réduisent le risque, mais prévoyez aussi les dégâts résiduels du Poison.", bossTeam: [
      { species: "Koffing", level: 16, types: ["poison"] },
      { species: "Whirlipede", level: 18, types: ["bug", "poison"] },
    ]},
    { name: "Arène de Camphre - Burgh", levelCap: 24, objective: "Insect Badge", advice: "Fire, Flying et Rock sont fiables; vérifiez les couvertures avant de garder un même Pokémon en place.", bossTeam: [
      { species: "Swadloon", level: 22, types: ["bug", "grass"] },
      { species: "Dwebble", level: 22, types: ["bug", "rock"] },
      { species: "Leavanny", level: 24, types: ["bug", "grass"] },
    ]},
    { name: "Arène de Nimbassa - Elesa", levelCap: 30, objective: "Bolt Badge", advice: "La vitesse d'Emolga peut casser un plan Ground trop simple : préparez un contrôle alternatif.", bossTeam: [
      { species: "Flaaffy", level: 28, types: ["electric"] },
      { species: "Emolga", level: 28, types: ["electric", "flying"] },
      { species: "Ampharos", level: 30, types: ["electric"] },
    ]},
    { name: "Arène de Poudreige - Clay", levelCap: 33, objective: "Quake Badge", advice: "Water, Grass et Ice sont forts, mais Excadrill exige une réponse capable de tenir un coup.", bossTeam: [
      { species: "Krokorok", level: 31, types: ["dark", "ground"] },
      { species: "Sandslash", level: 31, types: ["ground"] },
      { species: "Excadrill", level: 33, types: ["ground", "steel"] },
    ]},
    { name: "Arène de Survolant - Skyla", levelCap: 39, objective: "Jet Badge", advice: "Electric, Ice et Rock sont utiles; évitez de laisser vos réponses s'user avant l'as.", bossTeam: [
      { species: "Swoobat", level: 37, types: ["psychic", "flying"] },
      { species: "Skarmory", level: 37, types: ["steel", "flying"] },
      { species: "Swanna", level: 39, types: ["water", "flying"] },
    ]},
    { name: "Arène de Moufouet - Drayden", levelCap: 48, objective: "Legend Badge", advice: "Dragon récompense les équipes profondes et les plans qui empêchent les boosts adverses.", bossTeam: [
      { species: "Druddigon", level: 46, types: ["dragon"] },
      { species: "Flygon", level: 46, types: ["ground", "dragon"] },
      { species: "Haxorus", level: 48, types: ["dragon"] },
    ]},
    { name: "Arène de Virgo - Marlon", levelCap: 51, objective: "Wave Badge", advice: "Grass et Electric doivent couvrir les doubles types et conserver assez de santé pour la fin.", bossTeam: [
      { species: "Carracosta", level: 49, types: ["water", "rock"] },
      { species: "Wailord", level: 49, types: ["water"] },
      { species: "Jellicent", level: 51, types: ["water", "ghost"] },
    ]},
    { name: "Ligue Pokémon", levelCap: 59, objective: "Champion", advice: "Préparez chaque membre comme un combat distinct et gardez un remplaçant crédible pour vos rôles clés." },
  ],
  kalos: [
    { name: "Forêt de Sangrefleur", levelCap: 9, objective: "Élargir les options", advice: "Kalos offre vite beaucoup de choix : privilégiez la complémentarité plutôt que les doublons." },
    { name: "Arène de Rosavilla - Violette", levelCap: 12, objective: "Bug Badge", advice: "Fire, Flying et Rock sont précieux; évitez de laisser un Pokémon fragile face à une attaque surprise.", bossTeam: [
      { species: "Surskit", level: 10, types: ["water", "bug"] },
      { species: "Vivillon", level: 12, types: ["bug", "flying"] },
    ]},
    { name: "Route 4", levelCap: 15, objective: "Consolider l'équipe", advice: "Commencez à préparer une équipe de secours avant que les combats ne s'allongent." },
    { name: "Arène de Ambereux - Grant", levelCap: 25, objective: "Cliff Badge", advice: "Water, Grass, Fighting et Ground sont utiles, mais les doubles types demandent plusieurs réponses.", bossTeam: [
      { species: "Amaura", level: 25, types: ["rock", "ice"] },
      { species: "Tyrunt", level: 25, types: ["rock", "dragon"] },
    ]},
    { name: "Arène de Ébouléa - Korrina", levelCap: 32, objective: "Rumble Badge", advice: "Flying, Psychic et Fairy font la différence; gardez un changement capable d'encaisser un coup physique.", bossTeam: [
      { species: "Mienfoo", level: 29, types: ["fighting"] },
      { species: "Mienshao", level: 32, types: ["fighting"] },
      { species: "Lucario", level: 32, types: ["fighting", "steel"] },
    ]},
    { name: "Arène de Pelouses - Ramos", levelCap: 34, objective: "Plant Badge", advice: "Fire, Ice, Poison, Flying et Bug donnent beaucoup d'options : choisissez surtout les plus sûres.", bossTeam: [
      { species: "Jumpluff", level: 30, types: ["grass", "flying"] },
      { species: "Weepinbell", level: 31, types: ["grass", "poison"] },
      { species: "Gogoat", level: 34, types: ["grass"] },
    ]},
    { name: "Arène de Luminabourg - Lem", levelCap: 37, objective: "Voltage Badge", advice: "Ground est central, mais une solution aux immunités et aux couvertures reste nécessaire.", bossTeam: [
      { species: "Emolga", level: 35, types: ["electric", "flying"] },
      { species: "Magneton", level: 35, types: ["electric", "steel"] },
      { species: "Heliolisk", level: 37, types: ["electric", "normal"] },
    ]},
    { name: "Arène de Plumeria - Valérie", levelCap: 42, objective: "Fairy Badge", advice: "Poison et Steel doivent être protégés des attaques de couverture avant de prendre le contrôle.", bossTeam: [
      { species: "Mawile", level: 38, types: ["steel", "fairy"] },
      { species: "Mr. Mime", level: 39, types: ["psychic", "fairy"] },
      { species: "Sylveon", level: 42, types: ["fairy"] },
    ]},
    { name: "Arène d'Anistar - Olympia", levelCap: 48, objective: "Psychic Badge", advice: "Dark, Ghost et Bug sont utiles; la résistance spéciale évite qu'un mauvais tour devienne une perte.", bossTeam: [
      { species: "Slowking", level: 44, types: ["water", "psychic"] },
      { species: "Gothitelle", level: 45, types: ["psychic"] },
      { species: "Meowstic", level: 48, types: ["psychic"] },
    ]},
    { name: "Arène de Frimapic - Wulfric", levelCap: 59, objective: "Iceberg Badge", advice: "Fire, Fighting, Rock et Steel sont efficaces, mais ne négligez pas les doubles types.", bossTeam: [
      { species: "Abomasnow", level: 56, types: ["grass", "ice"] },
      { species: "Cryogonal", level: 55, types: ["ice"] },
      { species: "Avalugg", level: 59, types: ["ice"] },
    ]},
    { name: "Ligue Pokémon", levelCap: 68, objective: "Champion", advice: "Kalos offre beaucoup de choix : privilégiez six rôles complémentaires plutôt que six attaquants." },
  ],
  alola: [
    { name: "École des Dresseurs", levelCap: 10, objective: "Premier contrôle", advice: "Les combats couvrent plusieurs types : ne laissez pas votre starter prendre tous les risques." },
    { name: "Caverne Verdoyante - Totem Raticate", levelCap: 12, objective: "Première épreuve", advice: "Préparez une réponse au Totem plutôt qu'une simple équipe de route.", bossTeam: [
      { species: "Raticate", level: 12, types: ["dark", "normal"] },
    ]},
    { name: "Grand Procès de Melemele - Hala", levelCap: 16, objective: "Premier Cristal Z", advice: "Anticipez les attaques puissantes et gardez un changement défensif disponible.", bossTeam: [
      { species: "Mankey", level: 14, types: ["fighting"] },
      { species: "Makuhita", level: 14, types: ["fighting"] },
      { species: "Crabrawler", level: 15, types: ["fighting"] },
    ]},
    { name: "Plage des Vagues - Totem Wishiwashi", levelCap: 20, objective: "Épreuve Eau", advice: "Préparez Electric ou Grass, mais aussi une réponse au renfort appelé par le Totem.", bossTeam: [
      { species: "Wishiwashi", level: 20, types: ["water"] },
    ]},
    { name: "Volcan de Wela - Totem Salazzle", levelCap: 22, objective: "Épreuve Feu", advice: "Water, Rock et Ground sont fiables; gardez un plan pour les changements de rythme du Totem.", bossTeam: [
      { species: "Salazzle", level: 22, types: ["fire", "poison"] },
    ]},
    { name: "Jungle de Lush - Totem Lurantis", levelCap: 24, objective: "Épreuve Plante", advice: "Fire, Flying et Bug fonctionnent bien, à condition de tenir compte des renforts.", bossTeam: [
      { species: "Lurantis", level: 24, types: ["grass"] },
    ]},
    { name: "Grand Procès d'Akala - Olivia", levelCap: 28, objective: "Épreuve Roche", advice: "Water, Grass, Fighting, Ground et Steel offrent des plans sûrs contre Olivia.", bossTeam: [
      { species: "Nosepass", level: 26, types: ["rock"] },
      { species: "Boldore", level: 26, types: ["rock"] },
      { species: "Lycanroc", level: 27, types: ["rock"] },
    ]},
    { name: "Observatoire Hokulani - Totem Vikavolt", levelCap: 33, objective: "Épreuve Électrik", advice: "Ground doit être accompagné d'une réponse aux couvertures et aux renforts du Totem.", bossTeam: [
      { species: "Vikavolt", level: 33, types: ["bug", "electric"] },
    ]},
    { name: "Mégastore Thrifty - Totem Mimikyu", levelCap: 35, objective: "Épreuve Spectre", advice: "Dark et Ghost sont utiles; prévoyez surtout un moyen de ne pas perdre le contrôle du combat.", bossTeam: [
      { species: "Mimikyu", level: 35, types: ["ghost", "fairy"] },
    ]},
    { name: "Grand Procès d'Ula'ula - Nanu", levelCap: 44, objective: "Épreuve Ténèbres", advice: "Fighting, Bug et Fairy aident, mais les doubles types de Nanu récompensent une équipe flexible.", bossTeam: [
      { species: "Sableye", level: 36, types: ["dark", "ghost"] },
      { species: "Persian", level: 37, types: ["dark"] },
      { species: "Persian", level: 37, types: ["dark"] },
      { species: "Persian", level: 37, types: ["dark"] },
    ]},
    { name: "Canyon Poni - Totem Kommo-o", levelCap: 49, objective: "Épreuve Dragon", advice: "Fairy et Ice sont clés; gardez une deuxième réponse si le premier plan tombe.", bossTeam: [
      { species: "Kommo-o", level: 49, types: ["dragon", "fighting"] },
    ]},
    { name: "Grand Procès de Poni - Hapu", levelCap: 54, objective: "Épreuve Sol", advice: "Water, Grass et Ice sont forts, mais chaque changement doit respecter les couvertures de Hapu.", bossTeam: [
      { species: "Dugtrio", level: 43, types: ["ground"] },
      { species: "Gastrodon", level: 43, types: ["water", "ground"] },
      { species: "Flygon", level: 44, types: ["ground", "dragon"] },
      { species: "Mudsdale", level: 45, types: ["ground"] },
    ]},
    { name: "Ligue Pokémon", levelCap: 60, objective: "Champion", advice: "Les combats d'Alola récompensent la profondeur : répartissez vos réponses plutôt que de tout confier au starter." },
  ],
  letsgo: [
    { name: "Viridian Forest", levelCap: 10, objective: "Premiers partenaires", advice: "Votre partenaire est fort, mais votre Nuzlocke sera plus sûr avec une vraie équipe autour de lui." },
    { name: "Arène d'Argenta - Brock", levelCap: 12, objective: "Boulder Badge", advice: "Assurez-vous d'avoir une réponse claire à Rock avant d'entrer.", bossTeam: [
      { species: "Geodude", level: 10, types: ["rock", "ground"] },
      { species: "Onix", level: 12, types: ["rock", "ground"] },
    ]},
    { name: "Mt. Moon", levelCap: 16, objective: "Traversée longue", advice: "Conservez une équipe équilibrée et évitez de tout miser sur votre partenaire." },
    { name: "Arène d'Azuria - Misty", levelCap: 19, objective: "Cascade Badge", advice: "Grass ou Electric rendent le combat plus stable sans exposer inutilement votre partenaire.", bossTeam: [
      { species: "Staryu", level: 18, types: ["water"] },
      { species: "Starmie", level: 19, types: ["water", "psychic"] },
    ]},
    { name: "Arène de Carmin - Lt. Surge", levelCap: 25, objective: "Thunder Badge", advice: "Ground donne un avantage net, mais gardez une réponse de secours aux couvertures.", bossTeam: [
      { species: "Raichu", level: 25, types: ["electric"] },
    ]},
    { name: "Arène de Céladopole - Erika", levelCap: 34, objective: "Rainbow Badge", advice: "Fire, Flying, Ice, Poison et Bug offrent de nombreuses options; choisissez la plus résistante.", bossTeam: [
      { species: "Weepinbell", level: 30, types: ["grass", "poison"] },
      { species: "Tangela", level: 32, types: ["grass"] },
      { species: "Vileplume", level: 34, types: ["grass", "poison"] },
    ]},
    { name: "Arène de Cramois - Koga", levelCap: 43, objective: "Soul Badge", advice: "Psychic et Ground sont utiles; anticipez surtout Poison et les dégâts résiduels.", bossTeam: [
      { species: "Koffing", level: 37, types: ["poison"] },
      { species: "Muk", level: 37, types: ["poison"] },
      { species: "Koffing", level: 40, types: ["poison"] },
      { species: "Weezing", level: 43, types: ["poison"] },
    ]},
    { name: "Arène de Parmanie - Sabrina", levelCap: 44, objective: "Marsh Badge", advice: "Dark, Ghost et Bug donnent le rythme, mais la résistance spéciale reste votre filet de sécurité.", bossTeam: [
      { species: "Kadabra", level: 40, types: ["psychic"] },
      { species: "Mr. Mime", level: 40, types: ["psychic"] },
      { species: "Alakazam", level: 44, types: ["psychic"] },
    ]},
    { name: "Arène de Cramois - Blaine", levelCap: 48, objective: "Volcano Badge", advice: "Water, Rock et Ground sont les voies les plus sûres si votre équipe garde assez de vitesse.", bossTeam: [
      { species: "Rapidash", level: 45, types: ["fire"] },
      { species: "Arcanine", level: 48, types: ["fire"] },
    ]},
    { name: "Arène de Jadielle - Giovanni", levelCap: 50, objective: "Earth Badge", advice: "Deux réponses à Ground valent mieux qu'un seul Pokémon sur lequel repose tout le combat.", bossTeam: [
      { species: "Dugtrio", level: 45, types: ["ground"] },
      { species: "Nidoqueen", level: 44, types: ["poison", "ground"] },
      { species: "Nidoking", level: 45, types: ["poison", "ground"] },
    ]},
    { name: "Ligue Pokémon", levelCap: 57, objective: "Champion", advice: "Votre partenaire reste central, mais chaque rôle critique doit avoir une solution de rechange." },
  ],
  galar: [
    { name: "Route 2", levelCap: 10, objective: "Trouver le bon équilibre", advice: "Galar offre vite plusieurs rôles : cherchez de la résistance autant que de la puissance." },
    { name: "Mines de Galar", levelCap: 18, objective: "Préparer Turffield", advice: "Gardez une réponse sûre à Grass et surveillez les Pokémon trop proches de la limite." },
    { name: "Arène de Turffield - Milo", levelCap: 20, objective: "Grass Badge", advice: "Fire, Flying et Bug sont vos meilleurs alliés; prévoyez aussi un changement défensif.", bossTeam: [
      { species: "Gossifleur", level: 19, types: ["grass"] },
      { species: "Eldegoss", level: 20, types: ["grass"] },
    ]},
    { name: "Arène de Hulbury - Nessa", levelCap: 24, objective: "Water Badge", advice: "Grass et Electric sont efficaces, mais gardez une réponse au Pokémon Dynamax final.", bossTeam: [
      { species: "Goldeen", level: 22, types: ["water"] },
      { species: "Arrokuda", level: 23, types: ["water"] },
      { species: "Drednaw", level: 24, types: ["water", "rock"] },
    ]},
    { name: "Arène de Motostoke - Kabu", levelCap: 27, objective: "Fire Badge", advice: "Water, Rock et Ground doivent pouvoir tenir le rythme d'un combat Dynamax.", bossTeam: [
      { species: "Ninetales", level: 25, types: ["fire"] },
      { species: "Arcanine", level: 25, types: ["fire"] },
      { species: "Centiskorch", level: 27, types: ["fire", "bug"] },
    ]},
    { name: "Arène de Stow-on-Side", levelCap: 36, objective: "Badge Combat / Spectre", advice: "Bea (Sword) ou Allister (Shield) selon votre version. Adaptez votre couverture avant d'entrer.",
      versionBossTeams: {
        sword: [
          { species: "Hitmontop", level: 34, types: ["fighting"] },
          { species: "Pangoro", level: 34, types: ["fighting", "dark"] },
          { species: "Sirfetch'd", level: 35, types: ["fighting"] },
          { species: "Machamp", level: 36, types: ["fighting"] },
        ],
        shield: [
          { species: "Yamask", level: 34, types: ["ghost"] },
          { species: "Mimikyu", level: 34, types: ["ghost", "fairy"] },
          { species: "Cursola", level: 35, types: ["ghost"] },
          { species: "Gengar", level: 36, types: ["ghost", "poison"] },
        ],
      },
    },
    { name: "Arène de Ballonlea - Opal", levelCap: 38, objective: "Fairy Badge", advice: "Poison et Steel sont forts, mais les questions de l'arène peuvent modifier le rythme du combat.", bossTeam: [
      { species: "Weezing", level: 36, types: ["poison", "fairy"] },
      { species: "Mawile", level: 36, types: ["steel", "fairy"] },
      { species: "Togekiss", level: 38, types: ["fairy", "flying"] },
      { species: "Alcremie", level: 38, types: ["fairy"] },
    ]},
    { name: "Arène de Circhester", levelCap: 42, objective: "Badge Roche / Glace", advice: "Gordie (Sword) ou Melony (Shield) selon votre version. Les types et l'équipe changent complètement.",
      versionBossTeams: {
        sword: [
          { species: "Barbaracle", level: 40, types: ["rock", "water"] },
          { species: "Shuckle", level: 40, types: ["bug", "rock"] },
          { species: "Stonjourner", level: 41, types: ["rock"] },
          { species: "Coalossal", level: 42, types: ["rock", "fire"] },
        ],
        shield: [
          { species: "Frosmoth", level: 40, types: ["ice", "bug"] },
          { species: "Darmanitan", level: 40, types: ["ice"] },
          { species: "Eiscue", level: 41, types: ["ice"] },
          { species: "Lapras", level: 42, types: ["water", "ice"] },
        ],
      },
    },
    { name: "Arène de Spikemuth - Piers", levelCap: 46, objective: "Dark Badge", advice: "Fighting, Bug et Fairy sont précieux; la bataille sans Dynamax récompense un plan régulier.", bossTeam: [
      { species: "Scrafty", level: 44, types: ["dark", "fighting"] },
      { species: "Malamar", level: 45, types: ["dark", "psychic"] },
      { species: "Skuntank", level: 45, types: ["poison", "dark"] },
      { species: "Obstagoon", level: 46, types: ["dark", "normal"] },
    ]},
    { name: "Arène de Hammerlocke - Raihan", levelCap: 48, objective: "Dragon Badge", advice: "Le double combat exige deux Pokémon qui se protègent mutuellement, pas seulement deux bons attaquants.", bossTeam: [
      { species: "Gigalith", level: 46, types: ["rock"] },
      { species: "Sandaconda", level: 46, types: ["ground"] },
      { species: "Flygon", level: 47, types: ["ground", "dragon"] },
      { species: "Duraludon", level: 48, types: ["steel", "dragon"] },
    ]},
    { name: "Coupe des Champions", levelCap: 65, objective: "Champion", advice: "Prévoyez plusieurs combats de haut niveau et une réponse fiable au Gigantamax de Leon." },
  ],
  hisui: [
    { name: "Terres Sauvages d'Obsidienne", levelCap: 10, objective: "Former l'escouade", advice: "Les Pokémon sauvages peuvent surprendre : gardez toujours une sortie sûre." },
    { name: "Rang Étoile Nº1", levelCap: 15, objective: "Gagner en autonomie", advice: "Diversifiez les rôles avant de vous éloigner davantage de Jubilife Village." },
    { name: "Seigneur Kleavor", levelCap: 18, objective: "Premier noble", advice: "Préparez une équipe capable de survivre à un combat plus imprévisible qu'un badge classique.", bossTeam: [
      { species: "Kleavor", level: 18, types: ["bug", "rock"] },
    ]},
    { name: "Seigneur Lilligant", levelCap: 30, objective: "Marécages Pourpres", advice: "Flying, Fire, Ice et Psychic sont utiles; gardez une sortie face aux tours rapides.", bossTeam: [
      { species: "Lilligant", level: 30, types: ["grass"] },
    ]},
    { name: "Seigneur Arcanine", levelCap: 36, objective: "Côtes Cobalt", advice: "Water, Ground, Rock et Fighting offrent de bonnes réponses si l'équipe reste assez résistante.", bossTeam: [
      { species: "Arcanine", level: 36, types: ["fire"] },
    ]},
    { name: "Seigneur Électrode", levelCap: 46, objective: "Hauts Couronnet", advice: "Ground et Ice doivent composer avec la vitesse et les doubles tours propres à Hisui.", bossTeam: [
      { species: "Electrode", level: 46, types: ["electric", "grass"] },
    ]},
    { name: "Seigneur Avalugg", levelCap: 56, objective: "Terres de Glace", advice: "Fire, Fighting, Rock et Steel sont efficaces, mais ne sous-estimez pas sa résistance.", bossTeam: [
      { species: "Avalugg", level: 56, types: ["ice"] },
    ]},
    { name: "Temple de Sinnoh", levelCap: 68, objective: "Combat final", advice: "Préparez une escouade profonde : l'ordre des tours et la capacité à encaisser priment sur un simple avantage de type." },
  ],
  paldea: [
    { name: "Province du Sud (Zone 1)", levelCap: 10, objective: "Choisir une direction", advice: "Paldea est ouverte : fixez-vous un objectif proche pour éviter un écart de niveaux brutal." },
    { name: "Arène de Cortondo - Katy", levelCap: 15, objective: "Badge Insecte", advice: "Fire, Flying et Rock offrent une route sûre, mais gardez un plan pour le Pokémon Tera final.", bossTeam: [
      { species: "Nymble", level: 14, types: ["bug"] },
      { species: "Teddiursa", level: 14, types: ["normal"] },
      { species: "Lokix", level: 15, types: ["bug", "dark"] },
    ]},
    { name: "Titan de Roche - Klawf", levelCap: 16, objective: "Premier Titan", advice: "Une option Water ou Grass solide limite fortement les risques de cette étape.", bossTeam: [
      { species: "Klawf", level: 16, types: ["rock"] },
    ]},
    { name: "Arène d'Artazon - Brassius", levelCap: 17, objective: "Badge Plante", advice: "Fire, Flying, Ice, Poison et Bug sont utiles; anticipez le type Tera final.", bossTeam: [
      { species: "Petilil", level: 16, types: ["grass"] },
      { species: "Smoliv", level: 16, types: ["grass", "normal"] },
      { species: "Sudowoodo", level: 17, types: ["rock"] },
    ]},
    { name: "Titan Céleste - Bombirdier", levelCap: 19, objective: "Deuxième Titan", advice: "Electric, Ice et Rock sont efficaces, mais gardez une réponse capable d'encaisser.", bossTeam: [
      { species: "Bombirdier", level: 19, types: ["dark", "flying"] },
    ]},
    { name: "Team Star Ténèbres - Giacomo", levelCap: 21, objective: "Objectif Team Star", advice: "Fighting, Bug et Fairy donnent l'avantage; ne négligez pas l'endurance nécessaire au raid de base.", bossTeam: [
      { species: "Pawniard", level: 20, types: ["dark", "steel"] },
      { species: "Segin Starmobile", level: 20, types: ["dark"] },
    ]},
    { name: "Arène de Levincia - Iono", levelCap: 24, objective: "Badge Électrik", advice: "Ground aide, mais le Levitate de l'as oblige à préparer une seconde ligne de jeu.", bossTeam: [
      { species: "Wattrel", level: 23, types: ["electric", "flying"] },
      { species: "Bellibolt", level: 23, types: ["electric"] },
      { species: "Luxio", level: 23, types: ["electric"] },
      { species: "Mismagius", level: 24, types: ["ghost"] },
    ]},
    { name: "Team Star Feu - Mela", levelCap: 27, objective: "Objectif Team Star", advice: "Water, Ground et Rock sont essentiels; préservez-les avant le combat contre la Starmobile.", bossTeam: [
      { species: "Torkoal", level: 26, types: ["fire"] },
      { species: "Schedar Starmobile", level: 26, types: ["fire"] },
    ]},
    { name: "Titan d'Acier - Orthworm", levelCap: 28, objective: "Troisième Titan", advice: "Fire, Fighting et Ground raccourcissent le combat et limitent les risques.", bossTeam: [
      { species: "Orthworm", level: 28, types: ["steel"] },
    ]},
    { name: "Arène de Cascarrafa - Kofu", levelCap: 30, objective: "Badge Eau", advice: "Grass et Electric doivent gérer les doubles types ainsi que le changement Tera final.", bossTeam: [
      { species: "Veluza", level: 29, types: ["water", "psychic"] },
      { species: "Wugtrio", level: 29, types: ["water"] },
      { species: "Crabominable", level: 30, types: ["fighting", "ice"] },
    ]},
    { name: "Team Star Poison - Atticus", levelCap: 33, objective: "Objectif Team Star", advice: "Ground et Psychic sont précieux; prévoyez une réponse aux altérations de statut.", bossTeam: [
      { species: "Skuntank", level: 32, types: ["poison", "dark"] },
      { species: "Revavroom", level: 32, types: ["poison"] },
      { species: "Navi Starmobile", level: 32, types: ["poison"] },
    ]},
    { name: "Arène de Medali - Larry", levelCap: 36, objective: "Badge Normal", advice: "Fighting est le choix naturel, mais gardez une réponse au type Tera de l'as.", bossTeam: [
      { species: "Komala", level: 35, types: ["normal"] },
      { species: "Dudunsparce", level: 35, types: ["normal"] },
      { species: "Staraptor", level: 36, types: ["normal", "flying"] },
    ]},
    { name: "Arène de Montenevera - Ryme", levelCap: 42, objective: "Badge Spectre", advice: "Dark et Ghost sont efficaces; le double combat récompense surtout les bonnes synergies.", bossTeam: [
      { species: "Banette", level: 41, types: ["ghost"] },
      { species: "Mimikyu", level: 41, types: ["ghost", "fairy"] },
      { species: "Houndstone", level: 41, types: ["ghost"] },
      { species: "Toxtricity", level: 42, types: ["electric", "poison"] },
    ]},
    { name: "Titan Terreux - Donphan", levelCap: 44, objective: "Quatrième Titan", advice: "Adaptez votre couverture à Scarlet ou Violet et gardez un plan pour sa puissance brute.", bossTeam: [
      { species: "Great Tusk", level: 44, types: ["ground", "fighting"] },
    ]},
    { name: "Arène d'Alfornada - Tulip", levelCap: 45, objective: "Badge Psy", advice: "Dark, Ghost et Bug sont utiles; préparez une réponse au type Tera Fairy final.", bossTeam: [
      { species: "Farigiraf", level: 44, types: ["normal", "psychic"] },
      { species: "Espathra", level: 44, types: ["normal", "psychic"] },
      { species: "Gardevoir", level: 44, types: ["psychic", "fairy"] },
      { species: "Florges", level: 45, types: ["fairy"] },
    ]},
    { name: "Arène de Glaseado - Grusha", levelCap: 48, objective: "Badge Glace", advice: "Fire, Fighting, Rock et Steel sont efficaces, mais les couvertures adverses peuvent punir un plan linéaire.", bossTeam: [
      { species: "Frosmoth", level: 47, types: ["ice", "bug"] },
      { species: "Beartic", level: 47, types: ["ice"] },
      { species: "Cetitan", level: 47, types: ["ice"] },
      { species: "Altaria", level: 48, types: ["dragon", "flying"] },
    ]},
    { name: "Team Star Fée - Ortega", levelCap: 51, objective: "Objectif Team Star", advice: "Poison et Steel sont centraux; gardez assez de ressources pour la Starmobile.", bossTeam: [
      { species: "Wigglytuff", level: 50, types: ["normal", "fairy"] },
      { species: "Dachsbun", level: 50, types: ["fairy"] },
      { species: "Ruchbah Starmobile", level: 50, types: ["fairy"] },
    ]},
    { name: "Titan Dragon - Tatsugiri", levelCap: 55, objective: "Cinquième Titan", advice: "Le combat cache plusieurs phases : protégez vos réponses Dragon et Fairy jusqu'au bout.", bossTeam: [
      { species: "Dondozo", level: 55, types: ["water"] },
    ]},
    { name: "Team Star Combat - Eri", levelCap: 56, objective: "Objectif Team Star", advice: "Flying, Psychic et Fairy sont utiles, mais la Starmobile exige surtout de la profondeur.", bossTeam: [
      { species: "Annihilape", level: 55, types: ["fighting", "ghost"] },
      { species: "Crabominable", level: 55, types: ["fighting", "ice"] },
      { species: "Copperajah", level: 55, types: ["steel"] },
      { species: "Lucario", level: 55, types: ["fighting", "steel"] },
      { species: "Caph Starmobile", level: 55, types: ["fighting"] },
    ]},
    { name: "Ligue Pokémon", levelCap: 62, objective: "Champion", advice: "Préparez une équipe capable de traverser le Conseil 4 puis Geeta sans dépendre d'un seul rôle." },
    { name: "Piste Poco", levelCap: 63, objective: "Pepper", advice: "Attendez-vous à une équipe variée : privilégiez les changements sûrs et la couverture générale." },
    { name: "Finale de la Team Star", levelCap: 63, objective: "Grand boss", advice: "Une couverture équilibrée vaut mieux qu'un contre unique face à une équipe très diversifiée." },
    { name: "Retour au bercail", levelCap: 67, objective: "Combat final", advice: "Une fois engagé dans la Zone Zéro, gardez assez de marge pour plusieurs combats difficiles avant la finale." },
  ],
} satisfies Record<string, ProgressMilestone[]>;

const STARTER_SETS = {
  kanto: ["bulbasaur", "charmander", "squirtle"],
  johto: ["chikorita", "cyndaquil", "totodile"],
  hoenn: ["treecko", "torchic", "mudkip"],
  sinnoh: ["turtwig", "chimchar", "piplup"],
  unova: ["snivy", "tepig", "oshawott"],
  kalos: ["chespin", "fennekin", "froakie"],
  alola: ["rowlet", "litten", "popplio"],
  galar: ["grookey", "scorbunny", "sobble"],
  hisui: ["rowlet", "cyndaquil", "oshawott"],
  paldea: ["sprigatito", "fuecoco", "quaxly"],
};

function game(
  id: string,
  title: string,
  versionGroup: string,
  generation: number,
  startingLocation: string,
  starterIds: string[],
  progression: keyof typeof PROGRESSION,
  specialRules?: string[]
): GameProfile {
  return {
    id,
    title,
    versionGroup,
    generation,
    startingLocation,
    starterIds,
    milestones: PROGRESSION[progression],
    specialRules,
    ruleContexts: buildRuleContexts(id, specialRules),
  };
}

export const GAME_CATALOG: GameProfile[] = [
  game("red",  "Pokémon Red",  "red-blue", 1, "Pallet Town", STARTER_SETS.kanto, "kanto",
    ["Clause Safari Zone : une seule rencontre autorisée dans la Safari Zone", "Pêche et Surf = rencontre distincte par route"]),
  game("blue", "Pokémon Blue", "red-blue", 1, "Pallet Town", STARTER_SETS.kanto, "kanto",
    ["Clause Safari Zone : une seule rencontre autorisée dans la Safari Zone", "Pêche et Surf = rencontre distincte par route"]),
  game("yellow", "Pokémon Yellow", "yellow", 1, "Pallet Town", ["pikachu"], "kanto",
    ["Pikachu est le Pokémon de départ imposé et ne peut pas être rangé", "Clause Safari Zone active", "Pêche = rencontre séparée"]),
  game("gold",    "Pokémon Gold",    "gold-silver", 2, "New Bark Town", STARTER_SETS.johto, "johto",
    ["Arbres à Coup d'Boule = route distincte si arbre différent", "Concours de Capture d'Insecte = rencontre séparée", "Pêche = rencontre séparée par plan d'eau"]),
  game("silver",  "Pokémon Silver",  "gold-silver", 2, "New Bark Town", STARTER_SETS.johto, "johto",
    ["Arbres à Coup d'Boule = route distincte si arbre différent", "Concours de Capture d'Insecte = rencontre séparée", "Pêche = rencontre séparée par plan d'eau"]),
  game("crystal", "Pokémon Crystal", "crystal",     2, "New Bark Town", STARTER_SETS.johto, "johto",
    ["Arbres à Coup d'Boule = route distincte si arbre différent", "Mobile Stadium : rencontres non comptabilisées", "Pêche = rencontre séparée par plan d'eau"]),
  game("ruby",      "Pokémon Ruby",      "ruby-sapphire", 3, "Littleroot Town", STARTER_SETS.hoenn, "hoenn",
    ["Fossile = un cadeau libre sans règle de rencontre", "Pêche et Surf = rencontre distincte par zone", "Safari Zone : une rencontre autorisée"]),
  game("sapphire",  "Pokémon Sapphire",  "ruby-sapphire", 3, "Littleroot Town", STARTER_SETS.hoenn, "hoenn",
    ["Fossile = un cadeau libre sans règle de rencontre", "Pêche et Surf = rencontre distincte par zone", "Safari Zone : une rencontre autorisée"]),
  game("emerald",   "Pokémon Emerald",   "emerald",       3, "Littleroot Town", STARTER_SETS.hoenn, "hoenn",
    ["Zone de Combat non comptabilisée", "Safari Zone étendue : une rencontre par zone", "Île Mirage : rencontre libre si accessible"]),
  game("firered",   "Pokémon FireRed",   "firered-leafgreen", 3, "Pallet Town", STARTER_SETS.kanto, "kanto",
    ["Safari Zone : une rencontre autorisée", "Pokémon offerts comptent comme rencontre de leur lieu", "Pêche et Surf = rencontre distincte"]),
  game("leafgreen", "Pokémon LeafGreen", "firered-leafgreen", 3, "Pallet Town", STARTER_SETS.kanto, "kanto",
    ["Safari Zone : une rencontre autorisée", "Pokémon offerts comptent comme rencontre de leur lieu", "Pêche et Surf = rencontre distincte"]),
  game("diamond",   "Pokémon Diamond",   "diamond-pearl", 4, "Twinleaf Town", STARTER_SETS.sinnoh, "sinnoh",
    ["Arbres au Miel = rencontre propre par arbre", "Grand Souterrain non comptabilisé", "Pêche = rencontre distincte par plan d'eau"]),
  game("pearl",     "Pokémon Pearl",     "diamond-pearl", 4, "Twinleaf Town", STARTER_SETS.sinnoh, "sinnoh",
    ["Arbres au Miel = rencontre propre par arbre", "Grand Souterrain non comptabilisé", "Pêche = rencontre distincte par plan d'eau"]),
  game("platinum",  "Pokémon Platinum",  "platinum",      4, "Twinleaf Town", STARTER_SETS.sinnoh, "sinnoh",
    ["Arbres au Miel = rencontre propre par arbre", "Monde Distorsion : rencontre Giratina unique", "Pêche = rencontre distincte par plan d'eau"]),
  game("heartgold", "Pokémon HeartGold", "heartgold-soulsilver", 4, "New Bark Town", STARTER_SETS.johto, "johto",
    ["Pokémon compagnon (suiveur) ne compte pas", "Concours de Capture d'Insecte = rencontre propre", "Safari Zone par zone = rencontre propre"]),
  game("soulsilver", "Pokémon SoulSilver", "heartgold-soulsilver", 4, "New Bark Town", STARTER_SETS.johto, "johto",
    ["Pokémon compagnon (suiveur) ne compte pas", "Concours de Capture d'Insecte = rencontre propre", "Safari Zone par zone = rencontre propre"]),
  game("black",   "Pokémon Black",   "black-white", 5, "Nuvema Town", STARTER_SETS.unova, "unova",
    ["Pokémon offerts en ville = rencontre de leur lieu", "Trouées Cachées non comptabilisées en standard", "Saisons changent les rencontres : notez la saison de capture"]),
  game("white",   "Pokémon White",   "black-white", 5, "Nuvema Town", STARTER_SETS.unova, "unova",
    ["Pokémon offerts en ville = rencontre de leur lieu", "Trouées Cachées non comptabilisées en standard", "Saisons changent les rencontres : notez la saison de capture"]),
  game("black-2", "Pokémon Black 2", "black-2-white-2", 5, "Aspertia City", STARTER_SETS.unova, "unova2",
    ["Pokémon offerts comptés pour leur lieu", "Trouées Cachées non comptabilisées", "Pokémon World Tournament non applicable"]),
  game("white-2", "Pokémon White 2", "black-2-white-2", 5, "Aspertia City", STARTER_SETS.unova, "unova2",
    ["Pokémon offerts comptés pour leur lieu", "Trouées Cachées non comptabilisées", "Pokémon World Tournament non applicable"]),
  game("x", "Pokémon X", "x-y", 6, "Vaniville Town", STARTER_SETS.kalos, "kalos",
    ["Safari des Amis = rencontres distinctes par safari ami", "Horde : première espèce visible seulement", "Fossile = cadeau libre"]),
  game("y", "Pokémon Y", "x-y", 6, "Vaniville Town", STARTER_SETS.kalos, "kalos",
    ["Safari des Amis = rencontres distinctes par safari ami", "Horde : première espèce visible seulement", "Fossile = cadeau libre"]),
  game("omega-ruby",     "Pokémon Omega Ruby",     "omega-ruby-alpha-sapphire", 6, "Littleroot Town", STARTER_SETS.hoenn, "hoenn",
    ["DexNav : la rencontre DexNav compte même si elle est cherchée", "Safari Zone : une rencontre par zone", "Mirages = rencontre propre si accessible"]),
  game("alpha-sapphire", "Pokémon Alpha Sapphire", "omega-ruby-alpha-sapphire", 6, "Littleroot Town", STARTER_SETS.hoenn, "hoenn",
    ["DexNav : la rencontre DexNav compte même si elle est cherchée", "Safari Zone : une rencontre par zone", "Mirages = rencontre propre si accessible"]),
  game("sun",        "Pokémon Sun",        "sun-moon", 7, "Iki Town", STARTER_SETS.alola, "alola",
    ["Combat SOS : appel d'un autre Pokémon = même espèce, ne compte pas comme nouvelle rencontre", "Poké Loisir non applicable", "Cadeau unique des Pokémon (Fossile, etc.) = rencontre libre"]),
  game("moon",       "Pokémon Moon",       "sun-moon", 7, "Iki Town", STARTER_SETS.alola, "alola",
    ["Combat SOS : appel d'un autre Pokémon = même espèce, ne compte pas", "Poké Loisir non applicable"]),
  game("ultra-sun",  "Pokémon Ultra Sun",  "ultra-sun-ultra-moon", 7, "Iki Town", STARTER_SETS.alola, "alola",
    ["Ultra-Brèches : chaque brèche = rencontre propre par dimension", "Combat SOS ne change pas la rencontre de la zone"]),
  game("ultra-moon", "Pokémon Ultra Moon", "ultra-sun-ultra-moon", 7, "Iki Town", STARTER_SETS.alola, "alola",
    ["Ultra-Brèches : chaque brèche = rencontre propre par dimension", "Combat SOS ne change pas la rencontre de la zone"]),
  game("lets-go-pikachu", "Pokémon Let's Go, Pikachu!", "lets-go-pikachu-lets-go-eevee", 7, "Pallet Town", ["pikachu"], "letsgo",
    ["Pas de rencontres aléatoires : captures visibles uniquement", "Chaînes de capture non comptabilisées", "Pikachu partenaire ne peut pas être échangé ou utilisé en combat (selon variante)"]),
  game("lets-go-eevee",   "Pokémon Let's Go, Eevee!",   "lets-go-pikachu-lets-go-eevee", 7, "Pallet Town", ["eevee"], "letsgo",
    ["Pas de rencontres aléatoires : captures visibles uniquement", "Chaînes de capture non comptabilisées", "Évoli partenaire ne peut pas être échangé ou utilisé en combat (selon variante)"]),
  game("sword", "Pokémon Sword", "sword-shield", 8, "Postwick", STARTER_SETS.galar, "galar",
    ["Terres Sauvages : chaque zone peut être une route propre", "Expéditions Dynamax non comptabilisées en mode Standard", "Raid Dynamax : rencontre libre si le Pokémon est capturé"]),
  game("shield", "Pokémon Shield", "sword-shield", 8, "Postwick", STARTER_SETS.galar, "galar",
    ["Terres Sauvages : chaque zone peut être une route propre", "Expéditions Dynamax non comptabilisées en mode Standard", "Raid Dynamax : rencontre libre si le Pokémon est capturé"]),
  game("brilliant-diamond", "Pokémon Brilliant Diamond", "brilliant-diamond-shining-pearl", 8, "Twinleaf Town", STARTER_SETS.sinnoh, "sinnoh",
    ["Grand Souterrain non comptabilisé", "Arbres au Miel = rencontre propre par arbre", "Parc Rosa Rugosa = rencontre propre par salle"]),
  game("shining-pearl", "Pokémon Shining Pearl", "brilliant-diamond-shining-pearl", 8, "Twinleaf Town", STARTER_SETS.sinnoh, "sinnoh",
    ["Grand Souterrain non comptabilisé", "Arbres au Miel = rencontre propre par arbre", "Parc Rosa Rugosa = rencontre propre par salle"]),
  game("legends-arceus", "Pokémon Legends: Arceus", "legends-arceus", 8, "Jubilife Village", STARTER_SETS.hisui, "hisui",
    ["Pas de routes classiques : première capture par grande zone uniquement", "Alpha Pokémon comptent comme rencontre normale", "Missions de recherche non comptabilisées", "Basculin / Cherrim : rencontres uniques si capturés"]),
  game("scarlet", "Pokémon Scarlet", "scarlet-violet", 9, "Cabo Poco", STARTER_SETS.paldea, "paldea",
    ["Monde ouvert : première rencontre par zone ou biome recommandée", "Raid Tera non comptabilisé en Standard", "Pokémon dominants dans les grottes = rencontre propre", "Kitakami et Institut Myrtille (DLC) = zones propres"]),
  game("violet", "Pokémon Violet", "scarlet-violet", 9, "Cabo Poco", STARTER_SETS.paldea, "paldea",
    ["Monde ouvert : première rencontre par zone ou biome recommandée", "Raid Tera non comptabilisé en Standard", "Pokémon dominants dans les grottes = rencontre propre", "Kitakami et Institut Myrtille (DLC) = zones propres"]),
];

export function getGameById(id: string) {
  return GAME_CATALOG.find((entry) => entry.id === id) ?? null;
}

export function getGameForRun(gameTitle: string, versionGroup: string) {
  return GAME_CATALOG.find((entry) => entry.title === gameTitle)
    ?? GAME_CATALOG.find((entry) => entry.versionGroup === versionGroup)
    ?? null;
}

export function getStarterById(id: string) {
  return STARTERS[id] ?? null;
}
