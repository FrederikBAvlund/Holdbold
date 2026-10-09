import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, requireActiveTeamMemberWithRoles } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { encryptTeamApiKey } from "@/lib/teamOpenAiKey";

type Context = { params: { id: string } };
const schema = z.object({ apiKey: z.string().trim().min(1).max(512).regex(/^sk-[A-Za-z0-9_-]+$/) });

async function authorize(teamId: string) {
  const session = await requireSession();
  if (!session.ok) return session;
  return requireActiveTeamMemberWithRoles(session.userId, teamId, ["ADMIN"]);
}

export async function GET(_request: Request, { params }: Context) {
  const member = await authorize(params.id);
  if (!member.ok) return member.response;
  const credential = await prisma.teamOpenAiCredential.findUnique({
    where: { teamId: params.id }, select: { teamId: true }
  });
  return NextResponse.json({ configured: Boolean(credential) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, { params }: Context) {
  const member = await authorize(params.id);
  if (!member.ok) return member.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Indtast en gyldig OpenAI API-nøgle" }, { status: 400 });
  // Do not log request data, encryption failures or Prisma errors: they may contain secrets.
  try {
    const encryptedApiKey = encryptTeamApiKey(params.id, parsed.data.apiKey);
    await prisma.teamOpenAiCredential.upsert({
      where: { teamId: params.id },
      create: { teamId: params.id, encryptedApiKey }, update: { encryptedApiKey }
    });
    return NextResponse.json({ configured: true });
  } catch {
    return NextResponse.json({ error: "Kunne ikke gemme API-nøglen. Kontakt systemadministratoren." }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const member = await authorize(params.id);
  if (!member.ok) return member.response;
  await prisma.teamOpenAiCredential.deleteMany({ where: { teamId: params.id } });
  return NextResponse.json({ configured: false });
}
