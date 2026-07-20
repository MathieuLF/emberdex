import { z } from "zod";

export const themeTokensSchema = z.object({
  name: z.string().min(1),
  background: z.string().min(1),
  backgroundAlt: z.string().min(1),
  surface: z.string().min(1),
  surfaceStrong: z.string().min(1),
  surfaceElevated: z.string().min(1),
  line: z.string().min(1),
  text: z.string().min(1),
  muted: z.string().min(1),
  accent: z.string().min(1),
  accentSoft: z.string().min(1),
  accentSecondary: z.string().min(1),
  success: z.string().min(1),
  warning: z.string().min(1),
  danger: z.string().min(1),
  glow: z.string().min(1),
  shadow: z.string().min(1),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;

export const legacyRulePresetSchema = z.object({
  speciesClause: z.boolean(),
  shinyClause: z.boolean(),
  dupesClause: z.boolean(),
  levelCap: z.boolean(),
  setMode: z.boolean(),
  battleItems: z.boolean(),
  giftClause: z.boolean(),
  wipeIsPermanent: z.boolean(),
  pinchHealingAllowed: z.boolean(),
  rareCandyCap: z.number().int().nonnegative(),
  hardcore: z.boolean(),
});

export type LegacyRulePreset = z.infer<typeof legacyRulePresetSchema>;

export const ruleModeSchema = z.enum(["standard", "hardcore", "custom"]);

export type RuleMode = z.infer<typeof ruleModeSchema>;

export const ruleIssueSeveritySchema = z.enum(["warn", "block"]);

export type RuleIssueSeverity = z.infer<typeof ruleIssueSeveritySchema>;

export const levelCapPolicySchema = z.enum(["off", "advisory", "strict"]);

export type LevelCapPolicy = z.infer<typeof levelCapPolicySchema>;

export const encounterScopeSchema = z.enum(["area", "area-method", "area-biome", "zone"]);

export type EncounterScope = z.infer<typeof encounterScopeSchema>;

export const giftEncounterPolicySchema = z.enum(["free", "count", "separate"]);

export type GiftEncounterPolicy = z.infer<typeof giftEncounterPolicySchema>;

export const battleStyleSchema = z.enum(["switch", "set"]);

export type BattleStyle = z.infer<typeof battleStyleSchema>;

export const ruleSetSchema = z.object({
  firstEncounter: z.object({
    enabled: z.boolean(),
    scope: encounterScopeSchema,
    severity: ruleIssueSeveritySchema,
    shinyExempts: z.boolean(),
    giftPolicy: giftEncounterPolicySchema,
  }),
  speciesClause: z.object({
    enabled: z.boolean(),
    includeFainted: z.boolean(),
    severity: ruleIssueSeveritySchema,
  }),
  dupesClause: z.object({
    enabled: z.boolean(),
    includeFainted: z.boolean(),
    severity: ruleIssueSeveritySchema,
  }),
  levelCaps: z.object({
    enabled: z.boolean(),
    policy: levelCapPolicySchema,
    rareCandyLimit: z.number().int().nonnegative(),
  }),
  fainting: z.object({
    permadeath: z.boolean(),
    wipeEndsRun: z.boolean(),
  }),
  battle: z.object({
    style: battleStyleSchema,
    allowBattleItems: z.boolean(),
    allowHeldItems: z.boolean(),
    pinchHealingAllowed: z.boolean(),
  }),
  gameSpecific: z.object({
    enabled: z.boolean(),
    contextIds: z.array(z.string().min(1)).default([]),
    notes: z.array(z.string().min(1)).default([]),
  }),
});

export type RuleSet = z.infer<typeof ruleSetSchema>;

export const ruleTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  baseMode: ruleModeSchema,
  gameId: z.string().min(1).optional(),
  rules: ruleSetSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  builtIn: z.boolean().default(false),
});

export type RuleTemplate = z.infer<typeof ruleTemplateSchema>;

