import { create } from "zustand";
import { api } from "@/types/api";
import type { SessionListItem } from "@/types/session";

interface SessionListState {
  items: SessionListItem[];
  loading: boolean;
  error: string | null;
  // Filters
  experimentId: string;
  status: string;
  hasEvaluation: string; // "" | "true" | "false"
  // Actions
  setFilter: (key: "experimentId" | "status" | "hasEvaluation", value: string) => void;
  fetchSessions: () => Promise<void>;
}

export const useSessionListStore = create<SessionListState>((set, get) => ({
  items: [],
  loading: false,
  error: null,
  experimentId: "",
  status: "",
  hasEvaluation: "",

  setFilter: (key, value) => {
    set({ [key]: value });
    get().fetchSessions();
  },

  fetchSessions: async () => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      const { experimentId, status, hasEvaluation } = get();
      if (experimentId) params.set("experiment_id", experimentId);
      if (status) params.set("status", status);
      if (hasEvaluation) params.set("has_evaluation", hasEvaluation);

      const items = await api
        .get("instructor/sessions", { searchParams: params })
        .json<SessionListItem[]>();
      set({ items, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
