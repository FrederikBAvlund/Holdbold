# Holdbold

Mobilvenlig webapp til holdkalender, tilmelding og boedekasse.

## Kom hurtigt i gang

1. Installer dependencies
2. Opret `.env` ud fra `.env.example`
3. Koer migrationer
4. Start dev-serveren

```bash
nvm use            # Node 22 (.nvmrc)
npm install
cp .env.example .env
npm run dev:setup  # starter Postgres i Docker, koerer migrationer og seed
npm run dev
```

## Lokal udvikling

- Databasen koerer lokalt i Docker (`docker-compose.yml`, Postgres 16). Start med `npm run db:up`.
- Nulstil databasen (migrationer + seed) med `npm run db:reset`.
- Ny migration under udvikling: `npm run prisma:migrate`.
- Supabase-variablerne kan vaere tomme lokalt; profilbilleder gemmes saa i `public/uploads/` (ignoreres af git).
- Log ind lokalt med `AUTH_CREDENTIALS_ENABLED=true` og seed-brugerne (Facebook-login er ikke noedvendigt).

## CI

GitHub Actions (`.github/workflows/ci.yml`) koerer paa hver PR: `prisma validate`, `migrate deploy` mod en Postgres-service, typecheck, tests og build.

## API og sikkerhed

- Beskyttede API-ruter kraever en gyldig NextAuth-session (cookie). `middleware` afviser uautentificerede kald til `/api/*` undtagen `api/auth`, `api/health` og `api/cron` (cron bruger `CRON_SECRET` i route-handleren).
- Sæt `CRON_SECRET` i produktion til Vercel Cron / manuelle kald til `/api/cron/fines` med header `Authorization: Bearer <CRON_SECRET>`.

## Rollemodel (MVP)

- Admin
- Traener
- Spiller
- Boedekasseformand

## DBU iCal import

Admin kan angive en iCal URL og starte en import manuelt.

## Boedeflow

- Automatiske boeder ved overskredet tilmeldingsfrist
- Manuelle boeder fra admin/traener
- Spillerforeslaaede boeder kraever godkendelse af boedekasseformand

## Login

- Facebook login er paakraevet
- Email/telefon login er muligt, hvis `AUTH_CREDENTIALS_ENABLED=true`

## Seed (valgfri)

Miljoevariabler for at oprette en admin-bruger i seed:

- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

Miljoevariabler for at oprette en spiller i seed:

- `SEED_PLAYER_EMAIL`
- `SEED_PLAYER_PASSWORD`
