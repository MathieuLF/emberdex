import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import { Card, Pill } from "@/components/ui";
import { PlayerAccess } from "@/components/player-access";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentSession();

  return (
    <div className="page-reveal space-y-6 max-w-5xl mx-auto py-4">
      {/* 1. Header principal direct */}
      <div className="space-y-2">
        <Pill>Nuzlocke Active Companion</Pill>
        <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-bold tracking-tight text-[color:var(--text)]">
          Tableau de bord Nuzlocke
        </h1>
        <p className="text-sm text-[color:var(--muted)] leading-relaxed">
          Saisissez votre code d'accès pour reprendre votre aventure ou configurez une nouvelle partie ci-dessous.
        </p>
      </div>

      {/* 2. Actions de jeu immédiates */}
      <PlayerAccess />

      {/* 3. Notes techniques et Accès admin en bas */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Rappel des données Pokémon en anglais */}
        <Card className="p-5 flex items-start gap-4">
          <ShieldAlert className="h-5 w-5 text-[color:var(--accent-secondary)] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[color:var(--text)]">Langue des données</h4>
            <p className="text-xs leading-relaxed text-[color:var(--muted)]">
              Les noms des Pokémon, capacités, natures, objets et lieux conservent leurs appellations anglaises d'origine pour assurer la compatibilité avec les calculateurs de combat.
            </p>
          </div>
        </Card>

        {/* Espace admin propriétaire */}
        <Card className="p-5 flex flex-col justify-between gap-4">
          {session ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 h-full">
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[color:var(--accent)]">Espace Propriétaire</h4>
                <p className="text-xs text-[color:var(--muted)] font-medium">Administration connectée. Gérez vos configurations et sauvegardes.</p>
              </div>
              <Link href="/admin" className="inline-flex h-9 items-center justify-center rounded-xl bg-[color:var(--surface-strong)] px-4 text-xs font-semibold text-[color:var(--text)] border border-[color:var(--line)] transition hover:border-[color:var(--accent)]">
                Ouvrir l'administration
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 h-full">
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">Console de gestion</h4>
                <p className="text-xs text-[color:var(--muted)]">Accédez aux configurations globales d'Emberdex.</p>
              </div>
              <Link href="/login" className="inline-flex h-9 items-center justify-center rounded-xl border border-[color:var(--line)] px-4 text-xs font-semibold text-[color:var(--text)] transition hover:border-[color:var(--accent)]">
                Se connecter
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
