import { NextResponse } from "next/server";
import { themeTokensSchema } from "@emberdex/core";
import { getCurrentSession } from "@/lib/auth";
import { readAppState, updateTheme } from "@/lib/store";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const state = await readAppState();
  return NextResponse.json({ theme: state.theme });
}

export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = themeTokensSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Le contenu du thème est invalide.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const state = await updateTheme(parsed.data);
  return NextResponse.json({ ok: true, theme: state.theme });
}
