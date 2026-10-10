import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumePasswordResetToken } from "@/lib/passwordReset";

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Adgangskode skal være mindst 8 tegn")
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ugyldigt input" }, { status: 400 });
  }

  const email = await consumePasswordResetToken(parsed.data.token);
  if (!email) {
    return NextResponse.json({ error: "Linket er ugyldigt eller udløbet. Bed om et nyt." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const result = await prisma.user.updateMany({
    where: { email: { equals: email, mode: "insensitive" } },
    data: { passwordHash }
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Linket er ugyldigt eller udløbet. Bed om et nyt." }, { status: 400 });
  }

  return NextResponse.json({ message: "Din adgangskode er opdateret." });
}
