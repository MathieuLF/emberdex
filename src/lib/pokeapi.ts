import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPokeApiCacheRoot } from "./paths";
import { cachedPokemonAssetUrl, pokemonArtworkUrl, pokemonSpriteUrl } from "./pokemon-assets";

const API_BASE = "https://pokeapi.co/api/v2";
const DEFAULT_TTL = 1000 * 60 * 60 * 24;

export type PokemonSearchResult = {
  id: number;
  name: string;
  spriteUrl: string | null;
  artworkUrl: string | null;
};

export type PokemonDetail = PokemonSearchResult & {
  species: string;
  types: string[];
  stats: Record<string, number>;
  height: number;
  weight: number;
  abilities: string[];
  baseExperience: number;
};

export type VersionGroupSummary = {
  name: string;
  generation: string;
  versions: string[];
};

export type MoveDetail = {
  name: string;
  type: string;
  damageClass: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
};

export type LocationEncounterPreview = {
  location: string;
  pokemon: string[];
  method: string[];
  versionGroup: string;
};

type NamedResource = {
  name: string;
  url?: string;
};

type PokemonSprites = {
  front_default: string | null;
  other?: {
    "official-artwork"?: {
      front_default?: string | null;
    };
    dream_world?: {
      front_default?: string | null;
    };
  };
};

type PokemonApiRecord = {
  id: number;
  name: string;
  species?: NamedResource | null;
  sprites?: PokemonSprites | null;
  types?: Array<{
    type?: NamedResource | null;
  }> | null;
  stats?: Array<{
    base_stat: number;
    stat?: NamedResource | null;
  }> | null;
  height: number;
  weight: number;
  abilities?: Array<{
    ability?: NamedResource | null;
  }> | null;
  base_experience?: number | null;
};

type VersionGroupApiRecord = {
  name: string;
  generation?: NamedResource | null;
  versions?: NamedResource[] | null;
};

type PokemonListEntry = {
  name: string;
  url: string;
};

type MoveApiRecord = {
  name: string;
  type?: NamedResource | null;
  damage_class?: NamedResource | null;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
};

type TypeApiRecord = {
  damage_relations?: {
    double_damage_to?: NamedResource[] | null;
    half_damage_to?: NamedResource[] | null;
    no_damage_to?: NamedResource[] | null;
  } | null;
};

type LocationAreaApiRecord = {
  name: string;
  pokemon_encounters?: Array<{
    pokemon?: NamedResource | null;
    version_details?: Array<{
      version?: NamedResource | null;
    }> | null;
  }> | null;
};

type CacheEnvelope<T> = {
  updatedAt: string;
  value: T;
};

function bufferKey(key: string) {
  return Buffer.from(key).toString("base64url");
}

async function ensureCacheRoot() {
  await mkdir(getPokeApiCacheRoot(), { recursive: true });
}

async function readCache<T>(key: string) {
  const file = path.join(getPokeApiCacheRoot(), `${bufferKey(key)}.json`);

  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, value: T) {
  await ensureCacheRoot();
  const file = path.join(getPokeApiCacheRoot(), `${bufferKey(key)}.json`);
  const envelope: CacheEnvelope<T> = {
    updatedAt: new Date().toISOString(),
    value,
  };

  await writeFile(file, JSON.stringify(envelope, null, 2), "utf8");
}

async function cachedJson<T>(
  key: string,
  url: string,
  ttlMs = DEFAULT_TTL
): Promise<T> {
  const cached = await readCache<T>(key);
  if (cached) {
    const age = Date.now() - new Date(cached.updatedAt).getTime();
    if (age < ttlMs) {
      return cached.value;
    }
  }

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Emberdex/0.1",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (cached) {
        return cached.value;
      }

      throw new Error(`PokéAPI request failed for ${url}: ${response.status}`);
    }

    const json = (await response.json()) as T;
    await writeCache(key, json);
    return json;
  } catch (error) {
    if (cached) {
      return cached.value;
    }

    throw error;
  }
}

