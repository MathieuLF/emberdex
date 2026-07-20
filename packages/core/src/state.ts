import { randomUUID } from "node:crypto";
import {
  badgeRecordSchema,
  type BadgeRecord,
  type ContentPack,
  type EncounterRecord,
  type NoteRecord,
  type PokemonSlot,
  type RuleMode,
  type RuleSet,
  type RunEvent,
  type RunSnapshot,
  type ThemeTokens,
  getRuleSetPreset,
  themeTokensSchema,
} from "./schemas";

function nowIso() {
  return new Date().toISOString();
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  const next = items.filter((entry) => entry.id !== item.id);
  next.push(item);
  return next;
}

function removeById<T extends { id: string }>(items: T[], id: string) {
  return items.filter((entry) => entry.id !== id);
}

function makeEncounterFallback(pokemon: PokemonSlot, routeName: string): EncounterRecord {
  return {
    id: `${pokemon.id}-encounter`,
    routeId: routeName.toLowerCase().replace(/\s+/g, "-"),
    routeName,
    species: pokemon.species,
    dexNumber: pokemon.dexNumber,
    level: pokemon.level,
    outcome: "caught",
    timestamp: pokemon.caughtAt,
    shiny: pokemon.shiny,
    spriteUrl: pokemon.spriteUrl,
    versionGroup: "custom",
  };
}

export function createEmptyRun(input: {
  id: string;
  name: string;
  gameTitle: string;
  versionGroup: string;
  generation: number;
  rulesetId: string;
  ruleTemplateId?: string;
  challengeMode?: "standard" | "hardcore";
  ruleMode?: RuleMode;
  rules?: RuleSet;
  currentLocation?: string;
  createdAt?: string;
}): RunSnapshot {
  const createdAt = input.createdAt ?? nowIso();
  const ruleMode = input.ruleMode ?? input.challengeMode ?? "standard";
  const fallbackPreset = ruleMode === "hardcore" ? "hardcore" : "standard";
  const challengeMode = input.challengeMode ?? (fallbackPreset === "hardcore" ? "hardcore" : "standard");

  return {
    id: input.id,
    name: input.name,
    gameTitle: input.gameTitle,
    versionGroup: input.versionGroup,
    generation: input.generation,
    rulesetId: input.rulesetId,
    ruleTemplateId: input.ruleTemplateId,
    challengeMode,
    ruleMode,
    rules: input.rules ?? getRuleSetPreset(fallbackPreset),
    currentLocation: input.currentLocation,
    status: "active",
    createdAt,
    updatedAt: createdAt,
    revision: 0,
    team: [],
    box: [],
    cemetery: [],
    encounters: [],
    badges: [],
    notes: [],
    events: [],
    sync: {
      pending: 0,
    },
  };
}

