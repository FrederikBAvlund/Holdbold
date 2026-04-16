import { describe, expect, it } from "vitest";
import { canDeleteFine, parseIntegerAmountInput } from "./boderUtils";

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