function mapPokemonRecord(record: PokemonApiRecord): PokemonDetail {
  const sprites = record.sprites ?? undefined;
  const artworkUrl = cachedPokemonAssetUrl(
    sprites?.other?.["official-artwork"]?.front_default ??
    sprites?.other?.dream_world?.front_default ??
    sprites?.front_default ??
    null
  );
  const spriteUrl = cachedPokemonAssetUrl(sprites?.front_default ?? artworkUrl);

  return {
    id: record.id,
    name: record.name,
    species: record.species?.name ?? record.name,
    spriteUrl,
    artworkUrl,
    types: (record.types ?? [])
      .map((entry) => entry.type?.name)
      .filter((value): value is string => Boolean(value)),
    stats: (record.stats ?? []).reduce<Record<string, number>>((accumulator, entry) => {
      if (entry.stat?.name) {
        accumulator[entry.stat.name] = entry.base_stat;
      }
      return accumulator;
    }, {}),
    height: record.height,
    weight: record.weight,
    abilities: (record.abilities ?? [])
      .map((entry) => entry.ability?.name)
      .filter((value): value is string => Boolean(value)),
    baseExperience: record.base_experience ?? 0,
  };
}

export async function getVersionGroups(): Promise<VersionGroupSummary[]> {
  const payload = await cachedJson<{
    results: PokemonListEntry[];
  }>(`version-groups`, `${API_BASE}/version-group?limit=200`);

  const versionGroups = await Promise.all(
    payload.results.map(async (entry) => {
      const detail = await cachedJson<VersionGroupApiRecord>(
        `version-group:${entry.name}`,
        entry.url
      );
      return {
        name: detail.name,
        generation: detail.generation?.name ?? "unknown",
        versions: (detail.versions ?? [])
          .map((version) => version.name)
          .filter((value): value is string => Boolean(value)),
      } satisfies VersionGroupSummary;
    })
  );

  return versionGroups.sort((left, right) => left.name.localeCompare(right.name));
}

export async function searchPokemon(query: string): Promise<PokemonSearchResult[]> {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    const payload = await cachedJson<{ results: PokemonListEntry[] }>(
      `pokemon-list`,
      `${API_BASE}/pokemon?limit=2000`
    );

    return payload.results.slice(0, 12).map((entry) => {
      const id = Number(entry.url.split("/").filter(Boolean).at(-1));
      return {
        id,
        name: entry.name,
        spriteUrl: pokemonSpriteUrl(id),
        artworkUrl: pokemonArtworkUrl(id),
      };
    });
  }

  const payload = await cachedJson<{ results: PokemonListEntry[] }>(
    `pokemon-list`,
    `${API_BASE}/pokemon?limit=2000`
  );

  const matches = payload.results
    .filter((entry) => entry.name.includes(normalized))
    .slice(0, 12)
    .map((entry) => {
      const id = Number(entry.url.split("/").filter(Boolean).at(-1));
      return {
        id,
        name: entry.name,
        spriteUrl: pokemonSpriteUrl(id),
        artworkUrl: pokemonArtworkUrl(id),
      };
    });

  if (matches.length > 0) {
    return matches;
  }

  const detail = await getPokemon(normalized);
  return [detail];
}

export async function getPokemon(identifier: string | number): Promise<PokemonDetail> {
  const normalized = typeof identifier === "string" ? identifier.toLowerCase() : identifier;
  const key = `pokemon:${normalized}`;
  const payload = await cachedJson<PokemonApiRecord>(key, `${API_BASE}/pokemon/${normalized}`);
  return mapPokemonRecord(payload);
}

export async function getPokemonById(id: number) {
  return getPokemon(id);
}

/** Flatten a PokeAPI evolution chain node into an array of species names */
function flattenChain(node: { species: { name: string }; evolves_to: unknown[] }): string[] {
  const names = [node.species.name];
  for (const child of node.evolves_to as typeof node[]) {
    names.push(...flattenChain(child));
  }
  return names;
}

