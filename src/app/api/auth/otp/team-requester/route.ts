import { NextResponse } from "next/server";
import { z } from "zod";
import { requestTeamRequesterCode } from "@/lib/loginCode";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const IP_LIMIT = { limit: 10, windowSeconds: 10 * 60 };

const bodySchema = z.object({
  name: z.string().trim().min(1, "Navn er påkrævet").max(100),
  email: z.string().trim().email("Email er ugyldig")
});

/** Trin 1 i oprettelse af bruger, der vil anmode om et hold: sender en kode. Brugeren oprettes først, når koden er bekræftet. */
export async function POST(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit(`otp-request:ip:${ip}`, IP_LIMIT.limit, IP_LIMIT.windowSeconds);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "For mange forsøg. Vent lidt, og prøv igen." },
      { status: 429, headers: { "Retry-After": String(IP_LIMIT.windowSeconds) } }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig request body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    const message = parsed.error.issues[0]?.message ?? "Ugyldige input";
    return NextResponse.json({ error: message, fieldErrors: field ? { [field]: message } : {} }, { status: 400 });
  }

  try {
    const result = await requestTeamRequesterCode(parsed.data);
    if (result.status === "email_taken") {
      return NextResponse.json(
        { error: "Der findes allerede en bruger med den email. Log ind i stedet.", fieldErrors: { email: "Email er allerede i brug" } },
        { status: 409 }
      );
    }
  } catch (error) {
    console.error("Kunne ikke sende kode", error);
    return NextResponse.json({ error: "Kunne ikke sende koden. Prøv igen om lidt." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
