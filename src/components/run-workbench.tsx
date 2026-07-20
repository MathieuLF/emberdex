"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  calculateDamage,
  formatDamageRange,
  type DamageResult,
  type RunEvent,
  type RunSnapshot,
  type PokemonSlot,
  type ContentPack,
  type RouteDefinition,
  type RouteBoss,
  type RuleEvaluation,
} from "@emberdex/core";
import { type GameProfile, type ProgressMilestone } from "@/lib/game-catalog";
import { postJson } from "@/lib/client-api";
import { cachedPokemonAssetUrl, missingPokemonSpriteUrl } from "@/lib/pokemon-assets";
import { Button, Card, Input, SectionHeading, Select, StatCard, Textarea, Divider, Pill } from "@/components/ui";
import {
  Check,
  Loader2,
  RefreshCw,
  Swords,
  Zap,
  Skull,
  Edit2,
  ArrowRight,
  ArrowLeftRight,
  Compass,
  Trophy,
  Plus,
  X,
  FileText,
  AlertTriangle,
  Shield,
  Search,
} from "lucide-react";
import { Portal } from "./portal";

type RunWorkbenchProps = {
  run: RunSnapshot;
  pack: ContentPack | null;
  gameProfile: GameProfile | null;
  activeRulesCount: number;
};

type PokemonLookup = {
  id: number;
  name: string;
  spriteUrl: string | null;
  artworkUrl: string | null;
  species?: string;
  types?: string[];
  stats?: Record<string, number>;
};

type RuleOverrideError = Error & {
  status?: number;
  payload?: {
    requiresOverride?: boolean;
    evaluation?: RuleEvaluation;
    message?: string;
  } | null;
};

type PendingRuleOverride = {
  events: RunEvent[];
  evaluation: RuleEvaluation;
  resolve: () => void;
  reject: (error: Error) => void;
};

type RunEventsResponse = {
  ok: true;
  run: RunSnapshot;
  evaluation?: RuleEvaluation;
};

type RuleOverrideEvent = Extract<RunEvent, { type: "rule.override" }>;

const outcomeOptions = [
  { value: "caught", label: "Capturé" },
  { value: "failed", label: "Échoué" },
  { value: "escaped", label: "En fuite" },
  { value: "gift", label: "Reçu" },
  { value: "fainted", label: "Mis K.O." },
] as const;

const typeChart: Record<string, Record<string, number>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5, steel: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

const typeLabels: Record<string, string> = {
  normal: "Normal",
  fire: "Feu",
  water: "Eau",
  electric: "Électrik",
  grass: "Plante",
  ice: "Glace",
  fighting: "Combat",
  poison: "Poison",
  ground: "Sol",
  flying: "Vol",
  psychic: "Psy",
  bug: "Insecte",
  rock: "Roche",
  ghost: "Spectre",
  dragon: "Dragon",
  dark: "Ténèbres",
  steel: "Acier",
  fairy: "Fée",
};

function formatDate(value?: string) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDamageNote(note: string) {
  const translations: Record<string, string> = {
    "Same-type attack bonus applied.": "Bonus d’attaque de même type appliqué.",
    "Critical hit multiplier applied.": "Multiplicateur de coup critique appliqué.",
    "Physical burn penalty applied.": "Pénalité de brûlure physique appliquée.",
    "The target is immune.": "La cible est immunisée.",
  };

  if (note.startsWith("Type effectiveness x")) {
    return note.replace("Type effectiveness", "Efficacité du type");
  }

  return translations[note] ?? note;
}

function slugRoute(route: string) {
  return route
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildPokemonSlot(lookup: PokemonLookup, routeName: string, level: number, shiny: boolean, nickname?: string) {
  const species = capitalize(lookup.name);
  return {
    id: `${lookup.name}-${Date.now()}`,
    species,
    dexNumber: lookup.id,
    nickname: nickname ? capitalize(nickname) : species,
    level,
    status: "team" as const,
    spriteUrl: lookup.artworkUrl ?? lookup.spriteUrl ?? undefined,
    types: lookup.types ?? [],
    caughtAt: new Date().toISOString(),
    location: routeName,
    shiny,
    hp: lookup.stats?.hp,
    maxHp: lookup.stats?.hp,
  };
}

function SaveStatus({ run }: { run: RunSnapshot }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard?.writeText(run.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)] font-semibold">
          Sauvegarde
        </p>
        <p className="text-xs text-[color:var(--text)]">
          {run.sync.pending > 0 ? `${run.sync.pending} modification${run.sync.pending > 1 ? "s" : ""} en attente` : "Tout est synchronisé"}
        </p>
      </div>
      <div className="flex gap-1.5 items-center">
        {run.sync.pending > 0 ? (
          <RefreshCw className="h-3.5 w-3.5 text-[color:var(--warning)] animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5 text-[color:var(--success)]" />
        )}
        <Button type="button" variant="ghost" className="h-7 px-2 text-[10px] font-semibold" onClick={() => void copyCode()}>
          {copied ? "Copié !" : "Copier ID"}
        </Button>
      </div>
    </div>
  );
}

function renderEventDescription(event: RunEvent, party: PokemonSlot[]) {
  switch (event.type) {
    case "encounter.recorded": {
      const payload = event.payload;
      const speciesName = capitalize(payload.species ?? "Pokémon inconnu");
      return payload.outcome === "gift"
        ? `${speciesName} choisi comme starter à ${payload.routeName}`
        : `${speciesName} rencontré sur ${payload.routeName}`;
    }
    case "badge.awarded":
      return `Étape validée : ${event.payload.name}`;
    case "note.added":
      return event.payload.text;
    case "pokemon.moved": {
      const dest = { team: "l'équipe", box: "la boîte", cemetery: "le cimetière" }[event.payload.target as "team" | "box" | "cemetery"];
      const movedName = capitalize(event.payload.pokemon.nickname ?? event.payload.pokemon.species ?? "Pokémon");
      return `${movedName} déplacé vers ${dest}`;
    }
    case "pokemon.fainted": {
      const target = party.find((p) => p.id === event.payload.pokemonId);
      const name = target ? capitalize(target.nickname ?? target.species) : "Un Pokémon";
      const reason = event.payload.reason ? ` face à : ${event.payload.reason}` : "";
      return `${name} est tombé au combat${reason}.`;
    }
    case "run.created":
      return `Partie créée pour ${event.payload.gameTitle}`;
    case "run.relocated":
      return `Lieu modifié : ${event.payload.currentLocation ?? event.payload.currentRoute}`;
    case "theme.updated":
      return "Thème de la partie actualisé";
    case "pokemon.updated": {
      const target = party.find((p) => p.id === event.payload.pokemonId);
      const name = target ? capitalize(target.nickname ?? target.species) : "Un Pokémon";
      const levelStr = event.payload.level ? ` (Niv. ${event.payload.level})` : "";
      const nickStr = event.payload.nickname ? ` nommé ${capitalize(event.payload.nickname)}` : "";
      return `Mise à jour de ${name}${levelStr}${nickStr}.`;
    }
    case "manual-rule.checked":
      return `Check règle : ${event.payload.label} (${event.payload.status})${event.payload.note ? ` - ${event.payload.note}` : ""}`;
    case "rule.override":
      return `Exception de règle : ${event.payload.reason}`;
    default:
      return "Événement enregistré";
  }
}

function formatEventType(type: string) {
  return {
    "run.created": "partie créée",
    "run.relocated": "lieu modifié",
    "encounter.recorded": "rencontre enregistrée",
    "pokemon.moved": "Pokémon déplacé",
    "pokemon.fainted": "Pokémon mis K.O.",
    "badge.awarded": "étape franchie",
    "note.added": "note ajoutée",
    "theme.updated": "thème actualisé",
    "pokemon.updated": "Pokémon mis à jour",
    "manual-rule.checked": "check règle",
    "rule.override": "exception de règle",
  }[type] ?? type;
}

