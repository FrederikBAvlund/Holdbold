import { NextResponse } from "next/server";
import { z } from "zod";
import { FINE_MANAGER_ROLES, requireActiveTeamMemberWithRoles, requireSession } from "@/lib/apiAuth";
import { MAX_IMPORT_ROWS, parseTemplateWorkbook } from "@/lib/fineTemplateImport";
import { prisma } from "@/lib/prisma";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const confirmSchema = z.object({
  teamId: z.string().min(1),
  templates: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        amount: z.number().int().refine((n) => n !== 0),
        category: z.enum(["SOME", "FAELLES", "SPILLER", "DIVERSE"]),
        description: z.string().max(500).optional()
      })
    )
    .min(1)
    .max(MAX_IMPORT_ROWS)
});

const keyOf = (title: string, amount: number) => `${title.trim().toLowerCase()}|${amount}`;

/**
 * Multipart (fil + teamId) giver en forhåndsvisning uden at gemme noget.
 * JSON (teamId + templates) opretter de bekræftede bødeskabeloner.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return session.response;

  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    const parsed = confirmSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Ugyldige data" }, { status: 400 });
    const { teamId, templates } = parsed.data;

    const access = await requireActiveTeamMemberWithRoles(session.userId, teamId, FINE_MANAGER_ROLES);
    if (!access.ok) return access.response;

    const existing = await prisma.fineTemplate.findMany({
      where: { teamId, status: { not: "REJECTED" } },
      select: { title: true, amount: true }
    });
    const existingKeys = new Set(existing.map((t) => keyOf(t.title, t.amount)));
    const fresh = templates.filter((t) => !existingKeys.has(keyOf(t.title, t.amount)));

    if (fresh.length > 0) {
      const now = new Date();
      await prisma.fineTemplate.createMany({
        data: fresh.map((t) => ({
          teamId,
          title: t.title,
          amount: t.amount,
          category: t.category,
          description: t.description,
          createdById: session.userId,
          status: "APPROVED" as const,
          approvedAt: now,
          approvedById: session.userId
        }))
      });
    }
    return NextResponse.json({ created: fresh.length, skipped: templates.length - fresh.length });
  }

  const form = await request.formData().catch(() => null);
  const teamId = String(form?.get("teamId") ?? "");
  const file = form?.get("file");
  if (!teamId || !(file instanceof File)) {
    return NextResponse.json({ error: "Vælg en Excel-fil" }, { status: 400 });
  }

  const access = await requireActiveTeamMemberWithRoles(session.userId, teamId, FINE_MANAGER_ROLES);
  if (!access.ok) return access.response;

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Filen er for stor (maks 2 MB)" }, { status: 400 });
  }

  try {
    return NextResponse.json(parseTemplateWorkbook(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "Kunne ikke læse filen. Brug en .xlsx-fil." }, { status: 400 });
  }
}
