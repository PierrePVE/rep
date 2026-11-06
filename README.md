# Rep

Application web mobile de suivi de musculation : programmes d'entraînement, saisie des séances à la salle, records personnels et progression. Pensée pour le téléphone (PWA), en français.

> Projet personnel en cours de développement.

## Fonctionnalités

**Disponibles**

- **Comptes** : inscription, connexion par email et mot de passe, compte démo en un clic, page d'administration des comptes.
- **Programmes** : plusieurs programmes par utilisateur, dont un actif ; séances (jusqu'à 7, dans l'ordre de rotation) ; exercices planifiés avec séries, fourchette de répétitions, RPE cible, repos et notes ; réordonnancement ; partage par lien (comptes personnels) avec aperçu et import d'une copie.
- **Bibliothèque d'exercices** : 115 exercices de départ par compte, recherche insensible aux accents, création (aussi directement depuis les sélecteurs d'exercice), modification, archivage.
- **Séance en cours** : démarrage depuis un jour du programme (le prochain jour de la rotation est suggéré) ou en séance libre ; saisie des séries (poids, répétitions, RPE, échauffement / dégressive), préremplies depuis la série précédente ou la dernière séance ; rappel « la dernière fois » et records à battre sous chaque exercice ; badge et notification de record personnel ; minuteur de repos optionnel.
- **Historique** : séances par mois avec durée et volume, détail modifiable après coup (séries, exercices, nom, notes), suppression ; photo de séance (prise ou choisie à la fin, compressée dans le navigateur, stockée dans la base).
- **Feed social** (comptes personnels) : pseudo public (l'email reste privé), recherche de membres, abonnements sur demande à accepter ou refuser ; le feed montre ses séances et celles de ses abonnements (durée, exercices, volume, records battus, photo), avec le détail des séries en lecture seule et un bouton « Bravo » ; chaque séance peut être rendue privée.
- **Statistiques** : fiche par exercice (records, record de répétitions par charge, courbe du 1RM estimé, volume par séance) ; tableau de bord (séances de la semaine sur l'objectif, semaines d'affilée, total soulevé, calendrier de présence du mois, séries par muscle, records récents).
- **Application installable (PWA)** : icône sur l'écran d'accueil, plein écran, fichiers de l'application en cache.

**À venir**

- Déploiement (Neon + Vercel).
- Saisie hors-ligne, modèles de séance, poids de corps, export (V2).

## Stack

| Rôle | Outil |
|---|---|
| Framework | [Nuxt 4](https://nuxt.com) (Vue 3, TypeScript), API dans `server/` (Nitro) |
| Interface | [Nuxt UI 4](https://ui.nuxt.com) (Tailwind CSS v4) |
| Base de données | PostgreSQL sur [Neon](https://neon.tech), via [Drizzle ORM](https://orm.drizzle.team) |
| Validation | [Zod 4](https://zod.dev), schémas partagés entre les formulaires et l'API |
| Authentification | [nuxt-auth-utils](https://github.com/atinux/nuxt-auth-utils) + sessions stockées en base (révocables) |
| Tests | [Vitest](https://vitest.dev) |

## Installation

Prérequis : Node.js 22+, npm, et une base PostgreSQL (une branche Neon convient).

```bash
npm install
cp .env.example .env   # puis remplir les valeurs, voir ci-dessous
npm run db:migrate     # crée les tables
npm run db:seed        # crée le compte admin, le compte démo et leurs exercices
npm run dev            # http://localhost:3000
```

### Variables d'environnement

Toutes sont listées dans [`.env.example`](.env.example). Le fichier `.env` n'est jamais commité.

| Variable | Rôle |
|---|---|
| `NUXT_DATABASE_URL` | URL Postgres **poolée**, utilisée par l'application |
| `DATABASE_URL_UNPOOLED` | URL Postgres directe, utilisée par drizzle-kit et les scripts |
| `NUXT_SESSION_PASSWORD` | Clé de chiffrement du cookie de session (32 caractères minimum) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Compte administrateur créé par le seed |
| `DEMO_EMAIL`, `DEMO_PASSWORD` | Compte démo public créé par le seed |

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm run preview` | Build de production et prévisualisation. Le service worker de la PWA n'existe qu'en build : c'est ici qu'on le teste, pas avec `npm run dev`. |
| `npm run lint` | ESLint |
| `npm run typecheck` | Vérification TypeScript (`nuxi typecheck`) |
| `npm test` | Tests Vitest |
| `npm run db:generate` | Génère une migration à partir de `server/db/schema.ts` |
| `npm run db:migrate` | Applique les migrations |
| `npm run db:studio` | Explorateur de la base (Drizzle Studio) |
| `npm run db:seed` | Crée les comptes admin et démo avec le catalogue de départ. Idempotent : un compte existant n'est pas modifié. |
| `npm run db:sync-exercises` | Ajoute à **tous** les comptes existants les exercices de départ qui leur manquent. À relancer après un agrandissement du catalogue. N'ajoute que, ne modifie ni ne supprime rien. |
| `npm run pwa:icons` | Régénère les icônes PNG de la PWA depuis `public/favicon.svg` (`pwa-assets.config.ts`). À relancer quand le logo change. |
| `npm run wger:import` | Régénère `server/db/wgerExercises.json` depuis wger (voir plus bas) |

## Structure

```
app/            Interface : pages, composants, composables
server/api/     Routes de l'API (un fichier par route et par verbe HTTP)
server/db/      Schéma Drizzle, client, seed et catalogue d'exercices de départ
server/utils/   Session, authentification, contrôles d'appartenance
shared/utils/   Schémas Zod et constantes partagés par l'interface et l'API
scripts/        Scripts ponctuels (import wger)
```

Chaque utilisateur possède sa propre copie du catalogue d'exercices : il peut les renommer ou les archiver sans toucher aux autres comptes. Toutes les routes vérifient que la ressource demandée appartient à l'utilisateur connecté.

## Versions épinglées

- **`nuxt ~4.5.2`** : Nuxt 4.6.0 casse `nuxt dev` (erreur 500 « Either manifest or precomputed data must be provided »).
- **`typescript ~6.0.3`** : TypeScript 7 casse vue-tsc et typescript-eslint.

À relâcher quand une version corrigée sera disponible.

## Crédits

Une partie du catalogue d'exercices de départ (`server/db/wgerExercises.json`) provient de **[wger Workout Manager](https://wger.de)**, sous licence **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**. Les données ont été sélectionnées et adaptées : noms raccourcis, groupes musculaires et équipements convertis vers ceux de l'application. Ce fichier adapté reste sous la même licence CC BY-SA 4.0.
