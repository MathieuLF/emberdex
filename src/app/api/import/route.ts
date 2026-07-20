import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { importState } from "@/lib/store";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ message: "Le contenu à importer est manquant." }, { status: 400 });
  }

  try {
    const state = await importState(body);
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Le contenu à importer est invalide.",
        detail: error instanceof Error ? error.message : "The file is not an Emberdex state export.",
      },
      { status: 400 }
    );
  }
}
