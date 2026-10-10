# Holdbold på Hetzner

**Den valgte deployment er Coolify fra GitHub main: se [COOLIFY.md](COOLIFY.md).**
Nedenstående Compose/Nginx-kommandoer er den manuelle alternative opsætning.

Dette er deployment-forberedelsen. DNS, produktionsdata og eksisterende cronjobs
ændres ikke automatisk. Kør ikke det nye cronjob, før det gamle er stoppet.
HTTP-endpointet er fortsat beskyttet under overgangen og fjernes efter cutover.

## 1. Serverforberedelse (root)

Gem crontab og Nginx-konfiguration inden ændringer:

```bash
install -d -m 700 /root/holdbold-migration-backup
crontab -l > /root/holdbold-migration-backup/crontab.txt
cp -a /etc/nginx /root/holdbold-migration-backup/nginx
apt-get update
apt-get install -y docker.io docker-compose-v2
systemctl enable --now docker
docker --version
docker compose version
install -d -m 750 /opt/holdbold
```

Planlæg sikkerhedsopdateringer og genstart uden for FADL-kørslerne. Tilpas både
Hetzner-firewall og eventuel UFW: behold SSH og åbn 80/443. Åbn ikke 3000/5432.
Docker-adgang svarer til root-adgang; giv kun betroede deployment-brugere adgang.

## 2. Hent den forberedte kode

Checkout den revision, der indeholder denne guide, i `/opt/holdbold`.
Klon ikke bare main, før ændringerne er tilgængelige dér.
Opret `.env.production` manuelt, uden at lægge den i Git, og brug `chmod 600`.
Compose-kommandoer køres med begge argumenter:

```bash
docker compose --env-file .env.production -f compose.production.yml COMMAND
```

Indstillinger:

- `POSTGRES_PASSWORD`: generér en stærk adgangskode, gerne hex for enkel URL-kodning.
- `DATABASE_URL` og `DIRECT_URL`: `postgresql://holdbold:PASSWORD@db:5432/holdbold`.
- `NEXTAUTH_URL`: behold den eksisterende kanoniske https-adresse (www eller apex).
- Bevar `NEXTAUTH_SECRET`, `TEAM_API_KEY_ENCRYPTION_KEY`, Web Push-nøgler,
  `RESEND_API_KEY`, `MAIL_FROM`, superadmin og relevante auth-indstillinger.
- `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` bruges også ved build. Ændring kræver nyt build.
- `LOCAL_PROFILE_UPLOAD_DIR` sættes til `/data/profile-images` af Compose.
- Bevar Supabase-indstillinger midlertidigt, hvis gamle billeder endnu ikke er flyttet.
- Bevar `CRON_SECRET` indtil det offentlige endpoint fjernes.

## 3. Byg og test uden offentlig trafik

Byg helst på en separat maskine og overfør image med `docker save`/`docker load`.
Serverbuild kan konkurrere med FADL om RAM. Compose kan bygge med `build app`.
I managed cloud kræver build proxy/CA-opsætning; dette er ikke nødvendigt på Hetzner.
Build må ikke få produktionsdatabasens credentials. Hvis Next.js-build kræver en
DB, skal den være en isoleret lokal testdatabase, aldrig produktion.

Start først databasen med `up -d db`. Prøvegendannelse skal bruge en kopi af
Holdbolds app-tabeller og Prisma-migrationshistorik, ikke Supabases systemskemaer.
Kontrollér eksportens afhængigheder og PostgreSQL-version før restore.
Gendan i en tom database; kør derefter eksplicit:

```bash
docker compose --env-file .env.production -f compose.production.yml run --rm app npx prisma migrate deploy
docker compose --env-file .env.production -f compose.production.yml up -d app
curl -I http://127.0.0.1:3000/login
```

Kør aldrig seed/reset på produktionsdata. Migrationer kører ikke ved hver genstart.
Prøvekopien skal have cron slået fra og må ikke sende mails/push til rigtige brugere.
Test login, adgangskontrol, billeder, bøder, tilmelding og integrationsfunktioner.
En separat testadresse giver separate cookies/PWA; verificér det rigtige domæne ved cutover.

## 4. Flyt profilbilleder

Eksportér filerne fra Supabase Storage og kopier dem til Compose-volumenet
`holdbold_profile-images`. Brug app-brugerens UID/GID (1000:1000) og sikre filrettigheder.
Nye filer ligger uden for public og serveres af `/api/profile-images/[filename]`.
Ejeren og aktive medlemmer af samme hold har adgang.

Opdatér `User.image` for hver kopieret fil til `/api/profile-images/FILENAME`.
Kortlæg også gamle offentlige/signerede Supabase-URL'er og kontrollér, at filerne
findes; en databasebackup indeholder ikke Storage-filer. Eksport og omskrivning
skal forberedes og afprøves før den endelige flytning. Filer skal være png, jpg,
webp, gif eller avif med et sikkert filnavn. Hold Supabase aktiv, indtil dette er verificeret.

## 5. Nginx, HTTPS og cutover

`nginx.conf.example` er en HTTP-skabelon, ikke en færdig TLS-opsætning.
Gennemgå eksisterende sites, tilføj Holdbold, kør `nginx -t`, og reload kun ved succes.
Brug automatisk certifikatfornyelse; TLS kan forberedes med DNS-challenge før DNS-flytning.
Bevar mailrelaterede MX/TXT-records hos one.com.

Sænk DNS-TTL i god tid. Stop gammel cron og blokér writes på gammel app. Tag en
endelig konsistent databaseeksport og sidste billedsynkronisering. Restore,
kontrollér data, og skift A-records for både apex og www (eller behold korrekt CNAME).
Ret/fjern gamle AAAA-records efter den valgte IPv6-opsætning. HTTPS skal virke,
før den nye app åbnes. Lad gammel app være skrivebeskyttet under DNS-overgangen.

## 6. Aktivér lokal cron EFTER cutover

Erstat kun den eksisterende Holdbold-linje i `crontab -e`; behold FADL-linjerne.
Den nye linje er:

```cron
2 * * * * /usr/bin/bash /opt/holdbold/deploy/cron.sh >> /var/log/holdbold-cron.log 2>&1
```

Scriptet bruger `flock` og kalder containeren direkte uden HTTP-token. Det udfører
bødeautomatik, påmindelser, gentagne arrangementer og DBU-feed-synkronisering. Fjern derefter HTTP-cron-endpoint og `CRON_SECRET`
fra den aktive app. Manuel cron-kørsel sender rigtige påmindelser: test på isolerede data.
Sæt logrotation op for cronloggen og fejlalarmer for app, backup og cron.

## 7. Backup og rollback

Inden åbning: automatisér databasebackup og kopi af billedvolumen til eksternt
lager, med retention og separat sikker opbevaring af nødvendige nøgler. Afprøv
restore i en isoleret database. Lokale Docker-volumener er ikke backups.

Behold Vercel/Supabase under observation. Efter nye writes på Hetzner kræver
rollback en ny write-pause og overførsel af nye data/billeder tilbage; DNS alene
vil tabe ændringer. Brug aldrig `docker compose down -v` på produktionsopsætningen.
