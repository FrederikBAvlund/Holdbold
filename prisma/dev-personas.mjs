import bcrypt from "bcryptjs";

/**
 * Testbrugere til lokal udvikling: én for hver rolle og hver tilstand guiden kan være i.
 * Oprettes af seed'en, når SEED_DEV_PASSWORD er sat – og nulstilles hver gang seed'en kører.
 *
 * guide:
 *   new      – aldrig set guiden → velkomsten vises
 *   existing – var med, før guiden fandtes → "Nyt"-kortet vises
 *   promoted – har været igennem guiden som spiller og er siden forfremmet → "Du er blevet …"
 */
export const DEV_PERSONAS = [
  { email: "admin@holdbold.local", name: "Admin", roles: ["ADMIN"], guide: "new", note: "Ny admin: velkomst og holdopsætning" },
  { email: "traener@holdbold.local", name: "Træner", roles: ["TRAENER"], guide: "new", note: "Ny træner: begivenheder" },
  { email: "boedekasse@holdbold.local", name: "Bødekasse", roles: ["BOEDEKASSEFORMAND"], guide: "new", note: "Ny bødekasseformand" },
  { email: "spiller@holdbold.local", name: "Spiller", roles: ["SPILLER"], guide: "new", note: "Ny spiller: kun det grundlæggende" },
  { email: "some@holdbold.local", name: "SoMe", roles: ["SOME"], guide: "new", note: "Ny SoMe-ansvarlig" },
  {
    email: "flere@holdbold.local",
    name: "Flere roller",
    roles: ["TRAENER", "BOEDEKASSEFORMAND", "SPILLER"],
    guide: "new",
    note: "Træner + bødekasseformand + spiller"
  },
  { email: "veteran@holdbold.local", name: "Veteran", roles: ["SPILLER"], guide: "existing", note: "Medlem fra før guiden: \"Nyt\"-kortet" },
  {
    email: "forfremmet@holdbold.local",
    name: "Forfremmet",
    roles: ["BOEDEKASSEFORMAND", "SPILLER"],
    guide: "promoted",
    guideRoles: ["SPILLER"],
    note: "Spiller, der er blevet bødekasseformand: \"Du er blevet …\""
  },
  { email: "afventer@holdbold.local", name: "Afventer", roles: ["SPILLER"], status: "PENDING", guide: "new", note: "Venter på, at admin godkender" }
];

/** Resten af holdet, så der er nogen at give bøder, godkende og tilmelde. Veteraner uden guide-afbrydelser. */
export const DEMO_PLAYER_COUNT = 20;

function demoPlayers() {
  return Array.from({ length: DEMO_PLAYER_COUNT }, (_, index) => ({
    email: `spiller${index + 1}@holdbold.local`,
    name: `Spiller ${index + 1}`,
    roles: ["SPILLER"],
    guide: "existing"
  }));
}

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]", "::1"];

/**
 * Et kodeord som "1" på alle brugere må aldrig komme i nærheden af en rigtig database.
 * Afviser alt andet end en database på denne maskine – inden der røres ved noget.
 */
export function assertLocalDatabase(databaseUrl = process.env.DATABASE_URL) {
  let host = "";
  try {
    host = new URL(databaseUrl ?? "").hostname;
  } catch {
    throw new Error("DATABASE_URL mangler eller er ugyldig – testbrugere oprettes ikke.");
  }
  if (!LOCAL_HOSTS.includes(host)) {
    throw new Error(
      `SEED_DEV_PASSWORD opretter testbrugere med et svagt kodeord og må kun bruges mod en lokal database, ` +
        `men DATABASE_URL peger på "${host}". Fjern SEED_DEV_PASSWORD, eller brug den lokale Docker-database.`
    );
  }
}

function guideFields(persona) {
  if (persona.guide === "existing") {
    return { guideRoles: persona.roles, guideStartedAt: null, guideDismissedAt: null };
  }
  if (persona.guide === "promoted") {
    return { guideRoles: persona.guideRoles, guideStartedAt: new Date(), guideDismissedAt: null };
  }
  return { guideRoles: [], guideStartedAt: null, guideDismissedAt: null };
}

/**
 * Opretter eller nulstiller testbrugerne på holdet: kodeord, roller, status og guidens tilstand.
 * Returnerer et kort fra e-mail til bruger-id.
 */
export async function applyDevPersonas(prisma, { teamId, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const ids = new Map();

  for (const persona of [...DEV_PERSONAS, ...demoPlayers()]) {
    const user = await prisma.user.upsert({
      where: { email: persona.email },
      create: { name: persona.name, email: persona.email, passwordHash },
      update: { name: persona.name, passwordHash }
    });
    ids.set(persona.email, user.id);

    const membership = {
      roles: persona.roles,
      status: persona.status ?? "ACTIVE",
      ...guideFields(persona)
    };
    await prisma.membership.upsert({
      where: { userId_teamId: { userId: user.id, teamId } },
      create: { userId: user.id, teamId, ...membership },
      update: membership
    });
    await prisma.guideProgress.deleteMany({ where: { userId: user.id, teamId } });
  }

  return ids;
}
