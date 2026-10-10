import * as XLSX from "xlsx";

export type ImportCategory = "SOME" | "FAELLES" | "SPILLER" | "DIVERSE";

export type ImportedTemplate = {
  title: string;
  amount: number;
  category: ImportCategory;
  description?: string;
};

export type ImportRowError = { row: number; message: string };

export type ParsedTemplateImport = {
  templates: ImportedTemplate[];
  errors: ImportRowError[];
  duplicates: number;
};

export const MAX_IMPORT_ROWS = 500;

const COLUMN_ALIASES: Record<"title" | "amount" | "category" | "description", string[]> = {
  title: ["navn", "titel", "bøde", "boede", "bødenavn", "aarsag", "årsag", "name", "title"],
  amount: ["beløb", "beloeb", "belob", "pris", "kr", "takst", "amount", "sum"],
  category: ["kategori", "type", "category"],
  description: ["beskrivelse", "note", "noter", "kommentar", "description"]
};

const CATEGORY_ALIASES: Record<string, ImportCategory> = {
  some: "SOME",
  "sociale medier": "SOME",
  faelles: "FAELLES",
  fælles: "FAELLES",
  fællesbøder: "FAELLES",
  spiller: "SPILLER",
  spillere: "SPILLER",
  diverse: "DIVERSE"
};

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function findColumn(headers: string[], key: keyof typeof COLUMN_ALIASES) {
  return headers.findIndex((header) => COLUMN_ALIASES[key].includes(header));
}

export function parseAmount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : null;
  const cleaned = String(value ?? "")
    .toLowerCase()
    .replace(/kr\.?|,-|\s/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export function parseCategory(value: unknown): ImportCategory {
  const key = String(value ?? "").trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? "DIVERSE";
}

/** Tolker rækker som arrays (første række = overskrifter). */
export function parseTemplateRows(rows: unknown[][]): ParsedTemplateImport {
  const result: ParsedTemplateImport = { templates: [], errors: [], duplicates: 0 };
  const headerIndex = rows.findIndex((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
  if (headerIndex === -1) {
    result.errors.push({ row: 1, message: "Filen er tom" });
    return result;
  }

  const headers = rows[headerIndex].map(normalizeHeader);
  const titleCol = findColumn(headers, "title");
  const amountCol = findColumn(headers, "amount");
  const categoryCol = findColumn(headers, "category");
  const descriptionCol = findColumn(headers, "description");
  if (titleCol === -1 || amountCol === -1) {
    result.errors.push({ row: headerIndex + 1, message: "Filen skal have kolonnerne Navn og Beløb" });
    return result;
  }

  const seen = new Set<string>();
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = i + 1;
    const title = String(row[titleCol] ?? "").trim();
    const rawAmount = row[amountCol];
    if (!title && String(rawAmount ?? "").trim() === "") continue;
    if (!title) {
      result.errors.push({ row: rowNumber, message: "Navn mangler" });
      continue;
    }
    const amount = parseAmount(rawAmount);
    if (amount === null || amount === 0) {
      result.errors.push({ row: rowNumber, message: `Ugyldigt beløb for "${title}"` });
      continue;
    }
    const key = `${title.toLowerCase()}|${amount}`;
    if (seen.has(key)) {
      result.duplicates += 1;
      continue;
    }
    seen.add(key);
    const description = descriptionCol >= 0 ? String(row[descriptionCol] ?? "").trim() : "";
    result.templates.push({
      title: title.slice(0, 120),
      amount,
      category: categoryCol >= 0 ? parseCategory(row[categoryCol]) : "DIVERSE",
      ...(description ? { description: description.slice(0, 500) } : {})
    });
  }

  if (result.templates.length > MAX_IMPORT_ROWS) {
    result.errors.push({ row: 1, message: `Maks ${MAX_IMPORT_ROWS} bøder pr. import` });
    result.templates = [];
  }
  return result;
}

/** Læser første ark i en Excel-fil (.xlsx/.xls/.csv). */
export function parseTemplateWorkbook(buffer: ArrayBuffer): ParsedTemplateImport {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { templates: [], errors: [{ row: 1, message: "Filen er tom" }], duplicates: 0 };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, raw: true });
  return parseTemplateRows(rows);
}
