export function formatFineKr(amount: number) {
  return `${amount} kr`;
}

export function fineAmountClass(amount: number) {
  return amount < 0 ? "text-moss" : "text-ink";
}

export function fineEventHref(event: { id: string; title: string; date: string }) {
  const params = new URLSearchParams();
  params.set("focusEvent", event.id);
  params.set("focusTitle", event.title);
  const dateIso =
    typeof event.date === "string" && event.date.includes("T")
      ? event.date
      : new Date(event.date).toISOString();
  params.set("focusDate", dateIso);
  params.set("focusLocation", "");
  return `/dashboard/kalender?${params.toString()}`;
}

export function parseIntegerAmountInput(raw: string): { ok: true; value: number } | { ok: false } {
  const t = raw.trim().replace(/\s/g, "");
  if (!t || t === "-" || t === "+") return { ok: false };
  if (!/^-?\d+$/.test(t)) return { ok: false };
  const value = parseInt(t, 10);
  if (!Number.isFinite(value)) return { ok: false };
  return { ok: true, value };
}

export function fineStatusMeta(status: string) {
  if (status === "UNPAID") {
    return {
      label: "Ubetalt",
      className: "bg-red-100 text-red-700"
    };
  }
  if (status === "PAID_PENDING") {
    return {
      label: "Afventer godkendelse",
      className: "bg-amber-100 text-amber-800"
    };
  }
  if (status === "PAID_APPROVED") {
    return {
      label: "Betalt",
      className: "bg-green-100 text-green-700"
    };
  }
  return {
    label: status,
    className: "bg-ink/10 text-ink/70"
  };
}

export function canDeleteFine(status: string) {
  return ["UNPAID", "PAID_PENDING", "FORESLAET", "AFVIST"].includes(status);
}
