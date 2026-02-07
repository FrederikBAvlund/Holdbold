import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const teamSlug = process.env.SEED_TEAM_SLUG ?? "hold-1";
  const teamName = process.env.SEED_TEAM_NAME ?? "Hold 1";

  const team = await prisma.team.upsert({
    where: { slug: teamSlug },
    create: { name: teamName, slug: teamSlug },
    update: { name: teamName }
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPhone = process.env.SEED_ADMIN_PHONE;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const playerEmail = process.env.SEED_PLAYER_EMAIL;
  const playerPhone = process.env.SEED_PLAYER_PHONE;
  const playerPassword = process.env.SEED_PLAYER_PASSWORD;

  let adminUserId = null;

  if ((adminEmail || adminPhone) && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const user = await prisma.user.upsert({
      where: adminEmail ? { email: adminEmail } : { phone: adminPhone },
      create: {
        name: "Admin",
        email: adminEmail,
        phone: adminPhone,
        passwordHash
      },
      update: {}
    });

    adminUserId = user.id;

    await prisma.membership.upsert({
      where: { userId_teamId: { userId: user.id, teamId: team.id } },
      create: { userId: user.id, teamId: team.id, role: "ADMIN" },
      update: { role: "ADMIN" }
    });
  }

  if ((playerEmail || playerPhone) && playerPassword) {
    const passwordHash = await bcrypt.hash(playerPassword, 10);

    const user = await prisma.user.upsert({
      where: playerEmail ? { email: playerEmail } : { phone: playerPhone },
      create: {
        name: "Spiller",
        email: playerEmail,
        phone: playerPhone,
        passwordHash
      },
      update: {}
    });

    await prisma.membership.upsert({
      where: { userId_teamId: { userId: user.id, teamId: team.id } },
      create: { userId: user.id, teamId: team.id, role: "SPILLER" },
      update: { role: "SPILLER" }
    });
  }

  const bulkPassword = playerPassword ?? "Test1234!";
  const bulkHash = await bcrypt.hash(bulkPassword, 10);

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
      create: { userId: user.id, teamId: team.id, role: "SPILLER" },
      update: { role: "SPILLER" }
    });
  }

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
      create: { userId: user.id, teamId: team.id, role: "BOEDEKASSEFORMAND" },
      update: { role: "BOEDEKASSEFORMAND" }
    });
  }

  const fineRule = await prisma.fineRule.findFirst({
    where: { teamId: team.id }
  });

  if (!fineRule) {
    await prisma.fineRule.create({
      data: {
        teamId: team.id,
        name: "Mistet deadline",
        amount: 50,
        createdById: adminUserId
      }
    });
  }

  console.log("Seed complete", { teamId: team.id, teamSlug: team.slug });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
