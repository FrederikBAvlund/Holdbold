import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireSession } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkSlugAvailable, SLUG_ERROR_MESSAGES } from "@/lib/reservedSlugs";
import { isThemePresetId } from "@/lib/themePresets";
import { MAX_PENDING_TEAM_REQUESTS_PER_USER, notifySuperAdminsOfTeamRequest } from "@/lib/teamRequests";

const createSchema = z.object({
  name: z.string().trim().min(2, "Holdnavn skal have mindst 2 tegn").max(60),
  slug: z.string().trim().min(2, "Holdkode skal have mindst 2 tegn").max(40),
  themePreset: z.string().refine(isThemePresetId, "Ukendt farvetema")
});

/** Brugerens egne holdanmodninger. */
export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const requests = await prisma.teamRequest.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, slug: true, themePreset: true, status: true, rejectionReason: true, createdAt: true, decidedAt: true }
  });
  return NextResponse.json({ requests });
}

/** Anmoder om et nyt hold. Holdkoden reserveres, indtil systemadministratoren har svaret. */
export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : "Ugyldigt input";
    return NextResponse.json({ error: message ?? "Ugyldigt input" }, { status: 400 });
  }

  const limit = await checkRateLimit(`team-request:user:${auth.userId}`, 10, 60 * 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "For mange forsøg. Vent lidt, og prøv igen." }, { status: 429 });
  }

  const pending = await prisma.teamRequest.count({ where: { userId: auth.userId, status: "PENDING" } });
  if (pending >= MAX_PENDING_TEAM_REQUESTS_PER_USER) {
    return NextResponse.json(
      { error: `Du har allerede ${MAX_PENDING_TEAM_REQUESTS_PER_USER} anmodninger, der afventer svar` },
      { status: 409 }
    );
  }

  const check = await checkSlugAvailable(body.slug);
  if (!check.ok) {
    const message = SLUG_ERROR_MESSAGES[check.reason];
    return NextResponse.json({ error: message, fieldErrors: { slug: message } }, { status: check.reason === "too_short" ? 400 : 409 });
  }

  try {
    const created = await prisma.teamRequest.create({
      data: { userId: auth.userId, name: body.name, slug: check.slug, themePreset: body.themePreset },
      include: { user: { select: { name: true, email: true } } }
    });

    try {
      await notifySuperAdminsOfTeamRequest({
        id: created.id,
        name: created.name,
        slug: created.slug,
        requesterName: created.user.name,
        requesterEmail: created.user.email ?? ""
      });
    } catch (error) {
      console.error("Kunne ikke give systemadministrator besked om holdanmodning", error);
    }

    return NextResponse.json(
      { request: { id: created.id, name: created.name, slug: created.slug, status: created.status } },
      { status: 201 }
    );
  } catch (error) {
    // To anmodninger om samme kode samtidig – det partielle unikke indeks afgør det.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const message = SLUG_ERROR_MESSAGES.taken;
      return NextResponse.json({ error: message, fieldErrors: { slug: message } }, { status: 409 });
    }
    throw error;
  }
}
