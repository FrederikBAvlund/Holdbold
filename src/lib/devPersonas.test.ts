import { describe, expect, it } from "vitest";
import { assertLocalDatabase, DEV_PERSONAS, type DevPersona } from "../../prisma/dev-personas.mjs";
import { computeGuideState } from "@/lib/guide/state";
import type { GuideFacts } from "@/lib/guide/steps";
import { roles } from "@/lib/roles";

const noFacts: GuideFacts = {
  team: {
    mobilePayBox: false,
    calendarImported: false,
    eventSeries: false,
    fineTemplates: false,
    fineAutomation: false,
    openAiKey: false,
    otherMembers: false,
    assignedRoles: false,
    customTheme: false
  },
  user: {
    pushEnabled: false,
    signedUp: false,
    avatar: false,
    reportedAbsence: false,
    createdEvent: false,
    createdFine: false,
    approvedFine: false,
    markedFinePaid: false,
    createdCollection: false,
    decidedAbsence: false,
    createdMotmPoll: false
  }
};

/** Guidens tilstand for en testbruger, præcis som seed'en efterlader den */
function guideFor(persona: DevPersona) {
  const guideRoles = persona.guide === "new" ? [] : persona.guide === "existing" ? persona.roles : persona.guideRoles ?? [];
  return computeGuideState({
    roles: persona.roles,
    guideRoles,
    dismissed: false,
    started: persona.guide === "promoted",
    facts: noFacts,
    progress: {}
  });
}

const persona = (email: string) => {
  const found = DEV_PERSONAS.find((p) => p.email === email);
  if (!found) throw new Error(`Testbrugeren ${email} findes ikke`);
  return found;
};

describe("testbrugere", () => {
  it("har unikke e-mails på .local-domænet og kun kendte roller", () => {
    const emails = DEV_PERSONAS.map((p) => p.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const p of DEV_PERSONAS) {
      expect(p.email.endsWith("@holdbold.local"), p.email).toBe(true);
      expect(p.roles.length, p.email).toBeGreaterThan(0);
      for (const role of p.roles) expect(roles, p.email).toContain(role);
    }
  });

  it("dækker hver rolle", () => {
    const covered = new Set(DEV_PERSONAS.flatMap((p) => p.roles));
    expect([...covered].sort()).toEqual([...roles].sort());
  });

  it("starter nye brugere i velkomsten, uanset rolle", () => {
    for (const email of ["admin", "traener", "boedekasse", "spiller", "some", "flere"]) {
      expect(guideFor(persona(`${email}@holdbold.local`)).mode, email).toBe("intro");
    }
  });

  it("viser veteranen 'Nyt'-kortet", () => {
    expect(guideFor(persona("veteran@holdbold.local")).mode).toBe("announce");
  });

  it("giver den forfremmede 'Du er blevet …' med kun de nye dele", () => {
    const state = guideFor(persona("forfremmet@holdbold.local"));
    expect(state.mode).toBe("checklist");
    expect(state.promotion?.gainedRoles).toEqual(["BOEDEKASSEFORMAND"]);
    expect(state.promotion?.capabilities).toEqual(["fines", "absences", "motm"]);
  });

  it("lader træner og bødekasse være hver sin rolle", () => {
    const capabilities = (email: string) => guideFor(persona(email)).capabilities;
    expect(capabilities("traener@holdbold.local")).toContain("events");
    expect(capabilities("traener@holdbold.local")).not.toContain("fines");
    expect(capabilities("boedekasse@holdbold.local")).toContain("fines");
    expect(capabilities("boedekasse@holdbold.local")).not.toContain("events");
    expect(capabilities("flere@holdbold.local")).toEqual(expect.arrayContaining(["events", "fines"]));
  });

  it("har én bruger, der venter på godkendelse", () => {
    expect(DEV_PERSONAS.filter((p) => p.status === "PENDING").map((p) => p.email)).toEqual(["afventer@holdbold.local"]);
  });
});

describe("assertLocalDatabase", () => {
  it.each([
    "postgresql://user:password@localhost:5432/holdbold",
    "postgresql://user:password@127.0.0.1:5432/holdbold",
    "postgresql://user:password@[::1]:5432/holdbold"
  ])("tillader %s", (url) => {
    expect(() => assertLocalDatabase(url)).not.toThrow();
  });

  it.each([
    "postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres",
    "postgresql://postgres.abc:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    "postgresql://user:pw@10.0.0.5:5432/holdbold",
    "postgresql://user:pw@db:5432/holdbold",
    "postgresql://user:pw@localhost.evil.example:5432/holdbold"
  ])("afviser %s", (url) => {
    expect(() => assertLocalDatabase(url)).toThrow(/lokal database/);
  });

  it("afviser en manglende eller ugyldig DATABASE_URL", () => {
    expect(() => assertLocalDatabase("")).toThrow(/DATABASE_URL/);
    expect(() => assertLocalDatabase("ikke en url")).toThrow(/DATABASE_URL/);
  });
});
