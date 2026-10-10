import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { requireSession } from "@/lib/apiAuth";
import { loadGuideFacts } from "@/lib/guide/facts";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/apiAuth", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/guide/facts", () => ({ loadGuideFacts: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: { findFirst: vi.fn(), update: vi.fn() },
    guideProgress: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn()
  }
}));

const noFacts = {
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

const post = (body: unknown) => new Request("http://localhost/api/guide", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireSession).mockResolvedValue({ ok: true, userId: "u1" });
  vi.mocked(prisma.membership.findFirst).mockResolvedValue({
    id: "m1",
    role: "TRAENER",
    guideRole: "SPILLER",
    guideDismissedAt: null
  } as never);
  vi.mocked(prisma.guideProgress.findMany).mockResolvedValue([]);
  vi.mocked(loadGuideFacts).mockResolvedValue(noFacts);
});

describe("GET /api/guide", () => {
  it("kræver teamId", async () => {
    expect((await GET(new Request("http://localhost/api/guide"))).status).toBe(400);
  });

  it("afviser brugere, der ikke er aktive på holdet", async () => {
    vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/guide?teamId=t1"))).status).toBe(403);
  });

  it("returnerer trin og forfremmelse for brugerens rolle", async () => {
    const response = await GET(new Request("http://localhost/api/guide?teamId=t1"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.role).toBe("TRAENER");
    expect(body.promotion.capabilities).toEqual(["events"]);
    expect(body.steps.some((s: { id: string }) => s.id === "events.create")).toBe(true);
  });
});

describe("POST /api/guide", () => {
  it("afviser ukendte trin", async () => {
    expect((await POST(post({ teamId: "t1", action: "skip", stepId: "nope" }))).status).toBe(400);
    expect(prisma.guideProgress.upsert).not.toHaveBeenCalled();
  });

  it("gemmer et oversprunget trin", async () => {
    expect((await POST(post({ teamId: "t1", action: "skip", stepId: "basis.avatar" }))).status).toBe(200);
    expect(prisma.guideProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: { userId: "u1", teamId: "t1", stepId: "basis.avatar", status: "SKIPPED" },
        update: { status: "SKIPPED" }
      })
    );
  });

  it("lader 'set' stå over et trin, der allerede er klaret", async () => {
    await POST(post({ teamId: "t1", action: "seen", stepId: "basis.pay-fine" }));
    expect(prisma.guideProgress.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {} }));
  });

  it("følger den nuværende rolle, når velkomst eller forfremmelse er vist", async () => {
    await POST(post({ teamId: "t1", action: "acknowledge-role" }));
    expect(prisma.membership.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { guideRole: "TRAENER" } });
  });

  it("springer hele guiden over", async () => {
    await POST(post({ teamId: "t1", action: "dismiss" }));
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { guideRole: "TRAENER", guideDismissedAt: expect.any(Date) }
    });
  });

  it("afviser ukendte handlinger", async () => {
    expect((await POST(post({ teamId: "t1", action: "hack" }))).status).toBe(400);
  });
});
