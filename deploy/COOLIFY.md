# Holdbold i Coolify

Appen deployes fra GitHub `main` med repositoryets Dockerfile. PostgreSQL er en
separat privat database-resource på samme Coolify-server/network. Serverinstallation,
DNS og engangsdataflytning udføres separat; de er ikke en del af appens deployment.

## Application

- Build pack: **Dockerfile**, base directory `/`, Dockerfile `/Dockerfile`.
- Branch: `main`, med GitHub App og automatisk deployment aktiveret.
- Ports exposes: `3000`. Ingen offentlig host port mapping.
- Dockerfile indeholder readiness-check af `/api/health`, inklusive DB-forbindelse.
- Brug et navngivet Persistent Storage-volume på `/data/profile-images`.
  Appen kører som UID/GID 1000:1000 og skal have skriveadgang.

Auto deploy fra push er ikke en CI-gate. Beskyt `main` med CI før merge. Direkte
pushes kan starte deployment, før en samtidig CI-kørsel er færdig.

## Environment Variables

Importér værdierne i Coolify. Private env-filer og nøgler skal ikke i Git eller
imaget. `.env.example` dokumenterer variabelnavne uden produktionsværdier.

- `DATABASE_URL` og `DIRECT_URL`: brug Coolifys faktiske interne PostgreSQL-URL.
  Databasens hostname er ikke nødvendigvis `db`.
- Bevar `NEXTAUTH_SECRET`, `TEAM_API_KEY_ENCRYPTION_KEY`, mail- og Web Push-nøgler.
- `NEXTAUTH_URL`: behold det kanoniske domæne.
- `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`: både build-time og runtime.
- Hemmelige værdier og DB-URL'er: runtime, ikke build-time.
- `LOCAL_PROFILE_UPLOAD_DIR=/data/profile-images`.
- `RUN_DATABASE_MIGRATIONS=true`: migrations fra det nye image køres før appstart,
  også ved en genstart. Ingen seed/reset; fejl forhindrer appstart.
- `DISABLE_HTTP_CRON=true`: det gamle offentlige endpoint svarer 404.
- Udelad `CRON_SECRET`, `VERCEL` og øvrige Vercel-systemvariabler.
- `POSTGRES_PASSWORD` konfigureres på database-resource, ikke på appen.
- Supabase Storage-indstillinger kan beholdes, indtil gamle billeder er flyttet.

Dockerfile-apps kan rulles ud med gammel og ny container overlappende. Migrationer
skal være kompatible med begge versioner. En databaseændring rulles ikke automatisk
tilbage med app-imaget. Coolifys pre-deploy-kommando kører i det tidligere image;
brug derfor startup-scriptet til migrationer fra den nye version.

## Scheduled Task

Aktivér først efter dataflytning, og stop den gamle Holdbold-cron først:

- Command: `node dist/cron.cjs` (uden docker exec og uden HTTP-token).
- Frequency: `2 * * * *`.
- Timeout: fx 1800 sekunder, tilpasset observeret varighed.
- Kun den aktive app; ingen preview/test-resources med aktive cronjobs.

Scriptet tager en PostgreSQL-advisory lock, så overlappende lokale kørsler springes
over. Det udfører bøder, påmindelser, gentagne arrangementer og DBU-sync.
Coolify gemmer kørselsstatus og output. Test på isolerede data inden aktivering.

## Data og drift

Databasebackup indeholder ikke billeder. Sikkerhedskopiér både databasen og
billedvolumenet eksternt, opbevar nødvendige krypteringsnøgler sikkert, og afprøv restore.
Ved flytning fra Supabase skal Storage-filer kopieres og `User.image` omskrives
til `/api/profile-images/FILENAME`. Ejeren og aktive medlemmer af samme hold har
adgang. Kør aldrig seed/reset på eksisterende produktionsdata.

Verificér at en merge til `main` deployer den korrekte commit. Test et redeploy:
database og billeder skal stadig være der. Overvåg RAM, disk, cron og backup.

Referencer:
- https://coolify.io/docs/applications/builds/dockerfile
- https://coolify.io/docs/applications/deployments/automatic-deployments
- https://coolify.io/docs/core/automation/scheduled-tasks/create-a-task
