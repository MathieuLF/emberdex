import { describe, expect, it } from "vitest";
import {
  describeRulePreset,
  evaluateEncounter,
  evaluateRunEventBatch,
  getRuleSetPreset,
  legacyRulePresetToRuleSet,
  summarizeRuleSetDecisions,
  summarizePack,
  validateContentPack,
} from "./rules";
import { createEmptyRun } from "./state";
import type { EncounterRecord, PokemonSlot, RuleSet, RunEvent } from "./schemas";

const createdAt = "2026-06-27T12:00:00.000Z";

function makeRun(mode: "standard" | "hardcore" | "custom" = "standard", rules?: RuleSet) {
  return createEmptyRun({
    id: "run-1",
    name: "Rules Test",
    gameTitle: "Pokémon LeafGreen",
    versionGroup: "firered-leafgreen",
    generation: 3,
    rulesetId: "mainline-core",
    challengeMode: mode === "hardcore" ? "hardcore" : "standard",
    ruleMode: mode,
    rules,
    currentLocation: "Route 1",
    createdAt,
  });
}

function encounter(overrides: Partial<EncounterRecord> = {}): EncounterRecord {
  return {
    id: "enc-1",
    routeId: "route-1",
    routeName: "Route 1",
    species: "Pidgey",
    dexNumber: 16,
    level: 3,
    outcome: "caught",
    timestamp: createdAt,
    shiny: false,
    versionGroup: "firered-leafgreen",
    ...overrides,
  };
}

function pokemon(overrides: Partial<PokemonSlot> = {}): PokemonSlot {
  return {
    id: "pidgey-1",
    species: "Pidgey",
    dexNumber: 16,
    level: 3,
    status: "team",
    caughtAt: createdAt,
    types: ["normal", "flying"],
    shiny: false,
    ...overrides,
  };
}

const legacyRules = {
  speciesClause: true,
  shinyClause: false,
  dupesClause: true,
  levelCap: true,
  setMode: false,
  battleItems: false,
  giftClause: true,
  wipeIsPermanent: true,
  pinchHealingAllowed: false,
  rareCandyCap: 3,
  hardcore: true,
};

describe("validateContentPack", () => {
  it("accepts legacy packs and normalizes rules", () => {
    const pack = validateContentPack({
      id: "mainline-core",
      name: "Core Mainline Pack",
      description: "Mainline routes and boss checks.",
      scope: "mainline" as const,
      versionGroups: ["firered-leafgreen"],
      rules: legacyRules,
      routes: [
        {
          id: "pallet-town",
          name: "Pallet Town",
          generation: 3,
          levelCap: 5,
          bosses: [{ name: "Rival 1", pokemon: "Pidgey", level: 5 }],
        },
      ],
      updatedAt: createdAt,
    });

    expect(pack.rules.levelCaps.policy).toBe("strict");
    expect(pack.rules.battle.style).toBe("set");
    expect(pack.routes[0].bosses[0].pokemon).toBe("Pidgey");
  });
});

