type Callbacks = {
  onRecording: (value: boolean) => void;
  onConnecting: (value: boolean) => void;
  onBusy: (value: boolean) => void;
  onError: (message: string) => void;
  onAudio: (audio: Blob, signal: AbortSignal) => Promise<void>;
};

/** One held press produces at most one recording. Releasing during permission never opens the mic later. */
export function createHoldRecording(cb: Callbacks) {
  let held = false;
  let connecting = false;
  let busy = false;
  let generation = 0;
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let controller: AbortController | null = null;
  const stopTracks = () => { stream?.getTracks().forEach((track) => track.stop()); stream = null; };

  const cancel = () => {
    generation++;
    held = false;
    connecting = false;
    busy = false;
    controller?.abort();
    controller = null;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      recorder = null;
    }
    stopTracks();
    cb.onRecording(false);
    cb.onConnecting(false);
    cb.onBusy(false);
  };
  const finish = () => {
    held = false;
    if (!recorder || recorder.state === "inactive") return;
    busy = true;
    cb.onBusy(true);
    cb.onRecording(false);
    recorder.stop();
  };
  const start = async () => {
    if (held || connecting || busy) return;
    held = true;
    connecting = true;
    const current = ++generation;
    cb.onConnecting(true);
    try {
      if (typeof MediaRecorder === "undefined") throw new Error("Din browser understøtter ikke lydoptagelse.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (current !== generation || !held) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = media;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const capture = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder = capture;
      const chunks: Blob[] = [];
      const startedAt = Date.now();
      capture.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      capture.onerror = () => { if (current === generation) { cancel(); cb.onError("Optagelsen fejlede. Prøv igen."); } };
      capture.onstop = async () => {
        if (current !== generation) return;
        recorder = null;
        stopTracks();
        const audio = new Blob(chunks, { type: capture.mimeType || mimeType || "audio/webm" });
        controller = new AbortController();
        try {
          if (audio.size && Date.now() - startedAt >= 250) await cb.onAudio(audio, controller.signal);
        } catch (error) {
          if (current === generation && !controller?.signal.aborted) cb.onError(error instanceof Error ? error.message : "Kunne ikke behandle optagelsen");
        } finally {
          if (current === generation) { busy = false; controller = null; cb.onBusy(false); }
        }
      };
      capture.start();
      cb.onRecording(true);
    } catch (error) {
      if (current !== generation) return;
      cancel();
      cb.onError(error instanceof DOMException && error.name === "NotAllowedError" ? "Adgang til mikrofon blev afvist" : error instanceof Error ? error.message : "Kunne ikke starte optagelsen");
    } finally {
      if (current === generation) { connecting = false; cb.onConnecting(false); }
    }
  };
  return { start, finish, cancel };
}
