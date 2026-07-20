import { NextResponse } from "next/server";
import { getVersionGroups } from "@/lib/pokeapi";

export async function GET() {
  const versionGroups = await getVersionGroups();
  return NextResponse.json({ versionGroups });
}
