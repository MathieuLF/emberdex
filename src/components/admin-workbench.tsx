"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { type AppState, type ContentPack, type RuleMode, type RuleSet, type RuleTemplate, type ThemeTokens, summarizeRun } from "@emberdex/core";
import { postJson } from "@/lib/client-api";
import { Button, Card, Divider, Input, Pill, SectionHeading, Select, StatCard, Textarea } from "@/components/ui";
import { Loader2, Download, Upload, Paintbrush, FileJson, Plus, Trash2, RotateCcw, Save } from "lucide-react";

type AdminWorkbenchProps = {
  state: AppState;
};

const themeFieldGroups: Array<Array<keyof ThemeTokens>> = [
  ["name", "background", "backgroundAlt", "surface"],
  ["surfaceStrong", "surfaceElevated", "line", "text"],
  ["muted", "accent", "accentSoft", "accentSecondary"],
  ["success", "warning", "danger", "glow"],
  ["shadow"],
];

const themeFieldLabels: Record<keyof ThemeTokens, string> = {
  name: "Nom",
  background: "Arrière-plan",
  backgroundAlt: "Arrière-plan secondaire",
  surface: "Surface",
  surfaceStrong: "Surface renforcée",
  surfaceElevated: "Surface surélevée",
  line: "Bordures",
  text: "Texte",
  muted: "Texte secondaire",
  accent: "Accent principal",
  accentSoft: "Accent doux",
  accentSecondary: "Accent secondaire",
  success: "Succès",
  warning: "Avertissement",
  danger: "Danger",
  glow: "Lueur",
  shadow: "Ombre",
};

type TemplateDraft = {
  id: string;
  name: string;
  description: string;
  baseMode: RuleMode;
  gameId: string;
  rulesText: string;
};

function createTemplateDraft(template?: RuleTemplate | null): TemplateDraft {
  return {
    id: template?.id ?? "",
    name: template?.name ?? "",
    description: template?.description ?? "",
    baseMode: template?.baseMode ?? "custom",
    gameId: template?.gameId ?? "",
    rulesText: JSON.stringify(template?.rules ?? {}, null, 2),
  };
}

function ThemeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-[color:var(--muted)]">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function formatStatus(status: "active" | "paused" | "completed" | "failed") {
  return {
    active: "Active",
    paused: "En pause",
    completed: "Terminée",
    failed: "Échouée",
  }[status] ?? status;
}

