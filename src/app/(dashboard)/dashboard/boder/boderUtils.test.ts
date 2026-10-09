import { describe, expect, it } from "vitest";
import { canDeleteFine, fineStatusMeta, parseIntegerAmountInput, rankDebtors, summarizeFines } from "./boderUtils";

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
