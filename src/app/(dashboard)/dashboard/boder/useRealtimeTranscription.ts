"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DialogueUsage, TranscribeUsage } from "@/lib/voiceFines/pricing";
import { createDialogueEventHandler } from "@/lib/voiceFines/dialogueEvents";

type Options = {
  teamId: string;
  spoken: boolean;
  onSegment: (text: string) => void;
  onReply: (id: string, text: string, complete: boolean) => void;
  onTool: (name: string, input: unknown) => unknown;
  onUsage: (usage: TranscribeUsage) => void;
  onDialogueUsage: (usage: DialogueUsage) => void;
  onError: (message: string) => void;
};

export function useRealtimeTranscription(options: Options) {
  const [recording, setRecording] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [liveText, setLiveText] = useState("");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const connectionRef = useRef(0);
  const startingRef = useRef(false);
  const cbRef = useRef(options);
  cbRef.current = options;

  const stop = useCallback(() => {
    connectionRef.current += 1;
    startingRef.current = false;
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    setLiveText("");
    setRecording(false);
    setConnecting(false);
    setBusy(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    if (pcRef.current || startingRef.current) return;
    startingRef.current = true;
    const connection = ++connectionRef.current;
    const active = () => connectionRef.current === connection;
    setConnecting(true);
    try {
      // Request microphone access directly from the click; abandon it if the modal closes.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      if (!active()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const tokenRes = await fetch("/api/fines/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: cbRef.current.teamId, spoken: cbRef.current.spoken })
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!active()) return;
      if (!tokenRes.ok || !tokenData.token) {
        throw new Error(tokenData.error ?? "Kunne ikke starte samtalen");
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (event) => {
        if (!active() || !audioRef.current) return;
        const audio = audioRef.current;
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void audio.play().catch(() => {
          if (active()) cbRef.current.onError("Tryk på afspil i lydafspilleren for at høre assistenten.");
        });
      };
      pc.onconnectionstatechange = () => {
        if (!active()) return;
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          cbRef.current.onError("Forbindelsen blev afbrudt");
          stop();
        }
      };

      const channel = pc.createDataChannel("oai-events");
      const handleEvent = createDialogueEventHandler({
        send: (event) => { if (active() && channel.readyState === "open") channel.send(JSON.stringify(event)); },
        onLiveText: setLiveText,
        onBusy: setBusy,
        onSegment: (text) => cbRef.current.onSegment(text),
        onReply: (id, text, complete) => cbRef.current.onReply(`${connection}-${id}`, text, complete),
        onTool: (name, input) => cbRef.current.onTool(name, input),
        onTranscribeUsage: (usage) => cbRef.current.onUsage(usage),
        onDialogueUsage: (usage) => cbRef.current.onDialogueUsage(usage),
        onError: (message) => cbRef.current.onError(message)
      });
      channel.onmessage = (message) => {
        if (!active()) return;
        try {
          const event = JSON.parse(message.data);
          if (event && typeof event === "object") handleEvent(event);
        } catch {
          // Ignore non-JSON transport messages.
        }
      };
      channel.onclose = () => {
        if (active()) {
          cbRef.current.onError("Samtalen blev afbrudt");
          stop();
        }
      };

      const offer = await pc.createOffer();
      if (!active()) return;
      await pc.setLocalDescription(offer);
      if (!active()) return;
      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${tokenData.token}`, "Content-Type": "application/sdp" }
      });
      if (!active()) return;
      if (!sdpRes.ok) throw new Error("Kunne ikke forbinde til samtalen");
      const sdp = await sdpRes.text();
      if (!active()) return;
      await pc.setRemoteDescription({ type: "answer", sdp });
      if (active()) setRecording(true);
    } catch (error) {
      if (!active()) return;
      stop();
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      cbRef.current.onError(
        denied ? "Adgang til mikrofon blev afvist" : error instanceof Error ? error.message : "Kunne ikke starte samtalen"
      );
    } finally {
      if (active()) {
        startingRef.current = false;
        setConnecting(false);
      }
    }
  }, [stop]);

  return { recording, connecting, busy, liveText, audioRef, start, stop };
}
