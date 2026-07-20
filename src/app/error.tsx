"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button, Card, Pill, SectionHeading } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl py-8">
      <Card className="p-7 sm:p-10">
        <div className="space-y-6">
          <Pill>Petit contretemps</Pill>
          <SectionHeading
            eyebrow="La partie est toujours là"
            title="Cette page n’a pas pu s’ouvrir correctement"
            description="Réessayez maintenant. Si le problème persiste, revenez à l’accueil et rouvrez la partie avec son code."
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Réessayer
            </Button>
            <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[color:var(--line)] px-4 py-3 text-sm font-semibold text-[color:var(--text)] transition hover:border-[color:var(--accent)]">
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
