import { describe, expect, it } from "vitest";
import { encounterRecordSchema, pokemonSlotSchema } from "./schemas";

describe("core schemas", () => {
  it("accepts local cached PokéAPI asset URLs for Pokémon sprites", () => {
    const spriteUrl = "/api/pokemon/assets/sprites/master/sprites/pokemon/1.png";

    expect(
      pokemonSlotSchema.parse({
        id: "slot-1",
        species: "Bulbasaur",
        dexNumber: 1,
        level: 5,
        status: "team",
        spriteUrl,
        caughtAt: "2026-07-19T00:00:00.000Z",
      }).spriteUrl
    ).toBe(spriteUrl);

    expect(
      encounterRecordSchema.parse({
        id: "encounter-1",
        routeId: "starter",
        routeName: "Starter / Cadeau",
        species: "Bulbasaur",
        dexNumber: 1,
        level: 5,
        outcome: "gift",
        timestamp: "2026-07-19T00:00:00.000Z",
        spriteUrl,
        versionGroup: "firered-leafgreen",
      }).spriteUrl
    ).toBe(spriteUrl);
  });
});