describe("describeRulePreset and summarizePack", () => {
  it("summarizes the active structured rules", () => {
    const summary = describeRulePreset(legacyRulePresetToRuleSet(legacyRules));

    expect(summary).toEqual(expect.arrayContaining([
      "Clause des espèces stricte",
      "Clause des doublons avec cimetière",
      "Level caps strict",
      "Mode Set",
      "Sans objet en combat",
      "3 rare candies",
    ]));
  });

  it("counts routes, versions, and active rules", () => {
    const pack = validateContentPack({
      id: "mainline-core",
      name: "Core Mainline Pack",
      description: "Mainline routes and boss checks.",
      scope: "mainline" as const,
      versionGroups: ["firered-leafgreen"],
      rules: getRuleSetPreset("standard"),
      routes: [{ id: "pallet-town", name: "Pallet Town", generation: 3, levelCap: 5 }],
      updatedAt: createdAt,
    });
    const summary = summarizePack(pack);

    expect(summary.routeCount).toBe(1);
    expect(summary.versionCount).toBe(1);
    expect(summary.activeRules).toBeGreaterThan(4);
  });

  it("summarizes rules by allow, warning, and blocking decisions", () => {
    const decisions = summarizeRuleSetDecisions(getRuleSetPreset("hardcore"));

    expect(decisions.find((item) => item.id === "shiny-clause")?.status).toBe("allow");
    expect(decisions.find((item) => item.id === "dupes-clause")?.status).toBe("warn");
    expect(decisions.find((item) => item.id === "level-cap")?.status).toBe("block");
    expect(decisions.find((item) => item.id === "battle-items")?.description).toContain("interdits");
  });

  it("only includes selected game contexts when game-specific rules are enabled", () => {
    const rules = getRuleSetPreset("standard");
    const contexts = [
      { id: "paldea-tera-raids", label: "Tera Raid", defaultPolicy: "ignore" },
      { id: "paldea-dlc-zones", label: "DLC zones", defaultPolicy: "separate" },
    ];

    rules.gameSpecific.contextIds = ["paldea-tera-raids"];
    expect(summarizeRuleSetDecisions(rules, contexts).some((item) => item.id === "paldea-tera-raids")).toBe(true);

    rules.gameSpecific.enabled = false;
    expect(summarizeRuleSetDecisions(rules, contexts).some((item) => item.id === "paldea-tera-raids")).toBe(false);
  });
});

describe("evaluateEncounter", () => {
  it("warns in Standard when a route is reused", () => {
    const run = {
      ...makeRun("standard"),
      encounters: [encounter({ id: "first" })],
    };

    const evaluation = evaluateEncounter(run, encounter({ id: "second", species: "Rattata", dexNumber: 19 }));

    expect(evaluation.warnings.some((issue) => issue.ruleId === "first-encounter")).toBe(true);
    expect(evaluation.requiresOverride).toBe(false);
  });

  it("requires override in Hardcore when a route is reused", () => {
    const run = {
      ...makeRun("hardcore"),
      encounters: [encounter({ id: "first" })],
    };

    const evaluation = evaluateEncounter(run, encounter({ id: "second", species: "Rattata", dexNumber: 19 }));

    expect(evaluation.violations.some((issue) => issue.ruleId === "first-encounter")).toBe(true);
    expect(evaluation.requiresOverride).toBe(true);
    expect(evaluation.violations[0]?.explanation).toContain("première rencontre");
    expect(evaluation.violations[0]?.suggestedAction).toContain("exception");
  });

  it("keeps shiny encounters exempt from first-encounter violations", () => {
    const run = {
      ...makeRun("hardcore"),
      encounters: [encounter({ id: "first" })],
    };

    const evaluation = evaluateEncounter(run, encounter({ id: "shiny", shiny: true, species: "Rattata", dexNumber: 19 }));

    expect(evaluation.violations.some((issue) => issue.ruleId === "first-encounter")).toBe(false);
  });

  it("keeps gift encounters separate when the custom gift policy asks for it", () => {
    const rules = getRuleSetPreset("hardcore");
    rules.firstEncounter.giftPolicy = "separate";
    const run = {
      ...makeRun("custom", rules),
      encounters: [encounter({ id: "wild", outcome: "caught" })],
    };

    const evaluation = evaluateEncounter(run, encounter({ id: "gift", outcome: "gift", species: "Lapras", dexNumber: 131 }));

    expect(evaluation.violations.some((issue) => issue.ruleId === "first-encounter")).toBe(false);
  });

  it("keeps ignored selected contexts from consuming the area", () => {
    const rules = getRuleSetPreset("hardcore");
    rules.gameSpecific.contextIds = ["galar-max-raid"];
    const run = {
      ...makeRun("custom", rules),
      encounters: [encounter({ id: "wild" })],
    };

    const evaluation = evaluateEncounter(
      run,
      encounter({ id: "raid", species: "Dwebble", dexNumber: 557, contextId: "galar-max-raid" }),
      rules,
      { gameContexts: [{ id: "galar-max-raid", label: "Raid Dynamax", category: "raid", defaultPolicy: "ignore" }] }
    );

    expect(evaluation.violations.some((issue) => issue.ruleId === "first-encounter")).toBe(false);
  });

  it("separates encounters by method when the scope asks for it", () => {
    const rules = getRuleSetPreset("hardcore");
    rules.firstEncounter.scope = "area-method";
    const run = {
      ...makeRun("custom", rules),
      encounters: [encounter({ id: "grass", method: "grass" })],
    };

    const evaluation = evaluateEncounter(
      run,
      encounter({ id: "fish", method: "fishing", species: "Magikarp", dexNumber: 129 }),
      rules
    );

    expect(evaluation.violations.some((issue) => issue.ruleId === "first-encounter")).toBe(false);
  });

  it("does not count fainted Pokémon for Species Clause unless configured", () => {
    const run = {
      ...makeRun("hardcore"),
      cemetery: [pokemon({ status: "cemetery" })],
    };

    const evaluation = evaluateEncounter(run, encounter());

    expect(evaluation.violations.some((issue) => issue.ruleId === "species-clause")).toBe(false);
    expect(evaluation.warnings.some((issue) => issue.ruleId === "dupes-clause")).toBe(true);
  });

  it("lets Custom mode disable first encounter enforcement", () => {
    const rules = getRuleSetPreset("hardcore");
    rules.firstEncounter.enabled = false;
    const run = {
      ...makeRun("custom", rules),
      encounters: [encounter({ id: "first" })],
    };

    const evaluation = evaluateEncounter(run, encounter({ id: "second" }));

    expect(evaluation.warnings.some((issue) => issue.ruleId === "first-encounter")).toBe(false);
    expect(evaluation.violations.some((issue) => issue.ruleId === "first-encounter")).toBe(false);
  });
});