/**
 * Returns all species names in the same evolutionary line as `identifier`.
 * Fully cached — first request hits PokeAPI, subsequent ones are instant.
 */
export async function getEvolutionChain(identifier: string): Promise<string[]> {
  const normalized = identifier.toLowerCase().trim();
  const cacheKey = `evo-chain:${normalized}`;

  // Try cache directly
  const cached = await readCache<string[]>(cacheKey);
  if (cached) {
    const age = Date.now() - new Date(cached.updatedAt).getTime();
    if (age < DEFAULT_TTL) return cached.value;
  }

  try {
    // 1. Fetch the species record to get the evolution-chain URL
    const speciesData = await cachedJson<{
      evolution_chain: { url: string };
    }>(`species:${normalized}`, `${API_BASE}/pokemon-species/${normalized}`);

    // 2. Fetch the evolution chain
    const chainData = await cachedJson<{
      chain: { species: { name: string }; evolves_to: unknown[] };
    }>(`chain-url:${speciesData.evolution_chain.url}`, speciesData.evolution_chain.url);

    const names = flattenChain(chainData.chain);
    await writeCache(cacheKey, names);
    return names;
  } catch {
    // Fallback: just return the species itself
    return [normalized];
  }
}


export async function getMove(identifier: string): Promise<MoveDetail> {
  const normalized = identifier.toLowerCase();
  const payload = await cachedJson<MoveApiRecord>(`move:${normalized}`, `${API_BASE}/move/${normalized}`);
  return {
    name: payload.name,
    type: payload.type?.name ?? "normal",
    damageClass: payload.damage_class?.name ?? "status",
    power: payload.power,
    accuracy: payload.accuracy,
    pp: payload.pp,
  };
}

export async function getTypeEffectiveness(
  attackingType: string,
  defendingTypes: string[]
) {
  const normalized = attackingType.toLowerCase();
  const payload = await cachedJson<TypeApiRecord>(`type:${normalized}`, `${API_BASE}/type/${normalized}`);

  const relations = payload.damage_relations ?? {};
  const notes: string[] = [];
  let multiplier = 1;

  const relationMap = [
    { names: relations.double_damage_to ?? [], value: 2 },
    { names: relations.half_damage_to ?? [], value: 0.5 },
    { names: relations.no_damage_to ?? [], value: 0 },
  ];

  for (const defendingType of defendingTypes) {
    let typeMultiplier = 1;
    for (const relation of relationMap) {
      if (relation.names.some((entry) => entry.name === defendingType)) {
        typeMultiplier *= relation.value;
      }
    }
    multiplier *= typeMultiplier;
  }

  if (multiplier === 0) {
    notes.push("The target is immune.");
  } else if (multiplier > 1) {
    notes.push("Super effective.");
  } else if (multiplier < 1) {
    notes.push("Not very effective.");
  }

  return {
    attackingType,
    defendingTypes,
    multiplier,
    notes,
  };
}

export async function getLocationEncounterPreview(
  location: string,
  versionGroup: string
): Promise<LocationEncounterPreview | null> {
  try {
    const payload = await cachedJson<LocationAreaApiRecord>(`location-area:${location}`, `${API_BASE}/location-area/${location}`);

    const pokemon = (payload.pokemon_encounters ?? [])
      .map((encounter) => encounter.pokemon?.name)
      .filter((value): value is string => Boolean(value));
    const method = (payload.pokemon_encounters ?? [])
      .flatMap((encounter) => encounter.version_details ?? [])
      .map((detail) => detail.version?.name)
      .filter((value): value is string => Boolean(value));

    return {
      location: payload.name ?? location,
      pokemon: Array.from(new Set(pokemon)).sort(),
      method: Array.from(new Set(method)).sort(),
      versionGroup,
    };
  } catch {
    return null;
  }
}

export async function getPokemonSpriteUrl(identifier: string | number) {
  const pokemon = await getPokemon(identifier);
  return pokemon.artworkUrl ?? pokemon.spriteUrl;
}
