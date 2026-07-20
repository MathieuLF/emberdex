import { NextResponse } from "next/server";
import { getEvolutionChain, getLocationEncounterPreview, getPokemon } from "@/lib/pokeapi";

export async function GET(
  request: Request,
  context: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await context.params;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "pokemon";

  if (kind === "encounters") {
    const versionGroup = url.searchParams.get("versionGroup") ?? "firered-leafgreen";
    const preview = await getLocationEncounterPreview(identifier, versionGroup);
    return NextResponse.json({ preview });
  }

  if (kind === "evolution") {
    const chain = await getEvolutionChain(identifier);
    return NextResponse.json({ chain });
  }

  const pokemon = await getPokemon(identifier);
  return NextResponse.json({ pokemon });
}
