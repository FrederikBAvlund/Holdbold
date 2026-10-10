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

  Samme job opretter også kommende gentagne begivenheder (120 dage frem) og henter gemte DBU-iCal-feeds igen (højst hver 3. time), så flyttede kampe opdateres automatisk.
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

## OpenAI pr. hold

Holdets admin tilføjer, udskifter eller fjerner OpenAI API-nøglen under **Indstillinger → OpenAI**.
Transskription og fortolkning bruger kun det valgte holds nøgle; `OPENAI_API_KEY` bruges ikke længere.
Eksisterende hold skal derfor tilføje deres nøgle i indstillingerne efter opdateringen.

Før funktionen tages i brug:

1. Kør `prisma migrate deploy` og `prisma generate`.
2. Generér en krypteringsnøgle med `node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'`.
3. Gem resultatet som `TEAM_API_KEY_ENCRYPTION_KEY` i serverens secret-konfiguration, og genstart serveren.

API-nøgler gemmes i en separat tabel med AES-256-GCM, tilfældig nonce og hold-id som autentificeret kontekst.
API'et returnerer kun, om en nøgle er gemt. Kun aktive administratorer for holdet må administrere den.
Browseren uploader kun den holdte lydoptagelse til serveren og modtager aldrig den gemte API-nøgle.
Krypteringsnøglen må ikke gemmes i databasen, Git eller en `NEXT_PUBLIC_`-variabel; opbevar en sikker backup
separat fra databasebackups. Ændres eller mistes krypteringsnøglen, skal holdene indtaste deres API-nøgler igen.
Kryptering beskytter ved en isoleret databaselækage; adgang til både serverens secrets og databasen kan dekryptere nøglerne.


## Indtal bøder

Hold mikrofonknappen nede med mus, touch, mellemrum eller Enter, og slip for at oprette forslag.
Der optages kun, mens knappen holdes nede. Slip uden for knappen, tab af fokus og lukning stopper mikrofonen.
En udestående mikrofontilladelse må ikke starte optagelsen, hvis knappen allerede er sluppet.

Hver optagelse sendes til `gpt-4o-transcribe` med dansk sprog og holdets navne som ordliste.
Den returnerede tekst vises uændret og sendes som input til tekstmodellen (`gpt-6-luna`).
Der er ingen Realtime-dialog, talesvar eller parallel fortolkning af lyden. Modellen får navne og taksttitler;
koden matcher dem til database-id'er. Usikre navne vælges som vurderede forslag, og manglende frie beløb
vurderes ud fra holdets takster (25 kr uden takster). Hvert forslag kan rettes eller fjernes før Tildel.
Lydoptagelsen lagres ikke i databasen. Uploads må højst være 25 MB; hostingens uploadgrænse kan være lavere.