export const STANDARD_RULE_SET: RuleSet = {
  firstEncounter: {
    enabled: true,
    scope: "area",
    severity: "warn",
    shinyExempts: true,
    giftPolicy: "free",
  },
  speciesClause: {
    enabled: true,
    includeFainted: false,
    severity: "warn",
  },
  dupesClause: {
    enabled: true,
    includeFainted: true,
    severity: "warn",
  },
  levelCaps: {
    enabled: true,
    policy: "advisory",
    rareCandyLimit: 0,
  },
  fainting: {
    permadeath: true,
    wipeEndsRun: false,
  },
  battle: {
    style: "switch",
    allowBattleItems: true,
    allowHeldItems: true,
    pinchHealingAllowed: true,
  },
  gameSpecific: {
    enabled: true,
    contextIds: [],
    notes: [],
  },
};

export const HARDCORE_RULE_SET: RuleSet = {
  firstEncounter: {
    enabled: true,
    scope: "area",
    severity: "block",
    shinyExempts: true,
    giftPolicy: "count",
  },
  speciesClause: {
    enabled: true,
    includeFainted: false,
    severity: "block",
  },
  dupesClause: {
    enabled: true,
    includeFainted: true,
    severity: "warn",
  },
  levelCaps: {
    enabled: true,
    policy: "strict",
    rareCandyLimit: 0,
  },
  fainting: {
    permadeath: true,
    wipeEndsRun: true,
  },
  battle: {
    style: "set",
    allowBattleItems: false,
    allowHeldItems: true,
    pinchHealingAllowed: false,
  },
  gameSpecific: {
    enabled: true,
    contextIds: [],
    notes: [],
  },
};

export function cloneRuleSet(rules: RuleSet): RuleSet {
  return {
    ...rules,
    firstEncounter: { ...rules.firstEncounter },
    speciesClause: { ...rules.speciesClause },
    dupesClause: { ...rules.dupesClause },
    levelCaps: { ...rules.levelCaps },
    fainting: { ...rules.fainting },
    battle: { ...rules.battle },
    gameSpecific: {
      ...rules.gameSpecific,
      contextIds: [...rules.gameSpecific.contextIds],
      notes: [...rules.gameSpecific.notes],
    },
  };
}

export function getRuleSetPreset(mode: RuleMode): RuleSet {
  if (mode === "hardcore") {
    return cloneRuleSet(HARDCORE_RULE_SET);
  }

  return cloneRuleSet(STANDARD_RULE_SET);
}

const BUILT_IN_TEMPLATE_TIMESTAMP = "2026-01-01T00:00:00.000Z";

function builtInTemplate(
  id: string,
  name: string,
  description: string,
  baseMode: RuleMode,
  rules: RuleSet
): RuleTemplate {
  return {
    id,
    name,
    description,
    baseMode,
    rules,
    createdAt: BUILT_IN_TEMPLATE_TIMESTAMP,
    updatedAt: BUILT_IN_TEMPLATE_TIMESTAMP,
    builtIn: true,
  };
}

function makeHardcoreSoftRules() {
  const rules = getRuleSetPreset("hardcore");
  rules.firstEncounter.severity = "warn";
  rules.speciesClause.severity = "warn";
  rules.dupesClause.severity = "warn";
  rules.fainting.wipeEndsRun = false;
  return rules;
}

function makeBlindFriendlyRules() {
  const rules = getRuleSetPreset("standard");
  rules.levelCaps.policy = "advisory";
  rules.battle.allowBattleItems = true;
  rules.firstEncounter.giftPolicy = "free";
  rules.gameSpecific.notes = ["Pensé pour une découverte sans consulter les tables de rencontres."];
  return rules;
}

function makeGiftlockeRules() {
  const rules = getRuleSetPreset("standard");
  rules.firstEncounter.enabled = false;
  rules.firstEncounter.giftPolicy = "separate";
  rules.speciesClause.severity = "warn";
  rules.gameSpecific.notes = ["N'utiliser que les Pokémon offerts, starters, fossiles ou échanges validés par le joueur."];
  return rules;
}

function makeMonotypeRules() {
  const rules = getRuleSetPreset("standard");
  rules.gameSpecific.notes = ["Choisir un type avant le départ et ne garder que les Pokémon qui respectent ce type après évolution finale."];
  return rules;
}

