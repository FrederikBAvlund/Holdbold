import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/apiAuth";
import { loadGuideFacts } from "@/lib/guide/facts";
import { computeGuideState, type GuideProgressStatus } from "@/lib/guide/state";
import { getGuideStep } from "@/lib/guide/steps";
import { prisma } from "@/lib/prisma";

const STEP_ACTION_STATUS: Record<"seen" | "done" | "skip", GuideProgressStatus> = {
  seen: "SEEN",
  done: "DONE",
  skip: "SKIPPED"
};

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    teamId: z.string().min(1),
    action: z.enum(["seen", "done", "skip", "reset"]),
    stepId: z.string().min(1)
  }),
  // Velkomst eller "nye rettigheder" er vist – guiden følger nu den nuværende rolle
  z.object({ teamId: z.string().min(1), action: z.literal("acknowledge-role") }),
  // "Spring hele guiden over"
  z.object({ teamId: z.string().min(1), action: z.literal("dismiss") }),
  // Start forfra fra Profil: guiden vises igen, og overspringede trin kommer tilbage
  z.object({ teamId: z.string().min(1), action: z.literal("restart") })
]);

async function findMembership(userId: string, teamId: string) {
  return prisma.membership.findFirst({
    where: { userId, teamId, status: "ACTIVE" },
    select: { id: true, role: true, guideRole: true, guideDismissedAt: true }
  });
}

async function guideState(userId: string, teamId: string) {
  const membership = await findMembership(userId, teamId);
  if (!membership) return null;
  const [facts, progress] = await Promise.all([
    loadGuideFacts(userId, teamId),
    prisma.guideProgress.findMany({ where: { userId, teamId }, select: { stepId: true, status: true } })
  ]);
  return computeGuideState({
    role: membership.role,
    guideRole: membership.guideRole,
    dismissed: membership.guideDismissedAt !== null,
    facts,
    progress: Object.fromEntries(progress.map((row) => [row.stepId, row.status]))
  });
}

/** Guidens trin for brugerens rolle på holdet, med hvad der allerede er klaret. */
export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const teamId = new URL(request.url).searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "teamId er påkrævet" }, { status: 400 });

  const state = await guideState(auth.userId, teamId);
  if (!state) return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });
  return NextResponse.json(state);
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig request body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ugyldigt input" }, { status: 400 });
  }
  const body = parsed.data;
  const userId = auth.userId;

  const membership = await findMembership(userId, body.teamId);
  if (!membership) return NextResponse.json({ error: "Ikke adgang" }, { status: 403 });

  switch (body.action) {
    case "seen":
    case "done":
    case "skip": {
      if (!getGuideStep(body.stepId)) return NextResponse.json({ error: "Ukendt trin" }, { status: 400 });
      const status = STEP_ACTION_STATUS[body.action];
      const key = { userId_teamId_stepId: { userId, teamId: body.teamId, stepId: body.stepId } };
      // "Set" må ikke overskrive et trin, der allerede er klaret eller sprunget over
      await prisma.guideProgress.upsert({
        where: { userId_teamId_stepId: { userId, teamId: body.teamId, stepId: body.stepId } },
        create: { userId, teamId: body.teamId, stepId: body.stepId, status },
        update: status === "SEEN" ? {} : { status }
      });
      break;
    }
    case "reset":
      await prisma.guideProgress.deleteMany({ where: { userId, teamId: body.teamId, stepId: body.stepId } });
      break;
    case "acknowledge-role":
      await prisma.membership.update({ where: { id: membership.id }, data: { guideRole: membership.role } });
      break;
    case "dismiss":
      await prisma.membership.update({
        where: { id: membership.id },
        data: { guideRole: membership.role, guideDismissedAt: new Date() }
      });
      break;
    case "restart":
      await prisma.$transaction([
        prisma.membership.update({ where: { id: membership.id }, data: { guideDismissedAt: null } }),
        prisma.guideProgress.deleteMany({ where: { userId, teamId: body.teamId, status: "SKIPPED" } })
      ]);
      break;
  }

  const state = await guideState(userId, body.teamId);
  return NextResponse.json(state);
}
