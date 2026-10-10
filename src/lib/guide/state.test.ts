import { describe, expect, it } from "vitest";
import { computeGuideState, guideRolesAfterRoleChange, nextGuideSteps, type GuideStateInput } from "@/lib/guide/state";
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
  return computeGuideState({
    roles: ["SPILLER"],
    guideRoles: [],
    dismissed: false,
    started: false,
    facts: facts(),
    progress: {},
    ...input
  });
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
    expect(s.mode).toBe("intro");
  });

  it("viser ikke bødekasseformanden begivenheder", () => {
    const s = state({ roles: ["BOEDEKASSEFORMAND"] });
    expect(ids(s)).toContain("fines.assign");
    expect(ids(s).some((id) => id.startsWith("events."))).toBe(false);
  });

  it("viser begge dele til et medlem med flere roller", () => {
    const s = state({ roles: ["TRAENER", "BOEDEKASSEFORMAND"] });
    expect(ids(s)).toContain("events.create");
    expect(ids(s)).toContain("fines.assign");
  });

  it("viser træneren begivenheder, men ikke bødekassen", () => {
    const s = state({ roles: ["TRAENER"] });
    expect(ids(s)).toContain("events.create");
    expect(ids(s).some((id) => id.startsWith("fines."))).toBe(false);
  });

  it("markerer opsætning, som holdet allerede har, som klaret af holdet", () => {
    const s = state({ roles: ["BOEDEKASSEFORMAND"], facts: facts({ team: { mobilePayBox: true } }) });
    expect(step(s, "fines.mobilepay")).toMatchObject({ status: "done", doneBy: "team" });
  });

  it("markerer færdigheder, brugeren allerede har brugt, som klaret", () => {
    const s = state({ roles: ["BOEDEKASSEFORMAND"], facts: facts({ user: { createdFine: true } }) });
    expect(step(s, "fines.assign")).toMatchObject({ status: "done", doneBy: "you" });
  });

  it("lader bødeformanden selv tilknytte MobilePay Box, når holdet mangler den", () => {
    expect(step(state({ roles: ["BOEDEKASSEFORMAND"] }), "fines.mobilepay")?.status).toBe("todo");
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
    expect(ids(state({ roles: ["ADMIN"] }))).not.toContain("fines.voice");
    expect(ids(state({ roles: ["ADMIN"], facts: facts({ team: { openAiKey: true } }) }))).toContain("fines.voice");
  });

  it("viser kun nye, ikke-klarede trin ved forfremmelse", () => {
    // En træner, der også bliver bødekasseformand
    const s = state({
      roles: ["TRAENER", "BOEDEKASSEFORMAND", "SPILLER"],
      guideRoles: ["TRAENER", "SPILLER"],
      facts: facts({ team: { mobilePayBox: true, fineTemplates: true } })
    });
    expect(s.mode).toBe("announce");
    expect(s.promotion).toMatchObject({ gainedRoles: ["BOEDEKASSEFORMAND"], capabilities: ["fines", "absences", "motm"] });
    expect(s.promotion?.stepIds).toContain("fines.assign");
    expect(s.promotion?.stepIds).not.toContain("fines.mobilepay");
    expect(s.promotion?.stepIds).not.toContain("fines.templates");
    expect(s.promotion?.stepIds.some((id) => id.startsWith("events.") || id.startsWith("basis."))).toBe(false);
  });

  it("viser forfremmelse, selvom guiden er sprunget over", () => {
    const s = state({ roles: ["TRAENER"], guideRoles: ["SPILLER"], dismissed: true });
    expect(s.promotion?.capabilities).toEqual(["events"]);
  });

  it("viser ingen velkomst, når guiden er sprunget over", () => {
    expect(state({ dismissed: true }).mode).toBe("hidden");
    expect(state({ dismissed: true, started: true }).mode).toBe("hidden");
  });

  it("viser 'Nyt'-kortet til medlemmer fra før guiden og tjeklisten, når guiden er startet", () => {
    expect(state({ guideRoles: ["SPILLER"] }).mode).toBe("announce");
    expect(state({ guideRoles: ["SPILLER"], started: true }).mode).toBe("checklist");
  });
});

describe("nextGuideSteps", () => {
  it("starter bødeformanden i bødekassen og springer det klarede over", () => {
    const s = state({ roles: ["BOEDEKASSEFORMAND"], facts: facts({ team: { mobilePayBox: true } }) });
    expect(nextGuideSteps(s.steps, 3).map((x) => x.id)).toEqual(["fines.templates", "fines.automation", "fines.assign"]);
  });

  it("starter admin med at få holdet sat op", () => {
    expect(nextGuideSteps(state({ roles: ["ADMIN"] }).steps, 2).map((x) => x.id)).toEqual(["admin.invite", "admin.calendar-import"]);
  });

  it("holder guidens rækkefølge for spillere", () => {
    expect(nextGuideSteps(state().steps, 2).map((x) => x.id)).toEqual(["basis.push", "basis.rsvp"]);
  });
});

describe("guideRolesAfterRoleChange", () => {
  it("beholder de gamle roller, når en ny rolle giver noget nyt, så de nye dele kan vises", () => {
    expect(guideRolesAfterRoleChange(["SPILLER"], ["SPILLER", "BOEDEKASSEFORMAND"])).toEqual(["SPILLER"]);
  });

  it("følger med, når man mister en rolle", () => {
    expect(guideRolesAfterRoleChange(["ADMIN"], ["SPILLER"])).toEqual(["SPILLER"]);
  });

  it("holder fast i en uset forfremmelse, hvis en af de nye roller fjernes igen", () => {
    expect(guideRolesAfterRoleChange(["SPILLER"], ["SPILLER", "TRAENER"])).toEqual(["SPILLER"]);
  });

  it("lader nye medlemmer uden velkomst blive ved med at få den", () => {
    expect(guideRolesAfterRoleChange([], ["TRAENER"])).toEqual([]);
  });
});