function InteractiveSlotCard({
  pokemon,
  levelCap,
  onEdit,
  onFaint,
  onQuickMove,
  onLoadIntoCalculator,
}: {
  pokemon: PokemonSlot;
  levelCap?: number;
  onEdit: (p: PokemonSlot) => void;
  onFaint: (p: PokemonSlot) => void;
  onQuickMove: (p: PokemonSlot, target: "team" | "box") => void;
  onLoadIntoCalculator: (p: PokemonSlot) => void;
}) {
  const isOverLevelCap = levelCap && pokemon.status === "team" && pokemon.level > levelCap;

  return (
    <div className="group relative rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4 transition hover:border-[color:var(--accent)]/40 hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="relative">
          <Image
            src={cachedPokemonAssetUrl(pokemon.spriteUrl) ?? missingPokemonSpriteUrl}
            alt={pokemon.species}
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 rounded-lg border border-[color:var(--line)] bg-black/20 object-contain p-2"
          />
          {pokemon.shiny && (
            <span className="absolute -right-1 -top-1 rounded bg-[color:var(--warning)] px-1 py-0.5 text-[8px] font-bold text-black uppercase">
              Shiny
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              pokemon.status === "team"
                ? "bg-[color:var(--success)]/10 text-[color:var(--success)] border border-[color:var(--success)]/20"
                : pokemon.status === "box"
                  ? "bg-[color:var(--warning)]/10 text-[color:var(--warning)] border border-[color:var(--warning)]/20"
                  : "bg-[color:var(--danger)]/10 text-[color:var(--danger)] border border-[color:var(--danger)]/20"
            }`}>
              {pokemon.status === "team" ? "équipe" : pokemon.status === "box" ? "boîte" : "cimetière"}
            </span>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isOverLevelCap
                ? "bg-[color:var(--danger)]/15 text-[color:var(--danger)] border border-[color:var(--danger)]/35 font-bold animate-pulse"
                : "bg-[color:var(--accent-soft)] text-[color:var(--accent)] border border-[color:var(--accent)]/20"
            }`}>
              Niv. {pokemon.level}
            </span>
            <span className="rounded-full bg-[color:var(--background-alt)] border border-[color:var(--line)] px-2 py-0.5 text-[10px] text-[color:var(--muted)]">
              #{pokemon.dexNumber}
            </span>
          </div>

          <div>
            <h4 className="truncate text-base font-semibold text-[color:var(--text)]">
              {pokemon.nickname ?? pokemon.species}
            </h4>
            {pokemon.nickname && pokemon.nickname !== pokemon.species && (
              <p className="text-xs text-[color:var(--muted)] italic">{pokemon.species}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-1 text-[10px] text-[color:var(--muted)]">
            {pokemon.types.map((type: string) => (
              <span
                key={type}
                className="rounded-full border border-[color:var(--line)] bg-[color:var(--background-alt)] px-2 py-0.5"
              >
                {typeLabels[type] ?? capitalize(type)}
              </span>
            ))}
          </div>

          {pokemon.note && (
            <p className="text-xs text-[color:var(--muted)] border-t border-[color:var(--line)] pt-1.5 mt-1.5 leading-relaxed">
              {pokemon.note}
            </p>
          )}

          {/* Direct actions */}
          <div className="mt-3 flex items-center justify-between border-t border-[color:var(--line)] pt-2">
            <div className="flex gap-0.5">
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-8 p-0 hover:text-[color:var(--accent)]"
                onClick={() => onEdit(pokemon)}
                title="Modifier surnom, niveau ou note"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              {pokemon.status !== "cemetery" && (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"
                  onClick={() => onFaint(pokemon)}
                  title="Déclarer K.O. (Mort)"
                >
                  <Skull className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            <div className="flex gap-1">
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-2 text-xs flex items-center gap-1 hover:text-[color:var(--accent-secondary)]"
                onClick={() => onLoadIntoCalculator(pokemon)}
                title="Calculer les dégâts"
              >
                <Swords className="h-3 w-3" />
                Calc
              </Button>

              {pokemon.status === "team" && (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-2 text-xs font-normal"
                  onClick={() => onQuickMove(pokemon, "box")}
                  title="Envoyer dans le PC"
                >
                  <ArrowLeftRight className="h-3 w-3 mr-1" />
                  Boîte
                </Button>
              )}
              {pokemon.status === "box" && (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 px-2 text-xs font-normal"
                  onClick={() => onQuickMove(pokemon, "team")}
                  title="Prendre dans l'équipe active"
                >
                  <ArrowLeftRight className="h-3 w-3 mr-1" />
                  Prendre
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RunWorkbench({ run, pack, gameProfile, activeRulesCount }: RunWorkbenchProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activePokemon, setActivePokemon] = useState<PokemonLookup | null>(null);
  const [evolutionLine, setEvolutionLine] = useState<string[]>([]);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingRuleOverride, setPendingRuleOverride] = useState<PendingRuleOverride | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideFormError, setOverrideFormError] = useState<string | null>(null);
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  // HUD Modal open states
  const [isEncounterOpen, setIsEncounterOpen] = useState(false);
  const [isBadgeOpen, setIsBadgeOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isPCSelectorOpen, setIsPCSelectorOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  // Encounter Route options & autocomplete
  const [useCustomRoute, setUseCustomRoute] = useState(false);
  const [pokemonSuggestions, setPokemonSuggestions] = useState<PokemonLookup[]>([]);

  // Modals for editing & fainting
  const [editingPokemon, setEditingPokemon] = useState<PokemonSlot | null>(null);
  const [editForm, setEditForm] = useState({ nickname: "", level: 5, note: "" });

  const [faintingPokemon, setFaintingPokemon] = useState<PokemonSlot | null>(null);
  const [faintReason, setFaintReason] = useState("");

  // PC filters
  const [boxSearch, setBoxSearch] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string | null>(null);
  const [selectedBoxPokemonId, setSelectedBoxPokemonId] = useState<string | null>(null);

  const selectedBoxPokemon = useMemo(() => {
    if (!selectedBoxPokemonId) return null;
    return run.box.find((p) => p.id === selectedBoxPokemonId) ?? null;
  }, [run.box, selectedBoxPokemonId]);

  const party = useMemo(() => [...run.team, ...run.box, ...run.cemetery], [run.box, run.cemetery, run.team]);
  const activeMilestone = gameProfile?.milestones[run.badges.length] ?? null;
  const followingMilestone = gameProfile?.milestones[run.badges.length + 1] ?? null;

  // --- NUZLOCKE RULES ---

  // Filter routes by version group (game-specific routes)
  const gameRoutes = useMemo(() => {
    if (!pack?.routes) return [];
    return pack.routes.filter((route: RouteDefinition) => {
      if (!route.versionGroups || route.versionGroups.length === 0) return true;
      return route.versionGroups.includes(run.versionGroup);
    });
  }, [pack?.routes, run.versionGroup]);

  // Encounter status per route name (for indicators)
  const encounterStatusByRoute = useMemo(() => {
    const map: Record<string, "caught" | "failed" | "escaped"> = {};
    for (const e of run.encounters) {
      const key = e.routeName.trim().toLowerCase();
      if (e.outcome === "caught") map[key] = "caught";
      else if ((e.outcome === "failed" || e.outcome === "fainted") && map[key] !== "caught") map[key] = "failed";
      else if (e.outcome === "escaped" && !map[key]) map[key] = "escaped";
    }
    return map;
  }, [run.encounters]);

  // Determine current location's encounter
  const currentZoneEncounter = useMemo(() => {
    const loc = run.currentLocation ?? run.currentRoute;
    if (!loc) return null;
    return run.encounters.find((e) => e.routeName.trim().toLowerCase() === loc.trim().toLowerCase()) ?? null;
  }, [run.encounters, run.currentLocation, run.currentRoute]);

  const consumedAreaNames = useMemo(() => {
    const areas = new Set<string>();
    for (const entry of run.encounters) {
      if (entry.outcome !== "escaped") {
        areas.add(entry.routeName.trim().toLowerCase());
      }
    }
    return areas;
  }, [run.encounters]);

  const availableRouteCount = useMemo(
    () => gameRoutes.filter((route) => !consumedAreaNames.has(route.name.trim().toLowerCase())).length,
    [consumedAreaNames, gameRoutes]
  );

  // List of active team members exceeding level cap
  const teamExceedingCap = useMemo(() => {
    if (!activeMilestone) return [];
    return run.team.filter((p) => p.level > activeMilestone.levelCap);
  }, [run.team, activeMilestone]);

  const coachRisks = useMemo(() => {
    const risks: string[] = [];

    if (teamExceedingCap.length > 0) {
      risks.push(`${teamExceedingCap.length} Pokémon dépasse le level cap actif.`);
    }
    if (currentZoneEncounter) {
      risks.push(`${currentZoneEncounter.routeName} a déjà une rencontre enregistrée.`);
    }
    if (!run.rules.battle.allowBattleItems) {
      risks.push("Objets en combat interdits.");
    }
    if (run.rules.firstEncounter.severity === "block") {
      risks.push("Première rencontre bloquante en cas de zone déjà consommée.");
    }
    if (run.rules.gameSpecific.contextIds.length > 0) {
      risks.push(`${run.rules.gameSpecific.contextIds.length} contexte spécifique activé.`);
    }

    return risks;
  }, [currentZoneEncounter, run.rules.battle.allowBattleItems, run.rules.firstEncounter.severity, run.rules.gameSpecific.contextIds.length, teamExceedingCap.length]);

  const ruleOverrideEvents = useMemo<RuleOverrideEvent[]>(
    () => run.events.filter((event): event is RuleOverrideEvent => event.type === "rule.override"),
    [run.events]
  );

  // Types available in PC
  const boxTypes = useMemo(() => {
    const types = new Set<string>();
    run.box.forEach((p) => {
      p.types.forEach((t) => types.add(t));
    });
    return Array.from(types).sort();
  }, [run.box]);

  // Calculate team weaknesses defense scoring
  const teamWeaknesses = useMemo(() => {
    if (run.team.length === 0) return [];
    const results: Array<{ type: string; weakCount: number; resistCount: number; score: number }> = [];

    Object.keys(typeChart).forEach((attackingType) => {
      let weakCount = 0;
      let resistCount = 0;

      run.team.forEach((pokemon) => {
        let multiplier = 1;
        pokemon.types.forEach((defendingType) => {
          const t = defendingType.toLowerCase().trim();
          const factor = typeChart[attackingType]?.[t] ?? 1;
          multiplier *= factor;
        });

        if (multiplier > 1) weakCount++;
        if (multiplier < 1) resistCount++;
      });

      const score = weakCount - resistCount;
      if (weakCount > 0 || resistCount > 0) {
        results.push({ type: attackingType, weakCount, resistCount, score });
      }
    });

    return results.sort((a, b) => b.score - a.score);
  }, [run.team]);

  const [encounter, setEncounter] = useState({
    routeName: pack?.routes[0]?.name ?? run.currentLocation ?? run.currentRoute ?? "Route 1",
    method: "",
    biome: "",
    contextId: "",
    nickname: "",
    species: "",
    level: 5,
    outcome: "caught" as const,
    note: "",
    shiny: false,
    addToTeam: true,
  });

  const [badgeForm, setBadgeForm] = useState({
    name: activeMilestone?.name ?? "",
    leader: "",
    notes: "",
  });

  const [noteForm, setNoteForm] = useState("");

  const [damageForm, setDamageForm] = useState({
    level: 50,
    attack: 120,
    defense: 90,
    power: 80,
    category: "physical" as "physical" | "special",
    stab: true,
    critical: false,
    burn: false,
    effectiveness: 1,
    weatherMultiplier: 1,
    terrainMultiplier: 1,
  });
  const [damageResult, setDamageResult] = useState<DamageResult>(() =>
    calculateDamage({
      ...damageForm,
      otherMultipliers: [],
    })
  );

  async function submitRunEvents(events: RunEvent[]) {
    try {
      const response = await postJson<RunEventsResponse>(`/api/runs/${run.id}/events`, {
        baseRevision: run.revision,
        events,
      });
      const warnings = response.evaluation?.warnings ?? [];
      if (warnings.length > 0) {
        setMessage(`Avertissement règle : ${warnings.map((issue) => issue.title).join(", ")}.`);
      }

      return response.evaluation ?? null;
    } catch (error) {
      const overrideError = error as RuleOverrideError;
      const evaluation = overrideError.payload?.evaluation;
      const violations = evaluation?.violations ?? [];

      if (overrideError.status === 422 && overrideError.payload?.requiresOverride && evaluation && violations.length > 0) {
        return new Promise<void>((resolve, reject) => {
          setOverrideReason("");
          setOverrideFormError(null);
          setPendingRuleOverride({
            events,
            evaluation,
            resolve,
            reject,
          });
        });
      }

      throw error;
    }
  }

  async function confirmRuleOverride() {
    if (!pendingRuleOverride) {
      return;
    }

    const reason = overrideReason.trim();
    if (reason.length < 3) {
      setOverrideFormError("Ajoutez une raison claire pour conserver l’audit de cette exception.");
      return;
    }

    setOverrideFormError(null);
    setIsSubmittingOverride(true);

    try {
      await postJson<RunEventsResponse>(`/api/runs/${run.id}/events`, {
        baseRevision: run.revision,
        events: pendingRuleOverride.events,
        overrideReason: reason,
      });
      pendingRuleOverride.resolve();
      setPendingRuleOverride(null);
      setOverrideReason("");
      setMessage("Exception de règle enregistrée dans l’audit.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d’enregistrer cette exception.";
      setOverrideFormError(message);
    } finally {
      setIsSubmittingOverride(false);
    }
  }

  function cancelRuleOverride() {
    if (pendingRuleOverride) {
      pendingRuleOverride.reject(new Error("Exception de règle annulée."));
    }

    setPendingRuleOverride(null);
    setOverrideReason("");
    setOverrideFormError(null);
  }



  const routeAlreadyVisited = useMemo(() => {
    const key = encounter.routeName.trim().toLowerCase();
    // Shiny Clause: if shiny is checked, route clause doesn't apply
    if (encounter.shiny && run.rules.firstEncounter.shinyExempts) return false;
    return run.encounters.some(
      (e) => e.routeName.trim().toLowerCase() === key && e.outcome !== "escaped"
    );
  }, [run.encounters, encounter.routeName, encounter.shiny, run.rules.firstEncounter.shinyExempts]);

  // Dupes Clause: species already encountered anywhere (team/box/cemetery)
  // Checks the full evolution line if available (Species Clause proper)
  const dupesConflict = useMemo(() => {
    if (!encounter.species.trim() || !run.rules.dupesClause.enabled) return null;
    const allPokemon = run.rules.dupesClause.includeFainted
      ? [...run.team, ...run.box, ...run.cemetery]
      : [...run.team, ...run.box];
    // Use evolution line if available (populated after lookup), else exact species
    const lineToCheck = evolutionLine.length > 0 ? evolutionLine : [encounter.species.trim().toLowerCase()];
    return allPokemon.find((p) => lineToCheck.includes(p.species.toLowerCase())) ?? null;
  }, [encounter.species, evolutionLine, run.team, run.box, run.cemetery, run.rules.dupesClause.enabled, run.rules.dupesClause.includeFainted]);

  // Species Clause: cannot have the same evolutionary line in the team/box at all
  const speciesConflict = useMemo(() => {
    if (!encounter.species.trim() || !run.rules.speciesClause.enabled) return null;
    const allPokemon = run.rules.speciesClause.includeFainted
      ? [...run.team, ...run.box, ...run.cemetery]
      : [...run.team, ...run.box];
    const lineToCheck = evolutionLine.length > 0 ? evolutionLine : [encounter.species.trim().toLowerCase()];
    return allPokemon.find((p) => lineToCheck.includes(p.species.toLowerCase())) ?? null;
  }, [encounter.species, evolutionLine, run.team, run.box, run.cemetery, run.rules.speciesClause.enabled, run.rules.speciesClause.includeFainted]);

  async function lookupPokemon(query: string) {
    setLookupState("loading");
    setLookupError(null);
    setEvolutionLine([]);

    try {
      const [pokemonRes, evoRes] = await Promise.allSettled([
        fetch(`/api/pokemon/${encodeURIComponent(query)}`),
        fetch(`/api/pokemon/${encodeURIComponent(query)}?kind=evolution`),
      ]);

      if (pokemonRes.status === "rejected" || !pokemonRes.value.ok) {
        throw new Error("La recherche Pokémon a échoué.");
      }

      const payload = (await pokemonRes.value.json()) as { pokemon: PokemonLookup };
      setActivePokemon(payload.pokemon);

      // Populate evolution line for clause checks
      if (evoRes.status === "fulfilled" && evoRes.value.ok) {
        const evoPayload = (await evoRes.value.json()) as { chain: string[] };
        setEvolutionLine(evoPayload.chain ?? []);
      }

      setLookupState("ready");
      return payload.pokemon;
    } catch (error) {
      setLookupState("error");
      setLookupError(error instanceof Error ? error.message : "La recherche a échoué.");
      return null;
    }
  }

  async function searchSpeciesSuggestions(query: string) {
    if (query.trim().length <= 1) return;
    try {
      const response = await fetch(`/api/pokemon/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const payload = await response.json();
        setPokemonSuggestions(payload.results || []);
      }
    } catch {}
  }

  async function submitEncounter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pokemon =
      activePokemon ?? (await lookupPokemon(encounter.species.trim())) ?? null;

    if (!pokemon) {
      return;
    }

    setActionError(null);
    setIsSaving(true);

    const timestamp = new Date().toISOString();
    const encounterRecord = {
      id: `enc-${Date.now()}`,
      routeId: slugRoute([encounter.routeName, encounter.method, encounter.biome].filter(Boolean).join("-")),
      routeName: encounter.routeName,
      method: encounter.method.trim() || undefined,
      biome: encounter.biome.trim() || undefined,
      contextId: encounter.contextId || undefined,
      species: pokemon.name,
      dexNumber: pokemon.id,
      level: encounter.level,
      outcome: encounter.outcome,
      timestamp,
      note: encounter.note || undefined,
      shiny: encounter.shiny,
      spriteUrl: pokemon.artworkUrl ?? pokemon.spriteUrl ?? undefined,
      versionGroup: run.versionGroup,
    };

    const events: RunEvent[] = [
      {
        id: `event-${Date.now()}`,
        timestamp,
        type: "encounter.recorded" as const,
        payload: encounterRecord,
      },
    ];

    if (encounter.outcome === "caught" && encounter.addToTeam) {
      events.push({
        id: `event-team-${Date.now()}`,
        timestamp,
        type: "pokemon.moved" as const,
        payload: {
          pokemon: buildPokemonSlot(
            pokemon,
            encounter.routeName,
            encounter.level,
            encounter.shiny,
            encounter.nickname
          ),
          target: "team" as const,
        },
      });
    } else if (encounter.outcome === "caught") {
      const boxedSlot = buildPokemonSlot(
        pokemon,
        encounter.routeName,
        encounter.level,
        encounter.shiny,
        encounter.nickname
      );
      events.push({
        id: `event-box-${Date.now()}`,
        timestamp,
        type: "pokemon.moved" as const,
        payload: {
          pokemon: { ...boxedSlot, status: "box" as const },
          target: "box" as const,
        },
      });
    }

    try {
      await submitRunEvents(events);
      setIsEncounterOpen(false);
      startTransition(() => router.refresh());
      setEncounter((current) => ({
        ...current,
        species: "",
        nickname: "",
        note: "",
        addToTeam: true,
      }));
      setActivePokemon(null);
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Impossible d’enregistrer la rencontre.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitRelocate(routeName: string) {
    if (!routeName) return;
    setActionError(null);
    setIsSaving(true);
    try {
      await submitRunEvents([
        {
          id: `relocate-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "run.relocated" as const,
          payload: {
            currentLocation: routeName,
            currentRoute: routeName,
          },
        },
      ]);
      setEncounter((c) => ({ ...c, routeName }));
      startTransition(() => router.refresh());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Impossible de changer de lieu.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitQuickMove(pokemon: PokemonSlot, target: "team" | "box") {
    setActionError(null);
    try {
      await submitRunEvents([
        {
          id: `move-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "pokemon.moved" as const,
          payload: {
            pokemon,
            target,
          },
        },
      ]);
      startTransition(() => router.refresh());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Impossible de déplacer ce Pokémon.");
    }
  }

  async function submitBadge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setActionError(null);
    setIsSaving(true);

    try {
      await submitRunEvents([
        {
          id: `badge-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "badge.awarded" as const,
          payload: {
            id: `badge-${Date.now()}`,
            name: badgeForm.name,
            leader: badgeForm.leader || undefined,
            timestamp: new Date().toISOString(),
            notes: badgeForm.notes || undefined,
          },
        },
      ]);

      setBadgeForm({ name: followingMilestone?.name ?? "", leader: "", notes: "" });
      setIsBadgeOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Impossible d’ajouter ce badge.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setActionError(null);
    setIsSaving(true);

    try {
      await submitRunEvents([
        {
          id: `note-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "note.added" as const,
          payload: {
            id: `note-${Date.now()}`,
            text: noteForm,
            timestamp: new Date().toISOString(),
          },
        },
      ]);

      setNoteForm("");
      setIsNoteOpen(false);
      startTransition(() => router.refresh());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Impossible d’enregistrer cette note.");
    } finally {
      setIsSaving(false);
    }
  }

  async function submitManualRuleCheck(
    ruleId: "battle-items" | "battle-style" | "wipe" | "raid" | "game-context",
    label: string,
    status: "passed" | "failed" | "not-applicable",
    contextId?: string
  ) {
    setActionError(null);
    setMessage(null);
    setIsSaving(true);

    try {
      const evaluation = await submitRunEvents([
        {
          id: `manual-rule-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "manual-rule.checked" as const,
          payload: {
            id: `manual-rule-${Date.now()}`,
            ruleId,
            label,
            status,
            timestamp: new Date().toISOString(),
            contextId,
          },
        },
      ]);
      if (!evaluation?.warnings.length) {
        setMessage(`Check enregistré : ${label}.`);
      }
      startTransition(() => router.refresh());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Impossible d’enregistrer ce check de règle.");
    } finally {
      setIsSaving(false);
    }
  }

  function openEditModal(pokemon: PokemonSlot) {
    setEditingPokemon(pokemon);
    setEditForm({
      nickname: pokemon.nickname ?? pokemon.species,
      level: pokemon.level,
      note: pokemon.note ?? "",
    });
  }

  async function savePokemonEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingPokemon) return;
    setActionError(null);
    setIsSaving(true);

    try {
      await submitRunEvents([
        {
          id: `update-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "pokemon.updated" as const,
          payload: {
            pokemonId: editingPokemon.id,
            nickname: editForm.nickname || editingPokemon.species,
            level: Number(editForm.level),
            note: editForm.note || undefined,
          },
        },
      ]);
      setEditingPokemon(null);
      startTransition(() => router.refresh());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Impossible de mettre à jour le Pokémon.");
    } finally {
      setIsSaving(false);
    }
  }

  function openFaintModal(pokemon: PokemonSlot) {
    setFaintingPokemon(pokemon);
    setFaintReason("");
  }

  async function savePokemonFaint(event: React.FormEvent) {
    event.preventDefault();
    if (!faintingPokemon) return;
    setActionError(null);
    setIsSaving(true);

    try {
      await submitRunEvents([
        {
          id: `faint-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: "pokemon.fainted" as const,
          payload: {
            pokemonId: faintingPokemon.id,
            reason: faintReason || "Inconnue",
          },
        },
      ]);
      setFaintingPokemon(null);
      startTransition(() => router.refresh());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Impossible d'enregistrer le K.O.");
    } finally {
      setIsSaving(false);
    }
  }

  async function loadPokemonIntoCalculator(pokemon: PokemonSlot) {
    setActionError(null);
    setMessage(`Chargement des statistiques de ${pokemon.nickname ?? pokemon.species}...`);
    try {
      const response = await fetch(`/api/pokemon/${encodeURIComponent(pokemon.species.toLowerCase())}`);
      if (!response.ok) {
        throw new Error("Impossible de récupérer les statistiques du Pokémon.");
      }
      const data = await response.json();
      const details = data.pokemon;

      const attackStat = details.stats["attack"] ?? 100;
      const spAttackStat = details.stats["special-attack"] ?? 100;
      const isPhysical = attackStat >= spAttackStat;

      const nextCalc = {
        level: pokemon.level,
        attack: isPhysical ? attackStat : spAttackStat,
        defense: details.stats["defense"] ?? 80,
        power: 80,
        category: (isPhysical ? "physical" : "special") as "physical" | "special",
        stab: details.types.some((t: string) => pokemon.types.includes(t)),
        critical: false,
        burn: false,
        effectiveness: 1,
        weatherMultiplier: 1,
        terrainMultiplier: 1,
      };

      setDamageForm(nextCalc);
      recalculate(nextCalc);
      setCalculatorOpen(true);
      setMessage(`Statistiques de ${pokemon.nickname ?? pokemon.species} chargées avec succès !`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage(null);
      setActionError(err instanceof Error ? err.message : "Erreur lors du chargement des statistiques.");
    }
  }

  function recalculate(next: typeof damageForm) {
    const result = calculateDamage({
      ...next,
      otherMultipliers: [],
    });
    setDamageResult(result);
  }

  const filteredBox = useMemo(() => {
    let list = run.box;
    const query = boxSearch.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (p) =>
          p.species.toLowerCase().includes(query) ||
          (p.nickname && p.nickname.toLowerCase().includes(query)) ||
          p.types.some((t) => t.toLowerCase().includes(query))
      );
    }
    if (selectedTypeFilter) {
      list = list.filter((p) =>
        p.types.some((t) => t.trim().toLowerCase() === selectedTypeFilter.trim().toLowerCase())
      );
    }
    return list;
  }, [run.box, boxSearch, selectedTypeFilter]);

  const teamSlots = useMemo(() => {
    const slots: (PokemonSlot | null)[] = [...run.team];
    while (slots.length < 6) {
      slots.push(null);
    }
    return slots;
  }, [run.team]);

  return (
    <div className="space-y-6">
      {/* Feedback messages */}
      {message && (
        <p className="rounded-xl border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 px-4 py-3 text-sm text-[color:var(--success)]">
          {message}
        </p>
      )}
      {actionError && (
        <p role="alert" className="rounded-xl border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
          {actionError}
        </p>
      )}

      {/* Résumé de la zone et de l'objectif courant. */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* CURRENT LOCATION HUD */}
        <Card className="p-5 border-[color:var(--accent)]/20 relative overflow-hidden bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--background-alt)]">
          <div className="absolute right-2 top-2 opacity-5">
            <Compass className="h-24 w-24" />
          </div>

          <div className="flex flex-col h-full justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)] flex items-center gap-1">
                <Compass className="h-3.5 w-3.5" /> Zone actuelle
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
                <h2 className="text-xl font-bold text-[color:var(--text)]">
                  {run.currentLocation ?? run.currentRoute ?? "Non défini"}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[color:var(--muted)]">Aller vers :</span>
                  <select
                    value={run.currentLocation ?? run.currentRoute ?? ""}
                    onChange={(e) => void submitRelocate(e.target.value)}
                    className="rounded-lg bg-[color:var(--background-alt)] border border-[color:var(--line)] text-xs text-[color:var(--text)] px-2.5 py-1.5 focus:border-[color:var(--accent)] outline-none cursor-pointer transition font-semibold"
                  >
                    <option value="" disabled>Choisir un lieu</option>
                    {gameRoutes.map((route: RouteDefinition) => {
                      const status = encounterStatusByRoute[route.name.trim().toLowerCase()];
                      const prefix = status === "caught" ? "Capturé - " : status === "failed" ? "Échoué - " : "Libre - ";
                      return (
                        <option key={route.id} value={route.name}>
                          {prefix}{route.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-[color:var(--line)] pt-3 mt-1">
              {currentZoneEncounter ? (
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--success)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[color:var(--success)]"></span>
                    </span>
                    <span className="text-[color:var(--muted)]">Rencontre effectuée :</span>
                    <span className="font-semibold text-[color:var(--text)]">
                      {capitalize(currentZoneEncounter.species)} ({currentZoneEncounter.outcome === "caught" ? "Capturé" : currentZoneEncounter.outcome === "failed" ? "Échoué" : currentZoneEncounter.outcome})
                    </span>
                  </div>
                  {currentZoneEncounter.shiny && <span className="text-[color:var(--warning)] font-semibold">Shiny</span>}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[color:var(--muted)] italic">
                    Aucune rencontre enregistrée pour ce lieu.
                  </p>
                  <Button
                    type="button"
                    className="bg-[color:var(--accent)] hover:bg-[color:var(--accent)]/90 text-white font-semibold text-xs px-3 py-1.5 h-auto rounded-lg shadow-sm"
                    onClick={() => {
                      setEncounter((c) => ({
                        ...c,
                        routeName: run.currentLocation ?? run.currentRoute ?? pack?.routes[0]?.name ?? "Route 1",
                      }));
                      setIsEncounterOpen(true);
                    }}
                  >
                    Capturer / Rencontrer
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* CURRENT OBJECTIVE / BADGE HUD */}
        <Card className="p-5 border-[color:var(--accent)]/20 relative overflow-hidden bg-gradient-to-br from-[color:var(--surface-strong)] to-[color:var(--background-alt)]">
          <div className="absolute right-2 top-2 opacity-5">
            <Trophy className="h-24 w-24" />
          </div>

          <div className="flex flex-col h-full justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent-secondary)] flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" /> Objectif en cours
              </p>
              {activeMilestone ? (
                <div>
                  <h2 className="text-xl font-bold text-[color:var(--text)] truncate">
                    {activeMilestone.name}
                  </h2>
                  <p className="text-xs text-[color:var(--muted)]">
                    {activeMilestone.objective} · Limite : <span className="font-semibold text-[color:var(--accent-secondary)]">Niv. {activeMilestone.levelCap}</span>
                  </p>
                </div>
              ) : (
                <p className="text-sm font-semibold text-[color:var(--success)]">
                  Toutes les étapes principales ont été validées !
                </p>
              )}
            </div>

            <div className="border-t border-[color:var(--line)] pt-3 mt-1 flex items-center justify-between gap-3">
              <div className="text-xs">
                {teamExceedingCap.length > 0 ? (
                  <p className="text-[color:var(--danger)] font-semibold flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {teamExceedingCap.length} Pokémon dépasse le cap !
                  </p>
                ) : (
                  <p className="text-[color:var(--success)] font-semibold flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />
                    Équipe valide (tous ≤ Niv. {activeMilestone?.levelCap ?? 100})
                  </p>
                )}
              </div>
              {activeMilestone && (
                <Button
                  type="button"
                  variant="secondary"
                  className="font-semibold text-xs px-3 py-1.5 h-auto rounded-lg shadow-sm"
                  onClick={() => {
                    setBadgeForm({ name: activeMilestone.name, leader: "", notes: "" });
                    setIsBadgeOpen(true);
                  }}
                >
                  Valider l&apos;étape
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* QUICK ACTIONS BAR */}
      <div className="flex flex-wrap gap-2 justify-between items-center bg-[color:var(--surface-strong)]/40 p-3 rounded-2xl border border-[color:var(--line)]">
        <SaveStatus run={run} />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="text-xs font-semibold h-9 rounded-lg flex items-center gap-1.5"
            onClick={() => {
              setEncounter((c) => ({
                ...c,
                routeName: "Starter / Cadeau",
              }));
              setIsEncounterOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Autre rencontre (Cadeau/Starter)
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="text-xs font-semibold h-9 rounded-lg flex items-center gap-1.5"
            onClick={() => setIsNoteOpen(true)}
          >
            <FileText className="h-3.5 w-3.5" /> Nouvelle note
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="text-xs font-semibold h-9 rounded-lg flex items-center gap-1.5"
            onClick={() => setCalculatorOpen((o) => !o)}
          >
            <Swords className="h-3.5 w-3.5" />
            {calculatorOpen ? "Fermer le Calculateur" : "Calculateur"}
          </Button>
        </div>
      </div>

      {/* MODALS & OVERLAYS */}

      {pendingRuleOverride && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
            <Card className="w-full max-w-2xl border border-[color:var(--danger)]/40 bg-[#0b1726] p-6 shadow-[var(--shadow)] sm:p-8">
              <div className="flex items-start justify-between gap-4 border-b border-[color:var(--line)] pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--danger)]">Override requis</p>
                  <h2 className="mt-2 text-xl font-semibold text-[color:var(--text)]">Cette action enfreint les règles actives</h2>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                    L’action peut être enregistrée, mais Emberdex gardera une exception auditée avec votre raison.
                  </p>
                </div>
                <Button type="button" variant="ghost" className="h-8 w-8 min-h-0 p-0" onClick={cancelRuleOverride}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 space-y-3">
                {[...pendingRuleOverride.evaluation.violations, ...pendingRuleOverride.evaluation.warnings].map((issue) => (
                  <div
                    key={`${issue.ruleId}-${issue.message}`}
                    className={`rounded-xl border p-4 ${
                      issue.severity === "violation"
                        ? "border-[color:var(--danger)]/35 bg-[color:var(--danger)]/8"
                        : "border-[color:var(--warning)]/35 bg-[color:var(--warning)]/8"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill>{issue.severity === "violation" ? "Bloquant" : "Avertissement"}</Pill>
                      <p className="text-sm font-semibold text-[color:var(--text)]">{issue.title}</p>
                    </div>
                    <p className="mt-2 text-sm text-[color:var(--text)]">{issue.message}</p>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{issue.explanation}</p>
                    <p className="mt-2 text-xs font-semibold text-[color:var(--accent-secondary)]">{issue.suggestedAction}</p>
                  </div>
                ))}
              </div>

              <label className="mt-5 block space-y-2">
                <span className="text-sm font-medium text-[color:var(--muted)]">Raison de l’exception</span>
                <Textarea
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  placeholder="Exemple : shiny clause maison validée avant le départ, capture conservée pour documentation."
                />
              </label>

              {overrideFormError ? (
                <p role="alert" className="mt-3 rounded-xl border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
                  {overrideFormError}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <Button type="button" variant="secondary" onClick={cancelRuleOverride} disabled={isSubmittingOverride}>
                  Annuler l’action
                </Button>
                <Button type="button" variant="danger" onClick={() => void confirmRuleOverride()} disabled={isSubmittingOverride}>
                  {isSubmittingOverride ? "Enregistrement..." : "Forcer avec cette raison"}
                </Button>
              </div>
            </Card>
          </div>
        </Portal>
      )}

      {/* 1. ENCOUNTER FORM MODAL */}
      {isEncounterOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <Card className="w-full max-w-lg p-6 sm:p-8 bg-[#0b1726] border border-[color:var(--line)] shadow-[var(--shadow)] relative rounded-2xl max-h-[90vh] overflow-y-auto">
            <Button
              type="button"
              variant="ghost"
              className="absolute top-4 right-4 h-8 w-8 min-h-0 p-0 rounded-full flex items-center justify-center hover:bg-white/10 text-[color:var(--muted)]"
              onClick={() => setIsEncounterOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="border-b border-[color:var(--line)] pb-4 mb-5">
              <SectionHeading
                eyebrow="Nouvelle rencontre"
                title="Journal des captures"
                description="Ajoutez un nouveau Pokémon rencontré durant votre parcours."
              />
            </div>

            <form onSubmit={submitEncounter} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm text-[color:var(--muted)]">Lieu / Route</span>
                  {!useCustomRoute ? (
                    <Select
                      value={encounter.routeName}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          setUseCustomRoute(true);
                          setEncounter((c) => ({ ...c, routeName: "" }));
                        } else {
                          setEncounter((c) => ({ ...c, routeName: val }));
                        }
                      }}
                    >
                      {gameRoutes.map((route: RouteDefinition) => {
                        const status = encounterStatusByRoute[route.name.trim().toLowerCase()];
                        const prefix = status === "caught" ? "Capturé - " : status === "failed" ? "Échoué - " : "Libre - ";
                        return (
                          <option key={route.id} value={route.name}>
                            {prefix}{route.name}
                          </option>
                        );
                      })}
                      <option value="Starter / Cadeau">Starter / Cadeau</option>
                      <option value="custom">Autre lieu...</option>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={encounter.routeName}
                        onChange={(e) => setEncounter((c) => ({ ...c, routeName: e.target.value }))}
                        placeholder="Route 101"
                        required
                      />
                      <Button type="button" variant="secondary" onClick={() => {
                        setUseCustomRoute(false);
                        setEncounter((c) => ({ ...c, routeName: gameRoutes[0]?.name ?? "Route 1" }));
                      }}>
                        Liste
                      </Button>
                    </div>
                  )}
                </label>

                <label className="block space-y-2">
                  <span className="text-sm text-[color:var(--muted)]">Surnom</span>
                  <Input
                    value={encounter.nickname}
                    onChange={(e) => setEncounter((c) => ({ ...c, nickname: e.target.value }))}
                    placeholder="Surnom du Pokémon"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-2">
                  <span className="text-sm text-[color:var(--muted)]">Méthode</span>
                  <Input
                    value={encounter.method}
                    onChange={(event) => setEncounter((current) => ({ ...current, method: event.target.value }))}
                    placeholder="Herbe, pêche, surf..."
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm text-[color:var(--muted)]">Biome / sous-zone</span>
                  <Input
                    value={encounter.biome}
                    onChange={(event) => setEncounter((current) => ({ ...current, biome: event.target.value }))}
                    placeholder="Nord, grotte, désert..."
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm text-[color:var(--muted)]">Contexte</span>
                  <Select
                    value={encounter.contextId}
                    onChange={(event) => setEncounter((current) => ({ ...current, contextId: event.target.value }))}
                  >
                    <option value="">Aucun</option>
                    {gameProfile?.ruleContexts.map((context) => (
                      <option key={context.id} value={context.id}>
                        {context.label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              {routeAlreadyVisited && encounter.routeName !== "Starter / Cadeau" && (
                <div className="rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/8 px-3 py-2.5">
                  <p className="text-xs text-[color:var(--warning)] flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Règle de première rencontre : une capture a déjà été enregistrée sur {encounter.routeName}.
                  </p>
                  <p className="text-[11px] text-[color:var(--muted)] mt-1 ml-5">Si c&apos;est volontaire (cadeau, surf, pêche), continuez. Sinon, changez de route.</p>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="block space-y-2">
                  <span className="text-sm text-[color:var(--muted)]">Espèce</span>
                  <Input
                    value={encounter.species}
                    list="pokemon-species-suggestions"
                    onChange={(e) => {
                      const val = e.target.value;
                      setEncounter((c) => ({ ...c, species: val }));
                      searchSpeciesSuggestions(val);
                    }}
                    placeholder="Ex. Pidgey, Bulbasaur..."
                    required
                  />
                  <datalist id="pokemon-species-suggestions">
                    {pokemonSuggestions.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                  {/* Dupes Clause - advisory (orange) : espèce déjà capturée, re-roll conseillé */}
                  {dupesConflict && !speciesConflict && (
                    <div className="rounded-lg border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/8 px-2.5 py-2 mt-1">
                      <p className="text-[11px] text-[color:var(--warning)] flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Clause des Doublons : {capitalize(dupesConflict.species)} est déjà dans votre collection.
                      </p>
                      <p className="text-[10px] text-[color:var(--muted)] mt-0.5 ml-4.5">Selon les règles Nuzlocke standard, vous pouvez ignorer cette rencontre et chercher une autre espèce sur cette route.</p>
                    </div>
                  )}
                  {/* Species Clause - erreur (rouge) : espèce déjà en vie dans l'équipe/PC */}
                  {speciesConflict && (
                    <div className="rounded-lg border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/8 px-2.5 py-2 mt-1">
                      <p className="text-[11px] text-[color:var(--danger)] flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Clause Espèce : {capitalize(speciesConflict.species)} est déjà dans votre {speciesConflict.status === "team" ? "équipe active" : speciesConflict.status === "box" ? "PC" : "cimetière"}.
                      </p>
                      <p className="text-[10px] text-[color:var(--muted)] mt-0.5 ml-4.5">Vous ne pouvez pas avoir deux exemplaires de la même espèce.</p>
                    </div>
                  )}
                </label>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      if (encounter.species.trim()) {
                        await lookupPokemon(encounter.species.trim());
                      }
                    }}
                    disabled={lookupState === "loading"}
                  >
                    {lookupState === "loading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Vérifier"
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm text-[color:var(--muted)]">Niveau</span>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={encounter.level}
                    onChange={(event) =>
                      setEncounter((current) => ({
                        ...current,
                        level: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm text-[color:var(--muted)]">Résultat</span>
                  <Select
                    value={encounter.outcome}
                    onChange={(event) =>
                      setEncounter((current) => ({
                        ...current,
                        outcome: event.target.value as typeof encounter.outcome,
                      }))
                    }
                  >
                    {outcomeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--background-alt)] px-4 py-3 text-sm text-[color:var(--text)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={encounter.shiny}
                    onChange={(event) =>
                      setEncounter((current) => ({ ...current, shiny: event.target.checked }))
                    }
                  />
                  Rencontre Shiny
                </label>
                {encounter.shiny && run.rules.firstEncounter.shinyExempts && (
                  <p className="mt-1.5 text-[11px] text-[color:var(--warning)] flex items-center gap-1.5 font-semibold px-1">
                    Clause Shiny active: cette rencontre est autorisée même si la route est déjà explorée.
                  </p>
                )}
              </div>

              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--muted)]">Note de capture</span>
                <Textarea
                  value={encounter.note}
                  onChange={(event) =>
                    setEncounter((current) => ({ ...current, note: event.target.value }))
                  }
                  placeholder="Pokéball utilisée, stats particulières, talent..."
                />
              </label>

              {encounter.outcome === "caught" && (
                <label className="flex items-center gap-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--background-alt)] px-4 py-3 text-sm text-[color:var(--text)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={encounter.addToTeam}
                    onChange={(event) =>
                      setEncounter((current) => ({
                        ...current,
                        addToTeam: event.target.checked,
                      }))
                    }
                  />
                  Ajouter à l’équipe active (sinon envoyé dans le PC)
                </label>
              )}

              {activePokemon ? (
                <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--background-alt)] p-4">
                  <div className="flex items-center gap-4">
                    <Image
                      src={cachedPokemonAssetUrl(activePokemon.artworkUrl ?? activePokemon.spriteUrl) ?? missingPokemonSpriteUrl}
                      alt={activePokemon.name}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16 rounded-lg border border-[color:var(--line)] bg-black/20 object-contain p-2"
                    />
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
                        Trouvé dans PokeAPI
                      </p>
                      <p className="text-base font-semibold text-[color:var(--text)]">
                        #{activePokemon.id} {activePokemon.name}
                      </p>
                      <p className="text-xs text-[color:var(--muted)]">
                        Types : {(activePokemon.types ?? []).join(" / ") || "inconnu"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {lookupError ? (
                <p className="rounded-lg border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">
                  {lookupError}
                </p>
              ) : null}

              <div className="flex gap-3 justify-end pt-3">
                <Button type="button" variant="secondary" onClick={() => setIsEncounterOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={isPending || isSaving}>
                  {isSaving ? "Enregistrement..." : "Enregistrer la rencontre"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
        </Portal>
      )}

      {/* 2. BADGE/MILESTONE FORM MODAL */}
      {isBadgeOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <Card className="w-full max-w-md p-6 sm:p-8 bg-[#0b1726] border border-[color:var(--line)] shadow-[var(--shadow)] relative rounded-2xl max-h-[90vh] overflow-y-auto">
            <Button
              type="button"
              variant="ghost"
              className="absolute top-4 right-4 h-8 w-8 min-h-0 p-0 rounded-full flex items-center justify-center hover:bg-white/10 text-[color:var(--muted)]"
              onClick={() => setIsBadgeOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="border-b border-[color:var(--line)] pb-4 mb-5">
              <SectionHeading
                eyebrow="Progression"
                title="Étape franchie"
                description="Validez un badge d'arène ou un combat majeur."
              />
            </div>

            <form onSubmit={submitBadge} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--muted)]">Étape franchie / Badge</span>
                <Input
                  value={badgeForm.name}
                  onChange={(event) =>
                    setBadgeForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={activeMilestone?.name ?? "Nouvel objectif"}
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--muted)]">Adversaire / Leader</span>
                <Input
                  value={badgeForm.leader}
                  onChange={(event) =>
                    setBadgeForm((current) => ({ ...current, leader: event.target.value }))
                  }
                  placeholder={activeMilestone?.objective ?? "Combat important"}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--muted)]">Notes de combat</span>
                <Textarea
                  value={badgeForm.notes}
                  onChange={(event) =>
                    setBadgeForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  placeholder="Tactique employée, MVP de l'arène, remarques..."
                />
              </label>

              <div className="flex gap-3 justify-end pt-3">
                <Button type="button" variant="secondary" onClick={() => setIsBadgeOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={isPending || isSaving}>
                  {isSaving ? "Validation..." : "Valider l'étape"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
        </Portal>
      )}

      {/* 3. NEW NOTE MODAL */}
      {isNoteOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <Card className="w-full max-w-md p-6 sm:p-8 bg-[#0b1726] border border-[color:var(--line)] shadow-[var(--shadow)] relative rounded-2xl max-h-[90vh] overflow-y-auto">
            <Button
              type="button"
              variant="ghost"
              className="absolute top-4 right-4 h-8 w-8 min-h-0 p-0 rounded-full flex items-center justify-center hover:bg-white/10 text-[color:var(--muted)]"
              onClick={() => setIsNoteOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="border-b border-[color:var(--line)] pb-4 mb-5">
              <SectionHeading
                eyebrow="Journal de l'aventure"
                title="Ajouter une note"
                description="Ajoutez une note générale sur votre run Nuzlocke."
              />
            </div>

            <form onSubmit={submitNote} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--muted)]">Votre note</span>
                <Textarea
                  value={noteForm}
                  onChange={(event) => setNoteForm(event.target.value)}
                  placeholder="Règles spéciales appliquées, rappels pour plus tard..."
                  required
                  rows={4}
                />
              </label>

              <div className="flex gap-3 justify-end pt-3">
                <Button type="button" variant="secondary" onClick={() => setIsNoteOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={isPending || isSaving}>
                  Ajouter la note
                </Button>
              </div>
            </form>
          </Card>
        </div>
        </Portal>
      )}

      {/* 4. PC SELECTOR MODAL (Add to team from PC) */}
      {isPCSelectorOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <Card className="w-full max-w-lg p-6 sm:p-8 bg-[#0b1726] border border-[color:var(--line)] shadow-[var(--shadow)] relative rounded-2xl flex flex-col max-h-[80vh]">
            <Button
              type="button"
              variant="ghost"
              className="absolute top-4 right-4 h-8 w-8 min-h-0 p-0 rounded-full flex items-center justify-center hover:bg-white/10 text-[color:var(--muted)]"
              onClick={() => setIsPCSelectorOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="border-b border-[color:var(--line)] pb-4 mb-5">
              <h3 className="text-base font-bold text-[color:var(--text)]">Choisir un Pokémon du PC</h3>
              <p className="text-xs text-[color:var(--muted)] mt-1">Sélectionnez le Pokémon à transférer dans votre équipe.</p>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {run.box.map((pokemon) => (
                <div
                  key={pokemon.id}
                  onClick={async () => {
                    setIsPCSelectorOpen(false);
                    await submitQuickMove(pokemon, "team");
                  }}
                  className="flex items-center gap-4 p-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] hover:border-[color:var(--accent)]/50 cursor-pointer transition"
                >
                  <Image
                    src={cachedPokemonAssetUrl(pokemon.spriteUrl) ?? missingPokemonSpriteUrl}
                    alt={pokemon.species}
                    width={48}
                    height={48}
                    unoptimized
                    className="h-12 w-12 rounded bg-black/10 p-1 object-contain"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[color:var(--text)] truncate">{capitalize(pokemon.nickname ?? pokemon.species)}</p>
                    <p className="text-xs text-[color:var(--muted)]">Niv. {pokemon.level} · {capitalize(pokemon.species)}</p>
                  </div>
                  <div className="flex gap-1">
                    {pokemon.types.map((t: string) => (
                      <span key={t} className="rounded bg-[color:var(--background-alt)] border border-[color:var(--line)] px-2 py-0.5 text-[9px] text-[color:var(--muted)]">{typeLabels[t] ?? capitalize(t)}</span>
                    ))}
                  </div>
                </div>
              ))}
              {run.box.length === 0 && (
                <p className="text-sm text-[color:var(--muted)] text-center py-6">Aucun Pokémon disponible dans le PC.</p>
              )}
            </div>
          </Card>
        </div>
        </Portal>
      )}

      {/* 5. EDIT POKEMON MODAL */}
      {editingPokemon && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <Card className="w-full max-w-md p-6 sm:p-8 bg-[#0b1726] border border-[color:var(--line)] shadow-[var(--shadow)] relative rounded-2xl max-h-[90vh] overflow-y-auto">
            <Button
              type="button"
              variant="ghost"
              className="absolute top-4 right-4 h-8 w-8 min-h-0 p-0 rounded-full flex items-center justify-center hover:bg-white/10 text-[color:var(--muted)]"
              onClick={() => setEditingPokemon(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="border-b border-[color:var(--line)] pb-4 mb-5">
              <SectionHeading
                eyebrow="Édition de Pokémon"
                title={`Modifier ${editingPokemon.species}`}
                description="Mettez à jour le surnom, augmentez le niveau ou ajoutez des notes."
              />
            </div>
            <form onSubmit={savePokemonEdit} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--muted)]">Surnom</span>
                <Input
                  value={editForm.nickname}
                  onChange={(e) => setEditForm((c) => ({ ...c, nickname: e.target.value }))}
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--muted)]">Niveau</span>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={editForm.level}
                  onChange={(e) => setEditForm((c) => ({ ...c, level: Number(e.target.value) }))}
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--muted)]">Notes</span>
                <Textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm((c) => ({ ...c, note: e.target.value }))}
                  placeholder="Rôle tactique, couverture de type..."
                />
              </label>
              <div className="flex gap-3 justify-end pt-3">
                <Button type="button" variant="secondary" onClick={() => setEditingPokemon(null)}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
        </Portal>
      )}

      {/* 6. FAINT (DEATH) MODAL */}
      {faintingPokemon && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <Card className="w-full max-w-md p-6 sm:p-8 bg-[#0b1726] border border-[color:var(--danger)]/35 shadow-[var(--shadow)] relative rounded-2xl max-h-[90vh] overflow-y-auto">
            <Button
              type="button"
              variant="ghost"
              className="absolute top-4 right-4 h-8 w-8 min-h-0 p-0 rounded-full flex items-center justify-center hover:bg-white/10 text-[color:var(--muted)]"
              onClick={() => setFaintingPokemon(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3 text-[color:var(--danger)] border-b border-[color:var(--line)] pb-4 mb-5">
              <Skull className="h-6 w-6 animate-pulse" />
              <SectionHeading
                eyebrow="Avis de décès"
                title={`Dire adieu à ${faintingPokemon.nickname ?? faintingPokemon.species}`}
                description="Ce Pokémon sera placé définitivement dans le cimetière."
              />
            </div>
            <form onSubmit={savePokemonFaint} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--muted)]">Cause de la perte</span>
                <Input
                  value={faintReason}
                  onChange={(e) => setFaintReason(e.target.value)}
                  placeholder="Attaque critique de l'Onix de Brock..."
                  required
                />
              </label>
              <div className="flex gap-3 justify-end pt-3">
                <Button type="button" variant="secondary" onClick={() => setFaintingPokemon(null)}>
                  Annuler
                </Button>
                <Button type="submit" className="bg-[color:var(--danger)] text-white hover:bg-[color:var(--danger)]/90" disabled={isSaving}>
                  {isSaving ? "Transfert..." : "Confirmer le décès"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
        </Portal>
      )}

      {/* DAMAGE CALCULATOR PANEL */}
      {calculatorOpen && (
        <Card className="p-6 border-[color:var(--accent)]/30 shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted)]">Préparation au combat</p>
              <h2 className="mt-1 font-bold text-lg text-[color:var(--text)] flex items-center gap-1.5">
                <Swords className="h-5 w-5" /> Calculateur de dégâts
              </h2>
              <p className="text-xs text-[color:var(--muted)] mt-0.5">Évitez les pertes inutiles en simulant les dégâts reçus ou infligés.</p>
            </div>
            <Button type="button" variant="ghost" onClick={() => setCalculatorOpen(false)}>Masquer</Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <label className="block space-y-1">
              <span className="text-xs text-[color:var(--muted)] font-medium">Niveau lanceur</span>
              <Input
                type="number"
                min={1}
                value={damageForm.level}
                onChange={(event) => {
                  const next = { ...damageForm, level: Number(event.target.value) };
                  setDamageForm(next);
                  recalculate(next);
                }}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-[color:var(--muted)] font-medium">Puissance Capacité</span>
              <Input
                type="number"
                min={1}
                value={damageForm.power}
                onChange={(event) => {
                  const next = { ...damageForm, power: Number(event.target.value) };
                  setDamageForm(next);
                  recalculate(next);
                }}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-[color:var(--muted)] font-medium">Attaque du lanceur</span>
              <Input
                type="number"
                min={1}
                value={damageForm.attack}
                onChange={(event) => {
                  const next = { ...damageForm, attack: Number(event.target.value) };
                  setDamageForm(next);
                  recalculate(next);
                }}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-[color:var(--muted)] font-medium">Défense de la cible</span>
              <Input
                type="number"
                min={1}
                value={damageForm.defense}
                onChange={(event) => {
                  const next = { ...damageForm, defense: Number(event.target.value) };
                  setDamageForm(next);
                  recalculate(next);
                }}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 mt-3">
            <label className="block space-y-1">
              <span className="text-xs text-[color:var(--muted)] font-medium">Catégorie</span>
              <Select
                value={damageForm.category}
                onChange={(event) => {
                  const next = {
                    ...damageForm,
                    category: event.target.value as "physical" | "special",
                  };
                  setDamageForm(next);
                  recalculate(next);
                }}
              >
                <option value="physical">Physique</option>
                <option value="special">Spéciale</option>
              </Select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-[color:var(--muted)] font-medium">Efficacité du type</span>
              <Select
                value={String(damageForm.effectiveness)}
                onChange={(event) => {
                  const next = {
                    ...damageForm,
                    effectiveness: Number(event.target.value),
                  };
                  setDamageForm(next);
                  recalculate(next);
                }}
              >
                {["0", "0.25", "0.5", "1", "2", "4"].map((value) => (
                  <option key={value} value={value}>
                    x{value}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {[
              ["stab", "Bonus STAB (x1.5)"],
              ["critical", "Coup critique (x1.5)"],
              ["burn", "Brûlure physique (x0.5)"],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-lg border border-[color:var(--line)] bg-[color:var(--background-alt)] px-3 py-2 text-xs text-[color:var(--text)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={damageForm[key as keyof typeof damageForm] as boolean}
                  onChange={(event) => {
                    const next = {
                      ...damageForm,
                      [key]: event.target.checked,
                    } as typeof damageForm;
                    setDamageForm(next);
                    recalculate(next);
                  }}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3 mt-4">
            <StatCard label="Dégâts possibles" value={formatDamageRange(damageResult)} tone="accent" />
            <StatCard label="Moyenne" value={`${damageResult.average} HP`} />
            <StatCard label="Multiplicateur final" value={`x${damageResult.multiplier}`} />
          </div>

          {damageResult.notes.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-[color:var(--muted)] bg-[color:var(--background-alt)] p-3 rounded-lg border border-[color:var(--line)]">
              {damageResult.notes.map((note) => (
                <li key={note}>• {formatDamageNote(note)}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      )}

      {/* DYNAMIC LISTS: ACTIVE TEAM, BOX, CEMETERY & TIMELINE */}
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">

          {/* ACTIVE TEAM (6 slots fixed) */}
          <Card className="p-6">
            <SectionHeading
              eyebrow="Équipe active"
              title="Formation active (6 slots)"
              description="Les Pokémon présents dans votre équipe de combat."
            />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {teamSlots.map((pokemon, index) => {
                if (pokemon) {
                  return (
                    <InteractiveSlotCard
                      key={pokemon.id}
                      pokemon={pokemon}
                      levelCap={activeMilestone?.levelCap}
                      onEdit={openEditModal}
                      onFaint={openFaintModal}
                      onQuickMove={submitQuickMove}
                      onLoadIntoCalculator={loadPokemonIntoCalculator}
                    />
                  );
                } else {
                  return (
                    <div
                      key={`empty-slot-${index}`}
                      onClick={() => {
                        if (run.box.length === 0) {
                          setActionError("Aucun Pokémon disponible dans le PC à ajouter.");
                          setTimeout(() => setActionError(null), 4000);
                        } else {
                          setIsPCSelectorOpen(true);
                        }
                      }}
                      className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[color:var(--line)] bg-[color:var(--surface-strong)]/30 p-5 text-center transition hover:border-[color:var(--accent)]/55 hover:bg-[color:var(--surface-strong)] cursor-pointer min-h-[160px]"
                    >
                      <div className="rounded-full bg-[color:var(--line)] p-2 text-[color:var(--muted)] group-hover:text-[color:var(--accent)] group-hover:bg-[color:var(--accent-soft)] transition">
                        <Plus className="h-5 w-5" />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-[color:var(--text)]">Emplacement vide</p>
                      <p className="text-[10px] text-[color:var(--muted)] mt-0.5">Retirer un Pokémon du PC</p>
                    </div>
                  );
                }
              })}
            </div>
          </Card>

          {/* BOX & CEMETERY GRID */}
          <div className="grid gap-6 md:grid-cols-2">

            {/* BOX (PC) */}
            <Card className="p-6 flex flex-col h-full">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <SectionHeading
                  eyebrow="Réserve"
                  title="Boîte (PC)"
                  description="Les Pokémon en réserve."
                />
                <Input
                  className="max-w-44 text-xs h-9"
                  placeholder="Rechercher..."
                  value={boxSearch}
                  onChange={(e) => setBoxSearch(e.target.value)}
                />
              </div>

              {/* Type filters */}
              {boxTypes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3 pb-2 border-b border-[color:var(--line)]">
                  <button
                    onClick={() => setSelectedTypeFilter(null)}
                    className={`rounded-full px-2 py-0.5 text-[9px] font-semibold transition ${
                      selectedTypeFilter === null
                        ? "bg-[color:var(--accent)] text-white"
                        : "bg-[color:var(--background-alt)] text-[color:var(--muted)] border border-[color:var(--line)] hover:bg-[color:var(--surface-strong)]"
                    }`}
                  >
                    Tous ({run.box.length})
                  </button>
                  {boxTypes.map((type) => {
                    const count = run.box.filter((p) => p.types.includes(type)).length;
                    return (
                      <button
                        key={type}
                        onClick={() => setSelectedTypeFilter(type === selectedTypeFilter ? null : type)}
                        className={`rounded-full px-2 py-0.5 text-[9px] font-semibold transition ${
                          selectedTypeFilter === type
                            ? "bg-[color:var(--accent)] text-white"
                            : "bg-[color:var(--background-alt)] text-[color:var(--muted)] border border-[color:var(--line)] hover:bg-[color:var(--surface-strong)]"
                        }`}
                      >
                        {type} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* COMPACT GRID */}
              <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[22rem] overflow-y-auto pr-1 flex-1">
                {filteredBox.map((pokemon) => {
                  const isSelected = selectedBoxPokemon?.id === pokemon.id;
                  return (
                    <div
                      key={pokemon.id}
                      onClick={() => setSelectedBoxPokemonId(pokemon.id === selectedBoxPokemonId ? null : pokemon.id)}
                      className={`flex flex-col items-center justify-center rounded-lg border p-1.5 cursor-pointer transition text-center relative ${
                        isSelected
                          ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] shadow-sm"
                          : "border-[color:var(--line)] bg-[color:var(--surface-strong)]/45 hover:border-[color:var(--accent)]/45"
                      }`}
                    >
                      <div className="relative">
                        <Image
                          src={cachedPokemonAssetUrl(pokemon.spriteUrl) ?? missingPokemonSpriteUrl}
                          alt={pokemon.species}
                          width={48}
                          height={48}
                          unoptimized
                          className="h-12 w-12 object-contain"
                        />
                        {pokemon.shiny && (
                          <span className="absolute -top-1 -right-1 rounded bg-[color:var(--warning)] px-1 text-[7px] font-bold text-black">Shiny</span>
                        )}
                      </div>
                      <p className="text-[10px] font-medium text-[color:var(--text)] truncate w-full mt-1">
                        {capitalize(pokemon.nickname ?? pokemon.species)}
                      </p>
                      <span className="absolute top-1 right-1 text-[8px] font-semibold text-[color:var(--muted)]">
                        N.{pokemon.level}
                      </span>
                    </div>
                  );
                })}
                {filteredBox.length === 0 && (
                  <div className="col-span-full py-8 text-center text-xs text-[color:var(--muted)] italic">
                    {boxSearch || selectedTypeFilter ? "Aucun Pokémon ne correspond." : "La boîte PC est vide."}
                  </div>
                )}
              </div>

              {/* SELECTED DETAILS COMPANION PANEL */}
              {selectedBoxPokemon && (
                <div className="mt-4 p-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--background-alt)] space-y-3 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <Image
                      src={cachedPokemonAssetUrl(selectedBoxPokemon.spriteUrl) ?? missingPokemonSpriteUrl}
                      alt={selectedBoxPokemon.species}
                      width={48}
                      height={48}
                      unoptimized
                      className="h-12 w-12 rounded border border-[color:var(--line)] bg-black/25 p-1 object-contain"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm text-[color:var(--text)] truncate">
                          {selectedBoxPokemon.nickname ?? selectedBoxPokemon.species}
                        </h4>
                        <span className="text-[9px] bg-[color:var(--accent-soft)] text-[color:var(--accent)] px-1.5 py-0.5 rounded font-semibold">
                          Niv. {selectedBoxPokemon.level}
                        </span>
                      </div>
                      <p className="text-[10px] text-[color:var(--muted)] italic">{selectedBoxPokemon.species} · Capturé à : {selectedBoxPokemon.location}</p>
                    </div>
                  </div>

                  {selectedBoxPokemon.note && (
                    <p className="text-xs text-[color:var(--muted)] border-t border-[color:var(--line)] pt-1.5 leading-relaxed">
                      {selectedBoxPokemon.note}
                    </p>
                  )}

                  {/* Actions footer for selected PC pokemon */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[color:var(--line)]">
                    {run.team.length < 6 ? (
                      <Button
                        type="button"
                        className="h-7 text-[10px] font-bold px-3 bg-[color:var(--accent)] hover:bg-[color:var(--accent)]/90 text-white rounded-lg shadow-sm"
                        onClick={async () => {
                          const target = selectedBoxPokemon;
                          setSelectedBoxPokemonId(null);
                          if (target) await submitQuickMove(target, "team");
                        }}
                      >
                        Ajouter à l&apos;équipe
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-[color:var(--muted)] font-semibold">Échange avec :</span>
                        <select
                          onChange={async (e) => {
                            const targetToSwapId = e.target.value;
                            if (!targetToSwapId) return;
                            const teamMemberToMove = run.team.find((p) => p.id === targetToSwapId);
                            if (teamMemberToMove) {
                              const target = selectedBoxPokemon;
                              setSelectedBoxPokemonId(null);
                              setActionError(null);
                              setIsSaving(true);
                              try {
                                await submitRunEvents([
                                  {
                                    id: `swap-box-${Date.now()}`,
                                    timestamp: new Date().toISOString(),
                                    type: "pokemon.moved" as const,
                                    payload: { pokemon: teamMemberToMove, target: "box" as const },
                                  },
                                  {
                                    id: `swap-team-${Date.now()}`,
                                    timestamp: new Date().toISOString(),
                                    type: "pokemon.moved" as const,
                                    payload: { pokemon: target, target: "team" as const },
                                  },
                                ]);
                                startTransition(() => router.refresh());
                              } catch {
                                setActionError("Impossible de réaliser l'échange.");
                              } finally {
                                setIsSaving(false);
                              }
                            }
                          }}
                          className="rounded bg-[color:var(--surface-strong)] border border-[color:var(--line)] text-[10px] text-[color:var(--text)] px-1.5 py-0.5 max-w-[120px] font-semibold"
                        >
                          <option value="">Sélectionner...</option>
                          {run.team.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nickname ?? p.species}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex gap-0.5 ml-auto">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 w-7 p-0 hover:text-[color:var(--accent)]"
                        onClick={() => openEditModal(selectedBoxPokemon)}
                        title="Modifier"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"
                        onClick={() => openFaintModal(selectedBoxPokemon)}
                        title="K.O. (Mort)"
                      >
                        <Skull className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 w-7 p-0 hover:text-[color:var(--accent-secondary)]"
                        onClick={() => loadPokemonIntoCalculator(selectedBoxPokemon)}
                        title="Calculer"
                      >
                        <Swords className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* CEMETERY */}
            <Card className="p-6">
              <SectionHeading
                eyebrow="Pertes"
                title={`Cimetière${run.cemetery.length > 0 ? ` (${run.cemetery.length})` : ""}`}
                description="À la mémoire de ceux qui ont combattu vaillamment."
              />
              <div className="mt-4 space-y-2 max-h-[36rem] overflow-y-auto pr-1">
                {run.cemetery.length > 0 ? (
                  run.cemetery.map((pokemon) => (
                    <div
                      key={pokemon.id}
                      className="flex items-center gap-3 rounded-xl border border-[color:var(--danger)]/15 bg-[color:var(--danger)]/4 px-3 py-2.5"
                    >
                      <div className="relative shrink-0">
                        <Image
                          src={cachedPokemonAssetUrl(pokemon.spriteUrl) ?? missingPokemonSpriteUrl}
                          alt={pokemon.species}
                          width={40}
                          height={40}
                          unoptimized
                          className="h-10 w-10 object-contain grayscale opacity-60"
                        />
                        <Skull className="absolute -bottom-1 -right-1 h-3 w-3 text-[color:var(--danger)]" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[color:var(--muted)] italic">
                            {capitalize(pokemon.nickname ?? pokemon.species)}
                          </p>
                          <span className="text-[10px] text-[color:var(--muted)]">Niv. {pokemon.level}</span>
                          {pokemon.shiny && <span className="text-[9px] text-[color:var(--warning)]">Shiny</span>}
                        </div>
                        <p className="text-[11px] text-[color:var(--muted)]/70 italic">
                          {capitalize(pokemon.species)}{pokemon.location ? ` · Capturé à : ${pokemon.location}` : ""}
                        </p>
                        {pokemon.note && (
                          <p className="text-[10px] text-[color:var(--danger)]/70 mt-0.5 italic">
                            {pokemon.note}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-[color:var(--success)]/30 bg-[color:var(--success)]/5 p-6 text-sm text-[color:var(--success)] text-center">
                    Aucun décès pour le moment. Continuez comme ça.
                  </div>
                )}
              </div>
            </Card>
          </div>


          {/* TIMELINE */}
          <Card className="p-6">
            <SectionHeading
              eyebrow="Chronologie"
              title="Événements récents"
              description="Historique complet des actions."
            />
            <div className="mt-6 space-y-3 max-h-[32rem] overflow-y-auto pr-1">
              {run.events.slice().reverse().map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-3 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-2">
                      <Pill>{formatEventType(event.type)}</Pill>
                      <Pill><span suppressHydrationWarning>{formatDate(event.timestamp)}</span></Pill>
                    </div>
                    <p className="text-sm text-[color:var(--text)]">
                      {renderEventDescription(event, party)}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[color:var(--muted)]" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ROADMAP & OBJECTIVES */}
        <div className="space-y-6">
          {/* TACTICAL COMPANION CARD */}
          <Card className="p-6">
            <SectionHeading
              eyebrow="Ressources & Stratégie"
              title="Compagnon Tactique"
              description="Consultez les faiblesses de votre équipe et accédez directement aux bases de données pour votre zone actuelle."
            />

            <div className="mt-6 space-y-5">
              <div className="rounded-xl border border-[color:var(--accent)]/25 bg-[color:var(--accent-soft)] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)] flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" /> Coach Nuzlocke
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Prochain cap</p>
                    <p className="mt-2 text-lg font-semibold text-[color:var(--text)]">
                      {activeMilestone ? `Niv. ${activeMilestone.levelCap}` : "Libre"}
                    </p>
                    <p className="mt-1 text-[11px] text-[color:var(--muted)]">{activeMilestone?.name ?? "Parcours principal terminé"}</p>
                  </div>
                  <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Zones consommées</p>
                    <p className="mt-2 text-lg font-semibold text-[color:var(--text)]">{consumedAreaNames.size}</p>
                    <p className="mt-1 text-[11px] text-[color:var(--muted)]">{availableRouteCount} encore sans rencontre connue</p>
                  </div>
                  <div className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">Règles à risque</p>
                    <p className="mt-2 text-lg font-semibold text-[color:var(--text)]">{coachRisks.length}</p>
                    <p className="mt-1 text-[11px] text-[color:var(--muted)]">{run.ruleMode === "custom" ? "Custom actif" : run.ruleMode === "hardcore" ? "Hardcore actif" : "Standard actif"}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {coachRisks.length > 0 ? coachRisks.map((risk) => (
                    <div key={risk} className="flex items-start gap-2 rounded-lg border border-[color:var(--warning)]/25 bg-[color:var(--warning)]/8 px-3 py-2 text-xs text-[color:var(--muted)]">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--warning)]" />
                      <span>{risk}</span>
                    </div>
                  )) : (
                    <div className="rounded-lg border border-[color:var(--success)]/25 bg-[color:var(--success)]/8 px-3 py-2 text-xs text-[color:var(--success)]">
                      Aucun risque de règle immédiat détecté pour l’état actuel.
                    </div>
                  )}
                </div>
                <div className="mt-4 border-t border-[color:var(--accent)]/20 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)]">Checks rapides</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 min-h-0 px-3 py-2 text-xs"
                      disabled={isSaving}
                      onClick={() => void submitManualRuleCheck("battle-style", "Mode Set respecté", "passed")}
                    >
                      Mode Set OK
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 min-h-0 px-3 py-2 text-xs"
                      disabled={isSaving}
                      onClick={() => void submitManualRuleCheck("battle-items", "Objet utilisé en combat", "failed")}
                    >
                      Objet utilisé
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 min-h-0 px-3 py-2 text-xs"
                      disabled={isSaving}
                      onClick={() => void submitManualRuleCheck("wipe", "Wipe déclaré", "failed")}
                    >
                      Wipe
                    </Button>
                    {gameProfile?.ruleContexts[0] ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 min-h-0 px-3 py-2 text-xs"
                        disabled={isSaving}
                        onClick={() => void submitManualRuleCheck(
                          gameProfile.ruleContexts[0]?.category === "raid" ? "raid" : "game-context",
                          gameProfile.ruleContexts[0]?.label ?? "Contexte spécifique",
                          "failed",
                          gameProfile.ruleContexts[0]?.id
                        )}
                      >
                        Contexte spécial
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* 1. Bulbapedia & Serebii Links */}
              <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--background-alt)] p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent)] flex items-center gap-1">
                  <Compass className="h-3.5 w-3.5" /> Bases de données externes
                </p>
                <p className="text-xs text-[color:var(--muted)] leading-relaxed">
                  Consultez les taux d&apos;apparition, les dresseurs et les statistiques officielles pour vous préparer :
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {(run.currentLocation ?? run.currentRoute) && (
                    <>
                      <a
                        href={`https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent((run.currentLocation ?? run.currentRoute ?? "").replace(/\s+/g, "_"))}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text)] hover:border-[color:var(--accent)] transition"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        Guide : {run.currentLocation ?? run.currentRoute}
                      </a>
                      <a
                        href={`https://www.serebii.net/search.shtml?q=${encodeURIComponent(run.currentLocation ?? run.currentRoute ?? "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-1.5 text-xs font-semibold text-[color:var(--text)] hover:border-[color:var(--accent)] transition"
                      >
                        <Search className="h-3.5 w-3.5" aria-hidden="true" />
                        Chercher
                      </a>
                    </>
                  )}
                  {activeMilestone && (
                    <a
                      href={`https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(activeMilestone.name.replace(/\s+/g, "_"))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-3 py-1.5 text-xs font-semibold text-[color:var(--accent-secondary)] hover:border-[color:var(--accent)] transition"
                    >
                      <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                      Combat : {activeMilestone.name}
                    </a>
                  )}
                </div>
              </div>

              {/* 2. Team Weakness analysis */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent-secondary)] flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" /> Analyse des types de l&apos;équipe
                </p>
                {run.team.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-[color:var(--muted)] leading-relaxed">
                      Vulnérabilités cumulées de votre équipe active face aux 18 types d&apos;attaques (score négatif = faiblesse, positif = résistance) :
                    </p>
                    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                      {teamWeaknesses.filter(w => w.score !== 0).slice(0, 6).map((weakness) => {
                        const isDangerous = weakness.score > 0;
                        return (
                          <div
                            key={weakness.type}
                            className={`rounded-lg border p-2 flex flex-col justify-between text-xs transition ${
                              isDangerous
                                ? "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5"
                                : "border-[color:var(--success)]/20 bg-[color:var(--success)]/5"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-semibold text-[color:var(--text)]">
                                {typeLabels[weakness.type] ?? weakness.type}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                isDangerous
                                  ? "bg-[color:var(--danger)]/15 text-[color:var(--danger)]"
                                  : "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                              }`}>
                                {weakness.score > 0 ? `-${weakness.score}` : `+${Math.abs(weakness.score)}`}
                              </span>
                            </div>
                            <div className="text-[10px] text-[color:var(--muted)] mt-1 flex justify-between">
                              <span>Faibles : {weakness.weakCount}</span>
                              <span>Résist. : {weakness.resistCount}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {teamWeaknesses.filter(w => w.score > 1).length > 0 && (
                      <p className="text-[11px] text-[color:var(--danger)] font-semibold flex items-center gap-1 animate-pulse mt-2">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Attention : Faiblesse commune élevée face aux types : {
                          teamWeaknesses
                            .filter(w => w.score > 1)
                            .map(w => typeLabels[w.type] ?? w.type)
                            .join(", ")
                        }.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[color:var(--muted)] italic">
                    Ajoutez des Pokémon à votre équipe pour analyser sa couverture.
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <SectionHeading
              eyebrow="Audit"
              title="Exceptions de règles"
              description="Chaque override accepté reste visible avec sa raison et les règles concernées."
            />
            <div className="mt-5 space-y-3">
              {ruleOverrideEvents.length > 0 ? ruleOverrideEvents.slice().reverse().map((event) => (
                <div key={event.id} className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill><span suppressHydrationWarning>{formatDate(event.timestamp)}</span></Pill>
                    <Pill>{event.payload.eventIds.length} événement{event.payload.eventIds.length > 1 ? "s" : ""}</Pill>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-[color:var(--text)]">{event.payload.reason}</p>
                  {event.payload.violations.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--danger)]">Infractions</p>
                      {event.payload.violations.map((violation) => (
                        <p key={violation} className="text-xs leading-5 text-[color:var(--muted)]">{violation}</p>
                      ))}
                    </div>
                  ) : null}
                  {event.payload.warnings.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--warning)]">Avertissements</p>
                      {event.payload.warnings.map((warning) => (
                        <p key={warning} className="text-xs leading-5 text-[color:var(--muted)]">{warning}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-[color:var(--line)] bg-[color:var(--background-alt)] p-5 text-sm text-[color:var(--muted)]">
                  Aucune exception enregistrée pour cette run.
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <SectionHeading
              eyebrow={run.gameTitle}
              title="Feuille de route"
              description="Le parcours de progression recommandé."
            />
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label="Étapes" value={gameProfile?.milestones.length ?? pack?.routes.length ?? 0} />
                <StatCard label="Règles actives" value={activeRulesCount} />
              </div>
              <div className="flex flex-wrap gap-2">
                {run.rules.speciesClause.enabled ? <Pill>Clause des espèces</Pill> : null}
                {run.rules.firstEncounter.shinyExempts ? <Pill>Clause Shiny</Pill> : null}
                {run.rules.dupesClause.enabled ? <Pill>Clause des doublons</Pill> : null}
                {run.rules.levelCaps.policy === "strict" ? <Pill>Limite stricte</Pill> : <Pill>Limite conseillée</Pill>}
                {run.rules.battle.style === "set" ? <Pill>Mode Set</Pill> : null}
                {!run.rules.battle.allowBattleItems ? <Pill>Sans objet en combat</Pill> : null}
                <Pill>{run.ruleMode === "custom" ? "Custom" : run.ruleMode === "hardcore" ? "Hardcore" : "Standard"}</Pill>
              </div>
              <Divider />
              <div className="space-y-3">
                {gameProfile ? gameProfile.milestones.map((milestone: ProgressMilestone, index: number) => {
                  const isActive = index === run.badges.length;
                  const isCompleted = index < run.badges.length;
                  return (
                    <div
                      key={milestone.name}
                      className={`rounded-2xl border p-4 transition relative ${
                        isCompleted
                          ? "border-[color:var(--success)]/20 bg-[color:var(--success)]/5 opacity-70"
                          : isActive
                            ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] shadow-sm"
                            : "border-[color:var(--line)] bg-[color:var(--surface-strong)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-sm text-[color:var(--text)]">{milestone.name}</h3>
                            {isCompleted && (
                              <span className="rounded bg-[color:var(--success)]/10 text-[color:var(--success)] text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5">
                                Complété
                              </span>
                            )}
                            {isActive && (
                              <span className="rounded bg-[color:var(--accent)]/15 text-[color:var(--accent)] text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 animate-pulse">
                                En cours
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-[color:var(--accent-secondary)]">{milestone.objective}</p>
                          <p className="text-xs leading-relaxed text-[color:var(--muted)] pt-1">{milestone.advice}</p>
                        </div>
                        <Pill>Niv. {milestone.levelCap}</Pill>
                      </div>
                    </div>
                  );
                }) : pack?.routes.map((route: RouteDefinition) => (
                  <div
                    key={route.id}
                    className="rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium text-[color:var(--text)]">{route.name}</h3>
                        <p className="mt-1 text-sm text-[color:var(--muted)]">{route.notes}</p>
                      </div>
                      <Pill>Niv. {route.levelCap}</Pill>
                    </div>
                    <div className="mt-3 space-y-2">
                      {route.bosses.map((boss: RouteBoss) => (
                        <div
                          key={`${route.id}-${boss.name}`}
                          className="flex items-center justify-between gap-4 rounded-lg border border-[color:var(--line)] bg-[color:var(--background-alt)] px-4 py-2 text-sm"
                        >
                          <span>{boss.name}</span>
                          <span className="text-[color:var(--muted)]">
                            {boss.pokemon} Niv. {boss.level}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
