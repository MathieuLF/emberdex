import {
  getRuleSetPreset,
  legacyRulePresetToRuleSet,
  packSchema,
  ruleSetSchema,
  type ContentPack,
  type EncounterRecord,
  type LegacyRulePreset,
  type PokemonSlot,
  type RuleMode,
  type RuleSet,
  type RunEvent,
  type RunSnapshot,
} from "./schemas";
import { applyRunEvent } from "./state";

export { getRuleSetPreset, legacyRulePresetToRuleSet };

export type RuleIssue = {
  id: string;
  ruleId: string;
  severity: "warning" | "violation";
  title: string;
  message: string;
  explanation: string;
  suggestedAction: string;
  canOverride: boolean;
  relatedRuleLabel: string;
};

export type RuleEvaluation = {
  warnings: RuleIssue[];
  violations: RuleIssue[];
  requiresOverride: boolean;
};

export type RuleEvaluationContext = {
  levelCap?: number;
  levelCapName?: string;
  gameContexts?: RuleContextSummary[];
};

export type RuleDecisionStatus = "allow" | "warn" | "block";

export type RuleDecision = {
  id: string;
  label: string;
  status: RuleDecisionStatus;
  description: string;
};

export type RuleContextSummary = {
  id: string;
  label: string;
  category?: string;
  defaultPolicy?: string;
};

export function validateContentPack(input: unknown): ContentPack {
  return packSchema.parse(input);
}

function emptyEvaluation(): RuleEvaluation {
  return {
    warnings: [],
    violations: [],
    requiresOverride: false,
  };
}

function createIssue(
  ruleId: string,
  title: string,
  message: string,
  severity: "warn" | "block",
  details: Partial<Pick<RuleIssue, "explanation" | "suggestedAction" | "canOverride" | "relatedRuleLabel">> = {}
): RuleIssue {
  return {
    id: `${ruleId}-${severity}`,
    ruleId,
    severity: severity === "block" ? "violation" : "warning",
    title,
    message,
    explanation: details.explanation ?? message,
    suggestedAction: details.suggestedAction ?? "Vérifiez vos règles actives avant d'enregistrer cette action.",
    canOverride: details.canOverride ?? true,
    relatedRuleLabel: details.relatedRuleLabel ?? title,
  };
}

function mergeEvaluations(...evaluations: RuleEvaluation[]): RuleEvaluation {
  const warnings = evaluations.flatMap((evaluation) => evaluation.warnings);
  const violations = evaluations.flatMap((evaluation) => evaluation.violations);

  return {
    warnings,
    violations,
    requiresOverride: violations.length > 0,
  };
}

function issueEvaluation(issues: RuleIssue[]): RuleEvaluation {
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const violations = issues.filter((issue) => issue.severity === "violation");

  return {
    warnings,
    violations,
    requiresOverride: violations.length > 0,
  };
}

function normalizeSpecies(value: string) {
  return value.trim().toLowerCase();
}

function matchingPokemon(
  party: PokemonSlot[],
  species: string,
  includeFainted: boolean
) {
  const normalized = normalizeSpecies(species);
  return party.find((pokemon) => {
    if (!includeFainted && pokemon.status === "cemetery") {
      return false;
    }

    return normalizeSpecies(pokemon.species) === normalized;
  }) ?? null;
}

function findSelectedContext(
  encounter: EncounterRecord,
  rules: RuleSet,
  contexts: RuleContextSummary[] = []
) {
  if (!rules.gameSpecific.enabled || !encounter.contextId) {
    return null;
  }

  if (!rules.gameSpecific.contextIds.includes(encounter.contextId)) {
    return null;
  }

  return contexts.find((context) => context.id === encounter.contextId) ?? null;
}

function encounterConsumesArea(
  encounter: EncounterRecord,
  rules: RuleSet,
  contexts: RuleContextSummary[] = []
) {
  const context = findSelectedContext(encounter, rules, contexts);
  if (context?.defaultPolicy === "ignore" || context?.defaultPolicy === "allow") {
    return false;
  }

  if (encounter.outcome === "escaped") {
    return false;
  }

  if (encounter.outcome === "gift" && rules.firstEncounter.giftPolicy === "free") {
    return false;
  }

  return true;
}

