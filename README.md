# Holdbold

Mobilvenlig webapp til holdkalender, tilmelding og boedekasse.

## Kom hurtigt i gang

1. Installer dependencies
2. Opret `.env` ud fra `.env.example`
3. Koer migrationer
4. Start dev-serveren

```bash
npm install
cp .env.example .env
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

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
- `SEED_ADMIN_PHONE`
- `SEED_ADMIN_PASSWORD`

Miljoevariabler for at oprette en spiller i seed:

- `SEED_PLAYER_EMAIL`
- `SEED_PLAYER_PHONE`
- `SEED_PLAYER_PASSWORD`
