import { NextResponse } from "next/server";
import { z } from "zod";
import { requestLoginCode } from "@/lib/loginCode";

const bodySchema = z.object({ email: z.string().trim().email("Email er ugyldig") });

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig request body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ugyldige input" }, { status: 400 });
  }

  try {
    await requestLoginCode(parsed.data.email);
  } catch (error) {
    console.error("Kunne ikke sende engangskode", error);
    return NextResponse.json({ error: "Kunne ikke sende koden. Prøv igen om lidt." }, { status: 500 });
  }

  // Samme svar uanset om e-mailen findes, så man ikke kan afprøve hvilke e-mails der er brugere.
  return NextResponse.json({ ok: true });
}
