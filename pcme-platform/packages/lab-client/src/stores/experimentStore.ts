import { create } from "zustand";
import type { Experiment, Participant, Session, SessionStatus } from "@/types/experiment";
import type { RecordingResult } from "@/core/MediaRecorderManager";

interface ExperimentState {
  // Current experiment context
  experiment: Experiment | null;
  participant: Participant | null;
  session: Session | null;

  // Recording
  recordingResult: RecordingResult | null;

  // Upload state
  uploadProgress: number;
  isUploading: boolean;

  // Actions
  setExperiment: (exp: Experiment) => void;
  setParticipant: (p: Participant) => void;
  setSession: (s: Session) => void;
  updateSessionStatus: (status: SessionStatus) => void;
  setRecordingResult: (r: RecordingResult | null) => void;
  setUploadProgress: (progress: number) => void;
  setIsUploading: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  experiment: null,
  participant: null,
  session: null,
  recordingResult: null,
  uploadProgress: 0,
  isUploading: false,
};

export const useExperimentStore = create<ExperimentState>((set) => ({
  ...initialState,

  setExperiment: (experiment) => set({ experiment }),
  setParticipant: (participant) => set({ participant }),
  setSession: (session) => set({ session }),
  updateSessionStatus: (status) =>
    set((state) => ({
      session: state.session ? { ...state.session, status } : null,
    })),
  setRecordingResult: (recordingResult) => set({ recordingResult }),
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),
  setIsUploading: (isUploading) => set({ isUploading }),
  reset: () => set(initialState),
}));
