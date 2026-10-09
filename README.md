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
- Efter at have hentet nye aendringer (fx nye migrationer): koer `npx prisma generate` og `npx prisma migrate deploy`, ellers fejler build/typecheck paa en foraeldet Prisma-klient.
- Supabase-variablerne kan vaere tomme lokalt; profilbilleder gemmes saa i `public/uploads/` (ignoreres af git).
- Log ind lokalt med `AUTH_CREDENTIALS_ENABLED=true` og seed-brugerne (Facebook-login er ikke noedvendigt).

## CI

GitHub Actions (`.github/workflows/ci.yml`) koerer paa hver PR: `prisma validate`, `migrate deploy` mod en Postgres-service, typecheck, tests og build.

## API og sikkerhed

- Beskyttede API-ruter kraever en gyldig NextAuth-session (cookie). `middleware` afviser uautentificerede kald til `/api/*` undtagen `api/auth`, `api/health` og `api/cron` (cron bruger `CRON_SECRET` i route-handleren).
- Sæt `CRON_SECRET` i produktion. Bøde-jobbet kaldes fra serverens crontab (ikke Vercel Cron) med header `Authorization: Bearer <CRON_SECRET>`:

```cron
2 * * * * . /root/.holdbold-cron-env && /usr/bin/curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://www.holdbold.dk/api/cron/fines >> /var/log/holdbold-cron.log 2>&1
```

  Læg `CRON_SECRET=...` i `/root/.holdbold-cron-env` (`chmod 600`), så nøglen ikke står i `crontab -l`.

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