export function applyRunEvent(run: RunSnapshot, event: RunEvent): RunSnapshot {
  const timestamp = event.timestamp ?? nowIso();

  switch (event.type) {
    case "run.created": {
      return {
        ...run,
        id: event.payload.id,
        name: event.payload.name,
        gameTitle: event.payload.gameTitle,
        versionGroup: event.payload.versionGroup,
        generation: event.payload.generation,
        rulesetId: event.payload.rulesetId,
        ruleTemplateId: event.payload.ruleTemplateId ?? run.ruleTemplateId,
        challengeMode: event.payload.challengeMode ?? run.challengeMode ?? "standard",
        ruleMode: event.payload.ruleMode ?? run.ruleMode ?? event.payload.challengeMode ?? "standard",
        rules: event.payload.rules ?? run.rules,
        currentLocation: event.payload.currentLocation ?? run.currentLocation,
        status: "active",
        createdAt: run.createdAt ?? timestamp,
        updatedAt: timestamp,
        revision: run.revision + 1,
        sync: { ...run.sync, pending: Math.max(0, run.sync.pending - 1) },
        events: [...run.events, event],
      };
    }
    case "encounter.recorded": {
      const encounter = event.payload;
      return {
        ...run,
        currentRoute: encounter.routeName,
        currentLocation: encounter.routeName,
        updatedAt: timestamp,
        revision: run.revision + 1,
        encounters: upsertById(run.encounters, encounter),
        events: [...run.events, event],
        sync: { ...run.sync, pending: Math.max(0, run.sync.pending - 1) },
      };
    }
    case "pokemon.moved": {
      const pokemon = event.payload.pokemon;
      const target = event.payload.target;
      const cleanedTeam = removeById(run.team, pokemon.id);
      const cleanedBox = removeById(run.box, pokemon.id);
      const cleanedCemetery = removeById(run.cemetery, pokemon.id);
      const placed = { ...pokemon, status: target };
      return {
        ...run,
        updatedAt: timestamp,
        revision: run.revision + 1,
        team: target === "team" ? upsertById(cleanedTeam, placed) : cleanedTeam,
        box: target === "box" ? upsertById(cleanedBox, placed) : cleanedBox,
        cemetery: target === "cemetery" ? upsertById(cleanedCemetery, placed) : cleanedCemetery,
        events: [...run.events, event],
        sync: { ...run.sync, pending: Math.max(0, run.sync.pending - 1) },
      };
    }
    case "pokemon.fainted": {
      const target = [...run.team, ...run.box].find((pokemon) => pokemon.id === event.payload.pokemonId);
      const fainted = target
        ? {
            ...target,
            status: "cemetery" as const,
            note: event.payload.reason
              ? `${target.note ? `${target.note} · ` : ""}K.O. : ${event.payload.reason}`
              : target.note,
          }
        : {
            id: event.payload.pokemonId,
            species: "Unknown",
            dexNumber: 0,
            level: 0,
            status: "cemetery" as const,
            caughtAt: timestamp,
            types: [],
            shiny: false,
            note: event.payload.reason ? `K.O. : ${event.payload.reason}` : undefined,
          };

      return {
        ...run,
        updatedAt: timestamp,
        revision: run.revision + 1,
        team: removeById(run.team, event.payload.pokemonId),
        box: removeById(run.box, event.payload.pokemonId),
        cemetery: upsertById(run.cemetery, fainted),
        events: [...run.events, event],
        sync: { ...run.sync, pending: Math.max(0, run.sync.pending - 1) },
      };
    }
    case "badge.awarded": {
      const badge: BadgeRecord = badgeRecordSchema.parse(event.payload);
      return {
        ...run,
        updatedAt: timestamp,
        revision: run.revision + 1,
        badges: upsertById(run.badges, badge),
        events: [...run.events, event],
        sync: { ...run.sync, pending: Math.max(0, run.sync.pending - 1) },
      };
    }
    case "note.added": {
      const note: NoteRecord = event.payload;
      return {
        ...run,
        updatedAt: timestamp,
        revision: run.revision + 1,
        notes: upsertById(run.notes, note),
        events: [...run.events, event],
        sync: { ...run.sync, pending: Math.max(0, run.sync.pending - 1) },
      };
    }
    case "theme.updated": {
      const theme = themeTokensSchema.partial().parse(event.payload);
      return {
        ...run,
        updatedAt: timestamp,
        revision: run.revision + 1,
        events: [...run.events, event],
        sync: { ...run.sync, pending: Math.max(0, run.sync.pending - 1) },
        // Store run-scoped theme overrides in the notes array so they survive export/import.
        notes: upsertById(run.notes, {
          id: `theme-${timestamp}`,
          text: `Theme override: ${JSON.stringify(theme)}`,
          timestamp,
        }),
      };
    }
    case "manual-rule.checked": {
      const noteText = event.payload.note ? ` Note : ${event.payload.note}` : "";
      return {
        ...run,
        updatedAt: timestamp,
        revision: run.revision + 1,
        events: [...run.events, event],
        sync: { ...run.sync, pending: Math.max(0, run.sync.pending - 1) },
        notes: upsertById(run.notes, {
          id: `manual-rule-${event.payload.id}`,
          text: `Check règle ${event.payload.label} : ${event.payload.status}.${noteText}`,
          timestamp,
        }),
      };
    }
    case "rule.override": {
      const warningText = event.payload.warnings.length
        ? ` Avertissements : ${event.payload.warnings.join(" | ")}.`
        : "";
      const violationText = event.payload.violations.length
        ? ` Infractions : ${event.payload.violations.join(" | ")}.`
        : "";

      return {
        ...run,
        updatedAt: timestamp,
        revision: run.revision + 1,
        events: [...run.events, event],
        sync: { ...run.sync, pending: Math.max(0, run.sync.pending - 1) },
        notes: upsertById(run.notes, {
          id: `rule-override-${event.id}`,
          text: `Exception de règle : ${event.payload.reason}.${violationText}${warningText}`,
          timestamp,
        }),
      };
    }
    case "run.relocated": {
      return {
        ...run,
        currentRoute: event.payload.currentRoute,
        currentLocation: event.payload.currentLocation ?? event.payload.currentRoute,
        updatedAt: timestamp,
        revision: run.revision + 1,
        events: [...run.events, event],
        sync: { ...run.sync, pending: Math.max(0, run.sync.pending - 1) },
      };
    }
    case "pokemon.updated": {
      const { pokemonId, nickname, level, note } = event.payload;
      const updateInList = (list: PokemonSlot[]) =>
        list.map((p) => {
          if (p.id === pokemonId) {
            return {
              ...p,
              ...(nickname !== undefined ? { nickname } : {}),
              ...(level !== undefined ? { level } : {}),
              ...(note !== undefined ? { note } : {}),
            };
          }
          return p;
        });

      return {
        ...run,
        updatedAt: timestamp,
        revision: run.revision + 1,
        team: updateInList(run.team),
        box: updateInList(run.box),
        cemetery: updateInList(run.cemetery),
        events: [...run.events, event],
        sync: { ...run.sync, pending: Math.max(0, run.sync.pending - 1) },
      };
    }
    default: {
      return run;
    }
  }
}

export function applyRunEvents(run: RunSnapshot, events: RunEvent[]) {
  return events.reduce((snapshot, event) => applyRunEvent(snapshot, event), run);
}

