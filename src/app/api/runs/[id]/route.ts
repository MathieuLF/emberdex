import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { deleteRun, getRun, getRunByCode, updateRun } from "@/lib/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const run = await getRunByCode(id);

  if (!run) {
    return NextResponse.json({ message: "Partie introuvable." }, { status: 404 });
  }

  return NextResponse.json({ run });
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
  const current = await getRun(id);

  if (!current) {
    return NextResponse.json({ message: "Partie introuvable." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as
    | Partial<{
        name: string;
        gameTitle: string;
        currentLocation: string;
        currentRoute: string;
        status: "active" | "paused" | "completed" | "failed";
      }>
    | null;

  const nextRun = {
    ...current,
    name: body?.name ?? current.name,
    gameTitle: body?.gameTitle ?? current.gameTitle,
    currentLocation: body?.currentLocation ?? current.currentLocation,
    currentRoute: body?.currentRoute ?? current.currentRoute,
    status: body?.status ?? current.status,
    updatedAt: new Date().toISOString(),
  };

  const saved = await updateRun(id, nextRun);
  return NextResponse.json({ run: nextRun, state: saved });
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
  await deleteRun(id);
  return NextResponse.json({ ok: true });
}