function formatDate(value?: string) {
  if (!value) return "Jamais";
  return new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminWorkbench({ state }: AdminWorkbenchProps) {
  const router = useRouter();
  const packs = Object.values(state.packs);
  const runs = Object.values(state.runs);
  const ruleTemplates = Object.values(state.ruleTemplates).sort((left, right) => left.name.localeCompare(right.name));
  const [selectedPackId, setSelectedPackId] = useState(packs[0]?.id ?? "mainline-core");
  const [theme, setTheme] = useState<ThemeTokens>(state.theme);
  const [packText, setPackText] = useState(() =>
    JSON.stringify(packs[0] ?? null, null, 2)
  );
  const [selectedRuleTemplateId, setSelectedRuleTemplateId] = useState(ruleTemplates[0]?.id ?? "");
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(() => createTemplateDraft(ruleTemplates[0]));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === selectedPackId) ?? packs[0] ?? null,
    [packs, selectedPackId]
  );

  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [runs]);

  const selectedRuleTemplate = useMemo(() => {
    return ruleTemplates.find((template) => template.id === selectedRuleTemplateId) ?? ruleTemplates[0] ?? null;
  }, [ruleTemplates, selectedRuleTemplateId]);

  const globalMetrics = useMemo(() => {
    let totalAlive = 0;
    let totalFallen = 0;
    let completedRuns = 0;

    runs.forEach((run) => {
      const sum = summarizeRun(run);
      totalAlive += sum.alive;
      totalFallen += sum.fallen;
      if (run.status === "completed") {
        completedRuns++;
      }
    });

    const totalRuns = runs.length;
    const survivalRate = totalAlive + totalFallen > 0
      ? Math.round((totalAlive / (totalAlive + totalFallen)) * 100)
      : 100;
    const completionRate = totalRuns > 0
      ? Math.round((completedRuns / totalRuns) * 100)
      : 0;

    return {
      totalFallen,
      survivalRate,
      completionRate,
    };
  }, [runs]);

  async function saveTheme(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      await postJson("/api/theme", theme, { method: "PATCH" });
      setMessage("Vos nouvelles couleurs sont en place.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer le thème.");
    }
  }

  async function savePack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const parsed = JSON.parse(packText) as ContentPack;
      await postJson(`/api/packs/${selectedPackId}`, parsed, { method: "PATCH" });
      setMessage("Vos règles sont à jour.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer le pack.");
    }
  }

  function loadRuleTemplateDraft(templateId: string) {
    const template = ruleTemplates.find((entry) => entry.id === templateId) ?? null;
    setSelectedRuleTemplateId(template?.id ?? "");
    setTemplateDraft(createTemplateDraft(template));
    setError(null);
    setMessage(null);
  }

  async function saveRuleTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!templateDraft.id) {
      setError("Sélectionnez un template personnalisé avant d’enregistrer.");
      return;
    }

    setError(null);
    setMessage(null);

    let rules: RuleSet;
    try {
      rules = JSON.parse(templateDraft.rulesText) as RuleSet;
    } catch {
      setError("Le JSON des règles du template est invalide.");
      return;
    }

    try {
      const response = await fetch(`/api/rule-templates/${templateDraft.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: templateDraft.name,
          description: templateDraft.description,
          baseMode: templateDraft.baseMode,
          gameId: templateDraft.gameId.trim() || undefined,
          rules,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { template?: RuleTemplate; message?: string } | null;

      if (!response.ok || !payload?.template) {
        throw new Error(payload?.message ?? "Impossible de mettre à jour ce template.");
      }

      setSelectedRuleTemplateId(payload.template.id);
      setTemplateDraft(createTemplateDraft(payload.template));
      setMessage(`Le template "${payload.template.name}" a été mis à jour.`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre à jour ce template.");
    }
  }

  async function createBlankPack() {
    setError(null);
    setMessage(null);

    try {
      const response = await postJson<{ ok: boolean; pack: ContentPack }>("/api/packs", {
        versionGroup: "firered-leafgreen",
      }, { method: "PUT" });
      setSelectedPackId(response.pack.id);
      setPackText(JSON.stringify(response.pack, null, 2));
      setMessage("Votre nouveau pack est prêt à être personnalisé.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer le pack.");
    }
  }

  async function exportState() {
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/export");
      if (!response.ok) {
        throw new Error("La sauvegarde n’a pas pu être préparée.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "emberdex-backup.json";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Votre copie est prête.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de télécharger la sauvegarde.");
    }
  }

  async function refreshTheme() {
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/theme");
      if (!response.ok) {
        throw new Error("Les couleurs n’ont pas pu être rechargées.");
      }

      const payload = (await response.json()) as { theme: ThemeTokens };
      setTheme(payload.theme);
      setMessage("Vos couleurs ont été rechargées.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de recharger les couleurs.");
    }
  }

  async function importState(file: File | null) {
    if (!file) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const text = await file.text();
      await postJson("/api/import", JSON.parse(text), { method: "POST" });
      setMessage("Votre sauvegarde a bien été restaurée.");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’importer l’état de l’application.");
    }
  }

  async function deleteRunAction(runId: string) {
    if (!window.confirm(`Supprimer définitivement la partie ${runId} ? Cette action est irréversible.`)) {
      return;
    }
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/runs/${runId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Impossible de supprimer la partie.");
      }
      setMessage(`La partie ${runId} a été supprimée.`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue lors de la suppression.");
    }
  }

  async function deleteRuleTemplateAction(templateId: string, name: string) {
    if (!window.confirm(`Supprimer le template "${name}" ? Les runs déjà créés garderont leur copie des règles.`)) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/rule-templates/${templateId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Impossible de supprimer le template.");
      }
      setMessage(`Le template "${name}" a été supprimé.`);
      if (selectedRuleTemplateId === templateId) {
        const nextTemplate = ruleTemplates.find((template) => template.id !== templateId) ?? null;
        setSelectedRuleTemplateId(nextTemplate?.id ?? "");
        setTemplateDraft(createTemplateDraft(nextTemplate));
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue lors de la suppression du template.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
      {/* VISUAL THEME */}
      <Card className="p-6">
        <SectionHeading
          eyebrow="Ambiance visuelle"
          title="Choisissez les couleurs d’Emberdex"
          description="Créez un espace qui vous ressemble et qui reste agréable pendant toute une aventure."
          action={<Pill>{theme.name}</Pill>}
        />

        <form onSubmit={saveTheme} className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            {themeFieldGroups.flat().map((field) => (
              <ThemeInput
                key={field}
                label={themeFieldLabels[field]}
                value={theme[field]}
                onChange={(value) => setTheme((current) => ({ ...current, [field]: value }))}
              />
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paintbrush className="h-4 w-4 mr-2" />}
              Appliquer mes couleurs
            </Button>
            <Button type="button" variant="secondary" onClick={() => setTheme(state.theme)}>
              Annuler les changements
            </Button>
            <Button type="button" variant="ghost" onClick={exportState}>
              <Download className="h-4 w-4 mr-2" />
              Télécharger une copie
            </Button>
          </div>
        </form>
      </Card>

      {/* RULES PACKS */}
      <Card className="p-6">
        <SectionHeading
          eyebrow="Règles de jeu"
          title="Faites évoluer vos défis"
          description="Ajustez les règles, les étapes et les combats importants sans changer le contenu Pokémon en anglais."
          action={<Pill>{selectedPack?.name ?? "Aucun pack"}</Pill>}
        />

        <div className="mt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--muted)]">Pack à personnaliser</span>
              <Select
                value={selectedPackId}
                onChange={(event) => {
                  const next = event.target.value;
                  setSelectedPackId(next);
                  const pack = packs.find((entry) => entry.id === next);
                  if (pack) {
                    setPackText(JSON.stringify(pack, null, 2));
                  }
                }}
              >
                {packs.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </Select>
            </label>

            <div className="flex items-end gap-3">
              <Button type="button" variant="secondary" onClick={createBlankPack}>
                <Plus className="h-4 w-4 mr-2" />
                Créer un pack
              </Button>
            </div>
          </div>

          <form onSubmit={savePack} className="space-y-4">
            <Textarea
              value={packText}
              onChange={(event) => setPackText(event.target.value)}
              className="min-h-[32rem] font-mono text-xs leading-6"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[color:var(--muted)]">
                Mode avancé : chaque changement est vérifié avant d’être enregistré.
              </p>
              <Button type="submit" variant="secondary" disabled={isPending}>
                <FileJson className="h-4 w-4 mr-2" />
                Enregistrer mes règles
              </Button>
            </div>
          </form>
        </div>
      </Card>

      {/* PERSISTENCE BACKUPS */}
      <Card className="p-6 xl:col-span-2">
        <SectionHeading
          eyebrow="Tranquillité d’esprit"
          title="Gardez une copie de tout"
          description="Téléchargez une sauvegarde complète pour pouvoir retrouver vos parties, vos règles et vos couleurs."
        />

        <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Parties" value={Object.keys(state.runs).length} />
          <StatCard label="Packs" value={packs.length} />
          <StatCard label="Thème" value={state.theme.name} />
          <StatCard label="Pertes totales" value={globalMetrics.totalFallen} tone="danger" />
          <StatCard label="Taux de survie" value={`${globalMetrics.survivalRate}%`} tone="success" />
          <StatCard label="Taux d'achèvement" value={`${globalMetrics.completionRate}%`} tone="accent" />
        </div>

        <Divider className="my-6" />

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={exportState}>
            <Download className="h-4 w-4 mr-2" />
            Télécharger ma sauvegarde
          </Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[color:var(--text)] transition hover:-translate-y-0.5 hover:border-[color:var(--accent)]">
            <Upload className="h-4 w-4 mr-2" />
            Restaurer une sauvegarde
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => importState(event.target.files?.[0] ?? null)}
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void refreshTheme()}
          >
            Recharger les couleurs
          </Button>
        </div>
      </Card>

      {/* RULE TEMPLATE MANAGEMENT */}
      <Card className="p-6 xl:col-span-2">
        <SectionHeading
          eyebrow="Templates Nuzlocke"
          title="Bibliothèque de templates personnalisés"
          description="Renommez, documentez et ajustez les templates globaux. Les runs déjà créés gardent leur propre copie des règles."
        />

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-3">
            {ruleTemplates.length > 0 ? (
              <>
                <label className="block space-y-2">
                  <span className="text-sm text-[color:var(--muted)]">Template à modifier</span>
                  <Select value={selectedRuleTemplate?.id ?? ""} onChange={(event) => loadRuleTemplateDraft(event.target.value)}>
                    {ruleTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </Select>
                </label>

                <div className="space-y-3">
                  {ruleTemplates.map((template) => (
                    <div key={template.id} className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-[color:var(--text)]">{template.name}</p>
                        <Pill>{template.baseMode}</Pill>
                        {template.gameId ? <Pill>{template.gameId}</Pill> : <Pill>Global</Pill>}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{template.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 min-h-0 px-3 py-2 text-xs"
                          onClick={() => loadRuleTemplateDraft(template.id)}
                          disabled={isPending}
                        >
                          <FileJson className="h-3.5 w-3.5" />
                          Modifier
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          className="h-9 min-h-0 px-3 py-2 text-xs"
                          onClick={() => void deleteRuleTemplateAction(template.id, template.name)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Supprimer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="rounded-xl border border-dashed border-[color:var(--line)] bg-[color:var(--background-alt)] p-5 text-sm text-[color:var(--muted)]">
                Aucun template personnalisé global n’est enregistré.
              </p>
            )}
          </div>

          <form onSubmit={saveRuleTemplate} className="space-y-4 rounded-xl border border-[color:var(--line)] bg-[color:var(--background-alt)] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--muted)]">Nom</span>
                <Input
                  value={templateDraft.name}
                  onChange={(event) => setTemplateDraft((current) => ({ ...current, name: event.target.value }))}
                  disabled={!templateDraft.id}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-[color:var(--muted)]">Mode de base</span>
                <Select
                  value={templateDraft.baseMode}
                  onChange={(event) => setTemplateDraft((current) => ({ ...current, baseMode: event.target.value as RuleMode }))}
                  disabled={!templateDraft.id}
                >
                  <option value="standard">Standard</option>
                  <option value="hardcore">Hardcore</option>
                  <option value="custom">Custom</option>
                </Select>
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--muted)]">Description</span>
              <Textarea
                value={templateDraft.description}
                onChange={(event) => setTemplateDraft((current) => ({ ...current, description: event.target.value }))}
                className="min-h-24"
                disabled={!templateDraft.id}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--muted)]">Jeu ciblé optionnel</span>
              <Input
                value={templateDraft.gameId}
                onChange={(event) => setTemplateDraft((current) => ({ ...current, gameId: event.target.value }))}
                placeholder="ex. scarlet"
                disabled={!templateDraft.id}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-[color:var(--muted)]">Règles du template</span>
              <Textarea
                value={templateDraft.rulesText}
                onChange={(event) => setTemplateDraft((current) => ({ ...current, rulesText: event.target.value }))}
                className="min-h-[24rem] font-mono text-xs leading-6"
                disabled={!templateDraft.id}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[color:var(--muted)]">
                Ce JSON reste avancé; le builder joueur reste le chemin normal pour composer un template.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setTemplateDraft(createTemplateDraft(selectedRuleTemplate))}
                  disabled={!templateDraft.id || isPending}
                >
                  <RotateCcw className="h-4 w-4" />
                  Réinitialiser
                </Button>
                <Button type="submit" variant="secondary" disabled={!templateDraft.id || isPending}>
                  <Save className="h-4 w-4" />
                  Enregistrer le template
                </Button>
              </div>
            </div>
          </form>
        </div>
      </Card>

      <Card className="p-6 xl:col-span-2">
        <SectionHeading
          eyebrow="Gestion des parties"
          title="Toutes les aventures enregistrées"
          description="Visualisez et gérez les Nuzlocke de ce serveur. Vous pouvez supprimer définitivement des parties obsolètes."
        />

        <div className="mt-6 space-y-4">
          {sortedRuns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm text-[color:var(--text)]">
                <thead>
                  <tr className="border-b border-[color:var(--line)] text-[color:var(--muted)]">
                    <th className="py-3 px-4 font-semibold">Code / Nom</th>
                    <th className="py-3 px-4 font-semibold">Jeu</th>
                    <th className="py-3 px-4 font-semibold">Statut</th>
                    <th className="py-3 px-4 font-semibold">En vie / K.O.</th>
                    <th className="py-3 px-4 font-semibold">Badges</th>
                    <th className="py-3 px-4 font-semibold">Dernière activité</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]">
                  {sortedRuns.map((run) => {
                    const summary = summarizeRun(run);
                    return (
                      <tr key={run.id} className="hover:bg-[color:var(--surface-strong)]/30 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono bg-[color:var(--background-alt)] border border-[color:var(--line)] px-2 py-0.5 rounded text-xs text-[color:var(--accent)] font-bold mr-2">
                            {run.id}
                          </span>
                          <span className="font-semibold text-[color:var(--text)]">{run.name}</span>
                        </td>
                        <td className="py-3 px-4 text-[color:var(--muted)]">{run.gameTitle}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            run.status === "active"
                              ? "bg-[color:var(--success)]/10 text-[color:var(--success)] border border-[color:var(--success)]/20"
                              : run.status === "completed"
                                ? "bg-[color:var(--accent)]/10 text-[color:var(--accent)] border border-[color:var(--accent)]/20"
                                : "bg-[color:var(--muted)]/10 text-[color:var(--muted)] border border-[color:var(--line)]"
                          }`}>
                            {formatStatus(run.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[color:var(--success)] font-semibold">{summary.alive}</span>
                          <span className="text-[color:var(--muted)]"> / </span>
                          <span className="text-[color:var(--danger)] font-semibold">{summary.fallen}</span>
                        </td>
                        <td className="py-3 px-4 text-[color:var(--warning)] font-semibold">{run.badges.length}</td>
                        <td className="py-3 px-4 text-xs text-[color:var(--muted)]">{formatDate(run.updatedAt)}</td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            type="button"
                            variant="danger"
                            className="py-1 px-3 h-8 min-h-0 text-xs font-semibold inline-flex items-center gap-1"
                            onClick={() => void deleteRunAction(run.id)}
                            disabled={isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Supprimer
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[color:var(--muted)] italic text-center py-6">
              Aucune partie n&apos;est actuellement enregistrée.
            </p>
          )}
        </div>
      </Card>

      {/* FEEDBACK STATUS */}
      {message || error ? (
        <Card className="xl:col-span-2 p-4">
          <p className={error ? "text-[color:var(--danger)]" : "text-[color:var(--success)]"}>
            {error ?? message}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
