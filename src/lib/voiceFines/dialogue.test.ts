import { describe, expect, it } from "vitest";
import { validateDraftUpdate } from "./dialogue";

const members = [{ id: "u1", name: "Mikkel" }, { id: "u2", name: "Oskar" }];
const templates = [{ id: "t1", title: "For sent", amount: 25 }];
const fine = { userId: "u1", templateId: "t1", title: "Forkert", amount: 999, confidence: 0.9, sourceText: "Mikkel for sent" };

describe("dialogue draft updates", () => {
  it("bruger skabelonens autoritative beløb og tillader rettelse af spiller", () => {
    const result = validateDraftUpdate({ snapshotId: "snapshot-current", fines: [{ ...fine, userId: "u2" }] }, "snapshot-current", members, templates);
    expect(result).toEqual({ ok: true, fines: [{ ...fine, userId: "u2", title: "For sent", amount: 25 }] });
  });
  it("afviser gamle svar efter en manuel ændring", () => {
    expect(validateDraftUpdate({ snapshotId: "snapshot-old", fines: [] }, "snapshot-current", members, templates).ok).toBe(false);
  });
  it.each([
    { ...fine, userId: "unknown" },
    { ...fine, templateId: "unknown" },
    { ...fine, amount: 0 },
    { ...fine, amount: 2.5 },
    { ...fine, confidence: 2 }
  ])("afviser ugyldige forslag uden delvist at ændre listen", (invalid) => {
    expect(validateDraftUpdate({ snapshotId: "snapshot-current", fines: [fine, invalid] }, "snapshot-current", members, templates).ok).toBe(false);
  });
  it("beholder en fri bøde uden beløb til afklaring", () => {
    const result = validateDraftUpdate({ snapshotId: "snapshot-current", fines: [{ ...fine, templateId: null, title: "Glemte vest", amount: null }] }, "snapshot-current", members, templates);
    expect(result.ok && result.fines[0]).toMatchObject({ amount: null, confidence: 0.4 });
  });
  it("beholder ufærdige manuelle rækker", () => {
    const draft = { ...fine, userId: "", templateId: null, title: "", amount: null };
    const result = validateDraftUpdate({ snapshotId: "snapshot-current", fines: [draft, fine] }, "snapshot-current", members, templates);
    expect(result.ok && result.fines).toHaveLength(2);
  });
  it("tillader fjernelse af alle forslag", () => {
    expect(validateDraftUpdate({ snapshotId: "snapshot-current", fines: [] }, "snapshot-current", members, templates)).toEqual({ ok: true, fines: [] });
  });
  it("afviser mere end 200 forslag", () => {
    expect(validateDraftUpdate({ snapshotId: "snapshot-current", fines: Array(201).fill(fine) }, "snapshot-current", members, templates).ok).toBe(false);
  });
});
