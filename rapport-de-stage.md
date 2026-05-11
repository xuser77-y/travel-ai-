# Rapport de stage — Travio

> Plateforme AI-first de planification de voyages avec carte temps-réel, hubs communautaires, concierge IA et console d'administration complète.

---

## Page de garde (à compléter)

- **Établissement** : _(nom de votre école / université)_
- **Filière / spécialité** : _(ex. Ingénierie Informatique / Génie Logiciel)_
- **Année universitaire** : 2025 – 2026
- **Projet de Fin d'Études** : **Travio — Plateforme de planification de voyages intelligente**
- **Stagiaire** : _(votre nom)_
- **Encadrant académique** : _(à compléter)_
- **Encadrant professionnel** : _(à compléter)_
- **Organisme d'accueil** : _(à compléter)_
- **Période du stage** : _(dates)_

---

## Remerciements

_(Paragraphe personnel — remerciez votre encadrant académique, votre encadrant professionnel, l'équipe de l'organisme d'accueil, vos proches et le jury.)_

---

## Résumé

Travio est une plateforme web full-stack de planification de voyages qui repose sur l'intelligence artificielle générative pour produire en quelques secondes un itinéraire personnalisé jour par jour, accompagné de recommandations d'hôtels, de vols, de POI et d'une météo notée par journée. Autour de ce moteur IA, le projet ajoute une **Live Map** temps-réel, des **hubs communautaires** persistants, une expérience dédiée à la **Coupe du Monde 2030 Maroc – Espagne – Portugal**, un système complet de **plans & abonnements** (paiement simulé ou Stripe test), et une **console d'administration** avec analytics, modération et édition des prompts IA à chaud.

**Mots-clés** : React, Node.js, Express, MongoDB, Socket.io, JWT, Groq LLM, Leaflet, i18n, PFE.

---

## Table des matières

1. Introduction
2. Présentation de l'organisme d'accueil
3. Cadre du projet
4. Étude préalable
5. Analyse et spécification des besoins
6. Conception
7. Choix technologiques
8. Outils utilisés
9. Réalisation
10. Déploiement
11. Tests et validation
12. Difficultés rencontrées
13. Conclusion et perspectives
14. Bibliographie / Webographie
15. Annexes

---

## 1. Introduction

Le voyage n'est plus un acte purement logistique : les voyageurs modernes attendent une **expérience contextuelle** — un plan qui tient compte de leur budget, de la météo, de leurs centres d'intérêt, des événements locaux, et qui peut évoluer en temps réel grâce à d'autres voyageurs. Les plateformes classiques (agrégateurs de billets, guides statiques) répondent mal à ce besoin : elles séparent réservation, information et communauté.

Travio propose une **plateforme unifiée** qui combine :

- un **moteur d'IA générative** pour produire un itinéraire complet à partir d'un formulaire guidé ;
- une **carte participative temps-réel** sur laquelle les voyageurs déposent texte, photo et émotion ;
- des **hubs communautaires** persistants par destination ;
- une **brique commerciale** (plans d'abonnement, paiement, reçus PDF) ;
- une **console d'administration** pour piloter l'ensemble.

Ce rapport décrit la démarche d'ingénierie logicielle suivie : de la spécification au déploiement, en passant par la conception UML, l'implémentation full-stack et les tests.

---

## 2. Présentation de l'organisme d'accueil

_(À personnaliser — présenter votre entreprise / laboratoire / service d'accueil : activité, taille, organisation, mission du département où vous avez effectué le stage.)_

---

## 3. Cadre du projet

### 3.1 Contexte

Le stage s'inscrit dans le cadre du **Projet de Fin d'Études** de la filière _(à compléter)_. Il vise la conception et la réalisation d'une plateforme **prête pour la démonstration** et **architecturalement solide**, en prévision d'une adoption potentielle autour de la **Coupe du Monde 2030 (Maroc – Espagne – Portugal)** qui constitue un cas d'usage emblématique.

### 3.2 Objectifs

- Concevoir un **modèle du domaine** cohérent (UML : cas d'utilisation, classes, séquence, activité).
- Implémenter une **application web full-stack** performante et accessible (EN / FR / AR avec RTL).
- Intégrer une **couche d'IA générative** prompte-configurable en production.
- Offrir une **expérience premium** (design system, mode clair/sombre, animations).
- Mettre en place une **industrialisation complète** : tests manuels sur Postman, hébergement cloud (Render + Vercel), versioning GitHub.

### 3.3 Planning du stage

| Phase | Livrables | Durée indicative |
|-------|-----------|------------------|
| Étude préalable et cadrage | Benchmark, rédaction du cahier des charges | 1 semaine |
| Spécification des besoins | Cas d'utilisation, maquettes Figma | 1 semaine |
| Conception UML | Diagrammes de classes, séquence, activité | 1 semaine |
| Réalisation backend | API Express + MongoDB + Socket.io | 3 semaines |
| Réalisation frontend | SPA React + i18n + thèmes | 3 semaines |
| Intégration IA | Prompts Groq, orchestrateur, éditeur admin | 1 semaine |
| Tests & déploiement | Recette Postman, Render, Vercel | 1 semaine |
| Rédaction du rapport et soutenance | Rapport + slides + diagrammes | 1 semaine |

---

## 4. Étude préalable

### 4.1 Problématique

Planifier un voyage exige de **croiser manuellement** des dizaines de sources (météo, billetterie, guides, cartes, avis, groupes Facebook). Aucune plateforme grand public ne produit aujourd'hui un **itinéraire personnalisé, sensible au contexte et évolutif** à partir d'un simple dialogue.

### 4.2 Étude de l'existant

| Plateforme | Force | Limite |
|------------|-------|--------|
| Google Flights / Skyscanner | Comparateurs efficaces | Pas d'itinéraire, pas de communauté |
| TripAdvisor | Avis riches | Pas de planning généré, pas de temps-réel |
| Booking.com | Réservation intégrée | Pas d'IA, cloisonné hôtels |
| ChatGPT générique | Flexibilité | Pas de géocodage, pas de persistance, hallucinations |

**Positionnement de Travio** : unifier **plan IA + carte temps-réel + communauté + billetterie** dans une SPA moderne.

### 4.3 Choix d'un modèle de développement

Le projet a été mené en **cycle itératif incrémental** inspiré de Scrum : une série de sprints de 1 à 2 semaines, chaque sprint livrant une **verticale exploitable** (auth, planner, carte, hubs, billing, admin).

---

## 5. Analyse et spécification des besoins

### 5.1 Acteurs

- **Visiteur** : peut parcourir la landing, la Live Map publique et la section Coupe du Monde 2030.
- **Utilisateur inscrit** : génère et affine ses trips, participe à la communauté, souscrit à un plan.
- **Administrateur** (rôle `isAdmin`) : dispose d'une console dédiée pour la modération, l'édition des prompts IA, la configuration des plans et la supervision.

### 5.2 Besoins fonctionnels

1. **Authentification** : inscription avec vérification OTP par email, connexion mot-de-passe et connexion Google.
2. **Planification IA** : formulaire en 7 étapes, génération d'un itinéraire complet, chat de raffinement.
3. **Live Map** : publication de posts géolocalisés, visualisation des clusters, résumé IA d'une zone.
4. **Hubs communautaires** : salons persistants, codes d'invitation, modération.
5. **Coupe du Monde 2030** : compte à rebours, carte des stades, itinéraires par ville hôte.
6. **Abonnements & paiement** : 4 paliers (free / basic / pro / premium), checkout simulé ou Stripe test, reçus PDF imprimables.
7. **Notifications** : diffusion admin (globale ou ciblée), badges non-lus, expiration automatique.
8. **Administration** : dashboard analytique, gestion utilisateurs, modération, édition des prompts IA (double authentification par mot de passe), configuration des plans.

### 5.3 Besoins non-fonctionnels

- **Performance** : génération d'un itinéraire en ≤ 15 s ; API `/search/proxy` mise en cache 6 h.
- **Sécurité** : JWT 7 jours, hashing scrypt, re-vérification mot de passe pour l'édition des prompts, middleware de gating par plan.
- **Internationalisation** : EN / FR / AR avec RTL natif.
- **Accessibilité** : contraste AA, focus visible, composants accessibles (toasts, dialogues).
- **Responsive** : desktop first, mais mobile supporté sur toutes les pages critiques.
- **Observabilité** : middleware `apiTracker` qui mesure chaque `/api/*` et alimente la console admin.

---

## 6. Conception

Les quatre diagrammes UML officiels du projet sont centralisés dans le fichier `diagrams.md` — voir ce fichier pour le **code PlantUML exécutable**. Ce document fournit le **texte descriptif** de chacun.

### 6.1 Diagramme de cas d'utilisation

Trois acteurs (Visiteur, Utilisateur inscrit, Administrateur) organisés en hiérarchie, et ~20 cas d'utilisation regroupés en grappes : Authentification, Planificateur IA, Social & Live, Coupe du Monde, Billing, Administration. Les relations `<<include>>` et `<<extend>>` formalisent les dépendances clés (ex. `Sign up` inclut `Verify email`, `Subscribe` inclut `Print PDF receipt`).

### 6.2 Diagramme de classes

Modèle du domaine présenté **de manière neutre vis-à-vis du stockage** : toutes les classes utilisent des types UML standards (`String`, `Date`, `float`, `List<T>`) et des multiplicités classiques, ce qui rend le diagramme valide pour une base relationnelle comme documentaire. Les entités centrales sont `User`, `Profile`, `PlanTier`, `Subscription`, `Trip`, `Day`, `Session`, `Activity`, `ChatRoom`, `Message`, `LivePost`, `Notification`, `AiPrompt`.

### 6.3 Diagramme de séquence — Génération d'un plan IA

Montre le parcours complet :

1. `POST /api/trips/generate` avec JWT,
2. middleware `planGate` (auth + quota),
3. orchestrateur parallèle (`weatherService` + `photoService` + `poiService`),
4. appel LLM `aiService.generateItinerary` (Groq),
5. persistance + création du hub communautaire,
6. réponse HTTP vers le front-end.

### 6.4 Diagramme d'activité — Parcours utilisateur

Couvre le cheminement d'un visiteur jusqu'à un trip sauvegardé, avec la branche **quota dépassé → écran d'upgrade → checkout** et la boucle **raffinement IA** (avec la détection de *no-op* côté backend pour éviter le bug "l'IA confirme mais rien ne change").

---

## 7. Choix technologiques

### 7.1 Front-end

| Technologie | Rôle |
|-------------|------|
| **React 18** | Librairie UI (composants fonctionnels, hooks) |
| **Vite** | Dev server + build tool |
| **React Router v6** | Routage SPA |
| **Zustand** | State global léger (`tripStore`) |
| **Axios** | Client HTTP |
| **Socket.io-client** | Singleton temps-réel |
| **Leaflet + react-leaflet** | Cartes (trip, Live Map, WC2030) |
| **Framer Motion** | Transitions + intro 3D |
| **Lucide React** | Set d'icônes |
| **Recharts** | Visualisations analytics (admin) |
| **i18next** | Traductions EN / FR / AR (RTL) |
| **@react-oauth/google** | Social Login |
| **CSS pur + variables** | Design tokens, thème clair/sombre |

### 7.2 Back-end

| Technologie | Rôle |
|-------------|------|
| **Node.js + Express** | Serveur HTTP, routes, middlewares |
| **Mongoose** | ODM pour MongoDB |
| **MongoDB** | Datastore unique |
| **Socket.io** | WebSockets temps-réel |
| **jsonwebtoken** | Authentification JWT |
| **crypto.scrypt** (natif) | Hash des mots de passe |
| **groq-sdk** | LLM `llama-3.3-70b-versatile` |
| **node-cache** | Cache TTL pour lookups externes |
| **multer** | Upload d'images Live Map |
| **nodemailer** | Email transactionnel (OTP) |
| **google-auth-library** | Vérification ID token Google |
| **Stripe** (optionnel) | Paiement en mode test |

### 7.3 APIs externes

- **Groq Cloud** — LLM (Llama 3.3 70B, mode `response_format: json_object`)
- **Open-Meteo** — prévision météo (sans clé)
- **Photon (Komoot)** — autocomplétion de villes
- **Nominatim (OSM)** — fallback de géocodage
- **Pexels** — photos de destinations
- **Overpass (OSM)** — POI
- **Google OAuth** — Social Login

---

## 8. Outils utilisés

| Outil | Usage dans le projet |
|-------|----------------------|
| **Windsurf Editor** (Cascade AI) | IDE principal — pair-programming avec l'agent IA Cascade pour la génération et la revue de code, la recherche dans le codebase et l'exécution de commandes |
| **Postman** | Recette manuelle de l'API REST (génération de collection, tests de workflows, variables d'environnement pour JWT et URL de base) |
| **GitHub** | Versioning, branches, pull-requests, historique des décisions |
| **Render** | Hébergement du backend Node.js (build à partir de la branche principale, variables d'environnement sécurisées) |
| **Vercel** | Hébergement du frontend Vite (build statique, déploiements atomiques, preview URLs par PR) |
| **Stitch** (Google AI) | Génération de maquettes initiales à partir de prompts textuels (écrans du planner et du tableau de bord) |
| **Figma** | Affinage des maquettes, composants réutilisables, design tokens, handoff vers le code |
| **StarUML** | Modélisation UML (import des diagrammes PlantUML, export PNG/SVG pour le rapport) |
| **PlantUML** | Source-de-vérité textuelle pour les 4 diagrammes UML (versionnés dans `diagrams.md`) |
| **MongoDB Compass** | Exploration des collections en local, débogage des documents |
| **Node.js + npm** | Runtime et gestion des dépendances |
| **Vite** | Dev server front, Hot Module Replacement |
| **ESLint** | Qualité de code front-end |

---

## 9. Réalisation

### 9.1 Architecture générale

Architecture **client-serveur** mono-repo :

```
┌─────────────────┐   REST /api/*      ┌──────────────────┐
│                 │ ─────────────────> │                  │
│   Frontend SPA  │                    │   Backend API    │
│   (React/Vite)  │ <───── WS ───────  │  (Express + WS)  │
│                 │   Socket.io        │                  │
└─────────────────┘                    └──────┬───────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │    MongoDB       │
                                    └──────────────────┘
                                              │
                                              ▼
            ┌──────────── APIs externes ────────────────┐
            │ Groq LLM • Open-Meteo • Photon •          │
            │ Nominatim • Pexels • Overpass • Google    │
            └───────────────────────────────────────────┘
```

Pour le détail module-par-module, voir `README.md` et `ARCH.md`.

### 9.2 Points d'ingénierie notables

**Pipeline IA configurable à chaud.** Chaque prompt LLM est enregistré dans un registre (`services/promptService.js`) avec des placeholders `{{dot.notation}}`. Les administrateurs peuvent réécrire n'importe quel prompt depuis la console, **sans redéployer**. Un mécanisme de double-authentification par mot de passe protège cette section.

**Orchestration parallèle des lookups.** L'orchestrateur lance en **Promise.all** la météo, la photo et les POI, puis transmet le tout au LLM. On économise plusieurs secondes par trip.

**Résilience externe.** Le `photoService` (Pexels) applique un *circuit breaker* de 10 min en cas de `ENOTFOUND` et bascule sur des photos curatées, avec un *fallback DNS* Cloudflare (`1.1.1.1`) quand le résolveur système échoue. Le `weatherService` et le `photoService` forcent IPv4 pour éviter les échecs AAAA chroniques sur certains ISPs.

**Détection de no-op IA.** Quand le LLM renvoie un itinéraire *verbalement modifié* mais structurellement identique à l'entrée, une **empreinte (fingerprint)** est comparée avec l'input ; si aucune modification réelle n'est détectée, l'utilisateur reçoit un message demandant de reformuler — évitant le bug "l'IA dit OK mais rien ne change".

**Temps-réel unifié.** Un **socket Socket.io unique** côté client gère Live Map, hubs et notifications. Les événements sont typés (`livemap:new_post`, `chat:message`, `new_notification`, `presence:update`) et diffusés par room.

**Internationalisation RTL.** L'arabe est géré par un switch `dir="rtl"` sur le `<html>` + surcharges CSS sur les composants impactés (navbar, planner, chat).

**Thème clair/sombre.** Basé sur `body.light-mode` ; aucune librairie de theming : des variables CSS surchargées.

**In-app toast + confirm.** Un `ToastProvider` et un `ConfirmProvider` (promesse) remplacent **tous** les `alert()` et `window.confirm()`, garantissant une cohérence visuelle sur toutes les actions destructives.

**Paiement deux-modes.** Un mode *mock* ultra-rapide pour la démo jury (commande synthétique `MOCK-…`), et un mode Stripe Checkout *test mode* si la clé `STRIPE_SECRET_KEY` est présente. Les **reçus PDF** sont générés côté frontend en HTML imprimable (aucune librairie PDF).

**Administration complète.** La console regroupe 8 sections : Overview (Recharts), Users, Online (présence socket), Trips, Hubs, Live Posts (abonnement temps-réel), API Usage, AI Prompts, Plans & Billing, Notifications. Chaque action destructive passe par l'`useConfirm()`.

### 9.3 Sécurité

- Mots de passe hashés avec `crypto.scrypt` (format `scrypt:<salt>:<hash>`, migration transparente des records legacy).
- JWT 7 jours signé avec `JWT_SECRET`, transmis en `Authorization: Bearer`.
- Re-vérification du flag `isAdmin` côté DB à chaque requête admin (aucun cache).
- Éditeur de prompts IA verrouillé par **re-saisie du mot de passe** (côté client + re-vérification côté serveur à chaque sauvegarde).
- Validation côté serveur de toutes les payloads via les schémas Mongoose.
- Middleware `planGate` empêchant tout contournement de quota free.

---

## 10. Déploiement

### 10.1 Hébergement

- **Backend** : Render (service Node.js, auto-déploiement depuis GitHub sur chaque push sur `main`).
- **Frontend** : Vercel (build Vite statique, preview URL par pull-request).
- **Base de données** : MongoDB Atlas en production (cluster gratuit M0) ou MongoDB local en développement (`mongodb://localhost:27017/travio`).

### 10.2 Variables d'environnement

Backend (`.env`) :

```
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=<long_random_string>
GROQ_API_KEY=<clé Groq>
PEXELS_API_KEY=<clé Pexels>
GOOGLE_CLIENT_ID=<client ID Google OAuth>
EMAIL_USER=<compte Gmail>
EMAIL_PASS=<app password Gmail>
ADMIN_EMAIL=<email>           # whitelist auto-promotion admin
STRIPE_SECRET_KEY=sk_test_... # optionnel
FRONTEND_URL=https://...      # redirections Stripe
PAYMENT_PROVIDER=mock         # 'mock' ou 'stripe'
```

Frontend (`.env`) :

```
VITE_API_URL=https://<nom>.onrender.com
VITE_GOOGLE_CLIENT_ID=<client ID Google OAuth>
VITE_PEXELS_KEY=<optionnel, pour photos inline>
```

### 10.3 Chaîne CI/CD

- `git push` sur `main` ⇒ Vercel build + preview + promotion en production.
- `git push` sur `main` ⇒ Render rebuild du service Node.
- Revue de code par pull-request ; merges après validation locale (Postman).

---

## 11. Tests et validation

- **Recette fonctionnelle** via **Postman** : collection par domaine (Auth, Trips, LiveMap, Chat, Admin, Payments), variables d'environnement pour `baseUrl` et `token`.
- **Recette visuelle** manuelle sur Chrome + Firefox + mobile (Chrome DevTools device emulation).
- **Validation i18n** en basculant EN / FR / AR et en vérifiant le rendu RTL.
- **Scénarios clés testés de bout en bout** :
  - Inscription + OTP + connexion ;
  - Génération d'un trip complet ;
  - Raffinement IA (cas nominal + cas no-op) ;
  - Post Live Map + suppression ;
  - Adhésion à un hub + envoi de messages ;
  - Souscription d'un plan (mock + Stripe test) + téléchargement du reçu ;
  - Parcours admin complet (CRUD users/trips/hubs/posts, édition de prompts, diffusion de notifications).

---

## 12. Difficultés rencontrées

- **Hallucinations du LLM** : lors du raffinement, le modèle confirmait parfois une modification sans la produire réellement. Résolu par une **détection de no-op** (fingerprint d'itinéraire) et un salvage du wrapper `updatedTrip`.
- **Résolution DNS instable** (`ENOTFOUND` sur `api.pexels.com`) : mitigation par IPv4-only + *fallback* DNS Cloudflare + circuit breaker + photos curatées.
- **Rate-limiting Groq** (HTTP 429) : retry exponentiel limité, avec log pour audit.
- **Cohérence light/dark** sur des composants tiers (Leaflet, Recharts) : écrite à la main via CSS variables et helpers utilitaires.
- **PayPal Sandbox** forçant la création d'un compte acheteur : abandonné au profit d'un **mock** + Stripe test.
- **Warnings Mongoose** (`new: true` déprécié) : tous les call-sites migrés vers `returnDocument: 'after'`.

---

## 13. Conclusion et perspectives

Travio démontre qu'il est possible de livrer, en quelques semaines, une **plateforme complète** combinant IA générative, temps-réel, e-commerce et administration, en s'appuyant sur un stack moderne JavaScript de bout en bout.

**Perspectives** :

- Stockage objet (S3 / Cloudinary) pour les images Live Map.
- Partage de trip par lien public.
- Versionnement d'itinéraire et diff des prompts côté admin.
- Notifications push mobiles pour l'activité Live Map à proximité.
- Intégration réelle de réservations vols/hôtels (Amadeus, Hotelbeds).
- Application mobile React Native partageant la même API.
- Moteur de recommandation personnalisé s'appuyant sur l'historique des trips.

---

## 14. Bibliographie / Webographie

- React 18 — https://react.dev
- Vite — https://vitejs.dev
- Node.js — https://nodejs.org
- Express — https://expressjs.com
- Mongoose — https://mongoosejs.com
- Socket.io — https://socket.io
- Leaflet — https://leafletjs.com
- OpenStreetMap (Nominatim / Overpass / Photon) — https://www.openstreetmap.org
- Open-Meteo — https://open-meteo.com
- Pexels API — https://www.pexels.com/api/
- Groq Cloud — https://groq.com
- Stripe — https://stripe.com/docs/testing
- Render — https://render.com/docs
- Vercel — https://vercel.com/docs
- PlantUML — https://plantuml.com
- Figma — https://www.figma.com
- Stitch (Google) — https://stitch.withgoogle.com
- Windsurf IDE — https://windsurf.com
- Postman — https://www.postman.com

---

## 15. Annexes

- **Annexe A — Diagrammes UML** : voir `diagrams.md` pour le code PlantUML complet (cas d'utilisation, classes, séquence, activité).
- **Annexe B — Architecture détaillée** : voir `ARCH.md`.
- **Annexe C — Guide d'installation et fonctionnalités** : voir `README.md`.
- **Annexe D — Vision et feuille de route** : voir `project.md`.
- **Annexe E — Captures d'écran** : _(à insérer)_ Landing, Planner (7 étapes), Trip Results, Live Map, Community, World Cup 2030, Billing, Console admin.