export const BUILT_IN_RULE_TEMPLATES: RuleTemplate[] = [
  builtInTemplate(
    "builtin-standard",
    "Standard",
    "Nuzlocke souple: premières rencontres et permadeath, avec avertissements plutôt que blocages.",
    "standard",
    getRuleSetPreset("standard")
  ),
  builtInTemplate(
    "builtin-hardcore",
    "Hardcore",
    "Règles strictes: level caps bloquants, mode Set et aucun objet en combat.",
    "hardcore",
    getRuleSetPreset("hardcore")
  ),
  builtInTemplate(
    "builtin-hardcore-soft",
    "Hardcore souple",
    "Base Hardcore, mais les clauses de capture avertissent au lieu de bloquer.",
    "custom",
    makeHardcoreSoftRules()
  ),
  builtInTemplate(
    "builtin-blind-friendly",
    "Blind friendly",
    "Pour découvrir un jeu sans devoir consulter toutes les tables: règles lisibles, overrides faciles.",
    "custom",
    makeBlindFriendlyRules()
  ),
  builtInTemplate(
    "builtin-giftlocke",
    "Giftlocke",
    "Point de départ pour une run centrée sur les Pokémon offerts et rencontres statiques choisies.",
    "custom",
    makeGiftlockeRules()
  ),
  builtInTemplate(
    "builtin-monotype-shell",
    "Monotype shell",
    "Gabarit pour fixer un type maison et documenter les exceptions liées aux évolutions.",
    "custom",
    makeMonotypeRules()
  ),
];

export function getBuiltInRuleTemplates(): RuleTemplate[] {
  return BUILT_IN_RULE_TEMPLATES.map((template) => ({
    ...template,
    rules: cloneRuleSet(template.rules),
  }));
}

export function legacyRulePresetToRuleSet(rules: LegacyRulePreset): RuleSet {
  const base = rules.hardcore ? getRuleSetPreset("hardcore") : getRuleSetPreset("standard");

  return {
    ...base,
    firstEncounter: {
      ...base.firstEncounter,
      shinyExempts: rules.shinyClause,
      giftPolicy: rules.giftClause ? base.firstEncounter.giftPolicy : "free",
    },
    speciesClause: {
      ...base.speciesClause,
      enabled: rules.speciesClause,
    },
    dupesClause: {
      ...base.dupesClause,
      enabled: rules.dupesClause,
    },
    levelCaps: {
      enabled: rules.levelCap,
      policy: rules.hardcore ? "strict" : "advisory",
      rareCandyLimit: rules.rareCandyCap,
    },
    fainting: {
      permadeath: rules.wipeIsPermanent,
      wipeEndsRun: rules.hardcore && rules.wipeIsPermanent,
    },
    battle: {
      style: rules.setMode || rules.hardcore ? "set" : "switch",
      allowBattleItems: rules.battleItems,
      allowHeldItems: true,
      pinchHealingAllowed: rules.pinchHealingAllowed,
    },
  };
}

export const rulePresetSchema = z.union([ruleSetSchema, legacyRulePresetSchema]).transform((rules) => {
  if ("firstEncounter" in rules) {
    return ruleSetSchema.parse(rules);
  }

  return legacyRulePresetToRuleSet(rules);
});

export type RulePreset = RuleSet;

export const routeBossSchema = z.object({
  name: z.string().min(1),
  pokemon: z.string().min(1),
  level: z.number().int().positive(),
  reward: z.string().optional(),
  notes: z.string().optional(),
});

export type RouteBoss = z.infer<typeof routeBossSchema>;

export const routeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  generation: z.number().int().positive(),
  levelCap: z.number().int().nonnegative(),
  bosses: z.array(routeBossSchema).default([]),
  notes: z.string().optional(),
  versionGroups: z.array(z.string()).optional(),
});

export type RouteDefinition = z.infer<typeof routeSchema>;

export const packSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  scope: z.literal("mainline"),
  versionGroups: z.array(z.string().min(1)).default([]),
  rules: rulePresetSchema,
  routes: z.array(routeSchema).default([]),
  updatedAt: z.string().min(1),
});

export type ContentPack = z.infer<typeof packSchema>;