describe("evaluateRunEventBatch", () => {
  it("blocks strict level-cap team updates", () => {
    const run = makeRun("hardcore");
    const events: RunEvent[] = [
      {
        id: "move-1",
        timestamp: createdAt,
        type: "pokemon.moved",
        payload: {
          pokemon: pokemon({ level: 15 }),
          target: "team",
        },
      },
    ];

    const evaluation = evaluateRunEventBatch(run, events, {
      levelCap: 14,
      levelCapName: "Brock",
    });

    expect(evaluation.requiresOverride).toBe(true);
    expect(evaluation.violations.some((issue) => issue.ruleId === "level-cap")).toBe(true);
  });

  it("warns for advisory level-cap team updates without requiring override", () => {
    const run = makeRun("standard");
    const events: RunEvent[] = [
      {
        id: "move-1",
        timestamp: createdAt,
        type: "pokemon.moved",
        payload: {
          pokemon: pokemon({ level: 15 }),
          target: "team",
        },
      },
    ];

    const evaluation = evaluateRunEventBatch(run, events, {
      levelCap: 14,
      levelCapName: "Brock",
    });

    expect(evaluation.requiresOverride).toBe(false);
    expect(evaluation.warnings.some((issue) => issue.ruleId === "level-cap")).toBe(true);
  });

  it("blocks manual battle-item failures when items are banned", () => {
    const run = makeRun("hardcore");
    const events: RunEvent[] = [
      {
        id: "manual-item",
        timestamp: createdAt,
        type: "manual-rule.checked",
        payload: {
          id: "manual-item",
          ruleId: "battle-items",
          label: "Objet utilisé en combat",
          status: "failed",
          timestamp: createdAt,
        },
      },
    ];

    const evaluation = evaluateRunEventBatch(run, events);

    expect(evaluation.requiresOverride).toBe(true);
    expect(evaluation.violations.some((issue) => issue.ruleId === "battle-items")).toBe(true);
  });
});
