import { describe, expect, it } from "vitest";
import {
  cachedPokemonAssetUrl,
  isSafePokeApiAssetPath,
  localPokeApiAssetUrl,
  pokeApiAssetPathFromRemoteUrl,
  pokemonArtworkUrl,
} from "./pokemon-assets";

describe("PokéAPI asset URLs", () => {
  it("rewrites official sprite URLs to the local asset proxy", () => {
    const remote =
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png";

    expect(pokeApiAssetPathFromRemoteUrl(remote)).toBe("sprites/master/sprites/pokemon/25.png");
    expect(cachedPokemonAssetUrl(remote)).toBe("/api/pokemon/assets/sprites/master/sprites/pokemon/25.png");
  });

  it("keeps unrelated URLs unchanged", () => {
    const remote = "https://example.com/pokemon/25.png";

    expect(cachedPokemonAssetUrl(remote)).toBe(remote);
  });

  it("rejects unsafe asset paths", () => {
    expect(isSafePokeApiAssetPath("sprites/master/sprites/pokemon/25.png")).toBe(true);
    expect(isSafePokeApiAssetPath("../secret.png")).toBe(false);
    expect(isSafePokeApiAssetPath("sprites/master/sprites/pokemon/25.exe")).toBe(false);
  });

  it("builds stable local artwork paths", () => {
    expect(pokemonArtworkUrl(1)).toBe(
      localPokeApiAssetUrl("sprites/master/sprites/pokemon/other/official-artwork/1.png")
    );
  });
});
