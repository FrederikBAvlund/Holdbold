import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { createPasswordResetToken } from "@/lib/passwordReset";

const bodySchema = z.object({ email: z.string().trim().email() });

const GENERIC_RESPONSE = {
  message: "Hvis emailen findes hos os, har vi sendt et link til at nulstille adgangskoden."
};

function appUrl(request: Request) {
  return (process.env.NEXTAUTH_URL || new URL(request.url).origin).replace(/\/$/, "");
}

export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit(`forgot-password:ip:${ip}`, 10, 10 * 60);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "For mange forsøg. Vent lidt, og prøv igen." },
      { status: 429, headers: { "Retry-After": String(10 * 60) } }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email er ugyldig" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { email: true, name: true }
  });

  // Samme svar uanset om emailen findes, så man ikke kan afprøve hvem der har en konto.
  if (!user?.email) return NextResponse.json(GENERIC_RESPONSE);

  // Højst 3 mails i timen pr. adresse; svaret er det samme, så grænsen ikke kan aflæses.
  const emailLimit = await checkRateLimit(`forgot-password:email:${user.email.toLowerCase()}`, 3, 60 * 60);
  if (!emailLimit.allowed) return NextResponse.json(GENERIC_RESPONSE);

  const token = await createPasswordResetToken(user.email);
  const link = `${appUrl(request)}/nulstil-password?token=${token}`;

  try {
    await sendMail({
      to: user.email,
      subject: "Nulstil din adgangskode til Holdbold",
      text: `Hej ${user.name}\n\nBrug linket herunder til at vælge en ny adgangskode. Det virker i 1 time.\n\n${link}\n\nHar du ikke bedt om det, kan du ignorere denne mail.`,
      html: `<p>Hej ${user.name.replace(/[<>&"]/g, "")}</p><p>Brug knappen herunder til at vælge en ny adgangskode. Linket virker i 1 time.</p><p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#1f5d3a;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Vælg ny adgangskode</a></p><p style="color:#666;font-size:13px">Har du ikke bedt om det, kan du ignorere denne mail.</p>`
    });
  } catch (error) {
    // Fejl må ikke afsløre, at emailen findes; log og svar som normalt.
    console.error("Kunne ikke sende nulstillingsmail", error);
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
