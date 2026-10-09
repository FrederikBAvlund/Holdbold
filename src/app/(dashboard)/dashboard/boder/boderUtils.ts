export function formatFineKr(amount: number) {
  return `${amount} kr`;
}

export function fineAmountClass(amount: number) {
  return amount < 0 ? "text-moss" : "text-ink";
}

export function fineEventHref(event: { id: string }) {
  return `/dashboard/kalender/${encodeURIComponent(event.id)}`;
}

export function parseIntegerAmountInput(raw: string): { ok: true; value: number } | { ok: false } {
  const t = raw.trim().replace(/\s/g, "");
  if (!t || t === "-" || t === "+") return { ok: false };
  if (!/^-?\d+$/.test(t)) return { ok: false };
  const value = parseInt(t, 10);
  if (!Number.isFinite(value)) return { ok: false };
  return { ok: true, value };
}

export type FineStatusTone = "out" | "pending" | "in" | "neutral";

/** Dansk label og farvetone pr. bødestatus (tonen mappes til Chip i UI). */
export function fineStatusMeta(status: string): { label: string; tone: FineStatusTone } {
  switch (status) {
    case "UNPAID":
      return { label: "Ubetalt", tone: "out" };
    case "PAID_PENDING":
      return { label: "Afventer", tone: "pending" };
    case "PAID_APPROVED":
      return { label: "Betalt", tone: "in" };
    case "FORESLAET":
      return { label: "Foreslået", tone: "pending" };
    case "AFVIST":
      return { label: "Afvist", tone: "neutral" };
    default:
      return { label: status, tone: "neutral" };
  }
}

/** Saldo for en spillers egne bøder. */
export function summarizeFines(fines: Array<{ amount: number; status: string }>) {
  let unpaid = 0;
  let pending = 0;
  let paid = 0;
  for (const fine of fines) {
    if (fine.status === "UNPAID") unpaid += fine.amount;
    else if (fine.status === "PAID_PENDING") pending += fine.amount;
    else if (fine.status === "PAID_APPROVED") paid += fine.amount;
  }
  return { unpaid, pending, paid, owed: unpaid + pending };
}

/** Bødetavle: kun medlemmer med beløb > 0, højeste først, med delt placering ved samme beløb. */
export function rankDebtors(debtors: Array<{ userId: string; name: string; total: number }>) {
  const sorted = debtors.filter((debtor) => debtor.total > 0).sort((a, b) => b.total - a.total);
  let rank = 0;
  let previous: number | null = null;
  return sorted.map((debtor, index) => {
    if (debtor.total !== previous) {
      rank = index + 1;
      previous = debtor.total;
    }
    return { ...debtor, rank };
  });
}

export function canDeleteFine(status: string) {
  return ["UNPAID", "PAID_PENDING", "AFVIST"].includes(status);
}
