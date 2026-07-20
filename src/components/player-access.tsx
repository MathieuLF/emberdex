"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clipboard,
  Copy,
  Eye,
  Gamepad2,
  ListChecks,
  Play,
  RotateCcw,
  Save,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  cloneRuleSet,
  describeRulePreset,
  getBuiltInRuleTemplates,
  getRuleSetPreset,
  ruleTemplateSchema,
  summarizeRuleSetDecisions,
  type RuleDecisionStatus,
  type RuleMode,
  type RuleSet,
  type RuleTemplate,
} from "@emberdex/core";
import { Button, Card, Input, Pill, SectionHeading, Select, Textarea } from "@/components/ui";
import {
  GAME_CATALOG,
  getGameById,
  getStarterById,
  type StarterProfile,
} from "@/lib/game-catalog";
import { cn } from "@/lib/cn";

type CreatedRun = {
  code: string;
  gameTitle: string;
  starterName: string;
  ruleMode: RuleMode;
  templateName?: string;
};

const generationLabels: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
  6: "VI",
  7: "VII",
  8: "VIII",
  9: "IX",
};

const statusLabels: Record<RuleDecisionStatus, string> = {
  allow: "Autorisé",
  warn: "Avertissement",
  block: "Bloquant",
};

const statusClasses: Record<RuleDecisionStatus, string> = {
  allow: "border-[color:var(--success)]/25 bg-[color:var(--success)]/8 text-[color:var(--success)]",
  warn: "border-[color:var(--warning)]/25 bg-[color:var(--warning)]/8 text-[color:var(--warning)]",
  block: "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/8 text-[color:var(--danger)]",
};

const LOCAL_TEMPLATE_STORAGE_KEY = "emberdex.localRuleTemplates";

function isLocalTemplate(template?: RuleTemplate | null) {
  return Boolean(template?.id.startsWith("local-template-"));
}

function readLocalTemplates(): RuleTemplate[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_TEMPLATE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => ruleTemplateSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data);
  } catch {
    return [];
  }
}

