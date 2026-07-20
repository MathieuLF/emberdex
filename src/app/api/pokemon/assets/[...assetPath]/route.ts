import { getCachedPokeApiAsset } from "@/lib/pokeapi-asset-cache";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetPath: string[] }> }
) {
  const { assetPath } = await context.params;
  const normalizedPath = assetPath.join("/");

  try {
    const asset = await getCachedPokeApiAsset(normalizedPath);
    return new Response(asset.body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": asset.contentType,
        "X-Emberdex-Asset-Cache": asset.cacheStatus,
      },
    });
  } catch {
    return new Response("Asset introuvable.", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
