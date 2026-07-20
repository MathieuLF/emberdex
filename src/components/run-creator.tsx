"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Divider, Input, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

type RunCreatorProps = {
  versionGroups: string[];
  packOptions: Array<{
    id: string;
    name: string;
  }>;
};

const generationOptions = [
  { value: "1", label: "Génération I" },
  { value: "2", label: "Génération II" },
  { value: "3", label: "Génération III" },
  { value: "4", label: "Génération IV" },
  { value: "5", label: "Génération V" },
  { value: "6", label: "Génération VI" },
  { value: "7", label: "Génération VII" },
  { value: "8", label: "Génération VIII" },
  { value: "9", label: "Génération IX" },
];

const sampleGameTitles: Record<string, string> = {
  "red-blue": "Pokémon Red",
  yellow: "Pokémon Yellow",
  "gold-silver": "Pokémon Gold",
  crystal: "Pokémon Crystal",
  "ruby-sapphire": "Pokémon Sapphire",
  emerald: "Pokémon Emerald",
  "firered-leafgreen": "Pokémon LeafGreen",
  "diamond-pearl": "Pokémon Platinum",
  platinum: "Pokémon Platinum",
  "heartgold-soulsilver": "Pokémon SoulSilver",
  "black-white": "Pokémon White",
  "black-2-white-2": "Pokémon White 2",
  "x-y": "Pokémon Y",
  "omega-ruby-alpha-sapphire": "Pokémon Alpha Sapphire",
  "sun-moon": "Pokémon Sun",
  "ultra-sun-ultra-moon": "Pokémon Ultra Moon",
  "lets-go-pikachu-lets-go-eevee": "Pokémon Eevee",
  "sword-shield": "Pokémon Shield",
  "brilliant-diamond-shining-pearl": "Pokémon Brilliant Diamond",
  "legends-arceus": "Pokémon Legends: Arceus",
  "scarlet-violet": "Pokémon Violet",
};

export function RunCreator({ versionGroups, packOptions }: RunCreatorProps) {
  const router = useRouter();
  const [selectedVersionGroup, setSelectedVersionGroup] = useState(
    versionGroups[0] ?? "firered-leafgreen"
  );
  const [selectedPack, setSelectedPack] = useState(packOptions[0]?.id ?? "mainline-core");
  const [name, setName] = useState("Partie 01");
  const [gameTitle, setGameTitle] = useState(
    sampleGameTitles[selectedVersionGroup] ?? "Pokémon LeafGreen"
  );
  const [generation, setGeneration] = useState("3");
  const [location, setLocation] = useState("Route 1");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const packName = useMemo(
    () => packOptions.find((pack) => pack.id === selectedPack)?.name ?? "Mainline Core",
    [packOptions, selectedPack]
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/runs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name,
        gameTitle,
        versionGroup: selectedVersionGroup,
        generation: Number(generation),
        rulesetId: selectedPack,
        currentLocation: location,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message ?? "La création de la partie a échoué.");
      return;
    }

    const payload = (await response.json()) as { run: { id: string } };
    startTransition(() => {
      router.refresh();
      router.push(`/run/${payload.run.id}`);
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[color:var(--line)] bg-[color:var(--surface-elevated)] px-6 py-5">
        <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
          Démarrage rapide
        </p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-[color:var(--text)]">Commencer une nouvelle partie</h3>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Choisissez un groupe de versions et un pack de règles, puis commencez le suivi.
            </p>
          </div>
          <span className="rounded-full border border-[color:var(--line)] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[color:var(--muted)]">
            {packName}
          </span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--muted)]">Nom de la partie</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--muted)]">Jeu</span>
            <Input
              value={gameTitle}
              onChange={(event) => setGameTitle(event.target.value)}
              required
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--muted)]">Groupe de versions</span>
            <Select
              value={selectedVersionGroup}
              onChange={(event) => {
                const next = event.target.value;
                setSelectedVersionGroup(next);
                setGameTitle(sampleGameTitles[next] ?? "Pokémon")
              }}
            >
              {versionGroups.map((versionGroup) => (
                <option key={versionGroup} value={versionGroup}>
                  {versionGroup}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--muted)]">Génération</span>
            <Select value={generation} onChange={(event) => setGeneration(event.target.value)}>
              {generationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--muted)]">Lieu de départ</span>
          <Input value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>

        <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr]">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--muted)]">Pack de règles</span>
            <Select value={selectedPack} onChange={(event) => setSelectedPack(event.target.value)}>
              {packOptions.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.name}
                </option>
              ))}
            </Select>
          </label>
          <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--background-alt)] p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
              Aperçu du pack
            </p>
            <p className="mt-2 text-sm text-[color:var(--text)]">
              Règles principales, routes personnalisées, variantes par version et paramètres du calculateur de dégâts.
            </p>
          </div>
        </div>

        {error ? (
          <p className="rounded-lg border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
            {error}
          </p>
        ) : null}

        <Divider />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm leading-6 text-[color:var(--muted)]">
            Les groupes de versions proviennent du pack de départ. Vous pouvez modifier ou ajouter
            des packs dans l’administration après la connexion.
          </p>
          <Button type="submit" disabled={isPending} className={cn("min-w-44")}>
            {isPending ? "Création..." : "Créer la partie"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