function encounterAreaKey(
  encounter: EncounterRecord,
  rules: RuleSet,
  contexts: RuleContextSummary[] = []
) {
  const routeName = encounter.routeName.trim().toLowerCase();
  const routeId = encounter.routeId.trim().toLowerCase();
  const method = encounter.method?.trim().toLowerCase();
  const biome = encounter.biome?.trim().toLowerCase();
  const context = findSelectedContext(encounter, rules, contexts);
  const base = rules.firstEncounter.scope === "area-method"
    ? `${routeName}:${method || routeId}`
    : rules.firstEncounter.scope === "area-biome"
      ? `${routeName}:${biome || routeId}`
      : rules.firstEncounter.scope === "zone"
        ? routeId
        : routeName;

  if (context?.defaultPolicy === "separate") {
    return `${base}:context:${context.id}`;
  }

  if (encounter.outcome === "gift" && rules.firstEncounter.giftPolicy === "separate") {
    return `${base}:gift`;
  }

  return base;
}

export function resolveRuleMode(mode?: RuleMode | "standard" | "hardcore" | null): RuleMode {
  return mode === "hardcore" || mode === "custom" ? mode : "standard";
}

export function resolveRuleSet(mode?: RuleMode, rules?: RuleSet | LegacyRulePreset | null): RuleSet {
  if (rules) {
    const parsed = ruleSetSchema.safeParse(rules);
    if (parsed.success) {
      return parsed.data;
    }

    return legacyRulePresetToRuleSet(rules as LegacyRulePreset);
  }

  return getRuleSetPreset(resolveRuleMode(mode));
}

export function describeRulePreset(rules: RuleSet | LegacyRulePreset) {
  const resolved = resolveRuleSet("standard", rules);
  const items = [
    resolved.firstEncounter.enabled && `Première rencontre (${resolved.firstEncounter.scope})`,
    resolved.speciesClause.enabled && `Clause des espèces ${resolved.speciesClause.severity === "block" ? "stricte" : "souple"}`,
    resolved.dupesClause.enabled && `Clause des doublons ${resolved.dupesClause.includeFainted ? "avec cimetière" : "vivants seulement"}`,
    resolved.firstEncounter.shinyExempts && "Clause Shiny",
    resolved.levelCaps.enabled && `Level caps ${resolved.levelCaps.policy}`,
    resolved.battle.style === "set" && "Mode Set",
    !resolved.battle.allowBattleItems && "Sans objet en combat",
    resolved.fainting.permadeath && "Permadeath",
    resolved.fainting.wipeEndsRun && "Wipe permanente",
    resolved.battle.pinchHealingAllowed && "Pinch healing",
    resolved.levelCaps.rareCandyLimit > 0 && `${resolved.levelCaps.rareCandyLimit} rare candies`,
    resolved.gameSpecific.enabled && "Contextes spécifiques au jeu",
  ].filter(Boolean) as string[];

  return items;
}

function ruleStatus(enabled: boolean, severity?: "warn" | "block"): RuleDecisionStatus {
  if (!enabled) {
    return "allow";
  }

  return severity === "block" ? "block" : "warn";
}

