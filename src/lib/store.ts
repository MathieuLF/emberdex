import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomInt, randomUUID } from "node:crypto";
import {
  appStateSchema,
  cloneRuleSet,
  createRunInputSchema,
  evaluateRunEventBatch,
  getBuiltInRuleTemplates,
  packSchema,
  ruleTemplateSchema,
  type AppState,
  type ContentPack,
  type CreateRunInput,
  type RuleEvaluation,
  type RuleTemplate,
  type RunEvent,
  type RunSnapshot,
  type SyncBatch,
  syncBatchSchema,
} from "@emberdex/core";
import { applyRunEvents, createDemoRun, createEmptyRun, summarizeRun } from "@emberdex/core";
import { createBlankPack, defaultTheme, starterPack } from "@emberdex/content";
import { getAppStatePath, getDataRoot } from "./paths";
import { mergeTheme } from "./theme";
import { getOwnerDisplayName } from "./auth";
import { getGameById, getGameForRun, getStarterById, type PlayerRunSetup } from "./game-catalog";
import { formatRuleMode } from "./rule-labels";

type AppendEventsResult =
  | { ok: true; run: RunSnapshot; evaluation: RuleEvaluation }
  | {
      ok: false;
      reason: "missing-run" | "revision-conflict" | "rule-violation";
      receivedRevision: number;
      expectedRevision?: number;
      run?: RunSnapshot;
      evaluation?: RuleEvaluation;
    };

export class RuleTemplateMutationError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

let stateQueue: Promise<void> = Promise.resolve();

async function runSerialized<T>(task: () => Promise<T>) {
  let release = () => {};
  const previous = stateQueue;
  stateQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await task();
  } finally {
    release();
  }
}

function timestamp() {
  return new Date().toISOString();
}

function safeTimestampForFile() {
  return timestamp().replace(/[:.]/g, "-");
}

const RUN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeRunCode() {
  return Array.from({ length: 6 }, () =>
    RUN_CODE_ALPHABET[randomInt(RUN_CODE_ALPHABET.length)]
  ).join("");
}

function getRunRuleContext(run: RunSnapshot) {
  const game = getGameForRun(run.gameTitle, run.versionGroup);
  const milestone = game?.milestones?.[run.badges.length] ?? null;

  return {
    levelCap: milestone?.levelCap,
    levelCapName: milestone?.name,
    gameContexts: game?.ruleContexts ?? [],
  };
}

