import { describe, expect, it } from "vitest";
import { closestName, resolveTextFines } from "./textMatching";

const members = [{ id: "v", name: "Vitus Duus" }, { id: "e", name: "Oskar Engdal" }, { id: "a", name: "André Lundgren" }, { id: "b", name: "Andreas Beck Eibye" }];
const templates = [{ id: "late", title: "For sent", amount: 50 }];
const fine = { playerName: "Vitus", templateTitle: "For sent", title: "20 minutter for sent", amount: 20, confidence: 0.9 };

describe("name based fine proposals", () => {
  it("resolves first names, surnames and accents to actual IDs, using the tariff", () => {
    const result = resolveTextFines(["Vitus", "Engdal", "Andre"].map((playerName) => ({ ...fine, playerName })), members, templates);
    expect(result.map((row) => [row.userId, row.templateId, row.amount])).toEqual([["v", "late", 50], ["e", "late", 50], ["a", "late", 50]]);
  });
  it("guesses the closest spelling and marks it for review instead of dropping the batch", () => {
    const result = resolveTextFines([{ ...fine, playerName: "Bittus" }, { ...fine, playerName: "Engdahl" }], members, templates);
    expect(result.map((row) => row.userId)).toEqual(["v", "e"]);
    expect(result.every((row) => row.confidence <= 0.55)).toBe(true);
  });
  it("prefers André over Andreas for Andre and Andreas over André for Andreas", () => {
    expect(closestName("Andre", members.map((m) => m.name))?.index).toBe(2);
    expect(closestName("Andreas", members.map((m) => m.name))?.index).toBe(3);
  });
  it("chooses a reviewable guess when two people share a name", () => {
    const result = resolveTextFines([{ ...fine, playerName: "Oskar" }], [{ id: "1", name: "Oskar Engdal" }, { id: "2", name: "Oskar Jensen" }], templates);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("1");
    expect(result[0].confidence).toBeLessThanOrEqual(0.55);
  });
  it("preserves an unresolvable row and the other rows rather than failing atomically", () => {
    const result = resolveTextFines([fine, { ...fine, playerName: "" }], members, templates);
    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe("v");
    expect(result[1]).toMatchObject({ userId: "", confidence: 0.2 });
  });
  it("keeps a free fine and estimates missing amounts without templates", () => {
    const result = resolveTextFines([{ playerName: "Vitus", title: "Glemte vest", amount: null, confidence: 1 }], members, []);
    expect(result[0]).toMatchObject({ templateId: null, title: "Glemte vest", amount: 25, confidence: 0.55 });
  });
  it("does not turn an unrelated tariff into a match, and preserves explicit amounts", () => {
    const result = resolveTextFines([{ playerName: "Vitus", templateTitle: "xyzzy", title: "Glemte vest", amount: 75 }], members, templates);
    expect(result[0]).toMatchObject({ templateId: null, title: "Glemte vest", amount: 75 });
  });
});
