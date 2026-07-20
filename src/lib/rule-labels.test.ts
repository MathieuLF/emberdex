import { describe, expect, it } from "vitest";
import {
  formatContextPolicy,
  formatEncounterOutcome,
  formatRuleDecisionDescription,
  formatRuleDescriptor,
  formatRuleMode,
  formatRunStatus,
} from "./rule-labels";

describe("rule-labels", () => {
  it("formats product-facing rule and run labels in French", () => {
    expect(formatRuleMode("custom")).toBe("Personnalisé");
    expect(formatRunStatus("active")).toBe("En cours");
    expect(formatEncounterOutcome("gift")).toBe("Reçu");
    expect(formatContextPolicy("separate")).toBe("Compteur séparé");
    expect(formatRuleDescriptor("Level caps advisory")).toBe("Limites de niveau conseillées");
    expect(formatRuleDescriptor("Première rencontre (area-method)")).toBe("Première rencontre par lieu et méthode");
    expect(formatRuleDecisionDescription("Une seule rencontre compte par area.")).toBe("Une seule rencontre compte par lieu.");
  });
});
