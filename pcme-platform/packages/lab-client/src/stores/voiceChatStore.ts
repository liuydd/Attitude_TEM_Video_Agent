import { create } from "zustand";
import type { ChatTurn, ChatTurnStatus, VoiceMode } from "@/types/voice";
import type { ConnectionStatus } from "@/core/VoiceWebSocket";

interface VoiceChatState {
  isEnabled: boolean;
  connectionStatus: ConnectionStatus;
  voiceMode: VoiceMode | null;
  turns: ChatTurn[];
  currentPartialTranscript: string;
  currentPartialSpeaker: number | null;
  isAiSpeaking: boolean;

  setEnabled: (v: boolean) => void;
  setConnectionStatus: (s: ConnectionStatus) => void;
  setVoiceMode: (m: VoiceMode) => void;
  addTurn: (turn: ChatTurn) => void;
  updateTurn: (turn_id: string, updates: Partial<Pick<ChatTurn, "text" | "status">>) => void;
  appendTurnText: (turn_id: string, delta: string) => void;
  setPartialTranscript: (text: string, speaker?: number | null) => void;
  setAiSpeaking: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  isEnabled: false,
  connectionStatus: "idle" as ConnectionStatus,
  voiceMode: null as VoiceMode | null,
  turns: [] as ChatTurn[],
  currentPartialTranscript: "",
  currentPartialSpeaker: null as number | null,
  isAiSpeaking: false,
};

export const useVoiceChatStore = create<VoiceChatState>((set) => ({
  ...initialState,

  setEnabled: (isEnabled) => set({ isEnabled }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setVoiceMode: (voiceMode) => set({ voiceMode }),

  addTurn: (turn) =>
    set((state) => ({ turns: [...state.turns, turn] })),

  updateTurn: (turn_id, updates) =>
    set((state) => ({
      turns: state.turns.map((t) =>
        t.turn_id === turn_id ? { ...t, ...updates } : t
      ),
    })),

  appendTurnText: (turn_id, delta) =>
    set((state) => ({
      turns: state.turns.map((t) =>
        t.turn_id === turn_id ? { ...t, text: t.text + delta } : t
      ),
    })),

  setPartialTranscript: (currentPartialTranscript, speaker) =>
    set({ currentPartialTranscript, currentPartialSpeaker: speaker ?? null }),

  setAiSpeaking: (isAiSpeaking) => set({ isAiSpeaking }),

  reset: () => set(initialState),
}));