export function summarizeRuleSetDecisions(
  rules: RuleSet | LegacyRulePreset,
  contexts: RuleContextSummary[] = []
): RuleDecision[] {
  const resolved = resolveRuleSet("standard", rules);
  const selectedContextIds = new Set(resolved.gameSpecific.contextIds);
  const selectedContexts = resolved.gameSpecific.enabled
    ? contexts.filter((context) => selectedContextIds.has(context.id))
    : [];

  return [
    {
      id: "first-encounter",
      label: "Première rencontre",
      status: ruleStatus(resolved.firstEncounter.enabled, resolved.firstEncounter.severity),
      description: resolved.firstEncounter.enabled
        ? `Une seule rencontre compte par ${resolved.firstEncounter.scope}.`
        : "Les rencontres ne consomment pas automatiquement de zone.",
    },
    {
      id: "species-clause",
      label: "Clause des espèces",
      status: ruleStatus(resolved.speciesClause.enabled, resolved.speciesClause.severity),
      description: resolved.speciesClause.enabled
        ? `Vérifie les Pokémon ${resolved.speciesClause.includeFainted ? "déjà enregistrés" : "encore vivants"}.`
        : "Les espèces déjà obtenues sont autorisées.",
    },
    {
      id: "dupes-clause",
      label: "Clause des doublons",
      status: ruleStatus(resolved.dupesClause.enabled, resolved.dupesClause.severity),
      description: resolved.dupesClause.enabled
        ? `Les doublons ${resolved.dupesClause.includeFainted ? "incluent" : "ignorent"} le cimetière.`
        : "Les doublons sont autorisés.",
    },
    {
      id: "gift-policy",
      label: "Pokémon offerts",
      status: resolved.firstEncounter.giftPolicy === "free" ? "allow" : resolved.firstEncounter.severity === "block" ? "block" : "warn",
      description:
        resolved.firstEncounter.giftPolicy === "free"
          ? "Les cadeaux ne consomment pas la zone."
          : resolved.firstEncounter.giftPolicy === "separate"
            ? "Les cadeaux utilisent un compteur séparé du lieu."
            : "Les cadeaux comptent pour leur lieu.",
    },
    {
      id: "shiny-clause",
      label: "Clause Shiny",
      status: resolved.firstEncounter.shinyExempts ? "allow" : "warn",
      description: resolved.firstEncounter.shinyExempts
        ? "Un shiny peut être capturé même si la zone est déjà consommée."
        : "Les shinies suivent les mêmes règles de rencontre que les autres Pokémon.",
    },
    {
      id: "level-cap",
      label: "Level caps",
      status: !resolved.levelCaps.enabled || resolved.levelCaps.policy === "off"
        ? "allow"
        : resolved.levelCaps.policy === "strict" ? "block" : "warn",
      description:
        !resolved.levelCaps.enabled || resolved.levelCaps.policy === "off"
          ? "Aucune limite de niveau n'est appliquée."
          : resolved.levelCaps.policy === "strict"
            ? "Un Pokémon au-dessus du cap bloque l'action jusqu'à override."
            : "Le cap est affiché comme repère, sans blocage.",
    },
    {
      id: "battle-items",
      label: "Objets en combat",
      status: resolved.battle.allowBattleItems ? "allow" : "block",
      description: resolved.battle.allowBattleItems
        ? "Les objets utilisés pendant les combats sont autorisés."
        : "Les objets utilisés pendant les combats sont interdits par la règle.",
    },
    {
      id: "battle-style",
      label: "Style de combat",
      status: resolved.battle.style === "set" ? "block" : "allow",
      description: resolved.battle.style === "set"
        ? "Le mode Set est attendu pour les combats importants."
        : "Le mode Switch est autorisé.",
    },
    {
      id: "wipe",
      label: "Wipe",
      status: resolved.fainting.wipeEndsRun ? "block" : "warn",
      description: resolved.fainting.wipeEndsRun
        ? "Une défaite complète met fin à la run."
        : "Une défaite complète peut être documentée sans terminer automatiquement la run.",
    },
    ...selectedContexts.map((context) => ({
      id: context.id,
      label: context.label,
      status: context.defaultPolicy === "ignore" || context.defaultPolicy === "allow" ? "allow" : "warn" as RuleDecisionStatus,
      description: `Contexte spécifique activé${context.defaultPolicy ? `: ${context.defaultPolicy}` : ""}.`,
    })),
  ];
}

export function summarizePack(pack: ContentPack) {
  return {
    routeCount: pack.routes.length,
    versionCount: pack.versionGroups.length,
    activeRules: describeRulePreset(pack.rules).length,
  };
}

