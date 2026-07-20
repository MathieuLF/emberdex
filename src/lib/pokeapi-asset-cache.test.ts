import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCachedPokeApiAsset } from "./pokeapi-asset-cache";

describe("PokéAPI asset cache", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "emberdex-assets-"));
    process.env.EMBERDEX_DATA_DIR = tempDir;
  });

  afterEach(async () => {
    delete process.env.EMBERDEX_DATA_DIR;
    vi.unstubAllGlobals();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("stores an asset on first request and serves it from disk afterwards", async () => {
    const body = Buffer.from("png");
    const fetchMock = vi.fn(async () =>
      new Response(body, {
        status: 200,
        headers: { "content-type": "image/png" },
      })
    );

    vi.stubGlobal("fetch", fetchMock);

    const first = await getCachedPokeApiAsset("sprites/master/sprites/pokemon/1.png");
    const second = await getCachedPokeApiAsset("sprites/master/sprites/pokemon/1.png");

    expect(first.cacheStatus).toBe("miss");
    expect(second.cacheStatus).toBe("hit");
    expect(first.body.toString()).toBe("png");
    expect(second.body.toString()).toBe("png");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid paths before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCachedPokeApiAsset("../secret.png")).rejects.toThrow("Invalid PokéAPI asset path.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
