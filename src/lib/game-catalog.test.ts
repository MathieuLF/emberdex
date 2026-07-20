import { describe, expect, it } from "vitest";
import { getGameById, resolveBossTeam } from "./game-catalog";

describe("game catalog regressions", () => {
  it("loads Paldea milestones for Scarlet and Violet", () => {
    const scarlet = getGameById("scarlet");
    const violet = getGameById("violet");

    expect(scarlet?.milestones[0]?.name).toBe("Province du Sud (Zone 1)");
    expect(violet?.milestones[0]?.name).toBe("Province du Sud (Zone 1)");
    expect(scarlet?.ruleContexts.length).toBeGreaterThan(0);
    expect(scarlet?.ruleContexts.some((context) => context.category === "raid")).toBe(true);
    expect(scarlet?.ruleContexts.some((context) => context.category === "dlc")).toBe(true);
  });

  it("resolves Striaton against the selected starter type", () => {
    const black = getGameById("black");
    const striaton = black?.milestones.find((milestone) => milestone.name.includes("Striaton"));

    expect(striaton).toBeTruthy();
    expect(resolveBossTeam(striaton!, "grass")?.at(-1)?.species).toBe("Simisear");
    expect(resolveBossTeam(striaton!, "fire")?.at(-1)?.species).toBe("Simipour");
    expect(resolveBossTeam(striaton!, "water")?.at(-1)?.species).toBe("Simisage");
  });

  it("resolves Sword and Shield version-exclusive gyms", () => {
    const sword = getGameById("sword");
    const shield = getGameById("shield");
    const swordSplit = sword?.milestones.find((milestone) => milestone.name.includes("Stow-on-Side"));
    const shieldSplit = shield?.milestones.find((milestone) => milestone.name.includes("Stow-on-Side"));

    expect(resolveBossTeam(swordSplit!, null, "sword")?.at(-1)?.species).toBe("Machamp");
    expect(resolveBossTeam(shieldSplit!, null, "shield")?.at(-1)?.species).toBe("Gengar");
  });
});
