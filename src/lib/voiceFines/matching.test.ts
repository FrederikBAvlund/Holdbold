import { describe, expect, it } from "vitest";
import { sanitizeSuggestions } from "./matching";

const members = [{ id: "u1", name: "Mikkel" }];
const templates = [{ id: "t1", title: "For sent", amount: 20 }];

describe("sanitizeSuggestions", () => {
  it("bruger skabelonens titel og beløb", () => {
    const r = sanitizeSuggestions([{ userId: "u1", templateId: "t1", title: "x", amount: 999, confidence: 0.9 }], members, templates);
    expect(r).toEqual([{ userId: "u1", templateId: "t1", title: "For sent", amount: 20, confidence: 0.9, sourceText: "" }]);
  });
  it("dropper ukendte spillere", () => {
    expect(sanitizeSuggestions([{ userId: "zz", templateId: "t1" }], members, templates)).toEqual([]);
  });
  it("fri bøde uden beløb får lav sikkerhed", () => {
    const r = sanitizeSuggestions([{ userId: "u1", templateId: null, title: "Glemte vest", amount: null, confidence: 0.9 }], members, templates);
    expect(r[0].amount).toBeNull();
    expect(r[0].confidence).toBeLessThanOrEqual(0.4);
  });
  it("ukendt skabelon bliver fri bøde", () => {
    const r = sanitizeSuggestions([{ userId: "u1", templateId: "nope", title: "Ny", amount: 30 }], members, templates);
    expect(r[0].templateId).toBeNull();
    expect(r[0].amount).toBe(30);
  });
});
