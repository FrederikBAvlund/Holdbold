import { afterEach, describe, expect, it, vi } from "vitest";
import { useHoldToTalk } from "./useHoldToTalk";

const harness = vi.hoisted(() => ({ audio: undefined as undefined | ((blob: Blob, signal: AbortSignal) => Promise<void>), cleanup: undefined as undefined | (() => void) }));
vi.mock("react", () => ({
  useState: (initial: unknown) => [initial, vi.fn()], useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => () => void) => { harness.cleanup = effect(); }
}));
vi.mock("./holdRecording", () => ({ createHoldRecording: (callbacks: any) => {
  harness.audio = callbacks.onAudio;
  return { start: vi.fn(), finish: vi.fn(), cancel: vi.fn() };
} }));
function setup() {
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const callbacks = { existing: vi.fn(() => []), onTranscript: vi.fn(), onSuggestions: vi.fn(), onTranscribeUsage: vi.fn(), onParseUsage: vi.fn(), onError: vi.fn() };
  useHoldToTalk({ teamId: "team", ...callbacks });
  return callbacks;
}
afterEach(() => { harness.cleanup?.(); vi.unstubAllGlobals(); });

describe("aligned transcript and fine extraction", () => {
  it("displays and sends the identical transcript, with no audio dialogue or reply generation", async () => {
    const callbacks = setup();
    const text = "  Vitus, Engdal og André kom 20 minutter for sent.\n";
    const fetchMock = vi.fn(async (url: string) => url.endsWith("transcribe")
      ? Response.json({ text, usage: { audioIn: 5, textIn: 1, textOut: 2 } })
      : Response.json({ suggestions: [{ userId: "v", title: "For sent", amount: 25 }], usage: { input: 5, output: 3, cacheRead: 0, cacheWrite: 0 } }));
    vi.stubGlobal("fetch", fetchMock);
    await harness.audio!(new Blob(["audio"], { type: "audio/webm" }), new AbortController().signal);
    expect(callbacks.onTranscript).toHaveBeenCalledExactlyOnceWith(text);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, request] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toEqual({ teamId: "team", segment: text, existing: [] });
    expect(callbacks.onSuggestions).toHaveBeenCalledWith([{ userId: "v", title: "For sent", amount: 25 }]);
  });

  it("does not parse when transcription fails", async () => {
    const callbacks = setup();
    const fetchMock = vi.fn(async () => Response.json({ error: "Ingen tale" }, { status: 422 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(harness.audio!(new Blob(["audio"]), new AbortController().signal)).rejects.toThrow("Ingen tale");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(callbacks.onTranscript).not.toHaveBeenCalled();
  });

  it("does not apply late results after cancellation", async () => {
    const callbacks = setup();
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn(async () => { controller.abort(); return Response.json({ text: "Vitus" }); }));
    await harness.audio!(new Blob(["audio"]), controller.signal);
    expect(callbacks.onTranscript).not.toHaveBeenCalled();
    expect(callbacks.onSuggestions).not.toHaveBeenCalled();
  });
});
