import type { EventKind, FineAutomationAction, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AutomationTemplatePick = {
  id: string;
  title: string;
  amount: number;
  description: string | null;
};

export type ResolvedAutomation = {
  template: AutomationTemplatePick;
  excludedRoles: Role[];
  automationAction: FineAutomationAction;
};

const EVENT_DAY_TZ = "Europe/Copenhagen";

export function isSameCalendarDayAsEvent(eventDate: Date, now: Date = new Date(), timeZone = EVENT_DAY_TZ): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(eventDate) === fmt.format(now);
}

export function roleExcludedFromFineAutomation(role: Role, excludedRoles: Role[]): boolean {
  return excludedRoles.includes(role);
}

export function isPostDeadlineWithdrawal(
  previousStatus: "IN" | "OUT" | "UNKNOWN" | null | undefined,
  nextStatus: "IN" | "OUT" | "UNKNOWN",
  changedAt: Date,
  deadlineAt: Date,
  eventDate: Date
): boolean {
  return (
    previousStatus === "IN" &&
    nextStatus === "OUT" &&
    changedAt > deadlineAt &&
    changedAt < eventDate &&
    !isSameCalendarDayAsEvent(eventDate, changedAt)
  );
}

type DbClient = Pick<Prisma.TransactionClient, "fineAutomationSetting" | "fineTemplate">;

export async function resolveAutomationTemplate(
  teamId: string,
  action: FineAutomationAction,
  eventKind: EventKind | null,
  db: DbClient = prisma
): Promise<ResolvedAutomation | null> {
  if (!eventKind || (eventKind !== "TRAINING" && eventKind !== "MATCH")) {
    return null;
  }

  const row = await db.fineAutomationSetting.findUnique({
    where: { teamId_action: { teamId, action } },
    select: {
      appliesTraining: true,
      appliesMatch: true,
      templateTrainingId: true,
      templateMatchId: true,
      excludedRoles: true,
      isActive: true
    }
  });

  const templateId =
    eventKind === "TRAINING"
      ? row?.isActive && row.appliesTraining && row.templateTrainingId
        ? row.templateTrainingId
        : null
      : row?.isActive && row.appliesMatch && row.templateMatchId
        ? row.templateMatchId
        : null;

  if (templateId && row?.isActive) {
    const template = await db.fineTemplate.findFirst({
      where: { id: templateId, teamId, status: "APPROVED" },
      select: { id: true, title: true, amount: true, description: true }
    });
    if (template) {
      return {
        template,
        excludedRoles: row.excludedRoles,
        automationAction: action
      };
    }
  }

  return null;
}
