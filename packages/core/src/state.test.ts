import { describe, expect, it } from "vitest";
import { defaultTheme, starterPack } from "@emberdex/content";
import {
  applyRunEvent,
  createDemoRun,
  createEmptyRun,
  makeBlankNote,
  summarizeRun,
} from "./state";

describe("createDemoRun", () => {
  it("builds a playable snapshot", () => {
    const run = createDemoRun(defaultTheme, starterPack);
    const summary = summarizeRun(run);

    expect(run.team).toHaveLength(2);
    expect(run.encounters.length).toBeGreaterThan(0);
    expect(summary.alive).toBe(2);
    expect(summary.latestLocation).toBe("Viridian Forest");
    expect(summary.lastEvent?.type).toBe("note.added");
  });
});

describe("applyRunEvent", () => {
  it("moves a fainted Pokémon to the cemetery", () => {
    const run = createDemoRun(defaultTheme, starterPack);
    const target = run.team[0];

    const next = applyRunEvent(run, {
      id: "faint-1",
      timestamp: "2026-06-27T13:00:00.000Z",
      type: "pokemon.fainted",
      payload: {
        pokemonId: target.id,
        reason: "Boss wipe",
      },
    });

    expect(next.revision).toBe(run.revision + 1);
    expect(next.team.some((pokemon) => pokemon.id === target.id)).toBe(false);
    expect(next.cemetery.some((pokemon) => pokemon.id === target.id)).toBe(true);
  });

  it("updates a Pokémon's nickname and level", () => {
    const run = createDemoRun(defaultTheme, starterPack);
    const target = run.team[0];

    const next = applyRunEvent(run, {
      id: "update-1",
      timestamp: "2026-06-27T13:00:00.000Z",
      type: "pokemon.updated",
      payload: {
        pokemonId: target.id,
        nickname: "Sprouty",
        level: 20,
      },
    });

    const updated = next.team.find((pokemon) => pokemon.id === target.id);
    expect(updated?.nickname).toBe("Sprouty");
    expect(updated?.level).toBe(20);
    expect(next.revision).toBe(run.revision + 1);
  });
});

describe("createEmptyRun and makeBlankNote", () => {
  it("creates bare state and notes with timestamps", () => {
    const run = createEmptyRun({
      id: "run-1",
      name: "Fresh Start",
      gameTitle: "Pokémon Emerald",
      versionGroup: "emerald",
      generation: 3,
      rulesetId: "mainline-core",
      currentLocation: "Route 101",
      createdAt: "2026-06-27T12:00:00.000Z",
    });
    const note = makeBlankNote("Before the first rival fight.");

    expect(run.team).toHaveLength(0);
    expect(run.currentLocation).toBe("Route 101");
    expect(note.text).toBe("Before the first rival fight.");
    expect(note.timestamp).toContain("T");
  });

  it("keeps legacy challengeMode readable for new Hardcore runs", () => {
    const run = createEmptyRun({
      id: "run-hardcore",
      name: "Fresh Hardcore",
      gameTitle: "Pokémon Emerald",
      versionGroup: "emerald",
      generation: 3,
      rulesetId: "mainline-core",
      ruleMode: "hardcore",
      createdAt: "2026-06-27T12:00:00.000Z",
    });

    expect(run.ruleMode).toBe("hardcore");
    expect(run.challengeMode).toBe("hardcore");
    expect(run.rules.levelCaps.policy).toBe("strict");
  });
});
