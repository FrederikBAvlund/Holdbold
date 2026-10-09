import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRealtimeTranscription } from "./useRealtimeTranscription";

const harness = vi.hoisted(() => ({ cleanup: undefined as (() => void) | undefined }));
vi.mock("react", () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
  useRef: (current: unknown) => ({ current }),
  useCallback: (fn: unknown) => fn,
  useEffect: (effect: () => (() => void)) => { harness.cleanup = effect(); }
}));

function setup() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  const channel = { readyState: "open", send: vi.fn(), onmessage: null as any, onclose: null as any };
  const pc = {
    addTrack: vi.fn(), createDataChannel: vi.fn(() => channel), close: vi.fn(),
    createOffer: vi.fn(async () => ({ sdp: "offer" })), setLocalDescription: vi.fn(async () => {}),
    setRemoteDescription: vi.fn(async () => {}), ontrack: null as any, onconnectionstatechange: null as any,
    connectionState: "connected"
  };
  const getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  const peerConstructor = vi.fn(function () { return pc; });
  vi.stubGlobal("RTCPeerConnection", peerConstructor);
  const fetchMock = vi.fn(async (url: string) => url === "/api/fines/voice/token"
    ? Response.json({ token: "ek-test" }) : new Response("answer"));
  vi.stubGlobal("fetch", fetchMock);
  const callbacks = {
    onSegment: vi.fn(), onReply: vi.fn(), onTool: vi.fn(), onUsage: vi.fn(), onDialogueUsage: vi.fn(), onError: vi.fn()
  };
  const hook = useRealtimeTranscription({ teamId: "team", spoken: true, ...callbacks });
  const audio = { pause: vi.fn(), play: vi.fn(async () => {}), srcObject: null as unknown };
  hook.audioRef.current = audio as unknown as HTMLAudioElement;
  return { hook, callbacks, track, stream, channel, pc, getUserMedia, peerConstructor, fetchMock, audio };
}

describe("voice conversation connection", () => {
  beforeEach(() => { harness.cleanup = undefined; });
  afterEach(() => { harness.cleanup?.(); vi.unstubAllGlobals(); });

  it("forbinder med det kortlivede token og afspiller remote lyd", async () => {
    const { hook, pc, fetchMock, audio, stream, track, channel, callbacks } = setup();
    await hook.start();
    expect(fetchMock.mock.calls[1]).toEqual(["https://api.openai.com/v1/realtime/calls", {
      method: "POST", body: "offer", headers: { Authorization: "Bearer ek-test", "Content-Type": "application/sdp" }
    }]);
    expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "answer" });
    pc.ontrack({ streams: [stream] });
    expect(audio.srcObject).toBe(stream);
    expect(audio.play).toHaveBeenCalledTimes(1);
    hook.stop();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(pc.close).toHaveBeenCalledTimes(1);
    expect(audio.srcObject).toBeNull();
    channel.onmessage({ data: JSON.stringify({ type: "response.done", response: {
      id: "r1", status: "completed", output: [{ type: "function_call", call_id: "c1", name: "set_fine_drafts", arguments: '{}' }]
    } }) });
    expect(callbacks.onTool).not.toHaveBeenCalled();
  });

  it("åbner ikke en forbindelse, hvis brugeren stopper mens tokenet hentes", async () => {
    const { hook, fetchMock, peerConstructor, track } = setup();
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((r) => { resolve = r; }));
    const starting = hook.start();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    hook.stop();
    resolve(Response.json({ token: "ek-test" }));
    await starting;
    expect(peerConstructor).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("slukker en forsinket mikrofon efter lukning af modal", async () => {
    const { hook, getUserMedia, stream, track, fetchMock } = setup();
    let resolve!: (audioStream: typeof stream) => void;
    getUserMedia.mockImplementationOnce(() => new Promise<typeof stream>((r) => { resolve = r; }));
    const starting = hook.start();
    harness.cleanup?.();
    resolve(stream);
    await starting;
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
