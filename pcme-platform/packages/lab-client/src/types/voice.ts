/** Server → Client WebSocket message types for voice agent. */

export type VoiceMode = "agent" | "control";

export interface ReadyMessage {
  type: "ready";
  mode: VoiceMode;
}

export interface TranscriptPartialMessage {
  type: "transcript_partial";
  text: string;
  speaker?: number;
}

export interface TranscriptFinalMessage {
  type: "transcript_final";
  text: string;
  turn_id: string;
  speaker?: number;
}

export interface TranscriptAggregatedMessage {
  type: "transcript_aggregated";
  text: string;       // corrected text
  raw_text: string;   // original Deepgram STT text
  turn_id: string;
  speaker?: number;   // control mode only
}

export interface LLMDeltaMessage {
  type: "llm_delta";
  text: string;
  turn_id: string;
}

export interface LLMDoneMessage {
  type: "llm_done";
  full_text: string;
  turn_id: string;
}

export interface TTSDoneMessage {
  type: "tts_done";
  turn_id: string;
}

export interface InterruptedMessage {
  type: "interrupted";
  turn_id: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
  code: string;
}

export type ServerMessage =
  | ReadyMessage
  | TranscriptPartialMessage
  | TranscriptFinalMessage
  | TranscriptAggregatedMessage
  | LLMDeltaMessage
  | LLMDoneMessage
  | TTSDoneMessage
  | InterruptedMessage
  | ErrorMessage;

export type ChatTurnStatus = "partial" | "final" | "streaming" | "done" | "interrupted";

export interface ChatTurn {
  turn_id: string;
  role: "user" | "assistant" | "speaker_0" | "speaker_1";
  text: string;
  status: ChatTurnStatus;
}
