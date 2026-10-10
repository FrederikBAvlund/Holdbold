import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseAmount, parseCategory, parseTemplateRows, parseTemplateWorkbook } from "./fineTemplateImport";

describe("parseAmount", () => {
  it("handles numbers and Danish formats", () => {
    expect(parseAmount(20)).toBe(20);
    expect(parseAmount("25 kr.")).toBe(25);
    expect(parseAmount("12,5")).toBe(13);
    expect(parseAmount("1.000")).toBe(1000);
    expect(parseAmount("-10")).toBe(-10);
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
  });
});

describe("parseCategory", () => {
  it("maps known values and falls back to DIVERSE", () => {
    expect(parseCategory("Fælles")).toBe("FAELLES");
    expect(parseCategory("SoMe")).toBe("SOME");
    expect(parseCategory(" spiller ")).toBe("SPILLER");
    expect(parseCategory("ukendt")).toBe("DIVERSE");
    expect(parseCategory(undefined)).toBe("DIVERSE");
  });
});

describe("parseTemplateRows", () => {
  it("parses rows, skips blanks and dedupes", () => {
    const result = parseTemplateRows([
      ["Navn", "Beløb", "Kategori", "Beskrivelse"],
      ["For sent", 20, "Spiller", "Efter kl. 18"],
      ["", "", "", ""],
      ["For sent", "20 kr", "Spiller", ""],
      ["Glemt vest", "50", "", ""]
    ]);
    expect(result.errors).toEqual([]);
    expect(result.duplicates).toBe(1);
    expect(result.templates).toEqual([
      { title: "For sent", amount: 20, category: "SPILLER", description: "Efter kl. 18" },
      { title: "Glemt vest", amount: 50, category: "DIVERSE" }
    ]);
  });

  it("reports bad rows with row numbers", () => {
    const result = parseTemplateRows([
      ["Navn", "Beløb"],
      ["Uden beløb", "x"],
      ["", 10],
      ["Nul", 0]
    ]);
    expect(result.templates).toEqual([]);
    expect(result.errors.map((e) => e.row)).toEqual([2, 3, 4]);
  });

  it("requires title and amount columns", () => {
    expect(parseTemplateRows([["Foo", "Bar"]]).errors).toHaveLength(1);
    expect(parseTemplateRows([]).errors).toHaveLength(1);
  });

  it("accepts header aliases and leading blank rows", () => {
    const result = parseTemplateRows([[], ["Bøde", "Pris"], ["X", 5]]);
    expect(result.templates).toEqual([{ title: "X", amount: 5, category: "DIVERSE" }]);
  });
});

describe("parseTemplateWorkbook", () => {
  it("reads the first sheet of a real xlsx file", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Navn", "Beløb", "Kategori", "Beskrivelse"],
      ["Glemt drikkedunk", 10, "Spiller", ""],
      ["Tweet om kamp", "30", "SoMe", "Fra holdets konto"]
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Bøder");
    const buffer = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const result = parseTemplateWorkbook(buffer);
    expect(result.errors).toEqual([]);
    expect(result.templates.map((t) => [t.title, t.amount, t.category])).toEqual([
      ["Glemt drikkedunk", 10, "SPILLER"],
      ["Tweet om kamp", 30, "SOME"]
    ]);
  });
});
