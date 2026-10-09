import { describe, expect, it } from "vitest";
import {
  canDeleteFine,
  fineStatusMeta,
  groupByReason,
  inboxDecisionUrl,
  parseIntegerAmountInput,
  rankDebtors,
  runPool,
  summarizeFines
} from "./boderUtils";

describe("parseIntegerAmountInput", () => {
  it("parses integers", () => {
    expect(parseIntegerAmountInput("42")).toEqual({ ok: true, value: 42 });
    expect(parseIntegerAmountInput("-10")).toEqual({ ok: true, value: -10 });
  });

  it("rejects invalid input", () => {
    expect(parseIntegerAmountInput("")).toEqual({ ok: false });
    expect(parseIntegerAmountInput("12.5")).toEqual({ ok: false });
    expect(parseIntegerAmountInput("abc")).toEqual({ ok: false });
  });
});

describe("canDeleteFine", () => {
  it("allows deletable statuses", () => {
    expect(canDeleteFine("UNPAID")).toBe(true);
    expect(canDeleteFine("AFVIST")).toBe(true);
  });

  it("rejects suggested and paid-approved", () => {
    expect(canDeleteFine("FORESLAET")).toBe(false);
    expect(canDeleteFine("PAID_APPROVED")).toBe(false);
  });
});

describe("summarizeFines", () => {
  it("adskiller ubetalt, afventer og betalt", () => {
    const result = summarizeFines([
      { amount: 25, status: "UNPAID" },
      { amount: 50, status: "UNPAID" },
      { amount: 20, status: "PAID_PENDING" },
      { amount: 100, status: "PAID_APPROVED" },
      { amount: 30, status: "FORESLAET" }
    ]);
    expect(result).toEqual({ unpaid: 75, pending: 20, paid: 100, owed: 95 });
  });
});

describe("rankDebtors", () => {
  it("fjerner 0 kr og deler placering ved samme beløb", () => {
    const ranked = rankDebtors([
      { userId: "a", name: "A", total: 50 },
      { userId: "b", name: "B", total: 0 },
      { userId: "c", name: "C", total: 100 },
      { userId: "d", name: "D", total: 50 }
    ]);
    expect(ranked.map((r) => [r.userId, r.rank])).toEqual([
      ["c", 1],
      ["a", 2],
      ["d", 2]
    ]);
  });
});

describe("fineStatusMeta", () => {
  it("giver danske labels", () => {
    expect(fineStatusMeta("UNPAID")).toEqual({ label: "Ubetalt", tone: "out" });
    expect(fineStatusMeta("PAID_APPROVED").label).toBe("Betalt");
  });
});

describe("indbakke-hjælpere", () => {
  it("bygger URL'er til godkend/afvis", () => {
    expect(inboxDecisionUrl("fine", "f1", true)).toBe("/api/fines/f1/approve");
    expect(inboxDecisionUrl("payment", "u1", false)).toBe("/api/fines/payments/u1/reject");
    expect(inboxDecisionUrl("template", "t1", true)).toBe("/api/fine-templates/t1/approve");
  });

  it("grupperer bødeforslag med samme tekst, største gruppe først", () => {
    const fines = [
      { id: "1", reason: "Sen" },
      { id: "2", reason: "Ikke svaret " },
      { id: "3", reason: "ikke svaret" },
      { id: "4", reason: "Ikke svaret" },
      { id: "5", reason: "Sen" }
    ];
    const groups = groupByReason(fines);
    expect(groups.map((g) => g.items.length)).toEqual([3, 2]);
    expect(groups[0].reason).toBe("Ikke svaret");
    expect(groupByReason(fines, 4)).toEqual([]);
  });

  it("runPool melder succes og fejl og begrænser parallelitet", async () => {
    let active = 0;
    let peak = 0;
    const progress: number[] = [];
    const result = await runPool(
      [1, 2, 3, 4, 5, 6],
      async (n) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
        if (n === 3) throw new Error("boom");
        return n !== 5;
      },
      { concurrency: 2, onProgress: (done) => progress.push(done) }
    );
    expect(result.ok).toBe(4);
    expect(result.failed.sort()).toEqual([3, 5]);
    expect(peak).toBeLessThanOrEqual(2);
    expect(progress[progress.length - 1]).toBe(6);
  });
});
