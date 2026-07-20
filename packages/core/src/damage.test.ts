import { describe, expect, it } from "vitest";
import { calculateDamage, formatDamageRange } from "./damage";

describe("calculateDamage", () => {
  it("applies the major battle multipliers", () => {
    const result = calculateDamage({
      level: 50,
      attack: 120,
      defense: 90,
      power: 80,
      stab: true,
      effectiveness: 2,
      critical: true,
      burn: false,
      category: "special",
      weatherMultiplier: 1.2,
      terrainMultiplier: 1,
      otherMultipliers: [1.1],
    });

    expect(result.min).toBeGreaterThan(0);
    expect(result.max).toBeGreaterThanOrEqual(result.min);
    expect(result.notes).toContain("Same-type attack bonus applied.");
    expect(result.notes).toContain("Type effectiveness x2.");
    expect(result.notes).toContain("Critical hit multiplier applied.");
    expect(formatDamageRange(result)).toMatch(/HP$/);
  });

  it("records immunity cleanly", () => {
    const result = calculateDamage({
      level: 42,
      attack: 100,
      defense: 100,
      power: 60,
      effectiveness: 0,
      category: "special",
    });

    expect(result.min).toBe(0);
    expect(result.max).toBe(0);
    expect(result.notes).toContain("The target is immune.");
  });
});
