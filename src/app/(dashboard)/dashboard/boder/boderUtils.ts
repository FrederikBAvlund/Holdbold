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

/* ---------- Indbakke (godkend/afvis flere ad gangen) ---------- */

export type InboxKind = "payment" | "fine" | "template";

export function inboxDecisionUrl(kind: InboxKind, id: string, approve: boolean) {
  const action = approve ? "approve" : "reject";
  if (kind === "payment") return `/api/fines/payments/${id}/${action}`;
  if (kind === "fine") return `/api/fines/${id}/${action}`;
  return `/api/fine-templates/${id}/${action}`;
}

/** Bødeforslag med samme tekst, hyppigste først – til hurtigvalg ("vælg alle med denne tekst"). */
export function groupByReason<T extends { id: string; reason: string }>(fines: T[], minCount = 2) {
  const map = new Map<string, T[]>();
  for (const fine of fines) {
    const key = fine.reason.trim().toLowerCase();
    map.set(key, [...(map.get(key) ?? []), fine]);
  }
  return Array.from(map.values())
    .filter((items) => items.length >= minCount)
    .map((items) => ({ reason: items[0].reason.trim(), items }))
    .sort((a, b) => b.items.length - a.items.length || a.reason.localeCompare(b.reason, "da"));
}

/** Kører async-opgaver med begrænset parallelitet og rapporterer fremdrift. */
export async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<boolean>,
  options: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {}
) {
  const { concurrency = 4, onProgress } = options;
  const failed: T[] = [];
  let ok = 0;
  let done = 0;
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const item = items[next++];
      let success = false;
      try {
        success = await worker(item);
      } catch {
        success = false;
      }
      if (success) ok += 1;
      else failed.push(item);
      done += 1;
      onProgress?.(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return { ok, failed };
}
