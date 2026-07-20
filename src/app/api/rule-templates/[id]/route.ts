import { NextResponse } from "next/server";
import { z } from "zod";
import { ruleModeSchema, ruleSetSchema } from "@emberdex/core";
import { getCurrentSession } from "@/lib/auth";
import {
  deleteRuleTemplate,
  getRuleTemplate,
  RuleTemplateMutationError,
  updateRuleTemplate,
} from "@/lib/store";

const ruleTemplatePatchSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().min(3).optional(),
  baseMode: ruleModeSchema.optional(),
  gameId: z.string().min(1).optional(),
  rules: ruleSetSchema.optional(),
});

function mutationErrorResponse(error: unknown) {
  if (error instanceof RuleTemplateMutationError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  return NextResponse.json({ message: "Impossible de modifier ce template." }, { status: 500 });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const template = await getRuleTemplate(id);

  if (!template) {
    return NextResponse.json({ message: "Template introuvable." }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Connectez-vous pour modifier ce template." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = ruleTemplatePatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Le template de règles est invalide.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const template = await updateRuleTemplate(id, parsed.data);
    return NextResponse.json({ ok: true, template });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ message: "Connectez-vous pour supprimer ce template." }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    await deleteRuleTemplate(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
