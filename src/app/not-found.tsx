import Link from "next/link";
import { Card, Pill, SectionHeading } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-8">
        <div className="space-y-6">
          <Pill>Erreur 404</Pill>
          <SectionHeading
            eyebrow="Page introuvable"
            title="Cette sauvegarde ou cette page n’existe pas"
            description="Vérifiez le code de partie ou revenez à l’accueil pour créer ou reprendre une sauvegarde."
          />
          <Link
            href="/"
            className="inline-flex rounded-lg border border-[color:var(--line)] px-4 py-3 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)]"
          >
            Retour à l’accueil
          </Link>
        </div>
      </Card>
    </div>
  );
}
