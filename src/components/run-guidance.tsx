import Image from "next/image";
import type { RunSnapshot, PokemonSlot } from "@emberdex/core";
import { AlertTriangle, ArrowRight, ShieldCheck, Sparkles, Users, Swords, Info } from "lucide-react";
import { Card, Pill } from "@/components/ui";
import { getGameForRun, resolveBossTeam, STARTERS, type BossSlot, type GameRuleContext } from "@/lib/game-catalog";
import { pokemonSpriteUrl } from "@/lib/pokemon-assets";
import { formatContextCategory, formatContextPolicy } from "@/lib/rule-labels";

// ---------------------------------------------------------------------------
// Type chart for boss weakness analysis (attacker -> defender -> multiplier)
// ---------------------------------------------------------------------------
const typeEff: Record<string, Record<string, number>> = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5, grass: 2, ice: 2, bug: 2, steel: 2 },
  water:    { water: 0.5, grass: 0.5, dragon: 0.5, fire: 2, ground: 2, rock: 2 },
  electric: { electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0, flying: 2, water: 2 },
  grass:    { fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5, water: 2, ground: 2, rock: 2 },
  ice:      { fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5, grass: 2, ground: 2, flying: 2, dragon: 2 },
  fighting: { poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, ghost: 0, fairy: 0.5, normal: 2, ice: 2, rock: 2, dark: 2, steel: 2 },
  poison:   { poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, grass: 2, fairy: 2 },
  ground:   { grass: 0.5, bug: 0.5, flying: 0, fire: 2, electric: 2, poison: 2, rock: 2, steel: 2 },
  flying:   { electric: 0.5, rock: 0.5, steel: 0.5, grass: 2, fighting: 2, bug: 2 },
  psychic:  { psychic: 0.5, steel: 0.5, dark: 0, fighting: 2, poison: 2 },
  bug:      { fire: 0.5, fighting: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5, grass: 2, psychic: 2, dark: 2 },
  rock:     { fighting: 0.5, ground: 0.5, steel: 0.5, fire: 2, ice: 2, flying: 2, bug: 2 },
  ghost:    { normal: 0, dark: 0.5, ghost: 2, psychic: 2 },
  dragon:   { steel: 0.5, fairy: 0, dragon: 2 },
  dark:     { fighting: 0.5, dark: 0.5, fairy: 0.5, ghost: 2, psychic: 2 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5, ice: 2, rock: 2, fairy: 2 },
  fairy:    { fire: 0.5, poison: 0.5, steel: 0.5, fighting: 2, dragon: 2, dark: 2 },
};

function getEffectiveness(attackerType: string, defenderTypes: string[]): number {
  const chart = typeEff[attackerType.toLowerCase()] ?? {};
  return defenderTypes.reduce((acc, dt) => acc * (chart[dt.toLowerCase()] ?? 1), 1);
}

function computeBossAnalysis(myTeam: PokemonSlot[], bossTeam: BossSlot[]) {
  const bossTypes = Array.from(new Set(bossTeam.flatMap((b) => b.types)));

  const analysis = myTeam.map((pokemon) => {
    const myTypes: string[] = pokemon.types ?? [];

    // Best attack effectiveness against boss Pokémon (pick max across all boss)
    let bestAttack = 0;
    for (const boss of bossTeam) {
      for (const myType of myTypes) {
        const eff = getEffectiveness(myType, boss.types);
        if (eff > bestAttack) bestAttack = eff;
      }
    }

    // Worst defense: how effective are boss types against this Pokémon
    let worstDefense = 0;
    for (const bossType of bossTypes) {
      const eff = getEffectiveness(bossType, myTypes);
      if (eff > worstDefense) worstDefense = eff;
    }

    return { pokemon, bestAttack, worstDefense };
  });

  const recommended = analysis.filter((a) => a.bestAttack >= 2).sort((a, b) => b.bestAttack - a.bestAttack);
  const dangerous = analysis.filter((a) => a.worstDefense >= 2).sort((a, b) => b.worstDefense - a.worstDefense);
  const neutral = analysis.filter((a) => a.bestAttack < 2 && a.worstDefense < 2);

  return { recommended, dangerous, neutral };
}