export function createDemoRun(
  theme: ThemeTokens,
  pack: ContentPack,
  overrides?: Partial<RunSnapshot>
) {
  const createdAt = overrides?.createdAt ?? "2026-06-27T12:00:00.000Z";
  const base = createEmptyRun({
    id: overrides?.id ?? "ember-leaf",
    name: overrides?.name ?? "Ember Leaf",
    gameTitle: overrides?.gameTitle ?? "Pokémon LeafGreen",
    versionGroup: overrides?.versionGroup ?? "firered-leafgreen",
    generation: overrides?.generation ?? 3,
    rulesetId: overrides?.rulesetId ?? pack.id,
    currentLocation: overrides?.currentLocation ?? "Route 3",
    createdAt,
  });

  const team: PokemonSlot[] = [
    {
      id: "bulbasaur-1",
      species: "Bulbasaur",
      dexNumber: 1,
      nickname: "Sprout",
      level: 16,
      status: "team",
      spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
      types: ["grass", "poison"],
      caughtAt: createdAt,
      location: "Route 1",
      shiny: false,
      hp: 45,
      maxHp: 45,
      note: "Reliable lead and safe pivot.",
    },
    {
      id: "pidgey-16",
      species: "Pidgey",
      dexNumber: 16,
      nickname: "Halo",
      level: 15,
      status: "team",
      spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/16.png",
      types: ["normal", "flying"],
      caughtAt: createdAt,
      location: "Route 2",
      shiny: false,
      hp: 32,
      maxHp: 32,
      note: "Takes over when grass checks appear.",
    },
  ];

  const encounters = [
    makeEncounterFallback(team[0], "Route 1"),
    {
      id: "route-2-pidgey",
      routeId: "route-2",
      routeName: "Route 2",
      species: "Pidgey",
      dexNumber: 16,
      level: 4,
      outcome: "caught" as const,
      timestamp: createdAt,
      shiny: false,
      spriteUrl: team[1].spriteUrl,
      versionGroup: "firered-leafgreen",
    },
    {
      id: "viridian-forest-pikachu",
      routeId: "viridian-forest",
      routeName: "Viridian Forest",
      species: "Pikachu",
      dexNumber: 25,
      level: 5,
      outcome: "failed" as const,
      timestamp: createdAt,
      shiny: false,
      spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
      versionGroup: "firered-leafgreen",
      note: "Lost the static encounter to a duplicate clause rule.",
    },
  ];

  const badges = [
    {
      id: "boulder-badge",
      name: "Boulder Badge",
      leader: "Brock",
      timestamp: createdAt,
      notes: "Level cap now lifted to 15.",
    },
  ];

  const notes = [
    {
      id: "note-1",
      text: "Route 3 still needs boss checks wired into the pack editor.",
      timestamp: createdAt,
    },
  ];

  const events: RunEvent[] = [
    {
      id: "event-run-created",
      timestamp: createdAt,
      type: "run.created",
      payload: {
        id: base.id,
        name: base.name,
        gameTitle: base.gameTitle,
        versionGroup: base.versionGroup,
        generation: base.generation,
        rulesetId: base.rulesetId,
        currentLocation: base.currentLocation,
      },
    },
    ...encounters.map((encounter) => ({
      id: `${encounter.id}-event`,
      timestamp: encounter.timestamp,
      type: "encounter.recorded" as const,
      payload: encounter,
    })),
    ...team.map((pokemon) => ({
      id: `${pokemon.id}-moved`,
      timestamp: pokemon.caughtAt,
      type: "pokemon.moved" as const,
      payload: {
        pokemon,
        target: "team" as const,
      },
    })),
    ...badges.map((badge) => ({
      id: `${badge.id}-event`,
      timestamp: badge.timestamp,
      type: "badge.awarded" as const,
      payload: badge,
    })),
    ...notes.map((note) => ({
      id: `${note.id}-event`,
      timestamp: note.timestamp,
      type: "note.added" as const,
      payload: note,
    })),
  ];

  const run = applyRunEvents(base, events);
  return {
    ...run,
    team,
    encounters,
    badges,
    notes,
    events,
    sync: {
      lastSyncedAt: createdAt,
      pending: 0,
    },
  } satisfies RunSnapshot;
}

export function summarizeRun(run: RunSnapshot) {
  const alive = run.team.length;
  const fallen = run.cemetery.length;
  const boxed = run.box.length;
  const captureRate = run.encounters.length
    ? Math.round(
        (run.encounters.filter((encounter) => encounter.outcome === "caught").length /
          run.encounters.length) *
          100
      )
    : 0;

  return {
    alive,
    fallen,
    boxed,
    captureRate,
    latestLocation: run.currentLocation ?? run.currentRoute ?? "Unknown",
    lastUpdatedAt: run.updatedAt,
    lastEvent: run.events.at(-1) ?? null,
  };
}

export function countBadges(run: RunSnapshot) {
  return run.badges.length;
}

export function makeBlankNote(text: string): NoteRecord {
  return {
    id: randomUUID(),
    text,
    timestamp: nowIso(),
  };
}
