import type { DialogueUsage, TranscribeUsage } from "./pricing";

type Callbacks = {
  send: (event: unknown) => void;
  onSegment: (text: string) => void;
  onLiveText: (text: string) => void;
  onReply: (id: string, text: string, complete: boolean) => void;
  onBusy: (busy: boolean) => void;
  onTool: (name: string, input: unknown) => unknown;
  onTranscribeUsage: (usage: TranscribeUsage) => void;
  onDialogueUsage: (usage: DialogueUsage) => void;
  onError: (message: string) => void;
};

/** A fresh handler per connection: never replay completed tools or double-count usage. */
export function createDialogueEventHandler(cb: Callbacks) {
  const inputText = new Map<string, string>();
  const outputText = new Map<string, string>();
  const completedInputs = new Set<string>();
  const completedResponses = new Set<string>();
  const completedCalls = new Set<string>();
  return (event: Record<string, any>) => {
    const id = String(event.item_id ?? "");
    if (event.type === "conversation.item.input_audio_transcription.delta") {
      const text = (inputText.get(id) ?? "") + String(event.delta ?? "");
      inputText.set(id, text);
      cb.onLiveText(text);
    } else if (event.type === "conversation.item.input_audio_transcription.completed") {
      if (completedInputs.has(id)) return;
      completedInputs.add(id);
      inputText.delete(id);
      cb.onLiveText("");
      const text = String(event.transcript ?? "").trim();
      if (text) cb.onSegment(text);
      if (event.usage?.type === "tokens") {
        cb.onTranscribeUsage({
          audioIn: event.usage.input_token_details?.audio_tokens ?? 0,
          textIn: event.usage.input_token_details?.text_tokens ?? 0,
          textOut: event.usage.output_tokens ?? 0
        });
      }
    } else if (event.type === "response.output_audio_transcript.delta" || event.type === "response.output_text.delta") {
      const text = (outputText.get(id) ?? "") + String(event.delta ?? "");
      outputText.set(id, text);
      cb.onReply(id, text, false);
    } else if (event.type === "response.output_audio_transcript.done" || event.type === "response.output_text.done") {
      const text = String(event.transcript ?? event.text ?? outputText.get(id) ?? "");
      outputText.delete(id);
      cb.onReply(id, text, true);
    } else if (event.type === "response.created") {
      cb.onBusy(true);
    } else if (event.type === "response.done") {
      const response = event.response;
      if (!response?.id || completedResponses.has(response.id)) return;
      completedResponses.add(response.id);
      cb.onBusy(false);
      const usage = response.usage;
      if (usage) {
        const cached = usage.input_token_details?.cached_tokens_details;
        const audioIn = usage.input_token_details?.audio_tokens ?? 0;
        const audioOut = usage.output_token_details?.audio_tokens ?? 0;
        cb.onDialogueUsage({
          audioIn: Math.max(0, audioIn - (cached?.audio_tokens ?? 0)),
          textIn: Math.max(0, (usage.input_token_details?.text_tokens ?? (usage.input_tokens ?? 0) - audioIn) - (cached?.text_tokens ?? 0)),
          audioOut,
          textOut: usage.output_token_details?.text_tokens ?? Math.max(0, (usage.output_tokens ?? 0) - audioOut),
          cachedAudio: cached?.audio_tokens ?? 0,
          cachedText: cached?.text_tokens ?? 0
        });
      }
      if (response.status === "failed") {
        cb.onError("Assistenten kunne ikke svare. Prøv igen.");
        return;
      }
      if (response.status !== "completed") return;
      let toolHandled = false;
      for (const item of response.output ?? []) {
        if (item.type !== "function_call" || !item.call_id || completedCalls.has(item.call_id)) continue;
        completedCalls.add(item.call_id);
        let output: unknown;
        try {
          output = cb.onTool(item.name, JSON.parse(item.arguments));
        } catch {
          output = { ok: false, error: "Ugyldigt værktøjskald. Prøv igen." };
        }
        cb.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: item.call_id, output: JSON.stringify(output) } });
        toolHandled = true;
      }
      if (toolHandled) {
        cb.onBusy(true);
        cb.send({ type: "response.create" });
      }
    } else if (event.type === "error" || event.type === "conversation.item.input_audio_transcription.failed") {
      cb.onBusy(false);
      cb.onError("Fejl i samtalen. Stop og start igen, hvis fejlen fortsætter.");
    }
  };
}
