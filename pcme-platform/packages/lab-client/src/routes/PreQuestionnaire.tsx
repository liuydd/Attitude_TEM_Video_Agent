import { useNavigate } from "react-router-dom";
import { AttitudeQuestionnaire } from "@/components/AttitudeQuestionnaire";
import { eventLogger } from "@/core/EventLogger";
import { useExperimentStore } from "@/stores/experimentStore";
import { api } from "@/types/api";

export function PreQuestionnaire() {
  const navigate = useNavigate();
  const { session } = useExperimentStore();
  if (!session) { navigate("/"); return null; }
  return <div className="min-h-screen bg-gray-950 text-gray-100 p-6"><div className="mx-auto max-w-3xl rounded-lg bg-gray-900 p-6"><AttitudeQuestionnaire title="实验前：您对 AI 助手的整体评价" overall onSubmit={async (answers) => { await api.post(`sessions/${session.id}/questionnaires`, { json: { questionnaire_type: "pre_ai_overall_attitude", answers } }); eventLogger.log("questionnaire_submit", { questionnaire_type: "pre_ai_overall_attitude" }, "questionnaire"); navigate("/session"); }} /></div></div>;
}
