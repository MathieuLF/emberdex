# Documentation technique d'Emberdex

Emberdex est un tableau de bord et un compagnon de jeu pour les défis Pokémon Nuzlocke. Cette documentation présente l'architecture, les fonctions principales, le moteur de règles Nuzlocke et l'intégration des données.

---

## 1. Vue d'ensemble de l'architecture

Emberdex est structuré comme un monorepo basé sur les workspaces npm. Le code métier, le contenu et l'interface restent ainsi séparés.

```
emberdex/
  packages/
    core/         # Moteur logique (réducteurs de jeu, validation, calculatrice)
    content/      # Packs de contenu (routes par jeu, thèmes initiaux)
  src/
    app/          # Next.js (App Router, routes API)
    components/   # Interface utilisateur (atelier de run, tableau de bord, admin)
    lib/          # Accès aux API (PokéAPI), authentification, stockage local
  data/           # Répertoire par défaut de persistance (état local + cache API)
```

### packages/core
- **Schémas** : Schémas Zod pour valider l'état d'une partie (`RunSnapshot`), les événements et les configurations de packs.
- **Réducteur d'événements** : Moteur déterministe qui prend l'état courant de la partie, applique un événement (ex: capture, mort, badge obtenu) et produit le nouvel état.
- **Calculateur de dégâts** : Moteur de calcul prenant en compte les statistiques, catégories d'attaques, faiblesses/résistances, conditions météo, terrains de combat, et le statut (brûlure).

### packages/content
- Contient les routes officielles de chaque jeu (Gen 1 à Gen 9), classées et taguées par groupe de version pour le filtrage automatique.

---

## 2. Moteur de règles Nuzlocke

L'application intègre des règles automatisées basées sur les standards de la communauté Nuzlocke.

### Clause des espèces et clause des doublons
- **Clause des espèces** : Interdit d'ajouter un Pokémon d'une famille évolutive déjà présente dans l'équipe active ou le PC, selon le mode choisi.
- **Clause des doublons** : Si la première rencontre d'une route est d'une famille déjà capturée, même au cimetière si la règle le demande, l'application signale le doublon et laisse appliquer la variante choisie.
- **Résolution dynamique** : Lors de la saisie d'un Pokémon, Emberdex interroge la PokéAPI avec cache local pour récupérer la chaîne d'évolution complète, par exemple `Rattata -> Raticate`. Les deux clauses s'appliquent sur l'ensemble de la lignée évolutive détectée.

### Clause Shiny
- Si la case **Shiny** est cochée, le système ignore l'état de la route sélectionnée (déjà visitée ou non), conformément à la variante la plus courante de cette clause.

### Limites de niveau
- **Mode Standard** : affiche le niveau maximum conseillé basé sur l'as du prochain champion d'arène.
- **Mode Hardcore** : bloque les dépassements stricts jusqu'à l'ajout d'une exception auditée.
- **Mode Custom** : laisse choisir si les limites de niveau sont désactivées, indicatives ou strictes.

---

## 3. Système d'analyse et aperçu des boss

Le composant **RunGuidance** affiche les informations utiles avant le prochain combat important.

### Détection de la version et du starter
- L'application détecte le Pokémon starter depuis l'historique des événements (premier Pokémon obtenu ou reçu comme cadeau).
- Le type de ce starter sert à résoudre les boss dynamiques (comme l'arène de Striaton en Gen 5 où le champion s'adapte à votre faiblesse).

### Exclusivités de version à Galar
- Pour Pokémon Sword et Shield, l'application résout dynamiquement le boss correct en fonction de la version choisie :
  - *Stow-on-Side* : Bea (Sword) ou Allister (Shield).
  - *Circhester* : Gordie (Sword) ou Melony (Shield).

### Calcul d'efficacité en combat
- Compare le type de chaque Pokémon de l'équipe du joueur contre les types des Pokémon du boss à venir.
- Affiche :
  - **Pokémon efficaces** : Pokémon du joueur infligeant des dégâts super-efficaces (x2 ou plus) avec leurs types d'attaques naturels.
  - **Pokémon en danger** : Pokémon du joueur subissant des dégâts super-efficaces (x2 ou plus) de la part des types du boss.

---

## 4. Gestion des Pertes (Cimetière)

- Tout Pokémon marqué K.O. est automatiquement transféré au **Cimetière**.
- Le cimetière sert de mémorial : les sprites des Pokémon y apparaissent grisés avec leur niveau et leur note de décès.
- L'application conserve les détails clés : le niveau au moment du décès, le lieu de la capture d'origine, et la note explicative de sa défaite.

---

## 5. Persistance et modèle de données local

- **Pas de comptes requis** : Les parties sont liées à un code de sauvegarde aléatoire à 6 caractères.
- **Synchronisation** : Les mises à jour s'effectuent par envois d'événements incrémentaux au serveur, ce qui facilite la réconciliation et limite les conflits de versions.
- **Cache PokéAPI local** : Les réponses JSON sont stockées dans `data/cache/pokeapi`. Les sprites et artworks passent par `/api/pokemon/assets/...` et sont stockés dans `data/cache/pokeapi-assets`.

---

## 6. Cache, assets et déploiement

- **Assets Next.js** : Les fichiers `/_next/static/` sont générés avec des noms hashés. Next leur applique déjà un cache long et immutable.
- **Identifiant de déploiement** : `next.config.ts` définit `deploymentId` et `generateBuildId`. Si `NEXT_DEPLOYMENT_ID`, `GIT_SHA` ou `VERCEL_GIT_COMMIT_SHA` est fourni, Emberdex l'utilise. Sinon, un identifiant local horodaté est généré au build.
- **Service worker** : `/sw.js` est servi avec `Cache-Control: no-store`. Il crée des caches nommés avec la version du build, précharge les artworks des starters, supprime les anciens caches Emberdex à l'activation et recharge la page seulement lorsqu'un ancien service worker contrôlait déjà l'onglet.
- **Assets PokéAPI** : Les URLs `raw.githubusercontent.com/PokeAPI/...` sont réécrites vers le proxy local `/api/pokemon/assets/...`. Le serveur garde une copie disque et renvoie ensuite les images avec `Cache-Control: public, max-age=31536000, immutable`. Les starters sont préchauffés; les autres sprites sont mis en cache au premier affichage.
- **APIs Emberdex** : Les routes `/api/*` restent en `no-store`, sauf les assets Pokémon, pour éviter de servir un état de partie ou une validation de règles périmés.
