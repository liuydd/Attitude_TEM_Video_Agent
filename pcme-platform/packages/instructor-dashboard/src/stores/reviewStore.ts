import { create } from "zustand";
import { api } from "@/types/api";
import type { SessionDetail } from "@/types/session";
import type { Annotation, DimensionScore, Evaluation } from "@/types/evaluation";

interface ReviewState {
  session: SessionDetail | null;
  loading: boolean;
  error: string | null;

  // Playback
  currentTime: number;
  duration: number;
  playing: boolean;
  playbackRate: number;

  // Annotation draft
  draftStart: number | null;
  draftEnd: number | null;

  // Actions
  fetchSession: (id: string) => Promise<void>;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setPlaying: (p: boolean) => void;
  setPlaybackRate: (r: number) => void;
  setDraft: (start: number | null, end: number | null) => void;

  // Evaluation API
  saveEvaluation: (body: {
    instructor_name: string;
    dimension_scores: Record<string, DimensionScore>;
    overall_comment: string;
  }) => Promise<void>;
  addAnnotation: (body: {
    start_time: number;
    end_time: number;
    competencies: string[];
    rating: number;
    comment: string;
  }) => Promise<void>;
  updateAnnotation: (
    annId: string,
    body: Partial<Annotation>
  ) => Promise<void>;
  deleteAnnotation: (annId: string) => Promise<void>;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  session: null,
  loading: false,
  error: null,
  currentTime: 0,
  duration: 0,
  playing: false,
  playbackRate: 1,
  draftStart: null,
  draftEnd: null,

  fetchSession: async (id) => {
    set({ loading: true, error: null });
    try {
      const session = await api
        .get(`instructor/sessions/${id}`)
        .json<SessionDetail>();
      set({ session, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setPlaying: (p) => set({ playing: p }),
  setPlaybackRate: (r) => set({ playbackRate: r }),
  setDraft: (start, end) => set({ draftStart: start, draftEnd: end }),

  saveEvaluation: async (body) => {
    const sid = get().session?.id;
    if (!sid) return;
    const evaluation = await api
      .put(`instructor/sessions/${sid}/evaluation`, { json: body })
      .json<Evaluation>();
    set((s) => ({
      session: s.session ? { ...s.session, evaluation } : null,
    }));
  },

  addAnnotation: async (body) => {
    const sid = get().session?.id;
    if (!sid) return;
    const ann = await api
      .post(`instructor/sessions/${sid}/annotations`, { json: body })
      .json<Annotation>();
    set((s) => {
      if (!s.session) return s;
      const evaluation = s.session.evaluation ?? {
        session_id: sid,
        instructor_name: "",
        created_at: "",
        updated_at: "",
        annotations: [],
        dimension_scores: {},
        overall_comment: "",
      };
      return {
        session: {
          ...s.session,
          evaluation: {
            ...evaluation,
            annotations: [...evaluation.annotations, ann],
          },
        },
        draftStart: null,
        draftEnd: null,
      };
    });
  },

  updateAnnotation: async (annId, body) => {
    const sid = get().session?.id;
    if (!sid) return;
    const updated = await api
      .patch(`instructor/sessions/${sid}/annotations/${annId}`, { json: body })
      .json<Annotation>();
    set((s) => {
      if (!s.session?.evaluation) return s;
      return {
        session: {
          ...s.session,
          evaluation: {
            ...s.session.evaluation,
            annotations: s.session.evaluation.annotations.map((a) =>
              a.id === annId ? updated : a
            ),
          },
        },
      };
    });
  },

  deleteAnnotation: async (annId) => {
    const sid = get().session?.id;
    if (!sid) return;
    await api.delete(`instructor/sessions/${sid}/annotations/${annId}`);
    set((s) => {
      if (!s.session?.evaluation) return s;
      return {
        session: {
          ...s.session,
          evaluation: {
            ...s.session.evaluation,
            annotations: s.session.evaluation.annotations.filter(
              (a) => a.id !== annId
            ),
          },
        },
      };
    });
  },
}));
