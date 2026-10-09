import { describe, expect, it } from "vitest";
import { isAbsenceActive } from "@/lib/absences";

const now = new Date("2026-10-09T12:00:00Z");
const future = new Date("2026-11-01T00:00:00Z");
const past = new Date("2026-09-01T00:00:00Z");

describe("isAbsenceActive", () => {
  it("er aktivt når det er godkendt, ikke stoppet og ikke udløbet", () => {
    expect(isAbsenceActive({ status: "APPROVED", endedAt: null, endDate: future }, now)).toBe(true);
  });
  it("er ikke aktivt når det afventer, er stoppet eller udløbet", () => {
    expect(isAbsenceActive({ status: "PENDING", endedAt: null, endDate: future }, now)).toBe(false);
    expect(isAbsenceActive({ status: "APPROVED", endedAt: now, endDate: future }, now)).toBe(false);
    expect(isAbsenceActive({ status: "APPROVED", endedAt: null, endDate: past }, now)).toBe(false);
  });
});
