import { NextResponse } from "next/server";
import { z } from "zod";
import { ruleSetSchema } from "@emberdex/core";
import { createPlayerRun } from "@/lib/store";

const setupSchema = z.object({
  gameId: z.string().min(1),
  starterId: z.string().min(1),
  challengeMode: z.enum(["standard", "hardcore"]).optional(),
  ruleMode: z.enum(["standard", "hardcore", "custom"]).optional(),
  ruleTemplateId: z.string().min(1).optional(),
  rules: ruleSetSchema.optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Choisissez un jeu, un starter et un style de défi." },
      { status: 400 }
    );
  }

  let run;

  try {
    const requestedRuleMode = parsed.data.ruleMode ?? (parsed.data.ruleTemplateId ? undefined : parsed.data.challengeMode);
    run = await createPlayerRun({
      ...parsed.data,
      challengeMode: requestedRuleMode === "hardcore" ? "hardcore" : parsed.data.challengeMode ?? "standard",
      ruleMode: requestedRuleMode,
      ruleTemplateId: parsed.data.ruleTemplateId,
      rules: parsed.data.rules,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Cette combinaison de jeu et de starter n’est pas disponible." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      run,
      code: run.id,
    },
    { status: 201 }
  );
}
