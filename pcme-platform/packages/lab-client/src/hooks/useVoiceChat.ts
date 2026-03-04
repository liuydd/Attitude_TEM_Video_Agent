import { useCallback, useEffect, useRef } from "react";
import { AudioCaptureManager } from "@/core/AudioCaptureWorklet";
import { AudioPlaybackManager } from "@/core/AudioPlaybackManager";
import { VoiceWebSocket } from "@/core/VoiceWebSocket";
import { useVoiceChatStore } from "@/stores/voiceChatStore";
import type { ServerMessage } from "@/types/voice";

function speakerRole(speaker: number | undefined | null): "speaker_0" | "speaker_1" {
  return speaker === 1 ? "speaker_1" : "speaker_0";
}

export function useVoiceChat(sessionId: string, videoTimeRef?: React.RefObject<number>) {
  const captureRef = useRef<AudioCaptureManager | null>(null);
  const playbackRef = useRef<AudioPlaybackManager | null>(null);
  const wsRef = useRef<VoiceWebSocket | null>(null);

  const {
    isEnabled,
    connectionStatus,
    voiceMode,
    turns,
    currentPartialTranscript,
    currentPartialSpeaker,
    isAiSpeaking,
    setEnabled,
    setConnectionStatus,
    setVoiceMode,
    addTurn,
    updateTurn,
    appendTurnText,
    setPartialTranscript,
    setAiSpeaking,
    reset,
  } = useVoiceChatStore();

  const handleTextMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case "ready":
          setVoiceMode(msg.mode);
          break;

        case "transcript_partial":
          setPartialTranscript(msg.text, msg.speaker);
          break;

        case "transcript_final": {
          setPartialTranscript("");
          const mode = useVoiceChatStore.getState().voiceMode;

          if (mode === "control") {
            // Control mode: just show transcript with speaker label
            addTurn({
              turn_id: msg.turn_id,
              role: speakerRole(msg.speaker),
              text: msg.text,
              status: "final",
            });
          } else {
            // Agent mode: user bubble + prepare AI response bubble
            addTurn({
              turn_id: msg.turn_id,
              role: "user",
              text: msg.text,
              status: "final",
            });
            addTurn({
              turn_id: msg.turn_id + "_ai",
              role: "assistant",
              text: "",
              status: "streaming",
            });
            setAiSpeaking(true);
          }
          break;
        }

        case "llm_delta":
          appendTurnText(msg.turn_id + "_ai", msg.text);
          break;

        case "llm_done":
          updateTurn(msg.turn_id + "_ai", {
            text: msg.full_text,
            status: "done",
          });
          break;

        case "tts_done":
          break;

        case "interrupted":
          setAiSpeaking(false);
          if (msg.turn_id) {
            updateTurn(msg.turn_id + "_ai", { status: "interrupted" });
          }
          break;

        case "error":
          console.error("Voice agent error:", msg.message);
          break;
      }
    },
    [addTurn, updateTurn, appendTurnText, setPartialTranscript, setAiSpeaking, setVoiceMode]
  );

  const handleBinaryMessage = useCallback((data: ArrayBuffer) => {
    playbackRef.current?.enqueue(data);
  }, []);

  const start = useCallback(async () => {
    // 1. Init playback (only used in agent mode, but safe to init)
    const playback = new AudioPlaybackManager();
    playback.init();
    playback.onPlaybackEnd = () => {
      setAiSpeaking(false);
    };
    playbackRef.current = playback;

    // 2. Connect WebSocket
    const ws = new VoiceWebSocket();
    ws.onStatusChange = setConnectionStatus;
    ws.onTextMessage = handleTextMessage;
    ws.onBinaryMessage = handleBinaryMessage;
    ws.connect(sessionId);
    wsRef.current = ws;

    // 3. Start audio capture
    const capture = new AudioCaptureManager();
    capture.onAudioChunk = (pcm) => {
      ws.sendAudio(pcm);
    };
    await capture.start();
    captureRef.current = capture;

    setEnabled(true);
  }, [
    sessionId,
    setEnabled,
    setConnectionStatus,
    setAiSpeaking,
    handleTextMessage,
    handleBinaryMessage,
  ]);

  const stop = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;

    wsRef.current?.close();
    wsRef.current = null;

    playbackRef.current?.destroy();
    playbackRef.current = null;

    reset();
  }, [reset]);

  const interrupt = useCallback(() => {
    playbackRef.current?.interrupt();
    wsRef.current?.sendInterrupt();
    setAiSpeaking(false);
  }, [setAiSpeaking]);

  // Send video time to backend every second while enabled
  useEffect(() => {
    if (!isEnabled || !videoTimeRef) return;
    const interval = setInterval(() => {
      const t = videoTimeRef.current;
      if (t !== undefined && t !== null && wsRef.current) {
        wsRef.current.sendVideoTime(t);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isEnabled, videoTimeRef]);

  return {
    isEnabled,
    connectionStatus,
    voiceMode,
    turns,
    currentPartialTranscript,
    currentPartialSpeaker,
    isAiSpeaking,
    start,
    stop,
    interrupt,
  };
}
