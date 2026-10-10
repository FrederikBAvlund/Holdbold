import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHoldRecording } from "./holdRecording";

function setup() {
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  const getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  let capture: any;
  class Recorder {
    static isTypeSupported = () => true;
    state = "inactive";
    mimeType = "audio/webm";
    onstop: any = null;
    onerror: any = null;
    ondataavailable: any = null;
    constructor() { capture = this; }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["audio"]) }); }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  const cb = { onRecording: vi.fn(), onConnecting: vi.fn(), onBusy: vi.fn(), onError: vi.fn(), onAudio: vi.fn(async (_audio: Blob, _signal: AbortSignal) => {}) };
  return { controller: createHoldRecording(cb), cb, track, stream, getUserMedia, recorder: () => capture };
}

describe("hold to talk recording", () => {
  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(0));
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("captures only while held and uploads once after the final chunk on release", async () => {
    const { controller, recorder, cb, track } = setup();
    await controller.start();
    expect(recorder().state).toBe("recording");
    expect(cb.onAudio).not.toHaveBeenCalled();
    vi.mocked(Date.now).mockReturnValue(1000);
    controller.finish();
    controller.finish();
    expect(recorder().state).toBe("inactive");
    await recorder().onstop();
    expect(cb.onAudio).toHaveBeenCalledTimes(1);
    expect(await cb.onAudio.mock.calls[0][0].text()).toBe("audio");
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(cb.onBusy).toHaveBeenLastCalledWith(false);
  });

  it("never leaves the microphone open when released while permission is pending", async () => {
    const { controller, cb, getUserMedia, stream, track, recorder } = setup();
    let resolve!: (value: typeof stream) => void;
    getUserMedia.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const start = controller.start();
    controller.finish();
    resolve(stream);
    await start;
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(recorder()).toBeUndefined();
    expect(cb.onAudio).not.toHaveBeenCalled();
    expect(cb.onConnecting).toHaveBeenLastCalledWith(false);
  });

  it("discards cancelled and very short accidental presses", async () => {
    const first = setup();
    await first.controller.start();
    first.controller.cancel();
    expect(first.recorder().onstop).toBeNull();
    expect(first.cb.onAudio).not.toHaveBeenCalled();
    expect(first.track.stop).toHaveBeenCalledTimes(1);
    const second = setup();
    await second.controller.start();
    second.controller.finish();
    await second.recorder().onstop();
    expect(second.cb.onAudio).not.toHaveBeenCalled();
  });

  it("blocks overlapping presses and aborts processing when the modal closes", async () => {
    const { controller, cb, recorder, getUserMedia } = setup();
    let release!: () => void;
    cb.onAudio.mockImplementationOnce(() => new Promise<void>((done) => { release = done; }));
    await controller.start();
    vi.mocked(Date.now).mockReturnValue(1000);
    controller.finish();
    const processing = recorder().onstop();
    await controller.start();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    const signal = cb.onAudio.mock.calls[0][1];
    controller.cancel();
    expect(signal.aborted).toBe(true);
    release();
    await processing;
  });
});
