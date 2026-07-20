import type { RuleMode } from "@emberdex/core";

export function formatRuleMode(mode?: RuleMode | string | null) {
  if (mode === "hardcore") {
    return "Hardcore";
  }

  if (mode === "custom") {
    return "Personnalisé";
  }

  return "Standard";
}

export function formatRuleModeState(mode?: RuleMode | string | null) {
  return `${formatRuleMode(mode)} actif`;
}

export function formatRunStatus(status: "active" | "paused" | "completed" | "failed" | string) {
  return {
    active: "En cours",
    paused: "En pause",
    completed: "Terminée",
    failed: "Échouée",
  }[status] ?? status;
}

export function formatEncounterOutcome(outcome?: string | null) {
  return {
    caught: "Capturé",
    failed: "Échoué",
    escaped: "En fuite",
    gift: "Reçu",
    fainted: "Mis K.O.",
  }[outcome ?? ""] ?? outcome ?? "Inconnu";
}

export function formatEncounterScope(scope?: string | null) {
  return {
    area: "lieu",
    "area-method": "lieu et méthode",
    "area-biome": "lieu et sous-zone",
    zone: "zone",
  }[scope ?? ""] ?? scope ?? "lieu";
}

export function formatLevelCapPolicy(policy?: string | null) {
  return {
    off: "Désactivées",
    advisory: "Conseillées",
    strict: "Strictes",
  }[policy ?? ""] ?? policy ?? "Conseillées";
}

export function formatGiftPolicy(policy?: string | null) {
  return {
    free: "Ne comptent pas",
    count: "Comptent pour le lieu",
    separate: "Compteur séparé",
  }[policy ?? ""] ?? policy ?? "Selon les règles";
}

export function formatContextCategory(category?: string | null) {
  return {
    encounter: "Rencontre",
    gift: "Pokémon offert",
    static: "Statique",
    raid: "Raid",
    safari: "Safari",
    contest: "Concours",
    dlc: "DLC",
    postgame: "Après-ligue",
    boss: "Boss",
  }[category ?? ""] ?? category ?? "Contexte";
}

export function formatContextPolicy(policy?: string | null) {
  return {
    allow: "Autorisé",
    advisory: "À vérifier",
    count: "Compte pour le lieu",
    free: "Ne compte pas",
    ignore: "Ignoré",
    separate: "Compteur séparé",
  }[policy ?? ""] ?? policy ?? "À vérifier";
}

export function formatRuleDescriptor(label: string) {
  return label
    .replace(/\((area-method|area-biome|area|zone)\)/g, (_, scope: string) => `par ${formatEncounterScope(scope)}`)
    .replace("Level caps advisory", "Limites de niveau conseillées")
    .replace("Level caps strict", "Limites de niveau strictes")
    .replace("Level caps off", "Limites de niveau désactivées")
    .replace("Level caps", "Limites de niveau")
    .replace("Permadeath", "Mort permanente")
    .replace("Pinch healing", "Soins d'urgence")
    .replace(/(\d+) rare candies/g, "$1 bonbons rares")
    .replace("Contextes spécifiques au jeu", "Règles propres au jeu");
}

export function formatRuleDecisionDescription(description: string) {
  return description
    .replace("par area-method.", "par lieu et méthode.")
    .replace("par area-biome.", "par lieu et sous-zone.")
    .replace("par area.", "par lieu.")
    .replace("par zone.", "par zone.")
    .replace(": allow.", ": autorisé.")
    .replace(": advisory.", ": à vérifier.")
    .replace(": count.", ": compte pour le lieu.")
    .replace(": ignore.", ": ignoré.")
    .replace(": separate.", ": compteur séparé.");
}
