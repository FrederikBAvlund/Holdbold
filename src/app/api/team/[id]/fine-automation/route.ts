import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { FINE_AUTOMATION_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";

const roleEnum = z.enum(["ADMIN", "TRAENER", "SPILLER", "SOME", "BOEDEKASSEFORMAND"]);

const actionEnum = z.enum([
  "MISSED_SIGNUP_AT_DEADLINE",
  "STATUS_CHANGE_AFTER_DEADLINE",
  "SAME_DAY_WITHDRAWAL",
  "MATCH_MOTM_WINNER"
]);

const ruleInputSchema = z
  .object({
    action: actionEnum,
    appliesTraining: z.boolean(),
    appliesMatch: z.boolean(),
    templateTrainingId: z.string().nullable().optional(),
    templateMatchId: z.string().nullable().optional(),
    excludedRoles: z.array(roleEnum).optional()
  })
  .superRefine((data, ctx) => {
    if (data.appliesTraining && !data.templateTrainingId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vælg en godkendt skabelon for træning",
        path: ["templateTrainingId"]
      });
    }
    if (data.appliesMatch && !data.templateMatchId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vælg en godkendt skabelon for kamp",
        path: ["templateMatchId"]
      });
    }
  });

const patchSchema = z.object({
  rules: z.array(ruleInputSchema).min(1).max(4)
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const teamId = params.id;
  const auth = await requireActiveTeamMemberWithRoles(session.userId, teamId, FINE_AUTOMATION_ROLES);
  if (!auth.ok) return auth.response;

  const [rules, templates] = await Promise.all([
    prisma.fineAutomationSetting.findMany({
      where: { teamId },
      orderBy: { action: "asc" }
    }),
    prisma.fineTemplate.findMany({
      where: { teamId, status: "APPROVED" },
      select: { id: true, title: true, amount: true, category: true },
      orderBy: { title: "asc" }
    })
  ]);

  return NextResponse.json({ rules, templates });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  const teamId = params.id;
  const auth = await requireActiveTeamMemberWithRoles(session.userId, teamId, FINE_AUTOMATION_ROLES);
  if (!auth.ok) return auth.response;

  const json = await request.json();
  const body = patchSchema.parse(json);

  for (const rule of body.rules) {
    if (rule.templateTrainingId) {
      const template = await prisma.fineTemplate.findFirst({
        where: { id: rule.templateTrainingId, teamId, status: "APPROVED" },
        select: { id: true }
      });
      if (!template) {
        return NextResponse.json(
          { error: `Skabelon for træning ikke fundet eller ikke godkendt (${rule.action})` },
          { status: 400 }
        );
      }
    }
    if (rule.templateMatchId) {
      const template = await prisma.fineTemplate.findFirst({
        where: { id: rule.templateMatchId, teamId, status: "APPROVED" },
        select: { id: true }
      });
      if (!template) {
        return NextResponse.json(
          { error: `Skabelon for kamp ikke fundet eller ikke godkendt (${rule.action})` },
          { status: 400 }
        );
      }
    }
  }

  await prisma.$transaction(
    body.rules.map((rule) =>
      prisma.fineAutomationSetting.upsert({
        where: {
          teamId_action: {
            teamId,
            action: rule.action
          }
        },
        create: {
          teamId,
          action: rule.action,
          appliesTraining: rule.appliesTraining,
          appliesMatch: rule.appliesMatch,
          templateTrainingId: rule.appliesTraining ? rule.templateTrainingId ?? null : null,
          templateMatchId: rule.appliesMatch ? rule.templateMatchId ?? null : null,
          excludedRoles: rule.excludedRoles ?? ["SOME"],
          isActive: true
        },
        update: {
          appliesTraining: rule.appliesTraining,
          appliesMatch: rule.appliesMatch,
          templateTrainingId: rule.appliesTraining ? rule.templateTrainingId ?? null : null,
          templateMatchId: rule.appliesMatch ? rule.templateMatchId ?? null : null,
          ...(rule.excludedRoles !== undefined ? { excludedRoles: rule.excludedRoles } : {})
        }
      })
    )
  );

  const rules = await prisma.fineAutomationSetting.findMany({
    where: { teamId },
    orderBy: { action: "asc" }
  });

  return NextResponse.json({ rules });
}
