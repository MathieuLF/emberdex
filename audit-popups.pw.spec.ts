import { test } from "@playwright/test";
import { mkdirSync } from "fs";
import * as path from "path";

const ARTIFACT_DIR = path.join(process.env.PLAYWRIGHT_ARTIFACT_DIR ?? "test-results", "audit-popups");

test("Audit complet des pages et popups Nuzlocke", async ({ page }) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  // Capture des logs console du navigateur
  page.on("console", (msg) => {
    console.log(`[BROWSER LOG] [${msg.type()}]: ${msg.text()}`);
  });

  // Capture des erreurs de page
  page.on("pageerror", (err) => {
    console.error(`[BROWSER ERROR]: ${err.message}`);
  });

  // Capture des requêtes et réponses réseau
  page.on("request", (req) => {
    if (req.method() === "POST") {
      console.log(`[POST REQUEST]: ${req.url()} - Payload: ${req.postData()}`);
    } else {
      console.log(`[REQUEST]: ${req.method()} ${req.url()}`);
    }
  });
  page.on("response", (res) => {
    console.log(`[RESPONSE]: ${res.status()} ${res.url()}`);
  });

  // 1. Accès à la page d'accueil
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Prendre une capture de l'accueil
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "01_home.png") });

  // 2. Création d'une nouvelle partie (on laisse le starter Bulbasaur par défaut)
  await page.click('button:has-text("Créer mon Nuzlocke")');

  // Attente du code de confirmation de création
  await page.waitForSelector("text=Votre Nuzlocke est prêt");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "01_home_created.png") });

  // Clic sur "Rejoindre l’aventure"
  await page.click('a:has-text("Rejoindre l’aventure")');

  // Attente de la redirection vers la page de workbench (/run/[id])
  await page.waitForURL(/\/run\/.+/);
  await page.waitForLoadState("networkidle");

  // Capture du HUD principal initial (Pallet Town)
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "02_workbench_main.png") });

  // Voyage vers Route 3 pour avoir un lieu sans rencontre de starter
  await page.selectOption('select:has-text("Choisir un lieu")', "Route 3");
  // Attente explicite que l'événement de déplacement s'affiche dans la chronologie
  await page.waitForSelector("text=Lieu modifié : Route 3");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "02_workbench_route3.png") });

  // 3. Test, Remplissage & Capture du popup "Capturer / Rencontrer"
  await page.click('button:has-text("Capturer / Rencontrer")');
  await page.waitForSelector("text=Journal des captures");
  await page.waitForTimeout(200);

  // Remplissage des infos pour capturer un Pidgey
  await page.fill('input[placeholder="Ex. Pidgey, Bulbasaur..."]', "Pidgey");
  await page.fill('input[placeholder="Surnom du Pokémon"]', "AuditBird");

  // Décocher "Ajouter à l'équipe active" en cliquant sur le libellé textuel
  await page.click('text=Ajouter à l’équipe active');

  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "03_modal_encounter.png") });

  // Soumission de la rencontre (ajout au PC)
  await page.click('button[type="submit"]:has-text("Enregistrer la rencontre")');
  await page.waitForSelector("text=Journal des captures", { state: "detached" });

  // Forcer le rechargement de la page pour rafraîchir le Server Component et contourner le cache
  await page.reload();
  await page.waitForLoadState("networkidle");

  // Attente explicite que le Pokémon apparaisse dans le PC ou la chronologie
  await page.waitForSelector("text=AuditBird déplacé vers la boîte");

  // 4. Test & Capture du popup "Valider l'étape"
  await page.click('button:has-text("Valider l\'étape")');
  await page.waitForSelector("text=Étape franchie");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "04_modal_badge.png") });
  await page.click('button:has(.lucide-x)');
  await page.waitForSelector("text=Étape franchie", { state: "detached" });

  // 5. Test & Capture du popup "Nouvelle note"
  await page.click('button:has-text("Nouvelle note")');
  await page.waitForSelector("text=Ajouter une note");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "05_modal_note.png") });
  await page.click('button:has(.lucide-x)');
  await page.waitForSelector("text=Ajouter une note", { state: "detached" });

  // 6. Test & Capture du sélecteur PC (clic sur un emplacement vide, PC n'est plus vide)
  await page.click('text=Emplacement vide');
  await page.waitForSelector("text=Choisir un Pokémon du PC");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "06_modal_pc_selector.png") });
  await page.click('button:has(.lucide-x)');
  await page.waitForSelector("text=Choisir un Pokémon du PC", { state: "detached" });

  // 7. Test & Capture du popup d'édition de Pokémon
  // On clique sur Modifier sur le starter de l'équipe (Bulbasaur)
  await page.click('button[title="Modifier surnom, niveau ou note"]');
  await page.waitForSelector("text=Modifier Bulbasaur");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "07_modal_edit_pokemon.png") });
  await page.click('button:has(.lucide-x)');
  await page.waitForSelector("text=Modifier Bulbasaur", { state: "detached" });

  // 8. Test & Capture du popup d'avis de décès (K.O.)
  await page.click('button[title="Déclarer K.O. (Mort)"]');
  await page.waitForSelector("text=Dire adieu à");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "08_modal_faint_pokemon.png") });
  await page.click('button:has(.lucide-x)');
  await page.waitForSelector("text=Dire adieu à", { state: "detached" });
});
