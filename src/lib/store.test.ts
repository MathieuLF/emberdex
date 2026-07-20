import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRuleSetPreset } from "@emberdex/core";
import {
  appendRunEvents,
  createRuleTemplate,
  createPlayerRun,
  createRun,
  deleteRuleTemplate,
  exportState,
  getAppOverview,
  getRunByCode,
  listRuleTemplates,
  importState,
  readAppState,
  resetToStarterState,
  updateRuleTemplate,
  updateTheme,
} from "./store";
import { getAppStatePath } from "./paths";

describe("file-backed store", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "emberdex-store-"));
    process.env.EMBERDEX_DATA_DIR = tempDir;
  });

  afterEach(async () => {
    delete process.env.EMBERDEX_DATA_DIR;
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates runs and updates the overview", async () => {
    const run = await createRun({
      name: "Yellow Circuit",
      gameTitle: "Pokémon Yellow",
      versionGroup: "yellow",
      generation: 1,
      rulesetId: "mainline-core",
      currentLocation: "Pallet Town",
    });
    const overview = await getAppOverview();

    expect(run.name).toBe("Yellow Circuit");
    expect(run.id).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(run.revision).toBe(1);
    expect(overview.state.lastOpenRunId).toBe(run.id);
    expect(overview.runs[0].id).toBe(run.id);
  });

  it("creates public player runs that can be reopened with their code", async () => {
    const run = await createPlayerRun({
      gameId: "leafgreen",
      starterId: "bulbasaur",
      challengeMode: "standard",
    });
    const reopened = await getRunByCode(run.id.toLowerCase());

    expect(run.id).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(reopened?.id).toBe(run.id);
    expect(reopened?.name).toBe("Nuzlocke LeafGreen");
    expect(reopened?.gameTitle).toBe("Pokémon LeafGreen");
    expect(reopened?.currentLocation).toBe("Pallet Town");
    expect(reopened?.challengeMode).toBe("standard");
    expect(reopened?.ruleMode).toBe("standard");
    expect(reopened?.rules.levelCaps.policy).toBe("advisory");
    expect(reopened?.team).toHaveLength(1);
    expect(reopened?.team[0]?.species).toBe("Bulbasaur");
    expect(reopened?.encounters[0]?.outcome).toBe("gift");
  });

  it("uses the selected game, starter, and challenge mode", async () => {
    const run = await createPlayerRun({
      gameId: "violet",
      starterId: "fuecoco",
      challengeMode: "hardcore",
    });

    expect(run.name).toBe("Nuzlocke Violet");
    expect(run.gameTitle).toBe("Pokémon Violet");
    expect(run.versionGroup).toBe("scarlet-violet");
    expect(run.generation).toBe(9);
    expect(run.currentLocation).toBe("Cabo Poco");
    expect(run.challengeMode).toBe("hardcore");
    expect(run.ruleMode).toBe("hardcore");
    expect(run.rules.levelCaps.policy).toBe("strict");
    expect(run.team[0]?.species).toBe("Fuecoco");
  });

  it("persists custom rule snapshots on player runs", async () => {
    const rules = getRuleSetPreset("hardcore");
    rules.levelCaps.policy = "advisory";
    rules.battle.allowBattleItems = true;

    const run = await createPlayerRun({
      gameId: "black",
      starterId: "snivy",
      challengeMode: "standard",
      ruleMode: "custom",
      rules,
    });

    expect(run.ruleMode).toBe("custom");
    expect(run.rules.levelCaps.policy).toBe("advisory");
    expect(run.rules.battle.allowBattleItems).toBe(true);
  });

  it("migrates state with an empty custom template registry and exposes built-ins", async () => {
    const state = await readAppState();
    const templates = await listRuleTemplates();

    expect(state.ruleTemplates).toEqual({});
    expect(templates.some((template) => template.id === "builtin-standard")).toBe(true);
    expect(templates.some((template) => template.id === "builtin-hardcore")).toBe(true);
  });

  it("creates, renames, and deletes user rule templates", async () => {
    const rules = getRuleSetPreset("standard");
    rules.battle.allowBattleItems = false;

    const created = await createRuleTemplate({
      name: "Sans objets",
      description: "Standard avec objets interdits en combat.",
      baseMode: "custom",
      rules,
    });

    expect(created.builtIn).toBe(false);
    expect(created.rules.battle.allowBattleItems).toBe(false);

    const renamed = await updateRuleTemplate(created.id, {
      name: "Sans objets v2",
      description: "Version renommée.",
    });

    expect(renamed.name).toBe("Sans objets v2");

    await deleteRuleTemplate(created.id);
    const templates = await listRuleTemplates();
    expect(templates.some((template) => template.id === created.id)).toBe(false);
  });

  it("refuses to mutate built-in rule templates", async () => {
    await expect(updateRuleTemplate("builtin-standard", { name: "Mutated" })).rejects.toThrow("intégrés");
    await expect(deleteRuleTemplate("builtin-hardcore")).rejects.toThrow("intégrés");
  });

  it("creates runs from templates with an independent rule snapshot", async () => {
    const rules = getRuleSetPreset("hardcore");
    rules.battle.allowBattleItems = false;
    const template = await createRuleTemplate({
      name: "Snapshot test",
      description: "Template copied into a run.",
      baseMode: "custom",
      rules,
    });

    const run = await createPlayerRun({
      gameId: "leafgreen",
      starterId: "bulbasaur",
      challengeMode: "standard",
      ruleTemplateId: template.id,
    });

    expect(run.ruleMode).toBe("custom");
    expect(run.ruleTemplateId).toBe(template.id);
    expect(run.rules.battle.allowBattleItems).toBe(false);

    const updatedRules = getRuleSetPreset("standard");
    updatedRules.battle.allowBattleItems = true;
    await updateRuleTemplate(template.id, { rules: updatedRules });

    const reopened = await getRunByCode(run.id);
    expect(reopened?.rules.battle.allowBattleItems).toBe(false);
  });

  it("detects stale sync batches", async () => {
    const run = await createRun({
      name: "Crystal Route",
      gameTitle: "Pokémon Crystal",
      versionGroup: "crystal",
      generation: 2,
      rulesetId: "mainline-core",
      currentLocation: "New Bark Town",
    });

    const batch = {
      baseRevision: run.revision,
      events: [
        {
          id: "note-1",
          timestamp: "2026-06-27T12:10:00.000Z",
          type: "note.added" as const,
          payload: {
            id: "note-1",
            text: "Pack a repel for the next route.",
            timestamp: "2026-06-27T12:10:00.000Z",
          },
        },
      ],
    };

    const first = await appendRunEvents(run.id, batch);
    expect(first.ok).toBe(true);

    const second = await appendRunEvents(run.id, batch);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.reason).toBe("revision-conflict");
      expect(second.expectedRevision).toBeGreaterThan(run.revision);
    }
  });

  it("returns soft rule warnings while accepting the event batch", async () => {
    const run = await createRun({
      name: "Warning Route",
      gameTitle: "Pokémon LeafGreen",
      versionGroup: "firered-leafgreen",
      generation: 3,
      rulesetId: "mainline-core",
      currentLocation: "Pallet Town",
    });

    const first = await appendRunEvents(run.id, {
      baseRevision: run.revision,
      events: [
        {
          id: "route-1-first",
          timestamp: "2026-06-27T12:10:00.000Z",
          type: "encounter.recorded" as const,
          payload: {
            id: "route-1-first",
            routeId: "route-1",
            routeName: "Route 1",
            species: "Pidgey",
            dexNumber: 16,
            level: 3,
            outcome: "caught" as const,
            timestamp: "2026-06-27T12:10:00.000Z",
            shiny: false,
            versionGroup: "firered-leafgreen",
          },
        },
      ],
    });
    expect(first.ok).toBe(true);

    if (!first.ok) {
      throw new Error("Expected first encounter to be accepted.");
    }

    const second = await appendRunEvents(run.id, {
      baseRevision: first.run.revision,
      events: [
        {
          id: "route-1-second",
          timestamp: "2026-06-27T12:12:00.000Z",
          type: "encounter.recorded" as const,
          payload: {
            id: "route-1-second",
            routeId: "route-1",
            routeName: "Route 1",
            species: "Rattata",
            dexNumber: 19,
            level: 3,
            outcome: "caught" as const,
            timestamp: "2026-06-27T12:12:00.000Z",
            shiny: false,
            versionGroup: "firered-leafgreen",
          },
        },
      ],
    });

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.evaluation.requiresOverride).toBe(false);
      expect(second.evaluation.warnings.some((issue) => issue.ruleId === "first-encounter")).toBe(true);
      expect(second.run.encounters).toHaveLength(2);
    }
  });

  it("requires an override reason for strict rule violations", async () => {
    const run = await createPlayerRun({
      gameId: "leafgreen",
      starterId: "bulbasaur",
      challengeMode: "hardcore",
    });
    const overleveled = {
      ...run.team[0],
      id: "overcap-pidgey",
      species: "Pidgey",
      dexNumber: 16,
      level: 99,
    };

    const batch = {
      baseRevision: run.revision,
      events: [
        {
          id: "move-overcap",
          timestamp: "2026-06-27T12:10:00.000Z",
          type: "pokemon.moved" as const,
          payload: {
            pokemon: overleveled,
            target: "team" as const,
          },
        },
      ],
    };

    const rejected = await appendRunEvents(run.id, batch);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.reason).toBe("rule-violation");
      expect(rejected.evaluation?.requiresOverride).toBe(true);
    }

    const accepted = await appendRunEvents(run.id, {
      ...batch,
      overrideReason: "Testing a deliberate over-level exception.",
    });

    expect(accepted.ok).toBe(true);
    if (accepted.ok) {
      expect(accepted.run.events.some((event) => event.type === "rule.override")).toBe(true);
    }
  });

  it("exports and restores the vault state", async () => {
    const snapshot = await exportState();
    await updateTheme({ name: "Midnight Ember", accent: "#ff8f5a" });

    const changed = await readAppState();
    expect(changed.theme.name).toBe("Midnight Ember");

    await importState(snapshot);
    const restored = await readAppState();

    expect(restored.theme.name).toBe(snapshot.theme.name);
    expect(Object.keys(restored.runs).length).toBe(Object.keys(snapshot.runs).length);

    await resetToStarterState();
    const reset = await readAppState();
    expect(reset.theme.name).toBe(snapshot.theme.name);
  });

  it("migrates old run exports that only have challengeMode", async () => {
    const snapshot = await exportState();
    const run = Object.values(snapshot.runs)[0];
    const legacy = {
      ...snapshot,
      runs: {
        legacy: {
          ...run,
          id: "legacy",
          challengeMode: "hardcore",
          ruleMode: undefined,
          rules: undefined,
        },
      },
      lastOpenRunId: "legacy",
    };

    await importState(legacy);
    const migrated = await getRunByCode("legacy");
    const migratedState = await readAppState();

    expect(migrated?.ruleMode).toBe("hardcore");
    expect(migrated?.rules.levelCaps.policy).toBe("strict");
    expect(migratedState.ruleTemplates).toEqual({});
  });

  it("backs up invalid state instead of silently resetting it", async () => {
    await writeFile(getAppStatePath(), "{ invalid json", "utf8");

    await expect(readAppState()).rejects.toThrow("fichier d'état Emberdex est invalide");

    const files = await readdir(tempDir);
    expect(files.some((file) => file.includes("app-state.json.invalid-"))).toBe(true);
  });
});
