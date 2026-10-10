import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_USER_SELECT } from "@/lib/publicUser";

const API = path.resolve(__dirname, "../app/api");

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

// Relationer til User, som aldrig må hentes med alle felter i et API-svar
const USER_RELATION = /\b(user|actor|createdBy|approvedBy|rejectedBy|markedPaidBy|decidedBy|canceledBy)\s*:\s*true\b/;

describe("PUBLIC_USER_SELECT", () => {
  it("indeholder kun offentlige felter", () => {
    expect(Object.keys(PUBLIC_USER_SELECT).sort()).toEqual(["email", "id", "image", "name"]);
  });

  it.each(routeFiles(API).map((file) => [path.relative(API, file), file]))(
    "%s henter ikke hele brugere",
    (_name, file) => {
      expect(readFileSync(file, "utf8")).not.toMatch(USER_RELATION);
    }
  );
});
