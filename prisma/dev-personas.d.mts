import type { PrismaClient } from "@prisma/client";

export type DevPersona = {
  email: string;
  name: string;
  roles: ("ADMIN" | "TRAENER" | "SPILLER" | "SOME" | "BOEDEKASSEFORMAND")[];
  status?: "ACTIVE" | "PENDING";
  guide: "new" | "existing" | "promoted";
  guideRoles?: DevPersona["roles"];
  note?: string;
};

export const DEV_PERSONAS: DevPersona[];
export const DEMO_PLAYER_COUNT: number;
export function assertLocalDatabase(databaseUrl?: string): void;
export function applyDevPersonas(
  prisma: PrismaClient,
  options: { teamId: string; password: string }
): Promise<Map<string, string>>;
