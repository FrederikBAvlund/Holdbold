import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const fineTemplateSeeds = [
  { title: "(SoMe) Glemme MOTM", amount: 50, category: "SOME" },
  {
    title: "(SoMe) Glemme at opdatere målscore",
    amount: 25,
    description: "Glemmer at opdatere målscore",
    category: "SOME"
  },
  {
    title: "(SoMe) Grammatikfejl",
    amount: 40,
    description: "Stave- og formuleringsfejl ved instaoplæg",
    category: "SOME"
  },
  {
    title: "(SoMe) Sløjt content",
    amount: 20,
    description: "Content man har lyst til at skippe grundet manglende kreativitet",
    category: "SOME"
  },
  { title: "(SoMe) Glemmer holdbillede inden kamp", amount: 30, category: "SOME" },
  { title: "Afbud 24 timer eller mindre før kamp", amount: 200, category: "SPILLER" },
  { title: "Afslutning udover sidelinjen (kamp)", amount: 100, category: "SPILLER" },
  { title: "Afslutning udover sidelinjen (træning)", amount: 50, category: "SPILLER" },
  { title: "Begå straffe", amount: 100, category: "SPILLER" },
  { title: "Brok over tildelt bøde", amount: 10, category: "SPILLER" },
  { title: "Brænde en 100% chance", amount: 25, category: "SPILLER" },
  { title: "Diverse", amount: -150, description: "Holdet.dk (fra dem der ikke har overført)", category: "DIVERSE" },
  { title: "Diverse", amount: 20, category: "DIVERSE" },
  { title: "Diverse", amount: 50, category: "DIVERSE" },
  { title: "Du er savnet", amount: 10, category: "SPILLER" },
  { title: "Fejlindkast", amount: 75, category: "SPILLER" },
  { title: "For mange holdninger", amount: 20, description: "Hold dem for dig selv", category: "SPILLER" },
  { title: "For sent betaling pr dag", amount: 50, description: "Spilleren har ikke betalt til tiden", category: "FAELLES" },
  { title: "For sent til kamp (>5<15 min)", amount: 40, category: "SPILLER" },
  { title: "For sent til kamp (alt for sent)", amount: 70, description: ">15 min", category: "SPILLER" },
  { title: "For sent til kamp (inden for 5 min)", amount: 25, category: "SPILLER" },
  { title: "For sent til kamp (kampstart)", amount: 100, category: "SPILLER" },
  { title: "For sent til træning med tingene", amount: 35, category: "SPILLER" },
  { title: "Få en tunnel til kamp", amount: 25, category: "SPILLER" },
  { title: "Første mand hjemme", amount: 150, category: "SPILLER" },
  { title: "Ghoste bødeformanden", amount: 75, description: "Du ghoster bødekasseformanden, når han prøver at samle penge ind", category: "SPILLER" },
  { title: "Glemme støvler", amount: 100, category: "SPILLER" },
  { title: "Glemme øl eller tingene", amount: 100, category: "SPILLER" },
  { title: "Glemme øl, men sørger for de er der til kampstart", amount: 75, category: "SPILLER" },
  { title: "Glemt skinner, shorts, trøje eller sokker", amount: 60, category: "SPILLER" },
  { title: "Håndbold", amount: 50, description: "Se, snakke eller tænke på håndbold", category: "SPILLER" },
  { title: "Ikke gå i omklædning efter kamp", amount: 20, category: "SPILLER" },
  { title: "Ikke møde op til kamp", amount: 500, category: "SPILLER" },
  { title: "Ikke møde op til træning", amount: 75, category: "SPILLER" },
  { title: "Ikke skrive sig til/fra på opslag", amount: 20, category: "SPILLER" },
  { title: "Ikke tage tingene efter kamp", amount: 150, category: "SPILLER" },
  { title: "Jeg kom for sent til der sjove", amount: 50, category: "SPILLER" },
  { title: "Judas", amount: 100, category: "SPILLER" },
  { title: "Julefrokost", amount: 100, category: "FAELLES" },
  { title: "Kan ikke stille hold", amount: 50, description: "Såfremt vi ikke kan stille 14 mand og aflyser kampen, koster det alle 50 kroner", category: "FAELLES" },
  { title: "Kaste op til kamp", amount: 250, description: "Kaster op pga tømmermænd", category: "SPILLER" },
  { title: "Kikset story", amount: 45, category: "SPILLER" },
  { title: "Knalde i spillertrøje", amount: -1000, description: "Skal dokumenteres", category: "SPILLER" },
  { title: "Kontingent", amount: 240, category: "FAELLES" },
  { title: "Kort (rødt)", amount: 200, category: "SPILLER" },
  { title: "Kort (dumt gult)", amount: 100, category: "SPILLER" },
  { title: "Kort (gult)", amount: 50, category: "SPILLER" },
  { title: "Krampe", amount: 35, description: "Krampe til kamp eller træning", category: "SPILLER" },
  { title: "Kysse kæresten i spilletrøjen", amount: 50, category: "SPILLER" },
  { title: "Købe sig ud ud af røvspark", amount: 100, category: "SPILLER" },
  { title: "Lave en fissan", amount: 50, description: "Trække sig fra dueller tilstrækkeligt meget til kamp", category: "SPILLER" },
  { title: "Madpakken", amount: 35, description: "Frugt, müslibarer og andet mad relateret til træning accepteres. Har du madpakke med fordi du ikke har spist nok hjemmefra, tildeles denne bøde", category: "SPILLER" },
  { title: "Man of the match", amount: -40, category: "SPILLER" },
  { title: "Melde fra til træning på dagen", amount: 45, category: "SPILLER" },
  { title: "Mistet en bold", amount: 175, description: "Sparke en bold væk, hvor denne ikke kan hentes", category: "SPILLER" },
  { title: "Nicotine bøden", amount: 50, description: "Snus, smøgere eller anden form for nikotin fra vi går ud på banen, til kampen fløjtes af straffes med denne bøde", category: "SPILLER" },
  { title: "Selvmål", amount: 75, category: "SPILLER" },
  { title: "Skabe en scene til kamp", amount: 60, category: "SPILLER" },
  { title: "Skæve replikker", amount: 40, description: "Dårlig humor", category: "SPILLER" },
  { title: "Slå bødeformanden", amount: 300, category: "SPILLER" },
  { title: "Spilde udover sin ven", amount: 100, description: "Gøre sin ven gennemblødt", category: "SPILLER" },
  { title: "Spille kamp i lang buks", amount: 75, category: "SPILLER" },
  { title: "Spin hjulet efter træning", amount: 100, description: "Hvis man taber på hjulet til træning, og er forhindret i at komme til næste kamp/træning tildeles denne bøde. Bøden kan undgås ved, at man selv sørger for at transportere tingene hjem til en anden fra taberholdet", category: "SPILLER" },
  { title: "Stempelbøde", amount: 50, description: "Komme til kamp med stempler på armen", category: "SPILLER" },
  { title: "Stådreng i bad", amount: 500, category: "SPILLER" },
  { title: "Tabt kamp", amount: 25, description: "Ved nederlag får alle på holdkortet denne", category: "FAELLES" },
  { title: "Tage i byen i spilletrøje", amount: -50, category: "SPILLER" },
  { title: "Ulovlige skinner", amount: 75, description: "Dommer godkender ikke skinner, og du har ikke selv andre at skifte ud med", category: "SPILLER" },
  { title: "Veo abonnement", amount: 15, category: "FAELLES" },
  { title: "Voldsomme tømmermænd til kamp", amount: 110, category: "SPILLER" },
  { title: "Ødelægge glas", amount: 50, category: "SPILLER" },
  { title: "Ølspild", amount: 30, category: "SPILLER" },
  { title: "Ølspild (fadøl)", amount: 50, category: "SPILLER" }
];

