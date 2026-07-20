import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getAppOverview, removePack, upsertPack } from "@/lib/store";
import { packSchema } from "@emberdex/core";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const { id } = await context.params;
  const overview = await getAppOverview();
  const pack = overview.packs.find((entry) => entry.id === id);

  if (!pack) {
    return NextResponse.json({ message: "Pack introuvable." }, { status: 404 });
  }

  return NextResponse.json({ pack });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = packSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Le contenu du pack est invalide.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.id !== id) {
    return NextResponse.json({ message: "L’identifiant du pack ne correspond pas." }, { status: 400 });
  }

  const saved = await upsertPack(parsed.data);
  return NextResponse.json({ ok: true, pack: saved.packs[id] });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const { id } = await context.params;
  await removePack(id);
  return NextResponse.json({ ok: true });
}
