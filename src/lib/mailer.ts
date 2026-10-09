type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Sender mail via Resend (gratis op til 3.000 mails/md.).
 * Uden RESEND_API_KEY (fx lokalt) logges mailen i stedet for at blive sendt.
 */
export async function sendMail({ to, subject, text, html }: MailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[mail] RESEND_API_KEY mangler – mail til ${to} sendes ikke.\n${subject}\n${text}`);
    return true;
  }

  const from = process.env.MAIL_FROM || "Holdbold <onboarding@resend.dev>";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from, to, subject, text, html })
    });
    if (!response.ok) {
      console.error("[mail] Resend fejlede", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[mail] Resend fejlede", error);
    return false;
  }
}
