import { describe, expect, it, vi } from "vitest";
import { createDialogueEventHandler } from "./dialogueEvents";
import { dialogueCostUsd } from "./pricing";

function setup() {
  const cb = {
    send: vi.fn(), onSegment: vi.fn(), onLiveText: vi.fn(), onReply: vi.fn(), onBusy: vi.fn(),
    onTool: vi.fn(() => ({ ok: true, snapshotId: "snapshot-current", fines: [] })),
    onTranscribeUsage: vi.fn(), onDialogueUsage: vi.fn(), onError: vi.fn()
  };
  return { cb, handle: createDialogueEventHandler(cb) };
}

describe("Realtime dialogue protocol", () => {
  it("streamer assistentens tekst uden at fortolke den som brugerens bøder", () => {
    const { cb, handle } = setup();
    handle({ type: "response.output_audio_transcript.delta", item_id: "a", delta: "Hvem " });
    handle({ type: "response.output_audio_transcript.delta", item_id: "a", delta: "mener du?" });
    handle({ type: "response.output_audio_transcript.done", item_id: "a", transcript: "Hvem mener du?" });
    expect(cb.onReply).toHaveBeenLastCalledWith("a", "Hvem mener du?", true);
    expect(cb.onSegment).not.toHaveBeenCalled();
    expect(cb.onTool).not.toHaveBeenCalled();
  });
  it("viser også tekstsvar uden lyd", () => {
    const { cb, handle } = setup();
    handle({ type: "response.output_text.delta", item_id: "a", delta: "Rettet." });
    expect(cb.onReply).toHaveBeenCalledWith("a", "Rettet.", false);
  });
  it("sender værktøjsresultat før modellen svarer og udfører ikke kald to gange", () => {
    const { cb, handle } = setup();
    const event = { type: "response.done", response: { id: "r1", status: "completed", output: [
      { type: "function_call", call_id: "c1", name: "set_fine_drafts", arguments: '{"snapshotId":"snapshot-current","fines":[]}' }
    ] } };
    handle(event);
    handle(event);
    expect(cb.onTool).toHaveBeenCalledExactlyOnceWith("set_fine_drafts", { snapshotId: "snapshot-current", fines: [] });
    expect(cb.send.mock.calls.map(([e]) => e.type)).toEqual(["conversation.item.create", "response.create"]);
    expect(cb.send.mock.calls[0][0].item).toMatchObject({ type: "function_call_output", call_id: "c1" });
  });
  it("udfører ikke værktøjer fra afbrudte svar", () => {
    const { cb, handle } = setup();
    handle({ type: "response.done", response: { id: "r1", status: "cancelled", output: [
      { type: "function_call", call_id: "c1", name: "set_fine_drafts", arguments: '{}' }
    ] } });
    expect(cb.onTool).not.toHaveBeenCalled();
  });
  it("sender afvist værktøjskald tilbage, når argumenterne ikke er JSON", () => {
    const { cb, handle } = setup();
    handle({ type: "response.done", response: { id: "r1", status: "completed", output: [
      { type: "function_call", call_id: "c1", name: "set_fine_drafts", arguments: 'bad' }
    ] } });
    expect(JSON.parse(cb.send.mock.calls[0][0].item.output).ok).toBe(false);
    expect(cb.onTool).not.toHaveBeenCalled();
  });
  it("tæller transskription én gang og skiller cache og dialog fra hinanden", () => {
    const { cb, handle } = setup();
    const input = { type: "conversation.item.input_audio_transcription.completed", item_id: "u1", transcript: "Mikkel for sent", usage: { type: "tokens", input_token_details: { audio_tokens: 5 }, output_tokens: 3 } };
    handle(input);
    handle(input);
    expect(cb.onSegment).toHaveBeenCalledTimes(1);
    expect(cb.onTranscribeUsage).toHaveBeenCalledExactlyOnceWith({ audioIn: 5, textIn: 0, textOut: 3 });
    handle({ type: "response.done", response: { id: "r1", status: "completed", output: [], usage: {
      input_tokens: 120, output_tokens: 50,
      input_token_details: { audio_tokens: 100, text_tokens: 20, cached_tokens_details: { audio_tokens: 40, text_tokens: 10 } },
      output_token_details: { audio_tokens: 30, text_tokens: 20 }
    } } });
    const usage = { audioIn: 60, textIn: 10, audioOut: 30, textOut: 20, cachedAudio: 40, cachedText: 10 };
    expect(cb.onDialogueUsage).toHaveBeenCalledWith(usage);
    expect(dialogueCostUsd(usage)).toBeCloseTo((600 + 6 + 600 + 48 + 12 + 0.6) / 1_000_000);
  });
});


describe("short tool confirmations", () => {
  it("adds in one tool call and requests only a bounded confirmation without more tools", () => {
    const { cb, handle } = setup();
    cb.onTool.mockReturnValueOnce({ ok: true, added: 3 } as never);
    const event = { type: "response.done", response: { id: "new", status: "completed", output: [
      { type: "function_call", call_id: "add", name: "add_fine_drafts", arguments: '{"fines":[],"allowDuplicates":false}' }
    ] } };
    handle(event);
    handle(event);
    expect(cb.onTool).toHaveBeenCalledExactlyOnceWith("add_fine_drafts", { fines: [], allowDuplicates: false });
    expect(cb.send).toHaveBeenLastCalledWith({ type: "response.create", response: expect.objectContaining({
      tool_choice: "none", max_output_tokens: 256
    }) });
    expect(JSON.parse(cb.send.mock.calls[0][0].item.output)).toEqual({ ok: true, added: 3 });
  });

  it("allows recovery after a rejected write and does not issue a success confirmation", () => {
    const { cb, handle } = setup();
    cb.onTool.mockReturnValueOnce({ ok: false, error: "Ukendt spiller" } as never);
    handle({ type: "response.done", response: { id: "rejected", status: "completed", output: [
      { type: "function_call", call_id: "add", name: "add_fine_drafts", arguments: '{}' }
    ] } });
    expect(cb.send).toHaveBeenLastCalledWith({ type: "response.create" });
  });

  it("allows the edit after reading a snapshot instead of prematurely confirming", () => {
    const { cb, handle } = setup();
    handle({ type: "response.done", response: { id: "read", status: "completed", output: [
      { type: "function_call", call_id: "get", name: "get_fine_drafts", arguments: '{}' }
    ] } });
    expect(cb.send).toHaveBeenLastCalledWith({ type: "response.create" });
  });
});
