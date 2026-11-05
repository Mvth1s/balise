# Journal d'avancement

## Étape 1 — Vérifications, agents, squelette (2026-11-05)

- Comptes vérifiés : GitHub `Mvth1s`, Vercel `mvth1s` (équipe `mvth1s-projects`, offre Hobby).
- Faits Vercel vérifiés dans la documentation officielle (2026-11-05) : région Paris `cdg1` ; Hobby : `maxDuration` 300 s (défaut et maximum), 2 Go de mémoire ; taille de fonction 250 Mo non compressés ; Node.js 26.x (défaut), 24.x, 22.x ; pnpm 6 à 12 pris en charge.
- Choix de versions : Node 24.x (LTS, compatible @sparticuz/chromium) ; TypeScript 6.0.3 (typescript-eslint 8.72 exige < 6.1) ; playwright-core 1.63.0 car il embarque Chromium 153, comme @sparticuz/chromium 153.0.0 ; pnpm 12.15.0 (12.17.0 a moins de 14 jours).
- Huit sous-agents créés dans `.claude/agents/`, `CLAUDE.md` rédigé, monorepo pnpm initialisé.
