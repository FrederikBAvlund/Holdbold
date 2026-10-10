# AGENTS.md

Regler for AI-agenter (og mennesker) der arbejder i Holdbold-projektet.

## Pull requests

- Giv altid PR'en en relevant, beskrivende titel, der forklarer hvad aendringen goer (fx `Tilfoej bødeoversigt til kassereren`), ikke `Update` eller branch-navnet.
- Brug et branch-navn der passer til indholdet.
- Du maa altid oprette PR'er uden at spoerge om godkendelse foerst.

## CI

- Efter en PR er oprettet: tjek GitHub Actions (`.github/workflows/ci.yml`) for PR'en.
- Fejler CI, saa find aarsagen i loggen, ret den, kør checks lokalt og push en rettelse. Gentag til CI er groen.
- CI-fejl maa aldrig loeses ved at springe over, deaktivere eller slette tests.

## Test og database

- Test altid mod den lokale database, som koerer i Docker (`docker-compose.yml`, Postgres 16). Brug aldrig produktions- eller Supabase-databasen.
- Start databasen: `npm run db:up`
- Opsaetning (migrationer + seed): `npm run dev:setup`
- Nulstil: `npm run db:reset`
- Lokal `DATABASE_URL`/`DIRECT_URL` er `postgresql://user:password@localhost:5432/holdbold` (se `apps/api/.env.example`).

## Checks foer push

Koer de samme trin som CI:

```bash
npm run prisma:validate
npm run prisma:migrate:deploy
npm run typecheck
npm test
npm run build
```
