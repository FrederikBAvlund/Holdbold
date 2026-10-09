"use client";

import { useEffect, useRef, useState } from "react";
import { createHoldRecording } from "./holdRecording";
import type { ParseUsage, TranscribeUsage } from "@/lib/voiceFines/pricing";
import type { VoiceSuggestion } from "@/lib/voiceFines/matching";

type Options = {
  teamId: string;
  existing: () => Array<{ userId: string; title: string; amount: number | null }>;
  onTranscript: (text: string) => void;
  onSuggestions: (suggestions: VoiceSuggestion[]) => void;
  onTranscribeUsage: (usage: TranscribeUsage) => void;
  onParseUsage: (usage: ParseUsage) => void;
  onError: (message: string) => void;
};

export function useHoldToTalk(options: Options) {
  const [recording, setRecording] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const cb = useRef(options);
  cb.current = options;
  const recordingRef = useRef<ReturnType<typeof createHoldRecording> | null>(null);
  if (!recordingRef.current) recordingRef.current = createHoldRecording({
    onRecording: setRecording, onConnecting: setConnecting, onBusy: setBusy,
    onError: (message) => cb.current.onError(message),
    onAudio: async (audio, signal) => {
      const form = new FormData();
      form.set("teamId", cb.current.teamId);
      form.set("audio", audio, "recording");
      const transcribe = await fetch("/api/fines/voice/transcribe", { method: "POST", body: form, signal });
      const data = await transcribe.json();
      if (signal.aborted) return;
      if (!transcribe.ok) throw new Error(data.error ?? "Kunne ikke transskribere optagelsen");
      // This exact text is both displayed and passed to the text model. No second audio interpretation.
      cb.current.onTranscript(data.text);
      cb.current.onTranscribeUsage(data.usage);
      const response = await fetch("/api/fines/voice/parse", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal,
        body: JSON.stringify({ teamId: cb.current.teamId, segment: data.text, existing: cb.current.existing() })
      });
      const parsed = await response.json();
      if (signal.aborted) return;
      if (!response.ok) throw new Error(parsed.error ?? "Kunne ikke oprette bødeforslag");
      cb.current.onParseUsage(parsed.usage);
      cb.current.onSuggestions(parsed.suggestions);
    }
  });
  useEffect(() => {
    const stop = () => recordingRef.current?.finish();
    window.addEventListener("blur", stop);
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", visibility);
      recordingRef.current?.cancel();
    };
  }, []);
  return { recording, connecting, busy, start: recordingRef.current.start, finish: recordingRef.current.finish, cancel: recordingRef.current.cancel };
}
