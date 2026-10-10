import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { POST } from "./route";
import { getTeamOpenAiKey } from "@/lib/teamOpenAiKey";
import { requireActiveTeamMemberWithRoles } from "@/lib/apiAuth";

vi.mock("@/lib/apiAuth", () => ({ FINE_AUTOMATION_ROLES: ["ADMIN", "BOEDEKASSEFORMAND"], requireSession: vi.fn(async () => ({ ok: true, userId: "admin" })), requireActiveTeamMemberWithRoles: vi.fn() }));
vi.mock("@/lib/seasons", () => ({ getActiveSeason: vi.fn(async () => ({})), seasonClosedResponse: vi.fn(() => null) }));
vi.mock("@/lib/teamOpenAiKey", () => ({ getTeamOpenAiKey: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { membership: { findMany: vi.fn(async () => [{ user: { name: "Vitus Duus" } }]) } } }));
function request(type = "audio/webm", content = "audio") {
  const form = new FormData();
  form.set("teamId", "team");
  form.set("audio", new Blob([content], { type }), "audio");
  return new Request("http://localhost", { method: "POST", body: form });
}
beforeEach(() => {
  vi.mocked(getTeamOpenAiKey).mockResolvedValue("sk-secret");
  vi.mocked(requireActiveTeamMemberWithRoles).mockResolvedValue({ ok: true, roles: ["ADMIN"] });
});
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe("held audio transcription", () => {
  it("uses the team key and names glossary and returns exact text plus actual usage", async () => {
    const text = "  Vitus kom for sent.\n";
    const fetchMock = vi.fn(async (_url: string, _request: RequestInit) => Response.json({ text, usage: { input_token_details: { audio_tokens: 5, text_tokens: 2 }, output_tokens: 3 } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request());
    expect(await response.json()).toEqual({ text, usage: { audioIn: 5, textIn: 2, textOut: 3 } });
    expect(getTeamOpenAiKey).toHaveBeenCalledWith("team");
    const [url, upstream] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(upstream.headers).toEqual({ Authorization: "Bearer sk-secret" });
    const form = upstream.body as FormData;
    expect(form.get("model")).toBe("gpt-4o-transcribe");
    expect(form.get("language")).toBe("da");
    expect(form.get("prompt")).toContain("Vitus Duus");
    expect((form.get("file") as File).name).toBe("recording.webm");
  });
  it("authorizes before reading the secret or contacting OpenAI", async () => {
    vi.mocked(requireActiveTeamMemberWithRoles).mockResolvedValue({ ok: false, response: NextResponse.json({}, { status: 403 }) });
    expect((await POST(request())).status).toBe(403);
    expect(getTeamOpenAiKey).not.toHaveBeenCalled();
  });
  it.each([null, new Error("sk-secret")])("fails safely without a usable key", async (key) => {
    if (key instanceof Error) vi.mocked(getTeamOpenAiKey).mockRejectedValue(key);
    else vi.mocked(getTeamOpenAiKey).mockResolvedValue(key);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sk-secret");
  });
  it.each(["text/html", "audio/unknown"])("rejects unsupported audio %s", async (type) => {
    expect((await POST(request(type))).status).toBe(400);
    expect(getTeamOpenAiKey).not.toHaveBeenCalled();
  });
  it("rejects empty audio before making a paid request", async () => {
    expect((await POST(request("audio/webm", ""))).status).toBe(400);
    expect(getTeamOpenAiKey).not.toHaveBeenCalled();
  });
  it("returns safe errors for upstream failure and unrecognized speech", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "sk-secret" }, { status: 401 })));
    const failed = await POST(request());
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain("sk-secret");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ text: "" })));
    expect((await POST(request())).status).toBe(422);
  });
});
