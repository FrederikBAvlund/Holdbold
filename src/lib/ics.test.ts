import { describe, expect, it } from "vitest";
import { buildIcsCalendar, escapeIcsText, foldIcsLine, formatIcsDate } from "@/lib/ics";

describe("ics", () => {
  it("formaterer datoer i UTC", () => {
    expect(formatIcsDate(new Date("2026-10-10T16:30:00.000Z"))).toBe("20261010T163000Z");
  });

  it("escaper specialtegn", () => {
    expect(escapeIcsText("A, B; C\\D\nE")).toBe("A\\, B\\; C\\\\D\\nE");
  });

  it("folder lange linjer uden at splitte tegn", () => {
    const folded = foldIcsLine(`SUMMARY:${"æ".repeat(80)}`);
    const segments = folded.split("\r\n");
    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) {
      expect(new TextEncoder().encode(segment).length).toBeLessThanOrEqual(75);
    }
    expect(segments.map((s, i) => (i === 0 ? s : s.slice(1))).join("")).toBe(`SUMMARY:${"æ".repeat(80)}`);
  });

  it("bygger en kalender med afbud markeret", () => {
    const ics = buildIcsCalendar(
      [
        {
          uid: "a@holdbold",
          title: "Træning",
          start: new Date("2026-10-10T16:00:00.000Z"),
          durationMinutes: 90,
          location: "Banen",
          updatedAt: new Date("2026-10-01T00:00:00.000Z")
        },
        {
          uid: "b@holdbold",
          title: "Kamp",
          start: new Date("2026-10-11T10:00:00.000Z"),
          durationMinutes: 120,
          canceled: true,
          updatedAt: new Date("2026-10-01T00:00:00.000Z")
        }
      ],
      { name: "Holdbold" }
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261010T160000Z");
    expect(ics).toContain("DTEND:20261010T173000Z");
    expect(ics).toContain("SUMMARY:AFLYST: Kamp");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("LOCATION:Banen");
  });
});
