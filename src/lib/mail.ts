type MailInput = { to: string; subject: string; text: string; html?: string };

/**
 * Sender en mail via Resend (RESEND_API_KEY, afsender i MAIL_FROM).
 * Uden nøgle logges mailen til konsollen i udvikling, så login-flows kan afprøves lokalt.
 */
export async function sendMail({ to, subject, text, html }: MailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "Holdbold <onboarding@resend.dev>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY skal være sat for at sende mails");
    }
    console.info(`[mail] (ikke sendt, mangler RESEND_API_KEY)\nTil: ${to}\nEmne: ${subject}\n${text}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, html })
  });

  if (!response.ok) {
    throw new Error(`Mail kunne ikke sendes (${response.status})`);
  }
}