export function evaluateEncounter(
  run: RunSnapshot,
  encounter: EncounterRecord,
  rules: RuleSet = run.rules,
  context: RuleEvaluationContext = {}
): RuleEvaluation {
  const issues: RuleIssue[] = [];
  const shinyExempt = encounter.shiny && rules.firstEncounter.shinyExempts;
  const selectedContext = findSelectedContext(encounter, rules, context.gameContexts);

  if (encounter.contextId && rules.gameSpecific.enabled && !selectedContext) {
    issues.push(createIssue(
      "game-context",
      "Contexte non activé",
      "Cette rencontre utilise un contexte spécifique qui n'est pas activé dans les règles du run.",
      "warn",
      {
        relatedRuleLabel: "Contexte spécifique",
        explanation: "Les contextes sélectionnés servent à documenter les variantes comme raids, safari, DLC ou rencontres statiques.",
        suggestedAction: "Activez ce contexte en Custom ou retirez le contexte de la rencontre.",
      }
    ));
  }

  if (rules.firstEncounter.enabled && !shinyExempt && encounterConsumesArea(encounter, rules, context.gameContexts)) {
    const routeKey = encounterAreaKey(encounter, rules, context.gameContexts);
    const previous = run.encounters.find(
      (entry) => encounterAreaKey(entry, rules, context.gameContexts) === routeKey && encounterConsumesArea(entry, rules, context.gameContexts)
    );

    if (previous) {
      issues.push(createIssue(
        "first-encounter",
        "Zone déjà utilisée",
        `${encounter.routeName} a déjà une rencontre enregistrée (${previous.species}).`,
        rules.firstEncounter.severity,
        {
          relatedRuleLabel: "Première rencontre",
          explanation: "La règle de première rencontre limite chaque zone à une rencontre qui compte pour le run.",
          suggestedAction: "Choisissez une zone disponible, marquez la rencontre comme shiny exempté, ou enregistrez une exception motivée.",
        }
      ));
    }
  }

  if (rules.dupesClause.enabled) {
    const duplicate = matchingPokemon(
      [...run.team, ...run.box, ...run.cemetery],
      encounter.species,
      rules.dupesClause.includeFainted
    );

    if (duplicate) {
      issues.push(createIssue(
        "dupes-clause",
        "Doublon détecté",
        `${encounter.species} est déjà présent dans la collection (${duplicate.status}).`,
        rules.dupesClause.severity,
        {
          relatedRuleLabel: "Clause des doublons",
          explanation: "La clause des doublons évite d'ajouter une espèce déjà obtenue selon le périmètre choisi.",
          suggestedAction: "Relancez la rencontre si votre variante l'autorise, ou forcez l'exception avec une raison claire.",
        }
      ));
    }
  }

  if (rules.speciesClause.enabled) {
    const duplicate = matchingPokemon(
      [...run.team, ...run.box, ...run.cemetery],
      encounter.species,
      rules.speciesClause.includeFainted
    );

    if (duplicate) {
      issues.push(createIssue(
        "species-clause",
        "Clause des espèces",
        `${encounter.species} est déjà présent parmi les Pokémon ${rules.speciesClause.includeFainted ? "enregistrés" : "vivants"}.`,
        rules.speciesClause.severity,
        {
          relatedRuleLabel: "Clause des espèces",
          explanation: "Cette règle empêche de reprendre une espèce déjà disponible dans l'équipe, la boîte ou le cimetière selon le réglage.",
          suggestedAction: "Choisissez une autre rencontre valide, ou documentez pourquoi cette capture reste acceptée.",
        }
      ));
    }
  }

  return issueEvaluation(issues);
}

export function evaluateTeamUpdate(
  _run: RunSnapshot,
  pokemon: PokemonSlot,
  target: "team" | "box" | "cemetery",
  rules: RuleSet,
  context: RuleEvaluationContext = {}
): RuleEvaluation {
  const issues: RuleIssue[] = [];

  if (
    target === "team" &&
    rules.levelCaps.enabled &&
    rules.levelCaps.policy !== "off" &&
    context.levelCap !== undefined &&
    pokemon.level > context.levelCap
  ) {
    const strict = rules.levelCaps.policy === "strict";
    issues.push(createIssue(
      "level-cap",
      "Limite de niveau dépassée",
      `${pokemon.nickname ?? pokemon.species} est niveau ${pokemon.level}, au-dessus de la limite ${context.levelCap}${context.levelCapName ? ` avant ${context.levelCapName}` : ""}.`,
      strict ? "block" : "warn",
      {
        relatedRuleLabel: "Level cap",
        explanation: strict
          ? "Un level cap strict bloque l'ajout ou la mise à jour d'un Pokémon actif au-dessus du prochain cap."
          : "Un level cap advisory laisse l'action passer, mais signale que le Pokémon dépasse le prochain repère.",
        suggestedAction: strict
          ? "Placez ce Pokémon en boîte, baissez le réglage en Custom, ou forcez l'exception avec une raison."
          : "Gardez ce Pokémon hors des combats importants ou ajustez le cap si votre variante le permet.",
      }
    ));
  }

  return issueEvaluation(issues);
}

export function evaluateBadgeProgress(
  run: RunSnapshot,
  rules: RuleSet,
  context: RuleEvaluationContext = {}
): RuleEvaluation {
  if (
    !rules.levelCaps.enabled ||
    rules.levelCaps.policy === "off" ||
    context.levelCap === undefined
  ) {
    return emptyEvaluation();
  }

  const strict = rules.levelCaps.policy === "strict";
  const issues = run.team
    .filter((pokemon) => pokemon.level > context.levelCap!)
    .map((pokemon) => createIssue(
      "boss-cap",
      "Boss cap non respecté",
      `${pokemon.nickname ?? pokemon.species} est niveau ${pokemon.level}, au-dessus de la limite ${context.levelCap}${context.levelCapName ? ` pour ${context.levelCapName}` : ""}.`,
      strict ? "block" : "warn",
      {
        relatedRuleLabel: "Boss cap",
        explanation: strict
          ? "Le boss cap strict vérifie l'équipe active avant de valider l'étape."
          : "Le boss cap advisory signale les dépassements sans empêcher la progression.",
        suggestedAction: strict
          ? "Retirez le Pokémon au-dessus du cap, ou ajoutez une exception motivée si votre run l'autorise."
          : "Documentez le dépassement ou gardez ce Pokémon hors du combat si votre variante le demande.",
      }
    ));

  return issueEvaluation(issues);
}

