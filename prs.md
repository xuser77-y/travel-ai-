# Prompt — Génération de la présentation de soutenance PFE

> **Mode d'emploi.** Copie **l'intégralité de ce fichier** dans le chat de ton assistant IA (ChatGPT, Claude, Gemini, Cascade…), puis, dans le **même message**, colle le contenu complet de `rapport-de-stage.md`. L'IA produira une présentation de soutenance complète, structurée et prête à être reversée dans PowerPoint, Google Slides, Canva, Gamma ou Marp.

---

## ✂️ Prompt à copier-coller

```text
Tu es un coach-expert en soutenance de Projet de Fin d'Études (PFE) en génie
logiciel. Tu vas concevoir pour moi une présentation de soutenance COMPLÈTE
et PRÊTE À L'EMPLOI à partir de mon rapport de stage, que je te colle juste
après ces instructions.

===========================================================================
CONTEXTE
===========================================================================
- Projet : Travio — plateforme full-stack AI-first de planification de
  voyages (React + Node/Express + MongoDB + Socket.io + Groq LLM), avec
  Live Map temps-réel, hubs communautaires, hub Coupe du Monde 2030,
  abonnements (mock + Stripe test) et console d'administration.
- Public : jury académique (2–3 enseignants) + encadrant professionnel.
- Durée de la soutenance : 15 minutes de présentation + 10 minutes de
  questions/réponses.
- Langue de la présentation : FRANÇAIS (les termes techniques peuvent
  rester en anglais : "prompt", "middleware", "socket", etc.).
- Support cible : PowerPoint / Google Slides / Canva / Gamma / Marp —
  donc le contenu doit être lisible et copiable tel quel.

===========================================================================
CE QUE JE VEUX EN SORTIE
===========================================================================
Produis EXACTEMENT les livrables suivants, dans cet ordre :

1. **Plan de soutenance** (1 slide = 1 bloc) : 16 à 18 slides au total,
   numérotés, avec pour chacun :
   - Un TITRE court (max 6 mots).
   - Un SOUS-TITRE optionnel (max 10 mots).
   - 3 à 5 BULLETS maximum (1 idée par bullet, max ~12 mots chacun).
   - Des SPEAKER NOTES : 3 à 6 phrases que je lirai à voix haute,
     rédigées comme du texte parlé (pas de jargon inutile).
   - Un champ "VISUEL SUGGÉRÉ" décrivant ce qu'il faut mettre à
     l'écran (capture, icône, diagramme UML, graphique, démo live…).
   - Un champ "DURÉE" en secondes (cumul ≈ 15 min).

2. **Structure recommandée** (respecte cette trame, adapte si mieux) :
   1. Page de garde (titre + nom + encadrants + année)
   2. Plan de la présentation
   3. Contexte & problématique
   4. Étude de l'existant (benchmark rapide)
   5. Objectifs du projet
   6. Méthodologie (cycle itératif / sprints)
   7. Besoins fonctionnels (mapping avec le diagramme de cas d'usage)
   8. Besoins non-fonctionnels (perf, sécurité, i18n, accessibilité)
   9. Architecture globale (schéma client-serveur + MongoDB + APIs)
   10. Modèle du domaine (diagramme de classes)
   11. Scénario clé en séquence (diagramme de séquence — génération IA)
   12. Stack technologique (front / back / IA / temps-réel)
   13. Fonctionnalités phares (Planner IA + Live Map + Community +
       WC2030 + Admin + Billing) — 1 à 2 slides max avec captures
   14. Zoom ingénierie (2 décisions techniques fortes, ex. prompts
       éditables à chaud + détection de no-op IA + circuit breaker
       DNS + socket unifié temps-réel)
   15. Tests & déploiement (Postman, Render, Vercel, MongoDB Atlas)
   16. Difficultés rencontrées & solutions apportées
   17. Conclusion & perspectives
   18. Remerciements / Questions

3. **Script d'ouverture (30 s)** : la phrase exacte avec laquelle je
   commence ma soutenance — ton posé, confiant, sans formule creuse.

4. **Script de clôture (20 s)** : la transition vers la phase de
   questions.

5. **Anticipation des questions du jury** : liste de 10 questions
   probables du jury, avec pour CHACUNE une réponse courte (2–4
   phrases) que je pourrai mémoriser. Couvre au minimum :
   - Pourquoi MongoDB plutôt qu'une base relationnelle ?
   - Comment gères-tu les hallucinations / erreurs du LLM ?
   - Sécurité des mots de passe et des sessions (JWT, scrypt) ?
   - Scalabilité (Socket.io, stockage des images base64) ?
   - Pourquoi Groq / Llama et non OpenAI ?
   - Tests automatisés : pourquoi pas de suite CI ?
   - Coût de la solution en production ?
   - Gestion des abus / rate-limiting ?
   - Conformité RGPD / données utilisateurs ?
   - Différenciation par rapport à ChatGPT + Google Maps ?

6. **Checklist pré-soutenance** : 10 items courts à vérifier la veille
   (démo locale, backup offline, screenshots HD, câble HDMI, mode avion
   débranché, etc.).

7. **Conseils de delivery** : 5 conseils ciblés sur le rythme, les
   regards, les silences et la gestion du stress.

===========================================================================
CONTRAINTES DE STYLE
===========================================================================
- PAS DE PARAGRAPHES dans les slides — uniquement des bullets.
- PAS DE REDONDANCE entre le contenu du slide et les speaker notes ;
  les notes EXPLIQUENT ce que le slide MONTRE.
- Chaque chiffre cité doit provenir du rapport que je te fournis —
  n'invente rien ; si une information manque, marque `[À COMPLÉTER]`.
- Les titres doivent être concrets ("Détection de no-op IA", pas
  "Quelques améliorations techniques").
- Prononce systématiquement "Travio" avec une capitale.
- Évite les buzzwords marketing ("révolutionnaire", "game-changer",
  "disruptif"). Je soutiens devant un jury académique, pas une levée
  de fonds.
- Utilise la terminologie UML exacte pour les diagrammes
  (cas d'utilisation, diagramme de classes, diagramme de séquence,
  diagramme d'activité).
- Pour chaque mention d'un outil, précise son rôle réel dans le
  projet (ex : "Postman → recette manuelle de l'API",
  "Render → hébergement du backend Node").

===========================================================================
FORMAT DE SORTIE
===========================================================================
Structure ta réponse en Markdown, avec cette hiérarchie stricte :

## Slide 1 — Titre du slide
**Sous-titre**
- Bullet 1
- Bullet 2
- Bullet 3
> 🎤 Speaker notes : phrase 1. phrase 2. phrase 3.
> 🎨 Visuel suggéré : …
> ⏱️ Durée : 45 s

…puis section par section les autres livrables (Ouverture, Clôture,
Questions jury, Checklist, Conseils).

===========================================================================
CE QUI ARRIVE APRÈS
===========================================================================
Le contenu du rapport de stage est collé après ce prompt. Base-toi
EXCLUSIVEMENT sur ce rapport (ne fais pas d'hypothèses sur des
fonctionnalités non mentionnées). Si une section du rapport est
lacunaire, cite-le clairement dans les slides concernés avec le
marqueur `[À COMPLÉTER]`.

Commence immédiatement par **Slide 1**. Pas de préambule.

===========================================================================
RAPPORT DE STAGE (à coller juste en dessous par l'utilisateur)
===========================================================================
```