const spriteUrlSchema = z.union([
  z.string().url(),
  z.string().regex(/^\/api\/pokemon\/assets\/(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+\.(?:png|svg|gif|webp)$/i),
]);

export const pokemonSlotSchema = z.object({
  id: z.string().min(1),
  species: z.string().min(1),
  dexNumber: z.number().int().positive(),
  nickname: z.string().optional(),
  level: z.number().int().nonnegative(),
  status: z.enum(["team", "box", "cemetery"]),
  spriteUrl: spriteUrlSchema.optional(),
  types: z.array(z.string().min(1)).default([]),
  caughtAt: z.string().min(1),
  location: z.string().optional(),
  note: z.string().optional(),
  shiny: z.boolean().default(false),
  hp: z.number().int().nonnegative().optional(),
  maxHp: z.number().int().nonnegative().optional(),
});

export type PokemonSlot = z.infer<typeof pokemonSlotSchema>;

export const encounterRecordSchema = z.object({
  id: z.string().min(1),
  routeId: z.string().min(1),
  routeName: z.string().min(1),
  method: z.string().min(1).optional(),
  biome: z.string().min(1).optional(),
  contextId: z.string().min(1).optional(),
  species: z.string().min(1),
  dexNumber: z.number().int().positive(),
  level: z.number().int().nonnegative(),
  outcome: z.enum(["caught", "failed", "escaped", "gift", "fainted"]),
  timestamp: z.string().min(1),
  note: z.string().optional(),
  shiny: z.boolean().default(false),
  spriteUrl: spriteUrlSchema.optional(),
  versionGroup: z.string().min(1),
});

export type EncounterRecord = z.infer<typeof encounterRecordSchema>;

export const badgeRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  leader: z.string().optional(),
  timestamp: z.string().min(1),
  notes: z.string().optional(),
});

export type BadgeRecord = z.infer<typeof badgeRecordSchema>;

export const noteRecordSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  timestamp: z.string().min(1),
});

export type NoteRecord = z.infer<typeof noteRecordSchema>;

export const runStatusSchema = z.enum(["active", "paused", "completed", "failed"]);

export type RunStatus = z.infer<typeof runStatusSchema>;

export const challengeModeSchema = z.enum(["standard", "hardcore"]);

export type ChallengeMode = z.infer<typeof challengeModeSchema>;

export const runCreatedPayloadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  gameTitle: z.string().min(1),
  versionGroup: z.string().min(1),
  generation: z.number().int().positive(),
  rulesetId: z.string().min(1),
  ruleTemplateId: z.string().min(1).optional(),
  challengeMode: challengeModeSchema.optional(),
  ruleMode: ruleModeSchema.optional(),
  rules: ruleSetSchema.optional(),
  routeSeed: z.string().optional(),
  currentLocation: z.string().optional(),
});

export const encounterRecordedPayloadSchema = encounterRecordSchema;

export const pokemonMovedPayloadSchema = z.object({
  pokemon: pokemonSlotSchema,
  target: z.enum(["team", "box", "cemetery"]),
});

export const pokemonFaintedPayloadSchema = z.object({
  pokemonId: z.string().min(1),
  reason: z.string().optional(),
});

export const pokemonUpdatedPayloadSchema = z.object({
  pokemonId: z.string().min(1),
  nickname: z.string().optional(),
  level: z.number().int().nonnegative().optional(),
  note: z.string().optional(),
});

export const badgeAwardedPayloadSchema = badgeRecordSchema;

export const noteAddedPayloadSchema = noteRecordSchema;

export const themeUpdatedPayloadSchema = themeTokensSchema.partial();

export const manualRuleCheckPayloadSchema = z.object({
  id: z.string().min(1),
  ruleId: z.enum(["battle-items", "battle-style", "wipe", "raid", "game-context"]),
  label: z.string().min(1),
  status: z.enum(["passed", "failed", "not-applicable"]),
  timestamp: z.string().min(1),
  note: z.string().optional(),
  contextId: z.string().min(1).optional(),
});

export type ManualRuleCheck = z.infer<typeof manualRuleCheckPayloadSchema>;

export const ruleOverridePayloadSchema = z.object({
  reason: z.string().min(3),
  eventIds: z.array(z.string().min(1)).default([]),
  warnings: z.array(z.string().min(1)).default([]),
  violations: z.array(z.string().min(1)).default([]),
});

