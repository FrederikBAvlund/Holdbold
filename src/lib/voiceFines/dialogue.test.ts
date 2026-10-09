import { describe, expect, it } from "vitest";
import { estimatedFineAmount, memberNameHints, validateDraftAddition, validateDraftUpdate } from "./dialogue";

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


describe("direct additions", () => {
  it("adds three players in one batch using the lateness tariff rather than minutes", () => {
    const roster = [{ id: "vitus", name: "Vitus Duus" }, { id: "engdal", name: "Mikkel Engdal" }, { id: "andre", name: "André Lundgren" }];
    const result = validateDraftAddition({ fines: roster.map((member) => ({
      ...fine, userId: member.id, amount: 20, sourceText: "Vitus, Engdal og André kom 20 minutter for sent"
    })) }, [], roster, templates);
    expect(result.ok && result.added).toBe(3);
    expect(result.ok && result.fines.map((row) => [row.userId, row.amount])).toEqual([
      ["vitus", 25], ["engdal", 25], ["andre", 25]
    ]);
  });

  it("preserves live manual changes and incomplete rows without a snapshot round trip", () => {
    const manual = { ...fine, title: "Manuelt rettet", templateId: null, amount: 75 };
    const incomplete = { ...fine, userId: "", title: "", templateId: null, amount: null };
    const current = [manual, incomplete];
    const result = validateDraftAddition({ fines: [{ ...fine, userId: "u2" }] }, current, members, templates);
    expect(result.ok && result.fines.slice(0, 2)).toEqual(current);
    expect(result.ok && result.added).toBe(1);
    expect(current).toHaveLength(2);
  });

  it("estimates a missing free-fine amount and marks it for review", () => {
    const result = validateDraftAddition({ fines: [{ ...fine, templateId: null, title: "Glemte vest", amount: null }] }, [], members, templates);
    expect(result.ok && result.fines[0]).toMatchObject({ amount: 25, confidence: 0.4 });
    const explicit = validateDraftAddition({ fines: [{ ...fine, templateId: null, title: "Glemte vest", amount: 80 }] }, [], members, templates);
    expect(explicit.ok && explicit.fines[0]).toMatchObject({ amount: 80, confidence: 0.9 });
  });

  it("uses the median positive tariff and a 25 kr fallback without tariffs", () => {
    expect(estimatedFineAmount([])).toBe(25);
    expect(estimatedFineAmount([0, -10, 1000, 25, 50].map((amount) => ({ ...templates[0], amount })))).toBe(50);
  });

  it("keeps valid suggestions when an identity requires manual selection", () => {
    const result = validateDraftAddition({ fines: [fine, { ...fine, userId: "", confidence: 0.5, sourceText: "Oskar" }] }, [], members, templates);
    expect(result.ok && result.added).toBe(2);
    expect(result.ok && result.fines[1]).toMatchObject({ userId: "", confidence: 0.4, sourceText: "Oskar" });
  });

  it("deduplicates against current rows but permits explicitly additional fines", () => {
    const current = [{ ...fine, title: "For sent", amount: 25 }];
    expect(validateDraftAddition({ fines: [fine] }, current, members, templates)).toEqual({ ok: true, fines: current, added: 0 });
    const extra = validateDraftAddition({ fines: [fine], allowDuplicates: true }, current, members, templates);
    expect(extra.ok && extra.added).toBe(1);
    const repeated = validateDraftAddition({ fines: [fine, fine] }, [], members, templates);
    expect(repeated.ok && repeated.added).toBe(2);
  });

  it("rejects an invalid batch atomically and enforces the total row limit", () => {
    expect(validateDraftAddition({ fines: [fine, { ...fine, userId: "unknown" }] }, [], members, templates).ok).toBe(false);
    expect(validateDraftAddition({ fines: [fine], allowDuplicates: true }, Array(200).fill(fine), members, templates).ok).toBe(false);
  });
});

describe("spoken name hints", () => {
  it("includes unique given names and surnames and keeps André distinct from Andreas", () => {
    const hints = memberNameHints([
      { id: "v", name: "Vitus Duus" }, { id: "e", name: "Mikkel Engdal" },
      { id: "a", name: "André Lundgren" }, { id: "b", name: "Andreas Beck Eibye" }
    ]);
    expect(hints.split("\n")).toEqual([
      "v | Vitus Duus | entydige navne: vitus, duus",
      "e | Mikkel Engdal | entydige navne: mikkel, engdal",
      "a | André Lundgren | entydige navne: andre, lundgren",
      "b | Andreas Beck Eibye | entydige navne: andreas, beck, eibye"
    ]);
  });

  it("does not advertise a shared name as unique, including accent variants", () => {
    expect(memberNameHints([{ id: "a", name: "André Hansen" }, { id: "b", name: "Andre Jensen" }])).toBe(
      "a | André Hansen | entydige navne: hansen\nb | Andre Jensen | entydige navne: jensen"
    );
  });
});
