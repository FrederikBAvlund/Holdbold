"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TranscribeUsage } from "@/lib/voiceFines/pricing";

type Options = {
  teamId: string;
  onSegment: (text: string) => void;
  onUsage: (usage: TranscribeUsage) => void;
  onError: (message: string) => void;
};

export function useRealtimeTranscription({ teamId, onSegment, onUsage, onError }: Options) {
  const [recording, setRecording] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [liveText, setLiveText] = useState("");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const deltasRef = useRef<Record<string, string>>({});
  const cbRef = useRef({ onSegment, onUsage, onError });
  cbRef.current = { onSegment, onUsage, onError };

  const stop = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    deltasRef.current = {};
    setLiveText("");
    setRecording(false);
    setConnecting(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    if (pcRef.current || connecting) return;
    setConnecting(true);
    try {
      const tokenRes = await fetch("/api/fines/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId })
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok || !tokenData.token) {
        throw new Error(tokenData.error ?? "Kunne ikke starte optagelse");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const channel = pc.createDataChannel("oai-events");
      channel.onmessage = (message) => {
        let event: Record<string, any>;
        try {
          event = JSON.parse(message.data);
        } catch {
          return;
        }
        const itemId = String(event.item_id ?? "");
        if (event.type === "conversation.item.input_audio_transcription.delta") {
          deltasRef.current[itemId] = (deltasRef.current[itemId] ?? "") + String(event.delta ?? "");
          setLiveText(deltasRef.current[itemId]);
        } else if (event.type === "conversation.item.input_audio_transcription.completed") {
          delete deltasRef.current[itemId];
          setLiveText("");
          const transcript = String(event.transcript ?? "").trim();
          if (transcript) cbRef.current.onSegment(transcript);
          const usage = event.usage;
          if (usage?.type === "tokens") {
            cbRef.current.onUsage({
              audioIn: usage.input_token_details?.audio_tokens ?? 0,
              textIn: usage.input_token_details?.text_tokens ?? 0,
              textOut: usage.output_tokens ?? 0
            });
          }
        } else if (event.type === "error") {
          cbRef.current.onError(String(event.error?.message ?? "Fejl i transskription"));
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: { Authorization: `Bearer ${tokenData.token}`, "Content-Type": "application/sdp" }
      });
      if (!sdpRes.ok) throw new Error("Kunne ikke forbinde til transskription");
      await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          cbRef.current.onError("Forbindelsen blev afbrudt");
          stop();
        }
      };
      setRecording(true);
    } catch (error) {
      stop();
      const denied = error instanceof DOMException && error.name === "NotAllowedError";
      cbRef.current.onError(
        denied ? "Adgang til mikrofon blev afvist" : error instanceof Error ? error.message : "Kunne ikke starte optagelse"
      );
    } finally {
      setConnecting(false);
    }
  }, [teamId, connecting, stop]);

  return { recording, connecting, liveText, start, stop };
}