function writeLocalTemplates(templates: RuleTemplate[]) {
  window.localStorage.setItem(LOCAL_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function updateRuleSet(rules: RuleSet, patch: Partial<RuleSet>): RuleSet {
  return {
    ...rules,
    ...patch,
    firstEncounter: { ...rules.firstEncounter, ...patch.firstEncounter },
    speciesClause: { ...rules.speciesClause, ...patch.speciesClause },
    dupesClause: { ...rules.dupesClause, ...patch.dupesClause },
    levelCaps: { ...rules.levelCaps, ...patch.levelCaps },
    fainting: { ...rules.fainting, ...patch.fainting },
    battle: { ...rules.battle, ...patch.battle },
    gameSpecific: {
      ...rules.gameSpecific,
      ...patch.gameSpecific,
      contextIds: patch.gameSpecific?.contextIds ?? rules.gameSpecific.contextIds,
      notes: patch.gameSpecific?.notes ?? rules.gameSpecific.notes,
    },
  };
}

function modeLabel(mode: RuleMode) {
  return mode === "custom" ? "Custom" : mode === "hardcore" ? "Hardcore" : "Standard";
}

function templateOriginLabel(template: RuleTemplate) {
  if (template.builtIn) {
    return "Intégré";
  }

  return isLocalTemplate(template) ? "Local" : "Perso";
}

export function PlayerAccess() {
  const router = useRouter();
  const [selectedGameId, setSelectedGameId] = useState("leafgreen");
  const [starterId, setStarterId] = useState("bulbasaur");
  const [ruleMode, setRuleMode] = useState<RuleMode>("standard");
  const [customRules, setCustomRules] = useState<RuleSet>(() => getRuleSetPreset("standard"));
  const [templates, setTemplates] = useState<RuleTemplate[]>(() => getBuiltInRuleTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState("builtin-standard");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateGameScoped, setTemplateGameScoped] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [createdRun, setCreatedRun] = useState<CreatedRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    const localTemplates = readLocalTemplates();
    if (localTemplates.length) {
      setTemplates((current) => [
        ...current,
        ...localTemplates.filter((template) => !current.some((entry) => entry.id === template.id)),
      ]);
    }

    fetch("/api/rule-templates")
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { templates?: RuleTemplate[] } | null) => {
        if (active && payload?.templates?.length) {
          const latestLocal = readLocalTemplates();
          setTemplates([
            ...payload.templates,
            ...latestLocal.filter((template) => !payload.templates!.some((entry) => entry.id === template.id)),
          ]);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const selectedGame = getGameById(selectedGameId) ?? GAME_CATALOG[0];
  const starterOptions = selectedGame.starterIds
    .map((id) => getStarterById(id))
    .filter((starter): starter is StarterProfile => Boolean(starter));
  const selectedStarter = getStarterById(starterId) ?? starterOptions[0];
  const availableTemplates = templates.filter((template) => !template.gameId || template.gameId === selectedGame.id);
  const selectedTemplate = availableTemplates.find((template) => template.id === selectedTemplateId)
    ?? availableTemplates[0]
    ?? null;
  const selectedRules = ruleMode === "custom"
    ? customRules
    : selectedTemplate?.rules ?? getRuleSetPreset(ruleMode);
  const firstMilestone = selectedGame.milestones[0];
  const preview = summarizeRuleSetDecisions(selectedRules, selectedGame.ruleContexts);
  const previewCounts = preview.reduce(
    (counts, item) => ({ ...counts, [item.status]: counts[item.status] + 1 }),
    { allow: 0, warn: 0, block: 0 }
  );

  function applyTemplate(template: RuleTemplate) {
    setSelectedTemplateId(template.id);
    setRuleMode(template.baseMode);
    setCustomRules(cloneRuleSet(template.rules));
    setTemplateGameScoped(Boolean(template.gameId));
    setTemplateMessage(null);
  }

  function chooseRuleMode(mode: RuleMode) {
    const builtInId = mode === "hardcore" ? "builtin-hardcore" : "builtin-standard";
    const template = templates.find((entry) => entry.id === builtInId);

    setRuleMode(mode);
    setSelectedTemplateId(template?.id ?? builtInId);
    setCustomRules(getRuleSetPreset(mode));
    setTemplateGameScoped(false);
    setTemplateMessage(null);
  }

  function patchCustomRules(patch: Partial<RuleSet>) {
    setRuleMode("custom");
    setCustomRules((current) => updateRuleSet(current, patch));
  }

  function upsertTemplate(template: RuleTemplate) {
    setTemplates((current) => [...current.filter((entry) => entry.id !== template.id), template]);
    applyTemplate(template);
  }

  function clearTemplateDraft() {
    setTemplateName("");
    setTemplateDescription("");
  }

  function toggleGameContext(contextId: string, checked: boolean) {
    const currentIds = new Set(customRules.gameSpecific.contextIds);
    if (checked) {
      currentIds.add(contextId);
    } else {
      currentIds.delete(contextId);
    }

    patchCustomRules({
      gameSpecific: {
        ...customRules.gameSpecific,
        enabled: true,
        contextIds: Array.from(currentIds),
      },
    });
  }

  function chooseGame(gameId: string) {
    const game = getGameById(gameId);
    if (!game) {
      return;
    }

    setSelectedGameId(game.id);
    setStarterId(game.starterIds[0]);
    setCreatedRun(null);
    setError(null);
    if (!templates.some((template) => template.id === selectedTemplateId && (!template.gameId || template.gameId === game.id))) {
      const fallback = templates.find((template) => template.id === "builtin-standard") ?? templates[0];
      if (fallback) {
        applyTemplate(fallback);
      }
    }
    setCustomRules((current) => ({
      ...current,
      gameSpecific: {
        ...current.gameSpecific,
        contextIds: current.gameSpecific.contextIds.filter((id) => game.ruleContexts.some((context) => context.id === id)),
      },
    }));
  }

  async function saveCurrentTemplate() {
    const name = templateName.trim();
    if (name.length < 2) {
      setError("Donnez un nom au template avant de l’enregistrer.");
      return;
    }

    setError(null);
    setTemplateMessage(null);
    setIsSavingTemplate(true);

    try {
      const response = await fetch("/api/rule-templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description: templateDescription.trim() || `Template ${modeLabel(ruleMode)} créé depuis le builder joueur.`,
          baseMode: ruleMode,
          gameId: templateGameScoped ? selectedGame.id : undefined,
          rules: selectedRules,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { template?: RuleTemplate; message?: string } | null;

      if (response.status === 401) {
        const now = new Date().toISOString();
        const localTemplate: RuleTemplate = {
          id: `local-template-${now.replace(/[^0-9]/g, "")}`,
          name,
          description: templateDescription.trim() || `Template ${modeLabel(ruleMode)} créé depuis le builder joueur.`,
          baseMode: ruleMode,
          gameId: templateGameScoped ? selectedGame.id : undefined,
          rules: cloneRuleSet(selectedRules),
          createdAt: now,
          updatedAt: now,
          builtIn: false,
        };
        const localTemplates = [...readLocalTemplates().filter((entry) => entry.id !== localTemplate.id), localTemplate];
        writeLocalTemplates(localTemplates);
        upsertTemplate(localTemplate);
        clearTemplateDraft();
        setTemplateMessage("Template enregistré dans ce navigateur.");
        return;
      }

      if (!response.ok || !payload?.template) {
        setError(payload?.message ?? "Impossible d’enregistrer ce template.");
        return;
      }

      upsertTemplate(payload.template);
      clearTemplateDraft();
      setTemplateMessage("Template enregistré et sélectionné.");
    } catch {
      setError("Emberdex n’arrive pas à enregistrer ce template pour le moment.");
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function updateSelectedTemplate() {
    if (!selectedTemplate || selectedTemplate.builtIn) {
      setError("Dupliquez d’abord un template intégré avant de le modifier.");
      return;
    }

    const name = templateName.trim() || selectedTemplate.name;
    const description = templateDescription.trim() || selectedTemplate.description;

    setError(null);
    setTemplateMessage(null);
    setIsSavingTemplate(true);

    try {
      if (isLocalTemplate(selectedTemplate)) {
        const updatedTemplate: RuleTemplate = {
          ...selectedTemplate,
          name,
          description,
          baseMode: ruleMode,
          gameId: templateGameScoped ? selectedGame.id : undefined,
          rules: cloneRuleSet(selectedRules),
          updatedAt: new Date().toISOString(),
          builtIn: false,
        };
        const localTemplates = [
          ...readLocalTemplates().filter((entry) => entry.id !== updatedTemplate.id),
          updatedTemplate,
        ];
        writeLocalTemplates(localTemplates);
        upsertTemplate(updatedTemplate);
        clearTemplateDraft();
        setTemplateMessage("Template local mis à jour.");
        return;
      }

      const response = await fetch(`/api/rule-templates/${selectedTemplate.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          baseMode: ruleMode,
          gameId: templateGameScoped ? selectedGame.id : undefined,
          rules: selectedRules,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { template?: RuleTemplate; message?: string } | null;

      if (!response.ok || !payload?.template) {
        setError(payload?.message ?? "Impossible de mettre à jour ce template.");
        return;
      }

      upsertTemplate(payload.template);
      clearTemplateDraft();
      setTemplateMessage("Template mis à jour.");
    } catch {
      setError("Emberdex n’arrive pas à mettre à jour ce template pour le moment.");
    } finally {
      setIsSavingTemplate(false);
    }
  }

  function duplicateSelectedTemplate() {
    if (!selectedTemplate) {
      return;
    }

    setRuleMode("custom");
    setCustomRules(cloneRuleSet(selectedTemplate.rules));
    setTemplateName(`Copie de ${selectedTemplate.name}`);
    setTemplateDescription(selectedTemplate.description);
    setTemplateGameScoped(Boolean(selectedTemplate.gameId));
    setTemplateMessage("Copie prête à enregistrer comme nouveau template.");
    setError(null);
  }

  function deleteSelectedLocalTemplate() {
    if (!selectedTemplate || !isLocalTemplate(selectedTemplate)) {
      return;
    }

    if (!window.confirm(`Supprimer le template local "${selectedTemplate.name}" de ce navigateur ?`)) {
      return;
    }

    const localTemplates = readLocalTemplates().filter((entry) => entry.id !== selectedTemplate.id);
    writeLocalTemplates(localTemplates);

    const remaining = templates.filter((entry) => entry.id !== selectedTemplate.id);
    const fallback = remaining.find((entry) => entry.id === "builtin-standard") ?? remaining[0];
    setTemplates(remaining);
    if (fallback) {
      applyTemplate(fallback);
    }
    setTemplateMessage("Template local supprimé.");
    setError(null);
  }

  async function createGame(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCreatedRun(null);
    setIsCreating(true);

    try {
      const response = await fetch("/api/player-runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          gameId: selectedGame.id,
          starterId: selectedStarter.id,
          ruleMode,
          ruleTemplateId: isLocalTemplate(selectedTemplate) ? undefined : selectedTemplate?.id,
          rules: selectedRules,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { code?: string; message?: string; run?: { gameTitle: string } }
        | null;

      if (!response.ok || !payload?.code || !payload.run) {
        setError(payload?.message ?? "Impossible de préparer cette partie.");
        return;
      }

      setCreatedRun({
        code: payload.code,
        gameTitle: payload.run.gameTitle,
        starterName: selectedStarter.name,
        ruleMode,
        templateName: selectedTemplate?.name,
      });
    } catch {
      setError("Emberdex n’arrive pas à créer la partie pour le moment. Réessayez dans quelques instants.");
    } finally {
      setIsCreating(false);
    }
  }

  async function continueGame(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeCode(code);

    if (normalized.length !== 6) {
      setError("Saisissez le code de partie à 6 caractères.");
      return;
    }

    setError(null);
    setIsContinuing(true);

    try {
      const response = await fetch(`/api/runs/${normalized}`);
      if (!response.ok) {
        setError(response.status === 404 ? "Aucune sauvegarde ne correspond à ce code." : "Impossible d’ouvrir cette sauvegarde.");
        return;
      }

      startTransition(() => {
        router.push(`/run/${normalized}`);
      });
    } catch {
      setError("Emberdex n’arrive pas à ouvrir cette sauvegarde pour le moment.");
    } finally {
      setIsContinuing(false);
    }
  }

  async function copyCode() {
    if (!createdRun) {
      return;
    }

    try {
      await navigator.clipboard?.writeText(createdRun.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError(`Impossible de copier automatiquement. Votre code est ${createdRun.code}.`);
    }
  }

  return (
    <Card className="p-5 sm:p-7 lg:p-8">
      <SectionHeading
        eyebrow="Nouvelle aventure"
        title="Préparez un Nuzlocke qui correspond vraiment à votre jeu"
        description="Choisissez votre version, votre starter et un template de règles. Emberdex garde une copie des règles dans la partie."
      />

      <div className="mt-7 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <form onSubmit={createGame} className="space-y-7 rounded-[1.35rem] border border-[color:var(--accent)]/30 bg-[color:var(--surface-strong)] p-5 sm:p-7">
          <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr] md:items-start">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent)] font-[family-name:var(--font-mono-face)] text-sm font-semibold text-[#03121d]">1</span>
              <div>
                <h3 className="font-semibold text-[color:var(--text)]">Jeu et starter</h3>
                <p className="text-sm text-[color:var(--muted)]">Chaque version garde sa progression et ses starters.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="sr-only">Jeu Pokémon</span>
                <Select value={selectedGame.id} onChange={(event) => chooseGame(event.target.value)}>
                  {Object.keys(generationLabels).map(Number).map((generation) => (
                    <optgroup key={generation} label={`Génération ${generationLabels[generation]}`}>
                      {GAME_CATALOG.filter((game) => game.generation === generation).map((game) => (
                        <option key={game.id} value={game.id}>{game.title}</option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                <p className="text-xs text-[color:var(--muted)]">Départ : {selectedGame.startingLocation}</p>
              </label>

              <div className={cn("grid gap-3", starterOptions.length === 1 ? "grid-cols-1 sm:max-w-64" : "grid-cols-1 sm:grid-cols-3")}>
                {starterOptions.map((starter) => {
                  const selected = starter.id === selectedStarter.id;
                  return (
                    <button
                      key={starter.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setStarterId(starter.id)}
                      className={cn(
                        "group rounded-2xl border p-4 text-left transition hover:-translate-y-0.5",
                        selected
                          ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)] shadow-[0_18px_45px_rgba(0,0,0,0.2)]"
                          : "border-[color:var(--line)] bg-[color:var(--background-alt)] hover:border-[color:var(--accent)]/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <Image src={starter.spriteUrl} alt={starter.name} width={88} height={88} unoptimized className="h-20 w-20 object-contain transition group-hover:scale-105" />
                        {selected ? <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--accent)] text-[#03121d]"><Check className="h-3.5 w-3.5" /></span> : null}
                      </div>
                      <p className="mt-2 font-semibold text-[color:var(--text)]">{starter.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[color:var(--muted)]">{starter.types.join(" / ")}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent)] font-[family-name:var(--font-mono-face)] text-sm font-semibold text-[#03121d]">2</span>
              <div>
                <h3 className="font-semibold text-[color:var(--text)]">Template de règles</h3>
                <p className="text-sm text-[color:var(--muted)]">Choisissez une base, puis adaptez-la si nécessaire.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { id: "standard" as const, icon: Gamepad2, title: "Standard", text: "L’essentiel, avec avertissements et souplesse." },
                { id: "hardcore" as const, icon: Shield, title: "Hardcore", text: "Level caps stricts, Set, aucun objet en combat." },
                { id: "custom" as const, icon: SlidersHorizontal, title: "Custom", text: "Composez votre propre Nuzlocke à partir des règles concrètes." },
              ]).map((mode) => {
                const selected = ruleMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseRuleMode(mode.id)}
                    className={cn(
                      "flex gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5",
                      selected ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]" : "border-[color:var(--line)] bg-[color:var(--background-alt)]"
                    )}
                  >
                    <mode.icon className={cn("mt-0.5 h-5 w-5 shrink-0", selected ? "text-[color:var(--accent)]" : "text-[color:var(--muted)]")} />
                    <span>
                      <span className="block font-semibold text-[color:var(--text)]">{mode.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-[color:var(--muted)]">{mode.text}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-[color:var(--muted)]">Template réutilisable</span>
              <Select
                value={selectedTemplate?.id ?? ""}
                onChange={(event) => {
                  const template = availableTemplates.find((entry) => entry.id === event.target.value);
                  if (template) {
                    applyTemplate(template);
                  }
                }}
              >
                {availableTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {templateOriginLabel(template)} - {template.name}
                  </option>
                ))}
              </Select>
              {selectedTemplate ? (
                <div className="space-y-3">
                  <p className="text-xs leading-5 text-[color:var(--muted)]">{selectedTemplate.description}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill>{templateOriginLabel(selectedTemplate)}</Pill>
                    <Pill>{modeLabel(selectedTemplate.baseMode)}</Pill>
                    {selectedTemplate.gameId ? <Pill>{selectedTemplate.gameId}</Pill> : <Pill>Global</Pill>}
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 min-h-0 px-3 py-2 text-xs"
                      onClick={duplicateSelectedTemplate}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Dupliquer
                    </Button>
                    {!selectedTemplate.builtIn ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 min-h-0 px-3 py-2 text-xs"
                        onClick={() => void updateSelectedTemplate()}
                        disabled={isSavingTemplate}
                      >
                        <Save className="h-3.5 w-3.5" />
                        Mettre à jour
                      </Button>
                    ) : null}
                    {isLocalTemplate(selectedTemplate) ? (
                      <Button
                        type="button"
                        variant="danger"
                        className="h-9 min-h-0 px-3 py-2 text-xs"
                        onClick={deleteSelectedLocalTemplate}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Supprimer local
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent)] font-[family-name:var(--font-mono-face)] text-sm font-semibold text-[#03121d]">3</span>
              <div>
                <h3 className="font-semibold text-[color:var(--text)]">Personnalisation</h3>
                <p className="text-sm text-[color:var(--muted)]">Les modifications basculent automatiquement en Custom.</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-alt)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[color:var(--text)]">
                  {ruleMode === "custom" ? "Règles personnalisées" : ruleMode === "hardcore" ? "Règles Hardcore" : "Règles Standard"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {describeRulePreset(selectedRules).slice(0, 5).map((rule) => (
                    <Pill key={rule}>{rule}</Pill>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
                  <input
                    type="checkbox"
                    checked={customRules.firstEncounter.enabled}
                    onChange={(event) => patchCustomRules({ firstEncounter: { ...customRules.firstEncounter, enabled: event.target.checked } })}
                  />
                  Première rencontre par zone
                </label>
                <label className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
                  <input
                    type="checkbox"
                    checked={customRules.speciesClause.enabled}
                    onChange={(event) => patchCustomRules({ speciesClause: { ...customRules.speciesClause, enabled: event.target.checked } })}
                  />
                  Clause des espèces
                </label>
                <label className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
                  <input
                    type="checkbox"
                    checked={customRules.dupesClause.enabled}
                    onChange={(event) => patchCustomRules({ dupesClause: { ...customRules.dupesClause, enabled: event.target.checked } })}
                  />
                  Clause des doublons
                </label>
                <label className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
                  <input
                    type="checkbox"
                    checked={customRules.firstEncounter.shinyExempts}
                    onChange={(event) => patchCustomRules({ firstEncounter: { ...customRules.firstEncounter, shinyExempts: event.target.checked } })}
                  />
                  Shiny autorisés hors zone
                </label>
                <label className="block space-y-2 text-sm text-[color:var(--muted)]">
                  <span>Level caps</span>
                  <Select
                    value={customRules.levelCaps.policy}
                    onChange={(event) => patchCustomRules({
                      levelCaps: {
                        ...customRules.levelCaps,
                        enabled: event.target.value !== "off",
                        policy: event.target.value as RuleSet["levelCaps"]["policy"],
                      },
                    })}
                  >
                    <option value="advisory">Conseillés</option>
                    <option value="strict">Stricts</option>
                    <option value="off">Désactivés</option>
                  </Select>
                </label>
                <label className="block space-y-2 text-sm text-[color:var(--muted)]">
                  <span>Cadeaux</span>
                  <Select
                    value={customRules.firstEncounter.giftPolicy}
                    onChange={(event) => patchCustomRules({
                      firstEncounter: {
                        ...customRules.firstEncounter,
                        giftPolicy: event.target.value as RuleSet["firstEncounter"]["giftPolicy"],
                      },
                    })}
                  >
                    <option value="free">Libres</option>
                    <option value="count">Comptent pour le lieu</option>
                    <option value="separate">Rencontre séparée</option>
                  </Select>
                </label>
                <label className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
                  <input
                    type="checkbox"
                    checked={customRules.battle.style === "set"}
                    onChange={(event) => patchCustomRules({ battle: { ...customRules.battle, style: event.target.checked ? "set" : "switch" } })}
                  />
                  Mode Set
                </label>
                <label className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
                  <input
                    type="checkbox"
                    checked={!customRules.battle.allowBattleItems}
                    onChange={(event) => patchCustomRules({ battle: { ...customRules.battle, allowBattleItems: !event.target.checked } })}
                  />
                  Interdire les objets en combat
                </label>
                <label className="flex items-center gap-3 text-sm text-[color:var(--muted)]">
                  <input
                    type="checkbox"
                    checked={customRules.fainting.wipeEndsRun}
                    onChange={(event) => patchCustomRules({ fainting: { ...customRules.fainting, wipeEndsRun: event.target.checked } })}
                  />
                  Wipe permanente
                </label>
                <label className="block space-y-2 text-sm text-[color:var(--muted)]">
                  <span>Rare candies max</span>
                  <Input
                    type="number"
                    min={0}
                    value={customRules.levelCaps.rareCandyLimit}
                    onChange={(event) => patchCustomRules({ levelCaps: { ...customRules.levelCaps, rareCandyLimit: Number(event.target.value) } })}
                  />
                </label>
              </div>

              {selectedGame.ruleContexts.length > 0 ? (
                <div className="mt-4 border-t border-[color:var(--line)] pt-4">
                  <p className="text-sm font-semibold text-[color:var(--text)]">Contextes spécifiques à {selectedGame.title}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {selectedGame.ruleContexts.map((context) => (
                      <label key={context.id} className="flex items-start gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-3 text-sm text-[color:var(--muted)]">
                        <input
                          type="checkbox"
                          checked={customRules.gameSpecific.contextIds.includes(context.id)}
                          onChange={(event) => toggleGameContext(context.id, event.target.checked)}
                          className="mt-1"
                        />
                        <span>
                          <span className="block text-[color:var(--text)]">{context.label}</span>
                          <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--accent-secondary)]">{context.category} - {context.defaultPolicy}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent)] font-[family-name:var(--font-mono-face)] text-sm font-semibold text-[#03121d]">4</span>
              <div>
                <h3 className="font-semibold text-[color:var(--text)]">Revue finale</h3>
                <p className="text-sm text-[color:var(--muted)]">Aperçu des règles avant création.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--background-alt)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Autorisé</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--success)]">{previewCounts.allow}</p>
              </div>
              <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--background-alt)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Avertissement</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--warning)]">{previewCounts.warn}</p>
              </div>
              <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--background-alt)] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">Override requis</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--danger)]">{previewCounts.block}</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {preview.map((item) => (
                <div key={item.id} className={cn("rounded-xl border p-3", statusClasses[item.status])}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <span className="text-[10px] uppercase tracking-[0.16em]">{statusLabels[item.status]}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--muted)]">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--background-alt)] p-4">
            <div className="flex items-center gap-2">
              <Save className="h-4 w-4 text-[color:var(--accent)]" />
              <p className="text-sm font-semibold text-[color:var(--text)]">Sauvegarder ces règles comme template</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Nom du template" />
              <label className="flex items-center gap-3 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm text-[color:var(--muted)]">
                <input type="checkbox" checked={templateGameScoped} onChange={(event) => setTemplateGameScoped(event.target.checked)} />
                Limiter à ce jeu
              </label>
            </div>
            <Textarea className="mt-3 min-h-20" value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} placeholder="Description optionnelle" />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => void saveCurrentTemplate()} disabled={isSavingTemplate}>
                <Save className="h-4 w-4" />
                {isSavingTemplate ? "Enregistrement..." : "Enregistrer le template"}
              </Button>
              {templateMessage ? <p className="text-sm text-[color:var(--success)]">{templateMessage}</p> : null}
            </div>
          </div>

          <Button type="submit" className="w-full sm:w-auto sm:min-w-64" disabled={isCreating || isPending}>
            <Sparkles className="h-4 w-4" />
            {isCreating ? "Préparation de l’aventure..." : "Créer mon Nuzlocke"}
          </Button>
        </form>

        <aside className="space-y-4">
          <form onSubmit={continueGame} className="rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Pill>Déjà commencé ?</Pill>
                <h3 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold text-[color:var(--text)]">Retrouver ma partie</h3>
                <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">Votre code vous ramène directement à votre équipe et à votre prochaine étape.</p>
              </div>
              <RotateCcw className="h-5 w-5 text-[color:var(--accent-secondary)]" />
            </div>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-medium text-[color:var(--muted)]">Votre code</span>
              <Input value={code} onChange={(event) => setCode(normalizeCode(event.target.value))} placeholder="A7K9Q2" inputMode="text" autoCapitalize="characters" maxLength={6} className="font-[family-name:var(--font-mono-face)] text-center text-lg font-semibold uppercase tracking-[0.22em]" />
            </label>

            <Button type="submit" variant="secondary" className="mt-4 w-full" disabled={isContinuing || isPending}>
              <Play className="h-4 w-4" />
              {isContinuing || isPending ? "Ouverture..." : "Ouvrir ma sauvegarde"}
            </Button>
          </form>

          <div className="rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--background-alt)] p-5">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-[color:var(--accent-secondary)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent-secondary)]">Première étape</p>
            </div>
            <h3 className="mt-2 font-semibold text-[color:var(--text)]">{firstMilestone.name}</h3>
            <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{firstMilestone.advice}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill>Niv. {firstMilestone.levelCap}</Pill>
              <Pill>{firstMilestone.objective}</Pill>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-[color:var(--line)] bg-[color:var(--background-alt)] p-5">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[color:var(--accent)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--accent)]">Résumé</p>
            </div>
            <div className="mt-4 space-y-3 text-sm text-[color:var(--muted)]">
              <p><span className="font-semibold text-[color:var(--text)]">{selectedGame.title}</span> avec {selectedStarter.name}</p>
              <p>Mode {modeLabel(ruleMode)}{selectedTemplate ? ` depuis ${selectedTemplate.name}` : ""}</p>
              <p>{previewCounts.block} règle{previewCounts.block > 1 ? "s" : ""} bloquante{previewCounts.block > 1 ? "s" : ""}, {previewCounts.warn} avertissement{previewCounts.warn > 1 ? "s" : ""}</p>
            </div>
          </div>
        </aside>
      </div>

      {createdRun ? (
        <div className="mt-5 rounded-2xl border border-[color:var(--success)]/35 bg-[color:var(--success)]/10 p-5" aria-live="polite">
          <p className="text-sm font-semibold text-[color:var(--success)]">Votre Nuzlocke est prêt</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-[family-name:var(--font-mono-face)] text-3xl font-semibold tracking-[0.18em] text-[color:var(--text)]">{createdRun.code}</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {createdRun.starterName} vous attend dans l’équipe de {createdRun.gameTitle}. Mode {modeLabel(createdRun.ruleMode)}{createdRun.templateName ? `, template ${createdRun.templateName}` : ""}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={copyCode}>
                <Clipboard className="h-4 w-4" />
                {copied ? "Copié" : "Copier le code"}
              </Button>
              <Link href={`/run/${createdRun.code}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-transparent bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[#03121d] transition hover:-translate-y-0.5 hover:brightness-110">
                <Play className="h-4 w-4" />
                Rejoindre l’aventure
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-5 rounded-xl border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm text-[color:var(--danger)]">{error}</p>
      ) : null}
    </Card>
  );
}
