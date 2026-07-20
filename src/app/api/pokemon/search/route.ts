import { NextResponse } from "next/server";
import { searchPokemon } from "@/lib/pokeapi";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const results = await searchPokemon(query);

  return NextResponse.json({ results });
}
