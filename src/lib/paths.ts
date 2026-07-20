import path from "node:path";

export function getDataRoot() {
  const configuredRoot = process.env.EMBERDEX_DATA_DIR ?? process.env.NUZLOCKE_DATA_DIR;

  return configuredRoot
    ? path.resolve(configuredRoot)
    : path.join(process.cwd(), "data");
}

export function getAppStatePath() {
  return path.join(getDataRoot(), "app-state.json");
}

export function getCacheRoot() {
  return path.join(getDataRoot(), "cache");
}

export function getPokeApiCacheRoot() {
  return path.join(getCacheRoot(), "pokeapi");
}

export function getPokeApiAssetCacheRoot() {
  return path.join(getCacheRoot(), "pokeapi-assets");
}