const TYPE_FR: Record<string, string> = {
  normal: "Normal", fire: "Feu", water: "Eau", electric: "Électrik",
  grass: "Plante", ice: "Glace", fighting: "Combat", poison: "Poison",
  ground: "Sol", flying: "Vol", psychic: "Psy", bug: "Insecte",
  rock: "Roche", ghost: "Spectre", dragon: "Dragon", dark: "Ténèbres",
  steel: "Acier", fairy: "Fée",
};

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    normal: "bg-[#A8A878]/20 text-[#C8C8A8]", fire: "bg-[#F08030]/20 text-[#F09850]",
    water: "bg-[#6890F0]/20 text-[#7BAEF8]", electric: "bg-[#F8D030]/20 text-[#F8DC60]",
    grass: "bg-[#78C850]/20 text-[#98D850]", ice: "bg-[#98D8D8]/20 text-[#B8E8E8]",
    fighting: "bg-[#C03028]/20 text-[#E05848]", poison: "bg-[#A040A0]/20 text-[#C070C0]",
    ground: "bg-[#E0C068]/20 text-[#E8D078]", flying: "bg-[#A890F0]/20 text-[#C0B0F8]",
    psychic: "bg-[#F85888]/20 text-[#F878A0]", bug: "bg-[#A8B820]/20 text-[#C8D840]",
    rock: "bg-[#B8A038]/20 text-[#D8C058]", ghost: "bg-[#705898]/20 text-[#9070B0]",
    dragon: "bg-[#7038F8]/20 text-[#9060F8]", dark: "bg-[#705848]/20 text-[#907868]",
    steel: "bg-[#B8B8D0]/20 text-[#C8C8E0]", fairy: "bg-[#EE99AC]/20 text-[#F0A8BC]",
  };
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors[type.toLowerCase()] ?? "bg-white/10 text-white"}`}>
      {TYPE_FR[type.toLowerCase()] ?? capitalize(type)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PokeAPI name normalization - handles special characters per API conventions
// ---------------------------------------------------------------------------
const POKEAPI_NAME_OVERRIDES: Record<string, string> = {
  "mr. mime": "mr-mime",
  "mr mime": "mr-mime",
  "mime jr.": "mime-jr",
  "mime jr": "mime-jr",
  "mr. rime": "mr-rime",
  "mr rime": "mr-rime",
  "farfetch'd": "farfetchd",
  "farfetchd": "farfetchd",
  "nidoran♀": "nidoran-f",
  "nidoran♂": "nidoran-m",
  "nidoran-f": "nidoran-f",
  "nidoran-m": "nidoran-m",
  "flabébé": "flabebe",
  "type: null": "type-null",
  "jangmo-o": "jangmo-o",
  "hakamo-o": "hakamo-o",
  "kommo-o": "kommo-o",
  "porygon-z": "porygon-z",
  "ho-oh": "ho-oh",
  "chi-yu": "chi-yu",
  "chien-pao": "chien-pao",
  "ting-lu": "ting-lu",
  "wo-chien": "wo-chien",
};

function toBossApiName(species: string): string {
  const key = species.toLowerCase().trim();
  if (POKEAPI_NAME_OVERRIDES[key]) return POKEAPI_NAME_OVERRIDES[key];
  // General rule: lowercase, replace spaces/periods with hyphens, strip apostrophes
  return key.replace(/'/g, "").replace(/\./g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/-$/, "");
}

function BossSlotCard({ boss }: { boss: BossSlot }) {
  const apiName = toBossApiName(boss.species);
  const spriteUrl = pokemonSpriteUrl(apiName);
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-2 text-center min-w-[72px]">
      <Image
        src={spriteUrl}
        alt={boss.species}
        width={48}
        height={48}
        unoptimized
        className="h-12 w-12 object-contain"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
      <p className="text-[11px] font-semibold text-[color:var(--text)]">{capitalize(boss.species)}</p>
      <p className="text-[10px] text-[color:var(--muted)]">Niv. {boss.level}</p>
      <div className="flex flex-wrap justify-center gap-1">
        {boss.types.map((t) => <TypeBadge key={t} type={t} />)}
      </div>
    </div>
  );
}

function BossPreviewPanel({ run, bossTeam }: { run: RunSnapshot; bossTeam: BossSlot[] }) {
  const myTeam = run.team;
  if (myTeam.length === 0) {
    return (
      <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Analyse du boss</p>
        <p className="mt-2 text-sm text-[color:var(--muted)]">Ajoutez des Pokémon à votre équipe pour voir l'analyse de couverture.</p>
      </div>
    );
  }

  const { recommended, dangerous } = computeBossAnalysis(myTeam, bossTeam);

  return (
    <div className="space-y-3">
      {/* Boss team */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Équipe du boss</p>
        <div className="flex flex-wrap gap-2">
          {bossTeam.map((boss, i) => <BossSlotCard key={i} boss={boss} />)}
        </div>
      </div>

      {/* Your team analysis */}
      {recommended.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-[color:var(--success)]/30 bg-[color:var(--success)]/8 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--success)]" />
          <div>
            <p className="text-[11px] font-semibold text-[color:var(--success)]">Pokémon efficaces</p>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              {recommended.map((a) => capitalize(a.pokemon.nickname ?? a.pokemon.species)).join(" · ")}
            </p>
          </div>
        </div>
      )}
      {dangerous.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/8 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--danger)]" />
          <div>
            <p className="text-[11px] font-semibold text-[color:var(--danger)]">Pokémon en danger</p>
            <p className="mt-0.5 text-xs text-[color:var(--muted)]">
              {dangerous.map((a) => capitalize(a.pokemon.nickname ?? a.pokemon.species)).join(" · ")}
            </p>
          </div>
        </div>
      )}
      {recommended.length === 0 && dangerous.length === 0 && (
        <div className="flex gap-3 rounded-xl border border-[color:var(--warning)]/30 bg-[color:var(--warning)]/8 p-3">
          <Swords className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" />
          <p className="text-xs text-[color:var(--muted)]">Aucun type naturellement avantageux. Comptez sur les niveaux et la stratégie.</p>
        </div>
      )}
    </div>
  );
}

function SpecialRulesPanel({ rules, activeIds }: { rules: GameRuleContext[]; activeIds: string[] }) {
  const active = new Set(activeIds);

  return (
    <div className="rounded-2xl border border-[color:var(--accent)]/20 bg-[color:var(--accent-soft)] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Info className="h-3.5 w-3.5 text-[color:var(--accent)]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">Règles Nuzlocke spécifiques à ce jeu</p>
      </div>
      <ul className="space-y-1.5">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-start gap-2 text-xs text-[color:var(--muted)]">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--accent)]" />
              <span>
                {rule.label}
              <span className="ml-1 text-[10px] font-semibold text-[color:var(--accent)]">
                {formatContextCategory(rule.category)} · {formatContextPolicy(rule.defaultPolicy)}
              </span>
              {active.has(rule.id) ? (
                <span className="ml-1 text-[10px] font-semibold text-[color:var(--success)]">
                  actif
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getTeamAdvice(run: RunSnapshot, milestoneName: string) {
  if (run.cemetery.length > 0) {
    return {
      icon: AlertTriangle,
      title: "Rebâtir après une perte",
      text: `Avant ${milestoneName}, remplacez le rôle perdu plutôt que de simplement ajouter le Pokémon le plus fort disponible.`,
      tone: "text-[color:var(--warning)]",
    };
  }
  if (run.team.length <= 1) {
    return {
      icon: Users,
      title: "Élargir l'équipe",
      text: `Votre starter ne devrait pas porter seul la route vers ${milestoneName}. Cherchez deux partenaires aux rôles différents.`,
      tone: "text-[color:var(--accent-secondary)]",
    };
  }
  if (run.team.length < 4) {
    return {
      icon: Users,
      title: "Chercher de la couverture",
      text: "L'équipe prend forme. Ajoutez maintenant une réponse aux faiblesses communes plutôt qu'un doublon offensif.",
      tone: "text-[color:var(--accent-secondary)]",
    };
  }
  return {
    icon: ShieldCheck,
    title: "Préparer les remplaçants",
    text: "Votre équipe active est solide. Commencez à développer la boîte pour ne pas être démuni après une perte.",
    tone: "text-[color:var(--success)]",
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function RunGuidance({ run }: { run: RunSnapshot }) {
  const game = getGameForRun(run.gameTitle, run.versionGroup);
  if (!game) return null;

  const milestoneIndex = Math.min(run.badges.length, game.milestones.length - 1);
  const milestone = game.milestones[milestoneIndex];
  const journeyComplete = run.badges.length >= game.milestones.length;

  // Detect starter from first gift encounter or first encounter overall
  const starterEncounter = run.encounters.find((enc) => enc.outcome === "gift") ?? run.encounters[0];
  const starter = starterEncounter
    ? Object.values(STARTERS).find((s) => s.name.toLowerCase() === starterEncounter.species.toLowerCase())
    : null;

  // Determine starter type (primary) for starter-conditional boss teams
  const starterPrimaryType = starter?.types?.[0] ?? null;

  // Resolve the boss team using context (version + starter type)
  // versionBossTeams key: "sword" or "shield" (extracted from the game id)
  const resolvedBossTeam = resolveBossTeam(milestone, starterPrimaryType, game.id);

  // Determine if there's a version-specific context to label
  const isVersionSplit = !!milestone.versionBossTeams;
  const isStarterSplit = !!milestone.starterBossTeams;
  let bossContextLabel: string | null = null;
  if (isVersionSplit && resolvedBossTeam) {
    const versionLeaders: Record<string, string> = {
      sword: "Bea (Sword)", shield: "Allister (Shield)",
    };
    bossContextLabel = versionLeaders[game.id] ?? null;
    // Gordie/Melony
    if (milestone.name.includes("Circhester")) {
      bossContextLabel = game.id === "sword" ? "Gordie (Sword)" : "Melony (Shield)";
    }
  }
  if (isStarterSplit && resolvedBossTeam) {
    const starterLeaders: Record<string, string> = {
      grass: "Chili (Feu)", fire: "Cress (Eau)", water: "Cilan (Plante)",
    };
    bossContextLabel = starterLeaders[starterPrimaryType ?? ""] ?? null;
  }

  const teamAdvice = getTeamAdvice(run, milestone.name);
  const TeamAdviceIcon = teamAdvice.icon;
  const hasBoss = !journeyComplete && !!resolvedBossTeam && resolvedBossTeam.length > 0;

  return (
    <Card className="overflow-hidden p-6 sm:p-8">
      <div className="space-y-6">
        {/* Milestone + Boss row */}
        <div className={`grid gap-6 ${hasBoss ? "xl:grid-cols-[1fr_1fr]" : "xl:grid-cols-[1.2fr_0.8fr]"}`}>
          {/* Next milestone */}
          <div className="rounded-[1.35rem] border border-[color:var(--accent)]/30 bg-[color:var(--accent-soft)] p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Pill>{journeyComplete ? "Parcours terminé" : "Prochaine étape"}</Pill>
                  {!journeyComplete ? <Pill>Niv. {milestone.levelCap}</Pill> : null}
                </div>
                <p className="mt-5 text-sm font-medium text-[color:var(--accent)]">{journeyComplete ? "Défi accompli" : milestone.objective}</p>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold text-[color:var(--text)]">
                  {journeyComplete ? "Votre aventure principale est complète" : milestone.name}
                </h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--muted)]">
                  {journeyComplete
                    ? "Votre équipe et chaque moment marquant restent ici. Poursuivez avec vos propres objectifs ou préparez votre prochain Nuzlocke."
                    : milestone.advice}
                </p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-[#03121d]">
                <ArrowRight className="h-5 w-5" />
              </span>
            </div>
            {!journeyComplete && (
              <div className="mt-6 border-t border-[color:var(--accent)]/20 pt-5">
                <p className="text-sm leading-6 text-[color:var(--text)]">
                  <span className="font-semibold">Règle du moment :</span>{" "}
                  {run.rules.levelCaps.policy === "strict"
                    ? `ne dépassez pas le niveau ${milestone.levelCap} avant cette étape.`
                    : run.rules.levelCaps.policy === "advisory"
                      ? `gardez le niveau ${milestone.levelCap} comme repère pour conserver un défi équilibré.`
                      : "les limites de niveau sont désactivées pour cette partie."}
                </p>
              </div>
            )}
          </div>

          {/* Boss preview (si disponible) ou panneau de conseil */}
          {hasBoss ? (
            <div className="rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Swords className="h-4 w-4 text-[color:var(--danger)]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--danger)]">
                  Analyse du prochain boss
                  {bossContextLabel && (
                    <span className="ml-2 text-[color:var(--accent-secondary)] normal-case font-semibold">- {bossContextLabel}</span>
                  )}
                </p>
              </div>
              <BossPreviewPanel run={run} bossTeam={resolvedBossTeam!} />
            </div>

          ) : (
            <div className="grid gap-4">
              {starter && (
                <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
                  <Image src={starter.spriteUrl} alt={starter.name} width={76} height={76} unoptimized className="h-16 w-16 shrink-0 object-contain" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Votre starter</p>
                    <h3 className="mt-1 font-semibold text-[color:var(--text)]">Bien jouer {starter.name}</h3>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{starter.tip}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
                <TeamAdviceIcon className={`mt-0.5 h-5 w-5 shrink-0 ${teamAdvice.tone}`} />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Conseil d'équipe</p>
                  <h3 className="mt-1 font-semibold text-[color:var(--text)]">{teamAdvice.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{teamAdvice.text}</p>
                </div>
              </div>
              <div className="flex gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--accent)]" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Lecture rapide</p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">
                    {run.team.length} dans l'équipe · {run.box.length} en réserve · {run.cemetery.length} perte{run.cemetery.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Conseils d'équipe quand boss panel visible */}
        {hasBoss && (
          <div className="grid gap-4 sm:grid-cols-2">
            {starter && (
              <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
                <Image src={starter.spriteUrl} alt={starter.name} width={64} height={64} unoptimized className="h-14 w-14 shrink-0 object-contain" />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Votre starter</p>
                  <h3 className="mt-1 font-semibold text-[color:var(--text)]">{starter.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{starter.tip}</p>
                </div>
              </div>
            )}
            <div className="flex gap-4 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
              <TeamAdviceIcon className={`mt-0.5 h-5 w-5 shrink-0 ${teamAdvice.tone}`} />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Conseil d'équipe</p>
                <h3 className="mt-1 font-semibold text-[color:var(--text)]">{teamAdvice.title}</h3>
                <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{teamAdvice.text}</p>
              </div>
            </div>
          </div>
        )}

        {/* Special rules */}
        {game.ruleContexts.length > 0 && (
          <SpecialRulesPanel rules={game.ruleContexts} activeIds={run.rules.gameSpecific.contextIds} />
        )}
      </div>
    </Card>
  );
}
