import { NextResponse } from "next/server";
import { z } from "zod";
import { ruleModeSchema, ruleSetSchema } from "@emberdex/core";
import { getCurrentSession } from "@/lib/auth";
import { createRuleTemplate, listRuleTemplates } from "@/lib/store";

const ruleTemplateInputSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(3),
  baseMode: ruleModeSchema,
  gameId: z.string().min(1).optional(),
  rules: ruleSetSchema,
});

export async function GET() {
  const templates = await listRuleTemplates();
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Connectez-vous pour enregistrer un template global." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ruleTemplateInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Le template de règles est invalide.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const template = await createRuleTemplate(parsed.data);
  return NextResponse.json({ ok: true, template }, { status: 201 });
}