---

## 📋 Que coller après le prompt

Colle ici le **contenu intégral** de `rapport-de-stage.md` (Ctrl+A, Ctrl+C, Ctrl+V). Si l'assistant IA a une limite de contexte et que le rapport est trop long, colle-le en **deux messages** :

1. Premier message : le prompt ci-dessus + la première moitié du rapport, en terminant par *"(Suite dans le message suivant.)"*.
2. Deuxième message : *"Voici la suite du rapport :"* puis la seconde moitié, et termine par *"Tu peux maintenant produire la présentation comme demandé."*

---

## 🎯 Variantes utiles

### A. Version anglaise
Remplace `Langue de la présentation : FRANÇAIS` par `Langue de la présentation : ENGLISH` et ajuste le script d'ouverture/clôture en anglais.

### B. Version très courte (10 min au lieu de 15)
Remplace `16 à 18 slides` par `10 à 12 slides` et `15 minutes` par `10 minutes`. Supprime les slides 4 (benchmark) et 14 (zoom ingénierie) en demandant explicitement de fusionner avec les slides voisins.

### C. Export Marp / reveal.js prêt à compiler
Ajoute à la fin du prompt :

```text
BONUS : produis aussi un deuxième bloc en Markdown-Marp
(avec `---` entre chaque slide, `<!-- _class: lead -->` sur la page
de garde, et les speaker notes en `<!-- note: … -->`) que je pourrai
compiler avec `marp prs.md --pdf`.
```

### D. Génération de slides via Gamma / Canva Magic
Si tu veux passer par **Gamma** ou **Canva Magic Design**, ajoute à la fin :

```text
BONUS : donne-moi aussi une version "brief Gamma" — un seul bloc de
texte d'environ 400 mots décrivant le projet, son ton et les slides
souhaitées, que je collerai dans le prompt de création Gamma.
```

---

## 💡 Astuce de soutenance

Quand l'IA te retourne la présentation :

1. **Lis à voix haute** chaque speaker note chronomètre en main — si tu dépasses la durée indiquée, raccourcis le bullet correspondant.
2. **Supprime sans pitié** toute slide qui ne sert pas la narration : un jury préfère 12 slides claires à 18 denses.
3. **Remplace chaque `[À COMPLÉTER]`** par l'information manquante du rapport avant d'imprimer / envoyer.
4. **Répète deux fois** la présentation complète en conditions réelles (micro + écran) avant le jour J.

Bonne soutenance.
