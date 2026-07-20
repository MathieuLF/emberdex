const POKEAPI_RAW_ORIGIN = "https://raw.githubusercontent.com";
const POKEAPI_RAW_PREFIX = "/PokeAPI/";
const LOCAL_ASSET_PREFIX = "/api/pokemon/assets/";
const ALLOWED_ASSET_EXTENSIONS = new Set([".png", ".svg", ".gif", ".webp"]);

function hasAllowedAssetExtension(assetPath: string) {
  const lower = assetPath.toLowerCase();
  return Array.from(ALLOWED_ASSET_EXTENSIONS).some((extension) => lower.endsWith(extension));
}

export function isSafePokeApiAssetPath(assetPath: string) {
  if (!assetPath || assetPath.includes("\\") || assetPath.includes("..")) {
    return false;
  }

  const segments = assetPath.split("/");
  return (
    segments.length > 0 &&
    segments.every((segment) => /^[a-zA-Z0-9._-]+$/.test(segment)) &&
    hasAllowedAssetExtension(assetPath)
  );
}

export function pokeApiAssetPathFromRemoteUrl(src: string) {
  try {
    const url = new URL(src);
    if (url.origin !== POKEAPI_RAW_ORIGIN || !url.pathname.startsWith(POKEAPI_RAW_PREFIX)) {
      return null;
    }

    const assetPath = decodeURIComponent(url.pathname.slice(POKEAPI_RAW_PREFIX.length));
    return isSafePokeApiAssetPath(assetPath) ? assetPath : null;
  } catch {
    return null;
  }
}

export function localPokeApiAssetUrl(assetPath: string) {
  return `${LOCAL_ASSET_PREFIX}${assetPath}`;
}

export function cachedPokemonAssetUrl(src: string | null | undefined) {
  if (!src) {
    return src ?? null;
  }

  if (src.startsWith(LOCAL_ASSET_PREFIX)) {
    return src;
  }

  const assetPath = pokeApiAssetPathFromRemoteUrl(src);
  return assetPath ? localPokeApiAssetUrl(assetPath) : src;
}

export function rawPokemonSpriteUrl(dexNumberOrName: string | number) {
  return `${POKEAPI_RAW_ORIGIN}/PokeAPI/sprites/master/sprites/pokemon/${dexNumberOrName}.png`;
}

export function rawPokemonArtworkUrl(dexNumber: string | number) {
  return `${POKEAPI_RAW_ORIGIN}/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${dexNumber}.png`;
}

export function pokemonSpriteUrl(dexNumberOrName: string | number) {
  return cachedPokemonAssetUrl(rawPokemonSpriteUrl(dexNumberOrName))!;
}

export function pokemonArtworkUrl(dexNumber: string | number) {
  return cachedPokemonAssetUrl(rawPokemonArtworkUrl(dexNumber))!;
}

export const missingPokemonSpriteUrl = pokemonSpriteUrl(0);
