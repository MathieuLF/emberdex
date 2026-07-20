import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPokeApiAssetCacheRoot } from "./paths";
import { isSafePokeApiAssetPath } from "./pokemon-assets";

const POKEAPI_RAW_BASE = "https://raw.githubusercontent.com/PokeAPI";

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function contentTypeFor(assetPath: string) {
  return CONTENT_TYPES[path.extname(assetPath).toLowerCase()] ?? "application/octet-stream";
}

function resolveCachePath(assetPath: string) {
  if (!isSafePokeApiAssetPath(assetPath)) {
    throw new Error("Invalid PokéAPI asset path.");
  }

  const root = path.resolve(getPokeApiAssetCacheRoot());
  const file = path.resolve(root, ...assetPath.split("/"));
  const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  if (!file.startsWith(rootWithSeparator)) {
    throw new Error("Invalid PokéAPI asset path.");
  }

  return file;
}

async function readAsset(file: string) {
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

export async function getCachedPokeApiAsset(assetPath: string) {
  const file = resolveCachePath(assetPath);
  const cached = await readAsset(file);

  if (cached) {
    return {
      body: cached,
      contentType: contentTypeFor(assetPath),
      cacheStatus: "hit" as const,
    };
  }

  const response = await fetch(`${POKEAPI_RAW_BASE}/${assetPath}`, {
    cache: "no-store",
    headers: {
      "user-agent": "Emberdex/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`PokéAPI asset request failed for ${assetPath}: ${response.status}`);
  }

  const body = Buffer.from(await response.arrayBuffer());
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);

  return {
    body,
    contentType: response.headers.get("content-type") ?? contentTypeFor(assetPath),
    cacheStatus: "miss" as const,
  };
}
