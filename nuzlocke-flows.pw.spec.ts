import { expect, test } from "@playwright/test";

const creationCases = [
  { gameId: "leafgreen", starterId: "bulbasaur", label: "LeafGreen" },
  { gameId: "black", starterId: "snivy", label: "Black with Grass starter" },
  { gameId: "black", starterId: "tepig", label: "Black with Fire starter" },
  { gameId: "black", starterId: "oshawott", label: "Black with Water starter" },
  { gameId: "white", starterId: "snivy", label: "White with Grass starter" },
  { gameId: "white", starterId: "tepig", label: "White with Fire starter" },
  { gameId: "white", starterId: "oshawott", label: "White with Water starter" },
  { gameId: "sword", starterId: "grookey", label: "Sword" },
  { gameId: "shield", starterId: "sobble", label: "Shield" },
  { gameId: "scarlet", starterId: "sprigatito", label: "Scarlet" },
  { gameId: "violet", starterId: "fuecoco", label: "Violet" },
];

test.describe("Nuzlocke creation smoke tests", () => {
  for (const item of creationCases) {
    test(`creates ${item.label}`, async ({ request }) => {
      const response = await request.post("/api/player-runs", {
        data: {
          gameId: item.gameId,
          starterId: item.starterId,
          ruleMode: "standard",
        },
      });

      expect(response.ok()).toBe(true);
      const payload = await response.json();
      expect(payload.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(payload.run.ruleMode).toBe("standard");
      expect(payload.run.team).toHaveLength(1);
    });
  }

  test("creates a custom-mode run from the player builder", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Custom Composez/ })).toBeVisible();
    await page.getByRole("button", { name: /Custom Composez/ }).click();
    await expect(page.getByText("Règles personnalisées")).toBeVisible();
    await page.getByLabel("Interdire les objets en combat").check();
    await page.getByRole("button", { name: /Créer mon Nuzlocke/ }).click();

    await expect(page.getByText("Votre Nuzlocke est prêt")).toBeVisible();
    await page.getByRole("link", { name: /Rejoindre l’aventure/ }).click();
    await expect(page).toHaveURL(/\/run\/[A-HJ-NP-Z2-9]{6}/);
    await expect(page.locator("span").filter({ hasText: /^Custom$/ }).first()).toBeVisible();
    await expect(page.getByText("Sans objet en combat")).toBeVisible();
  });

  test("creates and reuses a custom rule template", async ({ request }) => {
    const templatesResponse = await request.get("/api/rule-templates");
    expect(templatesResponse.ok()).toBe(true);
    const templatesPayload = await templatesResponse.json();
    const standard = templatesPayload.templates.find((template: { id: string }) => template.id === "builtin-standard");
    expect(standard).toBeTruthy();

    const rules = structuredClone(standard.rules);
    rules.battle.allowBattleItems = false;

    const anonymousResponse = await request.post("/api/rule-templates", {
      data: {
        name: "Anonyme",
        description: "Doit être refusé.",
        baseMode: "custom",
        rules,
      },
    });
    expect(anonymousResponse.status()).toBe(401);

    const loginResponse = await request.post("/api/auth/login", {
      data: {
        password: "emberdex",
      },
    });
    expect(loginResponse.ok()).toBe(true);

    const templateResponse = await request.post("/api/rule-templates", {
      data: {
        name: "Playwright sans objets",
        description: "Template créé par le smoke test.",
        baseMode: "custom",
        rules,
      },
    });
    expect(templateResponse.ok()).toBe(true);
    const templatePayload = await templateResponse.json();

    const runResponse = await request.post("/api/player-runs", {
      data: {
        gameId: "leafgreen",
        starterId: "bulbasaur",
        challengeMode: "standard",
        ruleTemplateId: templatePayload.template.id,
      },
    });
    expect(runResponse.ok()).toBe(true);
    const runPayload = await runResponse.json();
    expect(runPayload.run.ruleMode).toBe("custom");
    expect(runPayload.run.ruleTemplateId).toBe(templatePayload.template.id);
    expect(runPayload.run.rules.battle.allowBattleItems).toBe(false);
  });

  test("updates and deletes custom rule templates through the API", async ({ request }) => {
    const templatesResponse = await request.get("/api/rule-templates");
    expect(templatesResponse.ok()).toBe(true);
    const templatesPayload = await templatesResponse.json();
    const standard = templatesPayload.templates.find((template: { id: string }) => template.id === "builtin-standard");
    expect(standard).toBeTruthy();

    const loginResponse = await request.post("/api/auth/login", {
      data: {
        password: "emberdex",
      },
    });
    expect(loginResponse.ok()).toBe(true);

    const rules = structuredClone(standard.rules);
    rules.levelCaps.policy = "strict";

    const createResponse = await request.post("/api/rule-templates", {
      data: {
        name: "API patch template",
        description: "Template créé pour vérifier PATCH et DELETE.",
        baseMode: "custom",
        rules,
      },
    });
    expect(createResponse.ok()).toBe(true);
    const createPayload = await createResponse.json();

    const builtinPatch = await request.patch("/api/rule-templates/builtin-standard", {
      data: {
        name: "Nope",
      },
    });
    expect(builtinPatch.status()).toBe(403);

    rules.battle.allowBattleItems = false;
    const patchResponse = await request.patch(`/api/rule-templates/${createPayload.template.id}`, {
      data: {
        name: "API patch template v2",
        description: "Template modifié par PATCH.",
        baseMode: "custom",
        rules,
      },
    });
    expect(patchResponse.ok()).toBe(true);
    const patchPayload = await patchResponse.json();
    expect(patchPayload.template.name).toBe("API patch template v2");
    expect(patchPayload.template.rules.battle.allowBattleItems).toBe(false);

    const builtinDelete = await request.delete("/api/rule-templates/builtin-hardcore");
    expect(builtinDelete.status()).toBe(403);

    const deleteResponse = await request.delete(`/api/rule-templates/${createPayload.template.id}`);
    expect(deleteResponse.ok()).toBe(true);

    const deletedResponse = await request.get(`/api/rule-templates/${createPayload.template.id}`);
    expect(deletedResponse.status()).toBe(404);
  });

  test("manages a browser-local template from the player builder", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Custom Composez/ }).click();
    await page.getByLabel("Interdire les objets en combat").check();
    await page.getByPlaceholder("Nom du template").fill("Local smoke template");
    await page.getByPlaceholder("Description optionnelle").fill("Template local Playwright.");
    await page.getByRole("button", { name: "Enregistrer le template" }).click();

    await expect(page.getByText("Template enregistré dans ce navigateur.")).toBeVisible();
    await expect.poll(async () => page.evaluate(() => {
      const raw = window.localStorage.getItem("emberdex.localRuleTemplates");
      return raw ? JSON.parse(raw).map((template: { name: string }) => template.name) : [];
    })).toContain("Local smoke template");

    await page.getByLabel("Interdire les objets en combat").uncheck();
    await page.getByPlaceholder("Nom du template").fill("Local smoke template v2");
    await page.getByRole("button", { name: "Mettre à jour" }).click();
    await expect(page.getByText("Template local mis à jour.")).toBeVisible();
    await expect.poll(async () => page.evaluate(() => {
      const raw = window.localStorage.getItem("emberdex.localRuleTemplates");
      return raw ? JSON.parse(raw).map((template: { name: string; rules: { battle: { allowBattleItems: boolean } } }) => ({
        name: template.name,
        allowBattleItems: template.rules.battle.allowBattleItems,
      })) : [];
    })).toContainEqual({
      name: "Local smoke template v2",
      allowBattleItems: true,
    });

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Supprimer local" }).click();
    await expect(page.getByText("Template local supprimé.")).toBeVisible();
    await expect.poll(async () => page.evaluate(() => {
      const raw = window.localStorage.getItem("emberdex.localRuleTemplates");
      return raw ? JSON.parse(raw).length : 0;
    })).toBe(0);
  });

  test("previews Hardcore blocking rules before creation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Hardcore Level caps/ }).click();
    await expect(page.getByText("Override requis")).toBeVisible();
    await expect(page.getByText("Objets en combat", { exact: true })).toBeVisible();
    await expect(page.getByText("Bloquant").first()).toBeVisible();
  });

  test("returns warnings for accepted soft rule issues", async ({ request }) => {
    const runResponse = await request.post("/api/player-runs", {
      data: {
        gameId: "leafgreen",
        starterId: "bulbasaur",
        ruleMode: "standard",
      },
    });
    expect(runResponse.ok()).toBe(true);
    const runPayload = await runResponse.json();

    const firstResponse = await request.post(`/api/runs/${runPayload.code}/events`, {
      data: {
        baseRevision: runPayload.run.revision,
        events: [
          {
            id: "soft-route-first",
            timestamp: "2026-06-27T12:10:00.000Z",
            type: "encounter.recorded",
            payload: {
              id: "soft-route-first",
              routeId: "route-1",
              routeName: "Route 1",
              species: "Pidgey",
              dexNumber: 16,
              level: 3,
              outcome: "caught",
              timestamp: "2026-06-27T12:10:00.000Z",
              shiny: false,
              versionGroup: "firered-leafgreen",
            },
          },
        ],
      },
    });
    expect(firstResponse.ok()).toBe(true);
    const firstPayload = await firstResponse.json();

    const secondResponse = await request.post(`/api/runs/${runPayload.code}/events`, {
      data: {
        baseRevision: firstPayload.run.revision,
        events: [
          {
            id: "soft-route-second",
            timestamp: "2026-06-27T12:12:00.000Z",
            type: "encounter.recorded",
            payload: {
              id: "soft-route-second",
              routeId: "route-1",
              routeName: "Route 1",
              species: "Rattata",
              dexNumber: 19,
              level: 3,
              outcome: "caught",
              timestamp: "2026-06-27T12:12:00.000Z",
              shiny: false,
              versionGroup: "firered-leafgreen",
            },
          },
        ],
      },
    });
    expect(secondResponse.ok()).toBe(true);
    const secondPayload = await secondResponse.json();
    expect(secondPayload.evaluation.requiresOverride).toBe(false);
    expect(secondPayload.evaluation.warnings.some((issue: { ruleId: string }) => issue.ruleId === "first-encounter")).toBe(true);
  });

  test("records a rule override from the workbench modal", async ({ request, page }) => {
    const response = await request.post("/api/player-runs", {
      data: {
        gameId: "leafgreen",
        starterId: "bulbasaur",
        ruleMode: "hardcore",
      },
    });
    expect(response.ok()).toBe(true);
    const payload = await response.json();

    await page.goto(`/run/${payload.code}`);
    await page.getByTitle("Modifier surnom, niveau ou note").first().click();
    await page.getByRole("spinbutton", { name: "Niveau" }).fill("99");
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await expect(page.getByText("Override requis")).toBeVisible();
    await page.getByLabel("Raison de l’exception").fill("Smoke test override pour vérifier l’audit.");
    await page.getByRole("button", { name: "Forcer avec cette raison" }).click();

    await expect(page.getByText("Exceptions de règles")).toBeVisible();
    await expect(page.getByText("Smoke test override pour vérifier l’audit.")).toBeVisible();
  });

  for (const item of [
    { gameId: "violet", starterId: "fuecoco", label: "Paldea" },
    { gameId: "black", starterId: "snivy", label: "Unova" },
  ]) {
    test(`shows the coach panel for ${item.label}`, async ({ request, page }) => {
      const response = await request.post("/api/player-runs", {
        data: {
          gameId: item.gameId,
          starterId: item.starterId,
          ruleMode: "standard",
        },
      });
      expect(response.ok()).toBe(true);
      const payload = await response.json();

      await page.goto(`/run/${payload.code}`);
      await expect(page.getByText("Coach Nuzlocke")).toBeVisible();
      await expect(page.getByText("Prochain cap")).toBeVisible();
      await expect(page.getByText("Zones consommées")).toBeVisible();
    });
  }
});
