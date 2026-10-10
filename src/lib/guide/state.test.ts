import { describe, expect, it } from "vitest";
import { computeGuideState, guideRoleAfterRoleChange, type GuideStateInput } from "@/lib/guide/state";
import { GUIDE_STEPS, type GuideFacts } from "@/lib/guide/steps";

function facts(overrides: { team?: Partial<GuideFacts["team"]>; user?: Partial<GuideFacts["user"]> } = {}): GuideFacts {
  return {
    team: {
      mobilePayBox: false,
      calendarImported: false,
      eventSeries: false,
      fineTemplates: false,
      fineAutomation: false,
      openAiKey: false,
      otherMembers: false,
      assignedRoles: false,
      customTheme: false,
      ...overrides.team
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
      createdMotmPoll: false,
      ...overrides.user
    }
  };
}

function state(input: Partial<GuideStateInput> = {}) {
  return computeGuideState({ role: "SPILLER", guideRole: null, dismissed: false, facts: facts(), progress: {}, ...input });
}

const ids = (s: ReturnType<typeof state>) => s.steps.map((step) => step.id);
const step = (s: ReturnType<typeof state>, id: string) => s.steps.find((x) => x.id === id);

describe("guide steps", () => {
  it("har unikke id'er med rettigheden som præfiks", () => {
    const all = GUIDE_STEPS.map((s) => s.id);
    expect(new Set(all).size).toBe(all.length);
    for (const s of GUIDE_STEPS) expect(s.id.startsWith(`${s.capability}.`), s.id).toBe(true);
  });
});

describe("computeGuideState", () => {
  it("viser kun basis-trin til en spiller", () => {
    const s = state();
    expect(s.steps.every((x) => x.capability === "basis")).toBe(true);
    expect(ids(s)).toContain("basis.rsvp");
    expect(s.intro).toBe(true);
  });

  it("viser træneren begivenheder, men ikke bødekassen", () => {
    const s = state({ role: "TRAENER" });
    expect(ids(s)).toContain("events.create");
    expect(ids(s).some((id) => id.startsWith("fines."))).toBe(false);
  });

  it("markerer opsætning, som holdet allerede har, som klaret af holdet", () => {
    const s = state({ role: "BOEDEKASSEFORMAND", facts: facts({ team: { mobilePayBox: true } }) });
    expect(step(s, "fines.mobilepay")).toMatchObject({ status: "done", doneBy: "team" });
  });

  it("markerer færdigheder, brugeren allerede har brugt, som klaret", () => {
    const s = state({ role: "BOEDEKASSEFORMAND", facts: facts({ user: { createdFine: true } }) });
    expect(step(s, "fines.assign")).toMatchObject({ status: "done", doneBy: "you" });
  });

  it("siger, at bødeformanden må bede admin om MobilePay Box", () => {
    expect(step(state({ role: "BOEDEKASSEFORMAND" }), "fines.mobilepay")?.waitingFor).toBe("admin");
    expect(step(state({ role: "ADMIN" }), "fines.mobilepay")?.waitingFor).toBeNull();
  });

  it("regner set info-trin som klaret, men ikke set opgaver", () => {
    const s = state({ progress: { "basis.pay-fine": "SEEN", "basis.rsvp": "SEEN" } });
    expect(step(s, "basis.pay-fine")?.status).toBe("done");
    expect(step(s, "basis.rsvp")?.status).toBe("todo");
  });

  it("husker overspringede trin", () => {
    const s = state({ progress: { "basis.avatar": "SKIPPED" } });
    expect(step(s, "basis.avatar")?.status).toBe("skipped");
    expect(s.summary.skipped).toBe(1);
  });

  it("skjuler indtalte bøder, når holdet ikke har en OpenAI-nøgle", () => {
    expect(ids(state({ role: "ADMIN" }))).not.toContain("fines.voice");
    expect(ids(state({ role: "ADMIN", facts: facts({ team: { openAiKey: true } }) }))).toContain("fines.voice");
  });

  it("viser kun nye, ikke-klarede trin ved forfremmelse", () => {
    const s = state({
      role: "BOEDEKASSEFORMAND",
      guideRole: "TRAENER",
      facts: facts({ team: { mobilePayBox: true, fineTemplates: true } })
    });
    expect(s.intro).toBe(false);
    expect(s.promotion).toMatchObject({ from: "TRAENER", to: "BOEDEKASSEFORMAND" });
    expect(s.promotion?.stepIds).toContain("fines.assign");
    expect(s.promotion?.stepIds).not.toContain("fines.mobilepay");
    expect(s.promotion?.stepIds).not.toContain("fines.templates");
    expect(s.promotion?.stepIds.some((id) => id.startsWith("events.") || id.startsWith("basis."))).toBe(false);
  });

  it("viser forfremmelse, selvom guiden er sprunget over", () => {
    const s = state({ role: "TRAENER", guideRole: "SPILLER", dismissed: true });
    expect(s.promotion?.capabilities).toEqual(["events"]);
  });

  it("viser ingen velkomst, når guiden er sprunget over", () => {
    expect(state({ dismissed: true }).intro).toBe(false);
  });
});

describe("guideRoleAfterRoleChange", () => {
  it("beholder den gamle rolle ved forfremmelse, så de nye dele kan vises", () => {
    expect(guideRoleAfterRoleChange("SPILLER", "BOEDEKASSEFORMAND")).toBe("SPILLER");
  });

  it("følger med ved degradering", () => {
    expect(guideRoleAfterRoleChange("ADMIN", "SPILLER")).toBe("SPILLER");
  });

  it("holder fast i en uset forfremmelse, hvis man går lidt ned igen", () => {
    expect(guideRoleAfterRoleChange("SPILLER", "TRAENER")).toBe("SPILLER");
  });

  it("lader nye medlemmer uden velkomst blive ved med at få den", () => {
    expect(guideRoleAfterRoleChange(null, "TRAENER")).toBeNull();
  });
});
