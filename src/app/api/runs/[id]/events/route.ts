import { NextResponse } from "next/server";
import { appendRunEvents, getRunByCode } from "@/lib/store";
import { syncBatchSchema } from "@emberdex/core";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const run = await getRunByCode(id);

  if (!run) {
    return NextResponse.json({ message: "Partie introuvable." }, { status: 404 });
  }

  return NextResponse.json({
    runId: run.id,
    revision: run.revision,
    events: run.events,
    sync: run.sync,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = syncBatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Le contenu de synchronisation est invalide.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const run = await getRunByCode(id);
  if (!run) {
    return NextResponse.json({ message: "Partie introuvable." }, { status: 404 });
  }

  const result = await appendRunEvents(run.id, parsed.data);

  if (!result.ok) {
    if (result.reason === "rule-violation") {
      return NextResponse.json(
        {
          message: "Cette action enfreint les règles actives. Ajoutez une raison pour enregistrer une exception.",
          run: result.run,
          expectedRevision: result.expectedRevision,
          receivedRevision: result.receivedRevision,
          evaluation: result.evaluation,
          requiresOverride: true,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        message:
          result.reason === "missing-run" ? "Partie introuvable." : "Conflit de révision.",
        run: result.run,
        expectedRevision: result.expectedRevision,
        receivedRevision: result.receivedRevision,
      },
      { status: result.reason === "missing-run" ? 404 : 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    run: result.run,
    evaluation: result.evaluation,
  });
}
