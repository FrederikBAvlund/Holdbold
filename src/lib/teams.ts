import type { Prisma } from "@prisma/client";

/** Opretter et hold med første sæson og én holdadministrator. Kaldes inde i en transaktion. */
export async function createTeamWithAdmin(
  tx: Prisma.TransactionClient,
  input: { name: string; slug: string; themePreset?: string; adminUserId: string }
) {
  const team = await tx.team.create({
    data: { name: input.name, slug: input.slug, ...(input.themePreset ? { themePreset: input.themePreset } : {}) }
  });
  await tx.season.create({ data: { teamId: team.id, name: "Sæson 1" } });
  await tx.membership.create({
    data: { teamId: team.id, userId: input.adminUserId, role: "ADMIN", status: "ACTIVE" }
  });
  return team;
}
