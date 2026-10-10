import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_STEPS } from "@/lib/guide/steps";

const SRC = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".tsx") ? [full] : [];
  });
}

/** Alle ankre, siderne sætter: data-guide="…", <Section anchor="…"> og { guide: "…" } */
function anchorsInSource() {
  const anchors = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:data-guide|anchor)="([^"]+)"|guide: "([^"]+)"/g)) {
      for (const anchor of (match[1] ?? match[2]).split(" ")) anchors.add(anchor);
    }
  }
  return anchors;
}

describe("guide steps", () => {
  const anchors = anchorsInSource();

  it.each(GUIDE_STEPS.map((step) => [step.id, step] as const))("%s peger på et anker, der findes i appen", (_id, step) => {
    if (step.anchor) expect(anchors, `data-guide="${step.anchor}"`).toContain(step.anchor);
    if (step.entry) expect(anchors, `data-guide="${step.entry.anchor}"`).toContain(step.entry.anchor);
  });
});