function templateKey(input) {
  const description = (input.description ?? "").trim().toLowerCase();
  return `${input.title.trim().toLowerCase()}|${input.amount}|${description}`;
}

async function main() {
  const teamSlug = process.env.SEED_TEAM_SLUG ?? "hold-1";
  const teamName = process.env.SEED_TEAM_NAME ?? "Hold 1";

  const team = await prisma.team.upsert({
    where: { slug: teamSlug },
    create: { name: teamName, slug: teamSlug },
    update: { name: teamName }
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const playerEmail = process.env.SEED_PLAYER_EMAIL;
  const playerPassword = process.env.SEED_PLAYER_PASSWORD;
  const includeSinglePlayer = process.env.SEED_INCLUDE_SINGLE_PLAYER === "true";
  const includeDemoPlayers = process.env.SEED_INCLUDE_DEMO_PLAYERS === "true";
  const includeDemoTreasurers = process.env.SEED_INCLUDE_DEMO_TREASURERS === "true";

  let adminUserId = null;

  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const user = await prisma.user.upsert({
      where: { email: adminEmail },
      create: {
        name: "Admin",
        email: adminEmail,
        passwordHash
      },
      update: {}
    });

    adminUserId = user.id;

    await prisma.membership.upsert({
      where: { userId_teamId: { userId: user.id, teamId: team.id } },
      create: { userId: user.id, teamId: team.id, role: "ADMIN", status: "ACTIVE" },
      update: { role: "ADMIN", status: "ACTIVE" }
    });
  }

  if (includeSinglePlayer && playerEmail && playerPassword) {
    const passwordHash = await bcrypt.hash(playerPassword, 10);

    const user = await prisma.user.upsert({
      where: { email: playerEmail },
      create: {
        name: "Spiller",
        email: playerEmail,
        passwordHash
      },
      update: {}
    });

    await prisma.membership.upsert({
      where: { userId_teamId: { userId: user.id, teamId: team.id } },
      create: { userId: user.id, teamId: team.id, role: "SPILLER", status: "ACTIVE" },
      update: { role: "SPILLER", status: "ACTIVE" }
    });
  }

  const bulkPassword = playerPassword ?? "Test1234!";
  const bulkHash = await bcrypt.hash(bulkPassword, 10);

  if (includeDemoPlayers) {
    for (let index = 1; index <= 20; index += 1) {
      const email = `spiller${index}@holdbold.local`;
      const user = await prisma.user.upsert({
        where: { email },
        create: {
          name: `Spiller ${index}`,
          email,
          passwordHash: bulkHash
        },
        update: {}
      });

      await prisma.membership.upsert({
        where: { userId_teamId: { userId: user.id, teamId: team.id } },
        create: { userId: user.id, teamId: team.id, role: "SPILLER", status: "ACTIVE" },
        update: { role: "SPILLER", status: "ACTIVE" }
      });
    }
  }

  if (includeDemoTreasurers) {
    for (let index = 1; index <= 2; index += 1) {
      const email = `boedekasse${index}@holdbold.local`;
      const user = await prisma.user.upsert({
        where: { email },
        create: {
          name: `Bødekasse ${index}`,
          email,
          passwordHash: bulkHash
        },
        update: {}
      });

      await prisma.membership.upsert({
        where: { userId_teamId: { userId: user.id, teamId: team.id } },
        create: { userId: user.id, teamId: team.id, role: "BOEDEKASSEFORMAND", status: "ACTIVE" },
        update: { role: "BOEDEKASSEFORMAND", status: "ACTIVE" }
      });
    }
  }

  const existingTemplates = await prisma.fineTemplate.findMany({
    where: { teamId: team.id },
    select: {
      id: true,
      title: true,
      amount: true,
      description: true,
      category: true
    }
  });

  const existingByKey = new Map(existingTemplates.map((template) => [templateKey(template), template]));
  const templatesToCreate = [];
  const templatesToUpdate = [];

  for (const template of fineTemplateSeeds) {
    const key = templateKey(template);
    const existing = existingByKey.get(key);

    if (!existing) {
      templatesToCreate.push({
        teamId: team.id,
        title: template.title,
        amount: template.amount,
        category: template.category,
        description: template.description ?? null,
        createdById: adminUserId,
        status: "APPROVED"
      });
      continue;
    }

    if (existing.category !== template.category) {
      templatesToUpdate.push(
        prisma.fineTemplate.update({
          where: { id: existing.id },
          data: { category: template.category }
        })
      );
    }
  }

  if (templatesToCreate.length > 0) {
    await prisma.fineTemplate.createMany({ data: templatesToCreate });
  }

  if (templatesToUpdate.length > 0) {
    await Promise.all(templatesToUpdate);
  }

  const allTemplates = await prisma.fineTemplate.findMany({
    where: { teamId: team.id, status: "APPROVED" },
    select: { id: true, title: true }
  });

  function findTemplateByTitleCI(title) {
    const needle = title.trim().toLowerCase();
    return allTemplates.find((template) => template.title.trim().toLowerCase() === needle);
  }

  const defaultSignup = findTemplateByTitleCI("Ikke skrive sig til/fra på opslag") ?? allTemplates[0];
  if (defaultSignup) {
    const trainingDay = findTemplateByTitleCI("Melde fra til træning på dagen");
    const matchDay = findTemplateByTitleCI("Afbud 24 timer eller mindre før kamp");

    const sameDayTrainingId = trainingDay?.id ?? defaultSignup.id;
    const sameDayMatchId = matchDay?.id ?? defaultSignup.id;

    const automationRules = [
      {
        action: "MISSED_SIGNUP_AT_DEADLINE",
        appliesTraining: true,
        appliesMatch: true,
        templateTrainingId: defaultSignup.id,
        templateMatchId: defaultSignup.id
      },
      {
        action: "STATUS_CHANGE_AFTER_DEADLINE",
        appliesTraining: true,
        appliesMatch: true,
        templateTrainingId: defaultSignup.id,
        templateMatchId: defaultSignup.id
      },
      {
        action: "SAME_DAY_WITHDRAWAL",
        appliesTraining: true,
        appliesMatch: true,
        templateTrainingId: sameDayTrainingId,
        templateMatchId: sameDayMatchId
      }
    ];

    for (const row of automationRules) {
      await prisma.fineAutomationSetting.upsert({
        where: {
          teamId_action: {
            teamId: team.id,
            action: row.action
          }
        },
        create: {
          teamId: team.id,
          action: row.action,
          appliesTraining: row.appliesTraining,
          appliesMatch: row.appliesMatch,
          templateTrainingId: row.templateTrainingId,
          templateMatchId: row.templateMatchId,
          excludedRoles: ["SOME"],
          isActive: true
        },
        update: {
          appliesTraining: row.appliesTraining,
          appliesMatch: row.appliesMatch,
          templateTrainingId: row.templateTrainingId,
          templateMatchId: row.templateMatchId
        }
      });
    }
  }

  console.log("Seed complete", {
    teamId: team.id,
    teamSlug: team.slug,
    templatesCreated: templatesToCreate.length,
    templatesUpdated: templatesToUpdate.length
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
