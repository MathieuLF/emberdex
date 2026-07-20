import { NextResponse } from "next/server";
import {
  buildSessionCookie,
  issueSessionToken,
  verifyOwnerPassword,
  getOwnerDisplayName,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";

  if (!verifyOwnerPassword(password)) {
    return NextResponse.json({ message: "Mot de passe incorrect." }, { status: 401 });
  }

  const token = issueSessionToken();
  const response = NextResponse.json({
    ok: true,
    ownerName: getOwnerDisplayName(),
  });

  response.cookies.set(buildSessionCookie(token));
  return response;
}
