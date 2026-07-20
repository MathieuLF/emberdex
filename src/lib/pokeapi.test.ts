import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPokemon } from "./pokeapi";

describe("PokéAPI ingestion", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "emberdex-pokeapi-"));
    process.env.EMBERDEX_DATA_DIR = tempDir;
  });

  afterEach(async () => {
    delete process.env.EMBERDEX_DATA_DIR;
    vi.unstubAllGlobals();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("maps Pokémon payloads and caches the response", async () => {
    const payload = {
      id: 1,
      name: "bulbasaur",
      species: { name: "bulbasaur" },
      sprites: {
        front_default: "https://example.com/front.png",
        other: {
          "official-artwork": {
            front_default: "https://example.com/artwork.png",
          },
        },
      },
      types: [{ type: { name: "grass" } }, { type: { name: "poison" } }],
      stats: [
        { stat: { name: "hp" }, base_stat: 45 },
        { stat: { name: "attack" }, base_stat: 49 },
      ],
      height: 7,
      weight: 69,
      abilities: [{ ability: { name: "overgrow" } }],
      base_experience: 64,
    };

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    const first = await getPokemon("bulbasaur");
    const second = await getPokemon("bulbasaur");

    expect(first).toMatchObject({
      id: 1,
      name: "bulbasaur",
      species: "bulbasaur",
      spriteUrl: "https://example.com/front.png",
      artworkUrl: "https://example.com/artwork.png",
      types: ["grass", "poison"],
      abilities: ["overgrow"],
      baseExperience: 64,
    });
    expect(first.stats.hp).toBe(45);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});
