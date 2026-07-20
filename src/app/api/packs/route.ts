import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { buildCustomPackShell, getAppOverview, upsertPack } from "@/lib/store";
import { packSchema } from "@emberdex/core";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const overview = await getAppOverview();
  return NextResponse.json({
    packs: overview.packs,
  });
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = packSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Le contenu du pack est invalide.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const saved = await upsertPack(parsed.data);
  return NextResponse.json({ ok: true, pack: saved.packs[parsed.data.id] });
}

export async function PUT(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { versionGroup?: string } | null;
  const versionGroup = body?.versionGroup ?? "firered-leafgreen";
  const shell = buildCustomPackShell(versionGroup);
  const saved = await upsertPack(shell);

  return NextResponse.json({ ok: true, pack: saved.packs[shell.id] }, { status: 201 });
}
