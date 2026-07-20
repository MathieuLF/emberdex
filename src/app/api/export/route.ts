import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { exportState } from "@/lib/store";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const state = await exportState();
  return NextResponse.json(state, {
    headers: {
      "Content-Disposition": 'attachment; filename="emberdex-backup.json"',
    },
  });
}