function allRuleTemplatesFromState(state: AppState) {
  return [
    ...getBuiltInRuleTemplates(),
    ...Object.values(state.ruleTemplates),
  ].sort((left, right) => {
    if (left.builtIn !== right.builtIn) {
      return left.builtIn ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function getRuleTemplateFromState(state: AppState, templateId?: string | null) {
  if (!templateId) {
    return null;
  }

  return allRuleTemplatesFromState(state).find((template) => template.id === templateId) ?? null;
}

function createInitialState(): AppState {
  const demoRun = createDemoRun(defaultTheme, starterPack);

  return {
    ownerName: getOwnerDisplayName(),
    theme: defaultTheme,
    packs: {
      [starterPack.id]: starterPack,
    },
    ruleTemplates: {},
    runs: {
      [demoRun.id]: demoRun,
    },
    lastOpenRunId: demoRun.id,
    updatedAt: demoRun.updatedAt,
  };
}

async function ensureDataRoot() {
  await mkdir(getDataRoot(), { recursive: true });
}

async function readStateFile() {
  await ensureDataRoot();

  let raw: string;

  try {
    raw = await readFile(getAppStatePath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    const state = createInitialState();
    await writeAppState(state);
    return state;
  }

  try {
    return appStateSchema.parse(JSON.parse(raw)) as AppState;
  } catch (error) {
    const backupPath = `${getAppStatePath()}.invalid-${safeTimestampForFile()}.json`;
    await writeFile(backupPath, raw, "utf8");
    throw new Error(
      `Le fichier d'état Emberdex est invalide. Une copie a été conservée ici : ${backupPath}. ${error instanceof Error ? error.message : ""}`.trim()
    );
  }
}

export async function readAppState() {
  return readStateFile();
}

export async function writeAppState(state: AppState) {
  const parsed = appStateSchema.parse(state);
  await ensureDataRoot();
  await writeFile(getAppStatePath(), JSON.stringify(parsed, null, 2), "utf8");
  return parsed;
}

export async function mutateAppState(
  mutator: (state: AppState) => Promise<AppState> | AppState
) {
  return runSerialized(async () => {
    const current = await readStateFile();
    const next = await mutator(current);
    const updated = {
      ...next,
      updatedAt: timestamp(),
    };

    return writeAppState(updated);
  });
}

export async function getAppOverview() {
  const state = await readAppState();
  const runs = Object.values(state.runs)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((run) => ({
      ...run,
      summary: summarizeRun(run),
    }));

  return {
    state,
    runs,
    packs: Object.values(state.packs).sort((left, right) =>
      left.name.localeCompare(right.name)
    ),
    ruleTemplates: allRuleTemplatesFromState(state),
  };
}

export async function listRuleTemplates() {
  const state = await readAppState();
  return allRuleTemplatesFromState(state);
}

export async function getRuleTemplate(templateId: string) {
  const state = await readAppState();
  return getRuleTemplateFromState(state, templateId);
}

export async function createRuleTemplate(input: Omit<RuleTemplate, "id" | "createdAt" | "updatedAt" | "builtIn">) {
  const now = timestamp();
  const template = ruleTemplateSchema.parse({
    ...input,
    id: `custom-template-${randomUUID()}`,
    rules: cloneRuleSet(input.rules),
    createdAt: now,
    updatedAt: now,
    builtIn: false,
  });

  const saved = await mutateAppState(async (state) => ({
    ...state,
    ruleTemplates: {
      ...state.ruleTemplates,
      [template.id]: template,
    },
  }));

  return saved.ruleTemplates[template.id];
}

export async function updateRuleTemplate(
  templateId: string,
  patch: Partial<Omit<RuleTemplate, "id" | "createdAt" | "updatedAt" | "builtIn">>
) {
  const saved = await mutateAppState(async (state) => {
    if (getBuiltInRuleTemplates().some((template) => template.id === templateId)) {
      throw new RuleTemplateMutationError("Les templates intégrés ne peuvent pas être modifiés.", 403);
    }

    const current = state.ruleTemplates[templateId];
    if (!current) {
      throw new RuleTemplateMutationError("Template introuvable.", 404);
    }

    const next = ruleTemplateSchema.parse({
      ...current,
      ...patch,
      rules: patch.rules ? cloneRuleSet(patch.rules) : current.rules,
      id: current.id,
      createdAt: current.createdAt,
      updatedAt: timestamp(),
      builtIn: false,
    });

    return {
      ...state,
      ruleTemplates: {
        ...state.ruleTemplates,
        [templateId]: next,
      },
    };
  });

  return saved.ruleTemplates[templateId];
}

export async function deleteRuleTemplate(templateId: string) {
  await mutateAppState(async (state) => {
    if (getBuiltInRuleTemplates().some((template) => template.id === templateId)) {
      throw new RuleTemplateMutationError("Les templates intégrés ne peuvent pas être supprimés.", 403);
    }

    if (!state.ruleTemplates[templateId]) {
      throw new RuleTemplateMutationError("Template introuvable.", 404);
    }

    const ruleTemplates = { ...state.ruleTemplates };
    delete ruleTemplates[templateId];

    return {
      ...state,
      ruleTemplates,
    };
  });

  return { ok: true };
}

export async function listRuns() {
  const state = await readAppState();
  return Object.values(state.runs).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getRun(runId: string) {
  const state = await readAppState();
  return state.runs[runId] ?? null;
}

export async function createRun(input: CreateRunInput) {
  const parsed = createRunInputSchema.parse(input);
  const createdAt = timestamp();
  let createdRunId = "";

  const savedState = await mutateAppState(async (state) => ({
    ...state,
    runs: (() => {
      let id = makeRunCode();
      while (state.runs[id]) {
        id = makeRunCode();
      }

      createdRunId = id;

      const template = getRuleTemplateFromState(state, parsed.ruleTemplateId);
      if (parsed.ruleTemplateId && !template) {
        throw new RuleTemplateMutationError("Template de règles introuvable.", 404);
      }

      const baseRuleMode = parsed.ruleMode ?? template?.baseMode ?? parsed.challengeMode ?? "standard";
      const ruleSnapshot = parsed.rules ?? (template ? cloneRuleSet(template.rules) : undefined);
      const base = createEmptyRun({
        id,
        name: parsed.name,
        gameTitle: parsed.gameTitle,
        versionGroup: parsed.versionGroup,
        generation: parsed.generation,
        rulesetId: parsed.rulesetId,
        ruleTemplateId: parsed.ruleTemplateId,
        challengeMode: parsed.challengeMode,
        ruleMode: baseRuleMode,
        rules: ruleSnapshot,
        currentLocation: parsed.currentLocation,
        createdAt,
      });

      const createdEvent: RunEvent = {
        id: randomUUID(),
        timestamp: createdAt,
        type: "run.created",
        payload: {
          id: base.id,
          name: base.name,
          gameTitle: base.gameTitle,
          versionGroup: base.versionGroup,
          generation: base.generation,
          rulesetId: base.rulesetId,
          ruleTemplateId: base.ruleTemplateId,
          challengeMode: base.challengeMode,
          ruleMode: baseRuleMode,
          rules: base.rules,
          currentLocation: base.currentLocation,
        },
      };

      const run = applyRunEvents(base, [createdEvent]);

      return {
        ...state.runs,
        [run.id]: {
          ...run,
          sync: {
            ...run.sync,
            pending: 0,
            lastSyncedAt: createdAt,
          },
        },
      };
    })(),
    lastOpenRunId: createdRunId,
  }));

  return savedState.runs[createdRunId];
}

export async function createPlayerRun(setup: PlayerRunSetup) {
  const game = getGameById(setup.gameId);
  const starter = getStarterById(setup.starterId);

  if (!game || !starter || !game.starterIds.includes(starter.id)) {
    throw new Error("Invalid player run setup.");
  }

  const run = await createRun({
    name: `Nuzlocke ${game.title.replace(/^Pokémon\s+/, "")}`,
    gameTitle: game.title,
    versionGroup: game.versionGroup,
    generation: game.generation,
    rulesetId: starterPack.id,
    challengeMode: setup.challengeMode,
    ruleMode: setup.ruleMode,
    rules: setup.rules,
    ruleTemplateId: setup.ruleTemplateId,
    currentLocation: game.startingLocation,
  });
  const modeLabel = formatRuleMode(run.ruleMode);

  const selectedAt = timestamp();
  const pokemonId = `starter-${randomUUID()}`;
  const starterSlot = {
    id: pokemonId,
    species: starter.name,
    dexNumber: starter.dexNumber,
    nickname: starter.name,
    level: 5,
    status: "team" as const,
    spriteUrl: starter.spriteUrl,
    types: starter.types,
    caughtAt: selectedAt,
    location: game.startingLocation,
    shiny: false,
  };

  const result = await appendRunEvents(run.id, {
    baseRevision: run.revision,
    events: [
      {
        id: randomUUID(),
        timestamp: selectedAt,
        type: "encounter.recorded",
        payload: {
          id: `starter-encounter-${randomUUID()}`,
          routeId: game.startingLocation.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          routeName: game.startingLocation,
          species: starter.name,
          dexNumber: starter.dexNumber,
          level: 5,
          outcome: "gift",
          timestamp: selectedAt,
          note: "Starter choisi au début de l’aventure.",
          shiny: false,
          spriteUrl: starter.spriteUrl,
          versionGroup: game.versionGroup,
        },
      },
      {
        id: randomUUID(),
        timestamp: selectedAt,
        type: "pokemon.moved",
        payload: {
          pokemon: starterSlot,
          target: "team",
        },
      },
      {
        id: randomUUID(),
        timestamp: selectedAt,
        type: "note.added",
        payload: {
          id: `challenge-${randomUUID()}`,
          text: `Défi ${modeLabel} choisi au départ.`,
          timestamp: selectedAt,
        },
      },
    ],
  });

  if (!result.ok) {
    throw new Error("Could not initialize player run.");
  }

  return result.run;
}

export async function getRunByCode(code: string) {
  const lookupCode = code.trim();
  const normalizedCode = lookupCode.toUpperCase();
  const state = await readAppState();
  return state.runs[lookupCode] ?? state.runs[normalizedCode] ?? null;
}

export async function appendRunEvents(
  runId: string,
  batch: SyncBatch
): Promise<AppendEventsResult> {
  const parsed = syncBatchSchema.parse(batch);

  return runSerialized(async () => {
    const state = await readStateFile();
    const current = state.runs[runId];

    if (!current) {
      return {
        ok: false as const,
        reason: "missing-run" as const,
        receivedRevision: parsed.baseRevision,
      };
    }

    if (current.revision !== parsed.baseRevision) {
      return {
        ok: false as const,
        reason: "revision-conflict" as const,
        receivedRevision: parsed.baseRevision,
        expectedRevision: current.revision,
        run: current,
      };
    }

    const evaluation = evaluateRunEventBatch(current, parsed.events, getRunRuleContext(current));

    if (evaluation.requiresOverride && !parsed.overrideReason) {
      return {
        ok: false as const,
        reason: "rule-violation" as const,
        receivedRevision: parsed.baseRevision,
        expectedRevision: current.revision,
        run: current,
        evaluation,
      };
    }

    const syncedAt = timestamp();
    const eventsToApply: RunEvent[] = parsed.overrideReason && (evaluation.requiresOverride || evaluation.warnings.length > 0)
      ? [
          ...parsed.events,
          {
            id: randomUUID(),
            timestamp: syncedAt,
            type: "rule.override",
            payload: {
              reason: parsed.overrideReason,
              eventIds: parsed.events.map((event) => event.id),
              warnings: evaluation.warnings.map((issue) => issue.message),
              violations: evaluation.violations.map((issue) => issue.message),
            },
          },
        ]
      : parsed.events;

    const nextRun = {
      ...applyRunEvents(current, eventsToApply),
      sync: {
        pending: 0,
        lastSyncedAt: syncedAt,
      },
      updatedAt: syncedAt,
    };

    const nextState = {
      ...state,
      runs: {
        ...state.runs,
        [runId]: nextRun,
      },
      lastOpenRunId: runId,
      updatedAt: syncedAt,
    };

    await writeAppState(nextState);

    return {
      ok: true as const,
      run: nextRun,
      evaluation,
    };
  });
}

export async function updateRun(runId: string, nextRun: RunSnapshot) {
  return mutateAppState(async (state) => ({
    ...state,
    runs: {
      ...state.runs,
      [runId]: nextRun,
    },
    lastOpenRunId: runId,
  }));
}

export async function deleteRun(runId: string) {
  return mutateAppState(async (state) => {
    const runs = { ...state.runs };
    delete runs[runId];

    return {
      ...state,
      runs,
      lastOpenRunId: state.lastOpenRunId === runId ? Object.keys(runs)[0] : state.lastOpenRunId,
    };
  });
}

export async function updateTheme(overrides: Partial<AppState["theme"]>) {
  return mutateAppState(async (state) => ({
    ...state,
    theme: mergeTheme(state.theme, overrides),
  }));
}

export async function upsertPack(pack: ContentPack) {
  const parsed = packSchema.parse(pack);

  return mutateAppState(async (state) => ({
    ...state,
    packs: {
      ...state.packs,
      [parsed.id]: {
        ...parsed,
        updatedAt: timestamp(),
      },
    },
  }));
}

export async function removePack(packId: string) {
  return mutateAppState(async (state) => {
    const packs = { ...state.packs };
    delete packs[packId];
    return {
      ...state,
      packs,
    };
  });
}

export async function ensureStarterRun() {
  const state = await readStateFile();
  if (Object.keys(state.runs).length > 0) {
    return state;
  }

  return writeAppState(createInitialState());
}

export async function importState(input: unknown) {
  const parsed = appStateSchema.parse(input);
  return writeAppState(parsed);
}

export async function exportState() {
  return readAppState();
}

export async function resetToStarterState() {
  return writeAppState(createInitialState());
}

export function buildCustomPackShell(versionGroup: string) {
  return createBlankPack(versionGroup);
}