export const runRelocatedPayloadSchema = z.object({
  currentRoute: z.string().min(1),
  currentLocation: z.string().optional(),
});

export const runEventSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    type: z.literal("run.created"),
    payload: runCreatedPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    type: z.literal("encounter.recorded"),
    payload: encounterRecordedPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    type: z.literal("pokemon.moved"),
    payload: pokemonMovedPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    type: z.literal("pokemon.fainted"),
    payload: pokemonFaintedPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    type: z.literal("badge.awarded"),
    payload: badgeAwardedPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    type: z.literal("note.added"),
    payload: noteAddedPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    type: z.literal("theme.updated"),
    payload: themeUpdatedPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    type: z.literal("manual-rule.checked"),
    payload: manualRuleCheckPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    type: z.literal("run.relocated"),
    payload: runRelocatedPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    type: z.literal("pokemon.updated"),
    payload: pokemonUpdatedPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    timestamp: z.string().min(1),
    type: z.literal("rule.override"),
    payload: ruleOverridePayloadSchema,
  }),
]);

export type RunEvent = z.infer<typeof runEventSchema>;

export const syncBatchSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  events: z.array(runEventSchema).min(1),
  overrideReason: z.string().min(3).optional(),
});

export type SyncBatch = z.infer<typeof syncBatchSchema>;

export const runSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  gameTitle: z.string().min(1),
  versionGroup: z.string().min(1),
  generation: z.number().int().positive(),
  rulesetId: z.string().min(1),
  ruleTemplateId: z.string().min(1).optional(),
  challengeMode: challengeModeSchema.optional(),
  ruleMode: ruleModeSchema.optional(),
  rules: ruleSetSchema.optional(),
  currentRoute: z.string().optional(),
  currentLocation: z.string().optional(),
  status: runStatusSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  revision: z.number().int().nonnegative(),
  team: z.array(pokemonSlotSchema),
  box: z.array(pokemonSlotSchema),
  cemetery: z.array(pokemonSlotSchema),
  encounters: z.array(encounterRecordSchema),
  badges: z.array(badgeRecordSchema),
  notes: z.array(noteRecordSchema),
  events: z.array(runEventSchema),
  sync: z.object({
    lastSyncedAt: z.string().optional(),
    pending: z.number().int().nonnegative(),
  }),
}).transform((run) => {
  const inferredMode = run.ruleMode ?? run.challengeMode ?? "standard";
  const ruleMode = inferredMode === "custom" ? "custom" : inferredMode;
  const fallbackPreset = ruleMode === "hardcore" ? "hardcore" : "standard";

  return {
    ...run,
    challengeMode: run.challengeMode ?? (fallbackPreset === "hardcore" ? "hardcore" : "standard"),
    ruleMode,
    rules: run.rules ?? getRuleSetPreset(fallbackPreset),
  };
});

export type RunSnapshot = z.infer<typeof runSnapshotSchema>;

export const appStateSchema = z.object({
  ownerName: z.string().min(1),
  theme: themeTokensSchema,
  packs: z.record(z.string(), packSchema),
  ruleTemplates: z.record(z.string(), ruleTemplateSchema).default({}),
  runs: z.record(z.string(), runSnapshotSchema),
  lastOpenRunId: z.string().optional(),
  updatedAt: z.string().min(1),
});

export type AppState = z.infer<typeof appStateSchema>;

export const createRunInputSchema = z.object({
  name: z.string().min(2),
  gameTitle: z.string().min(2),
  versionGroup: z.string().min(1),
  generation: z.number().int().positive(),
  rulesetId: z.string().min(1),
  ruleTemplateId: z.string().min(1).optional(),
  challengeMode: challengeModeSchema.optional(),
  ruleMode: ruleModeSchema.optional(),
  rules: ruleSetSchema.optional(),
  currentLocation: z.string().optional(),
});

export type CreateRunInput = z.infer<typeof createRunInputSchema>;

export const packUpsertSchema = packSchema.omit({ updatedAt: true }).extend({
  updatedAt: z.string().optional(),
});

export type PackUpsertInput = z.infer<typeof packUpsertSchema>;
