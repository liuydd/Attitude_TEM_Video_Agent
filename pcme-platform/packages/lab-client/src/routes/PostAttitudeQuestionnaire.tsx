import { useNavigate } from "react-router-dom";
import { AttitudeQuestionnaire } from "@/components/AttitudeQuestionnaire";
import { eventLogger } from "@/core/EventLogger";
import { useExperimentStore } from "@/stores/experimentStore";
import { api } from "@/types/api";

export function PostAttitudeQuestionnaire() {
  const navigate = useNavigate();
  const { session } = useExperimentStore();
  if (!session) { navigate("/"); return null; }
  return <div className="min-h-screen bg-gray-950 text-gray-100 p-6"><div className="mx-auto max-w-3xl rounded-lg bg-gray-900 p-6"><AttitudeQuestionnaire title="实验后：AI 整体态度与态度变化" overall extraItems={["与实验开始前相比，我现在对该 AI 助手的总体评价更加积极。", "与实验开始前相比，我现在更愿意在飞行训练中使用该 AI 助手。"]} onSubmit={async (answers) => { await api.post(`sessions/${session.id}/questionnaires`, { json: { questionnaire_type: "post_ai_overall_attitude_and_change", answers } }); eventLogger.log("questionnaire_submit", { questionnaire_type: "post_ai_overall_attitude_and_change" }, "questionnaire"); navigate("/questionnaire"); }} /></div></div>;
}
