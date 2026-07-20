# Emberdex

Emberdex est un compagnon Nuzlocke auto-hébergeable pour les jeux principaux Pokémon, de la première à la neuvième génération. L'interface est en français; les noms officiels du jeu, comme les espèces, les types, les attaques et les lieux, restent en anglais pour rester compatibles avec les bases de données et les calculateurs utilisés par la communauté.

---

## Fonctionnalités clés

### 🗺️ Gestion des zones et rencontres
* **Filtres par version** : Plus de 220 routes répertoriées. Seules les routes spécifiques au jeu sélectionné s'affichent.
* **Indicateurs de statut** : Suivi clair des zones explorées: libre, capturé, échoué ou tenté.

### 🛡️ Application des règles Nuzlocke
* **Clause des doublons** : Avertissement si vous rencontrez un Pokémon déjà capturé. Permet un nouvel essai conformément aux règles communautaires.
* **Clause des espèces** : Signale si le Pokémon saisi ou un membre de sa lignée évolutive est déjà présent selon les règles actives.
* **Résolution dynamique d'évolution** : Interroge la PokéAPI avec cache local pour valider l'ensemble d'une lignée évolutive, par exemple `Rattata -> Raticate`.
* **Clause Shiny** : Neutralise les restrictions de zone si vous rencontrez un Pokémon chromatique.
* **Limites de niveau** : Avertissement en Standard, blocage avec exception auditée en Hardcore.

### ⚔️ Analyseur de boss et tactique
* **Aide au combat** : Aperçu de l'équipe adverse du prochain boss avec sprites, niveaux et types.
* **Calculateur d'efficacité** : Détermine automatiquement quels Pokémon de votre équipe envoyer (super-efficaces) ou mettre à l'abri (vulnérables).
* **Adaptabilité** : Résout automatiquement les boss version-exclusifs (ex: Bea vs Allister à Galar) et starter-exclusifs (ex: trio de Striaton à Unova).

### Cimetière mémorial
* Affichage sous forme de mémorial sobre avec sprites Pokémon grisés.
* Suivi des causes de K.O., niveau du décès, et lieu de capture d'origine.

### 🧮 Calculateur de dégâts
* Calculatrice intégrée avec support des types (18 types), STAB, efficacité cumulée, coups critiques, brûlure, conditions météo et terrains de combat.

---

## Architecture technique

* **Cadre applicatif principal** : Next.js (App Router) et React.
* **Style** : CSS standard pour un contrôle total des performances et de l'accessibilité.
* **Monorepo** :
  * `packages/core` : Validations (Zod), moteur logique déterministe (reducer de partie), calculateur.
  * `packages/content` : Liste des routes par version-groupes.
* **Cache PokéAPI** : Cache local pour les réponses JSON et les sprites Pokémon servis par Emberdex.
* **Version des assets** : Chaque build reçoit un identifiant de déploiement; Next l'utilise pour éviter de mélanger anciens fichiers JavaScript/CSS et nouvelle version.

---

## Démarrage rapide

### Configuration locale
1. Clonez le dépôt et installez les dépendances :
   ```bash
   npm install
   ```
2. Configurez vos variables d'environnement en dupliquant le fichier d'exemple :
   ```bash
   cp .env.example .env.local
   ```
3. Remplacez `OWNER_PASSWORD` et `AUTH_SECRET` par des valeurs locales robustes, puis lancez le serveur de développement :
   ```bash
   npm run dev
   ```
4. Ouvrez `http://localhost:3000`.

### Identifiants de développement
* **Mot de passe Admin** : valeur de `OWNER_PASSWORD` dans votre `.env.local`
* **Nom de l'Admin** : valeur de `OWNER_NAME`, ou `Emberdex Keeper` si la variable est absente

> [!IMPORTANT]
> `OWNER_PASSWORD` et `AUTH_SECRET` sont obligatoires en production. Ne déployez pas Emberdex avec les valeurs d'exemple.

### Docker
1. Préparez un fichier `.env` pour Docker Compose :
   ```bash
   cp .env.example .env
   ```
2. Remplacez `OWNER_PASSWORD` et `AUTH_SECRET`.
3. Démarrez le conteneur :
   ```bash
   docker compose up -d --build
   ```

L'état applicatif est conservé dans le volume Docker `emberdex-data`.

### Cache et versions
Emberdex sert les sprites PokéAPI via `/api/pokemon/assets/...`. Les artworks des starters sont préchargés par le service worker; les autres sprites remplissent le cache disque dans `data/cache/pokeapi-assets` au premier affichage, puis repartent du serveur Emberdex avec un cache navigateur long.

Le fichier `/sw.js` n'est jamais mis en cache par le navigateur. Il nettoie les anciens caches Emberdex à chaque changement de version et laisse les fichiers `/_next/static/` être servis comme assets versionnés.

Pour donner un identifiant explicite à un déploiement, définissez `NEXT_DEPLOYMENT_ID` avant `npm run build` ou dans le `.env` utilisé par Docker Compose.

---

## Documentation et licence

* Pour plus de détails sur le fonctionnement technique et l'implémentation des algorithmes, consultez la [Documentation Technique](docs/emberdex-documentation.md).
* Le projet est distribué sous [Licence MIT](LICENSE).

---

## Clause de non-responsabilité

Emberdex est un outil communautaire non officiel. Il n'est en aucun cas affilié à, approuvé par ou associé à Nintendo, Game Freak, Creatures Inc., The Pokémon Company ou PokeAPI.

Les marques, noms de personnages et visuels Pokémon sont la propriété exclusive de leurs détenteurs respectifs. Ce projet est réalisé à but purement personnel et éducatif. Aucun fichier de jeu officiel ou ressource sous copyright n'est hébergé directement sur ce dépôt.
