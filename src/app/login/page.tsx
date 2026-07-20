import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { Card, Pill, SectionHeading } from "@/components/ui";

export default function LoginPage() {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="p-8">
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Pill>Espace propriétaire</Pill>
          </div>
          <SectionHeading
            eyebrow="Votre Emberdex"
            title="Gardez la main sur toute l’expérience"
            description="Retrouvez vos couleurs, vos règles et toutes les parties enregistrées au même endroit."
          />
          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-5 text-sm leading-6 text-[color:var(--muted)]">
            Cet espace est réservé à la personne qui gère Emberdex. Les joueurs, eux, continuent simplement avec leur code de partie.
          </div>
          <Link
            href="/"
            className="inline-flex rounded-full border border-[color:var(--line)] px-4 py-2 text-sm font-medium text-[color:var(--text)] transition hover:border-[color:var(--accent)]"
          >
            Retour à l’accueil
          </Link>
        </div>
      </Card>

      <Card className="p-8">
        <SectionHeading
          eyebrow="Content de vous revoir"
          title="Ouvrir mon espace"
          description="Entrez votre mot de passe pour retrouver vos réglages."
        />
        <div className="mt-6">
          <LoginForm />
        </div>
      </Card>
    </div>
  );
}