export function evaluateManualRuleCheck(
  run: RunSnapshot,
  event: Extract<RunEvent, { type: "manual-rule.checked" }>,
  context: RuleEvaluationContext = {}
): RuleEvaluation {
  const check = event.payload;
  if (check.status !== "failed") {
    return emptyEvaluation();
  }

  if (check.ruleId === "battle-items" && !run.rules.battle.allowBattleItems) {
    return issueEvaluation([createIssue(
      "battle-items",
      "Objet utilisé en combat",
      "Cette run interdit les objets utilisés pendant les combats.",
      "block",
      {
        relatedRuleLabel: "Objets en combat",
        explanation: "Le mode Hardcore et certains Customs demandent de ne pas utiliser de potion, rappel ou objet similaire pendant un combat.",
        suggestedAction: "Enregistrez une exception si l'objet a été utilisé volontairement ou corrigez le check.",
      }
    )]);
  }

  if (check.ruleId === "battle-style" && run.rules.battle.style === "set") {
    return issueEvaluation([createIssue(
      "battle-style",
      "Mode Set non respecté",
      "Cette run attend le mode Set pour les combats suivis.",
      "block",
      {
        relatedRuleLabel: "Mode Set",
        explanation: "Le mode Set supprime les changements gratuits après un K.O. adverse.",
        suggestedAction: "Confirmez que le combat était bien en Set ou documentez l'exception.",
      }
    )]);
  }

  if (check.ruleId === "wipe" && run.rules.fainting.wipeEndsRun) {
    return issueEvaluation([createIssue(
      "wipe",
      "Wipe permanente",
      "Cette run considère une défaite complète comme une fin de run.",
      "block",
      {
        relatedRuleLabel: "Wipe",
        explanation: "La règle de wipe permanente demande de marquer la run comme échouée ou de documenter l'exception.",
        suggestedAction: "Terminez la run ou forcez l'exception avec une raison.",
      }
    )]);
  }

  if (check.ruleId === "raid" || check.ruleId === "game-context") {
    const contextLabel = context.gameContexts?.find((entry) => entry.id === check.contextId)?.label ?? check.label;
    return issueEvaluation([createIssue(
      check.ruleId,
      "Contexte spécifique à vérifier",
      `${contextLabel} demande une décision de règle explicite.`,
      "warn",
      {
        relatedRuleLabel: "Contexte spécifique",
        explanation: "Les contextes comme raids, safari, DLC ou rencontres statiques changent souvent le périmètre d'une zone.",
        suggestedAction: "Gardez ce check comme note d'audit ou ajustez vos règles Custom.",
      }
    )]);
  }

  return emptyEvaluation();
}

export function evaluateRunEventBatch(
  run: RunSnapshot,
  events: RunEvent[],
  context: RuleEvaluationContext = {}
): RuleEvaluation {
  let snapshot = run;
  const evaluations: RuleEvaluation[] = [];

  for (const event of events) {
    if (event.type === "encounter.recorded") {
      evaluations.push(evaluateEncounter(snapshot, event.payload, snapshot.rules, context));
    }

    if (event.type === "pokemon.moved") {
      evaluations.push(evaluateTeamUpdate(
        snapshot,
        event.payload.pokemon,
        event.payload.target,
        snapshot.rules,
        context
      ));
    }

    if (event.type === "pokemon.updated") {
      const target = [...snapshot.team, ...snapshot.box, ...snapshot.cemetery].find(
        (pokemon) => pokemon.id === event.payload.pokemonId
      );

      if (target) {
        evaluations.push(evaluateTeamUpdate(
          snapshot,
          { ...target, level: event.payload.level ?? target.level },
          target.status,
          snapshot.rules,
          context
        ));
      }
    }

    if (event.type === "badge.awarded") {
      evaluations.push(evaluateBadgeProgress(snapshot, snapshot.rules, context));
    }

    if (event.type === "manual-rule.checked") {
      evaluations.push(evaluateManualRuleCheck(snapshot, event, context));
    }

    snapshot = applyRunEvent(snapshot, event);
  }

  return mergeEvaluations(...evaluations);
}
