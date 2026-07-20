import { NextResponse } from "next/server";
import { ruleSetSchema } from "@emberdex/core";
import { getCurrentSession } from "@/lib/auth";
import { createRun, getAppOverview } from "@/lib/store";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const overview = await getAppOverview();
  return NextResponse.json({
    ownerName: overview.state.ownerName,
    theme: overview.state.theme,
    runs: overview.runs,
    packs: overview.packs,
    ruleTemplates: overview.ruleTemplates,
    lastOpenRunId: overview.state.lastOpenRunId,
  });
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Accès non autorisé." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        gameTitle?: string;
        versionGroup?: string;
        generation?: number;
        rulesetId?: string;
        ruleTemplateId?: string;
        challengeMode?: "standard" | "hardcore";
        ruleMode?: "standard" | "hardcore" | "custom";
        rules?: unknown;
        currentLocation?: string;
      }
    | null;

  if (!body?.name || !body?.gameTitle || !body?.versionGroup || !body?.generation || !body?.rulesetId) {
    return NextResponse.json({ message: "Des champs obligatoires de la partie sont manquants." }, { status: 400 });
  }

  const parsedRules = body.rules ? ruleSetSchema.safeParse(body.rules) : null;
  if (parsedRules && !parsedRules.success) {
    return NextResponse.json({ message: "Les règles personnalisées sont invalides.", issues: parsedRules.error.flatten() }, { status: 400 });
  }

  let run;

  try {
    run = await createRun({
      name: body.name,
      gameTitle: body.gameTitle,
      versionGroup: body.versionGroup,
      generation: body.generation,
      rulesetId: body.rulesetId,
      ruleTemplateId: body.ruleTemplateId,
      challengeMode: body.challengeMode,
      ruleMode: body.ruleMode,
      rules: parsedRules?.data,
      currentLocation: body.currentLocation,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Impossible de créer cette partie." },
      { status: 400 }
    );
  }

  return NextResponse.json({ run }, { status: 201 });
}
