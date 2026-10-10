# Coolify på Hetzner — deployment fra main

Denne opsætning erstatter manuel overførsel af tar-filer. Appen bygges fra GitHub
`main` med repositoryets Dockerfile. PostgreSQL er en separat database-resource
på samme Coolify-server. Serverens FADL-cronjobs fortsætter uden for Coolify.

## 1. Installér Coolify

Serveren har Ubuntu 24.04, Docker, 2 CPU'er, 4 GB RAM og eksisterende Nginx.
Tag backup af Nginx og root-crontab først. Serveren bruges kun til cronjobs,
så Nginx kan stoppes/deaktiveres for at frigive 80/443 til Coolifys proxy.
Afklar eventuelle lokale FADL-afhængigheder før stop. Slet ikke konfigurationen.

Følg https://coolify.io/docs/start-with-self-hosted:

```bash
install -d -m 700 /root/holdbold-migration-backup
cp -a /etc/nginx /root/holdbold-migration-backup/nginx
crontab -l > /root/holdbold-migration-backup/crontab.txt
systemctl disable --now nginx
curl -fsSL https://cdn.coollabs.io/coolify/install.sh -o /root/install-coolify.sh
bash /root/install-coolify.sh
```

Registrér administratoren straks. Begræns dashboardadgang med Hetzner-firewall
eller brug SSH-tunnel til port 8000. Bevar SSH; åbn 80/443 til proxyen. Dashboardets
realtime/terminal kan desuden kræve 6001/6002 jf. den aktuelle firewallguide.
Back up `/data/coolify/source/.env` sikkert; den indeholder installationsnøgler.
DNS for Holdbold ændres ikke i dette trin.

## 2. Tilføj PostgreSQL

Opret projekt `Holdbold`, environment `production`, og en PostgreSQL 16 database
på localhost-serveren. Lad databasen være privat med vedvarende volume. Behold
brugernavn/databasenavn `holdbold` og din nye adgangskode, hvis du vælger disse ved
oprettelse. Brug den faktiske Internal URL, som Coolify viser, til både
`DATABASE_URL` og `DIRECT_URL`; værtsnavnet er ikke nødvendigvis `db`.

Sæt automatisk ekstern databasebackup op og afprøv restore inden offentlig drift.
Billedlager og krypteringsnøgler skal også sikres; databasebackup indeholder ikke billeder.

## 3. Opret app fra GitHub

Forbind en GitHub App med adgang til Holdbold-repositoriet. Opret en Git-baseret
Application på samme server/network som databasen:

- Repository: `FrederikBAvlund/Holdbold`.
- Branch: `main` (migrations-PR'en skal være merged først).
- Build pack: **Dockerfile**, base directory `/`, Dockerfile `/Dockerfile`.
- Ports exposes: `3000`. Ingen offentlig host port mapping.
- Dockerfile indeholder en healthcheck af `/api/health`, inklusive DB-forbindelse.
- Auto deploy: aktivér Git-providerens push/merge-deployments og verificér webhook.
- Start med en testadresse; brug først Holdbold-domænerne ved cutover.

Auto deploy fra push er ikke en CI-gate. Beskyt `main` med CI før merge. Direkte
pushes kan starte deployment, før en samtidig CI-kørsel er færdig.

## 4. Importér env og mount billeder

Importér filens indstillinger i appens Environment Variables i Coolify; ingen
`.env.production`-fil skal ligge i repositoryet eller kopieres ind i imaget.

- Erstat DB-URL'er med Coolifys interne URL.
- Bevar login-secret, krypteringsnøgle, mail og Web Push-nøgler.
- `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`: både build-time og runtime.
- Hemmelige værdier og DB-URL'er: runtime, ikke build-time.
- `LOCAL_PROFILE_UPLOAD_DIR=/data/profile-images`.
- `RUN_DATABASE_MIGRATIONS=true`: migrations fra det nye image køres før appstart,
  også ved en genstart. Ingen seed/reset; fejl forhindrer appstart.
- `DISABLE_HTTP_CRON=true`: det gamle offentlige endpoint svarer 404.
- Udelad `CRON_SECRET`, `VERCEL`, øvrige Vercel-systemvariabler og gamle Supabase
  databaseadresser. `POSTGRES_PASSWORD` sættes på DB-resource, ikke på appen.
- Behold Supabase Storage-indstillinger midlertidigt til gamle billedreferencer.

Tilføj et navngivet Persistent Storage-volume til `/data/profile-images`.
Appen kører som UID/GID 1000:1000; kontrollér skriveadgang via Coolify Terminal
før test-upload. Volumenet må ikke slettes ved redeployment og skal sikkerhedskopieres.

Dockerfile-apps kan rulles ud med gammel og ny container overlappende. Migrations-
ændringer skal derfor være kompatible med begge versioner. En databaseændring
rulles ikke automatisk tilbage med app-imaget. Kontrollér migrationer før merge.

## 5. Prøveflytning og endelig cutover

Følg data-, billed- og rollback-trinene i README.md. Brug en isoleret prøvekopi
uden automatiske mails/push/cron. Eksportér app-tabeller og Prisma-migrationshistorik,
ikke hele Supabases systemskemaer. Kopiér Storage-filer og tilpas `User.image`.
Tag write-pause og stop den gamle Holdbold-cron ved den endelige eksport.

Behold samme kanoniske domæne/NEXTAUTH_URL. Flyt A/AAAA for apex/www til Hetzner
og verificér HTTPS via Coolify. Bevar one.com-mail-records. Vercel må ikke modtage
writes under DNS-overgangen, og nye Hetzner-writes skal med ved en rollback.

## 6. Lokal cron i Coolify — EFTER cutover

Tilføj Scheduled Task på appen:

- Command: `node dist/cron.cjs` (uden docker exec og uden HTTP-token).
- Frequency: `2 * * * *`.
- Timeout: fx 1800 sekunder, tilpasset jobbenes observerede varighed.
- Kun den aktive app; ingen preview/test-resources med aktive cronjobs.

Scriptet tager en PostgreSQL-advisory lock, så overlappende lokale kørsler springes
over. Jobbet udfører bøder, påmindelser, gentagne arrangementer og DBU-sync.
Coolify gemmer kørselsstatus/output. Verificér på testdata inden aktivering, og
opret fejlnotifikationer. Fjern kun den gamle Holdbold-linje fra root-crontab;
behold FADL-jobbene.

## 7. Drift

Verificér at en merge til main giver den korrekte commit i Coolify. Test også et
redeploy: eksisterende database og billeder skal stadig være der. Overvåg RAM,
disk, cron og backup, især under builds og FADL-kørsler. En ekstern build-server
eller image-build i CI kan tilføjes, hvis builds presser de 4 GB RAM.

Officielle referencer:
- https://coolify.io/docs/applications/builds/dockerfile
- https://coolify.io/docs/applications/deployments/automatic-deployments
- https://coolify.io/docs/core/automation/scheduled-tasks/create-a-task
