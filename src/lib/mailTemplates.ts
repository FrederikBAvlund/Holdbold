export function appUrl(path = "") {
  const base = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://holdbold.dk").replace(/\/$/, "");
  return `${base}${path}`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type Mail = { subject: string; text: string; html: string };

function build(subject: string, paragraphs: string[], action?: { label: string; url: string }): Mail {
  const text = [...paragraphs, ...(action ? [`${action.label}: ${action.url}`] : [])].join("\n\n");
  const html =
    paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("") +
    (action ? `<p><a href="${escapeHtml(action.url)}">${escapeHtml(action.label)}</a></p>` : "");
  return { subject, text, html };
}

export function teamRequestApprovedMail(input: { name: string; teamName: string }): Mail {
  return build(
    `Dit hold ${input.teamName} er oprettet i Holdbold`,
    [
      `Hej ${input.name}`,
      `Dit hold ${input.teamName} er nu godkendt og oprettet i Holdbold. Du er administrator for holdet og kan logge ind, tilføje spillere, fordele roller og administrere holdet.`
    ],
    { label: "Log ind i Holdbold", url: appUrl("/login") }
  );
}

export function teamRequestRejectedMail(input: { name: string; teamName: string; reason?: string | null }): Mail {
  return build(`Din anmodning om ${input.teamName} er afvist`, [
    `Hej ${input.name}`,
    `Din anmodning om at oprette holdet ${input.teamName} i Holdbold blev desværre ikke godkendt.`,
    ...(input.reason ? [`Begrundelse: ${input.reason}`] : []),
    "Holdkoden er frigivet igen, og du er velkommen til at sende en ny anmodning."
  ]);
}

export function teamRequestReceivedMail(input: { requesterName: string; requesterEmail: string; teamName: string; slug: string }): Mail {
  return build(
    `Ny holdanmodning: ${input.teamName}`,
    [`${input.requesterName} (${input.requesterEmail}) har anmodet om holdet ${input.teamName} med holdkoden ${input.slug}.`],
    { label: "Gennemgå anmodningen", url: appUrl("/dashboard/admin") }
  );
}

export function membershipActivatedMail(input: { name: string; teamName: string }): Mail {
  return build(
    `Du er tilmeldt ${input.teamName} i Holdbold`,
    [
      `Hej ${input.name}`,
      `Du er nu godkendt og tilmeldt holdet ${input.teamName} i Holdbold. Slå gerne notifikationer til i appen, så du ikke går glip af noget.`
    ],
    { label: "Åbn Holdbold", url: appUrl("/login") }
  );
}
