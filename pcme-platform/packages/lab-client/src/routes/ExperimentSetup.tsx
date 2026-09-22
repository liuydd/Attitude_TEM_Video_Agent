import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/types/api";
import { useExperimentStore } from "@/stores/experimentStore";
import type { Experiment, Participant, Session } from "@/types/experiment";

const experimentSchema = z.object({
  name: z.string().min(1, "实验名称不能为空"),
  description: z.string().optional(),
  group_type: z.literal("experimental"),
  persona_condition: z.enum([
    "high_warmth_high_competence",
    "low_warmth_high_competence",
    "high_warmth_low_competence",
    "low_warmth_low_competence",
  ]),
  training_video_filename: z.string().min(1, "请输入视频文件名"),
});

const participantSchema = z.object({
  name: z.string().min(1, "姓名不能为空"),
  age: z.coerce.number().int().positive().optional(),
  gender: z.string().optional(),
});

type ExperimentForm = z.infer<typeof experimentSchema>;
type ParticipantForm = z.infer<typeof participantSchema>;

const PERSONA_CONDITIONS = {
  high_warmth_high_competence: { label: "专业且友好的助手", warmth: "high", competence: "high" },
  low_warmth_high_competence: { label: "专业但冷淡的助手", warmth: "low", competence: "high" },
  high_warmth_low_competence: { label: "友好但能力不足的助手", warmth: "high", competence: "low" },
  low_warmth_low_competence: { label: "冷淡且能力不足的助手", warmth: "low", competence: "low" },
} as const;

export function ExperimentSetup() {
  const navigate = useNavigate();
  const { setExperiment, setParticipant, setSession } = useExperimentStore();
  const [step, setStep] = useState<"experiment" | "participant">("experiment");
  const [currentExperiment, setCurrentExperiment] = useState<Experiment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const expForm = useForm<ExperimentForm>({
    resolver: zodResolver(experimentSchema),
    defaultValues: {
      name: "",
      description: "",
      group_type: "experimental",
      persona_condition: "high_warmth_high_competence",
      training_video_filename: "",
    },
  });

  const partForm = useForm<ParticipantForm>({
    resolver: zodResolver(participantSchema),
    defaultValues: { name: "", gender: "" },
  });

  const onCreateExperiment = async (data: ExperimentForm) => {
    try {
      setError(null);
      const { persona_condition, ...experimentData } = data;
      const persona = PERSONA_CONDITIONS[persona_condition];
      const exp = await api.post("experiments", {
        json: {
          ...experimentData,
          config: {
            persona_condition,
            warmth_level: persona.warmth,
            competence_level: persona.competence,
          },
        },
      }).json<Experiment>();
      setCurrentExperiment(exp);
      setExperiment(exp);
      setStep("participant");
    } catch (e) {
      setError(`创建实验失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const onCreateParticipantAndSession = async (data: ParticipantForm) => {
    try {
      setError(null);
      // Create or get participant
      let participant: Participant;
      try {
        participant = await api.post("participants", { json: data }).json<Participant>();
      } catch {
        // If 409 conflict, participant already exists — that's fine for re-use
        // For now, we just re-post and handle gracefully
        throw new Error("被试注册失败，请稍后重试");
      }
      setParticipant(participant);

      // Create session
      const session = await api
        .post("sessions", {
          json: {
            experiment_id: currentExperiment!.id,
            participant_id: participant.id,
          },
        })
        .json<Session>();
      setSession(session);

      navigate("/pre-questionnaire");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-bold text-center">
          飞行学员胜任力实验平台
        </h1>
        <p className="text-gray-400 text-center text-sm">
          {step === "experiment" ? "第 1 步：配置实验" : "第 2 步：录入被试信息"}
        </p>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded">
            {error}
          </div>
        )}

        {step === "experiment" ? (
          <form
            onSubmit={expForm.handleSubmit(onCreateExperiment)}
            className="space-y-4 bg-gray-900 p-6 rounded-lg"
          >
            <div>
              <label className="block text-sm mb-1">实验名称</label>
              <input
                {...expForm.register("name")}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                placeholder="例：TEM讨论实验-批次01"
              />
              {expForm.formState.errors.name && (
                <p className="text-red-400 text-xs mt-1">
                  {expForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm mb-1">实验描述（可选）</label>
              <textarea
                {...expForm.register("description")}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                rows={2}
              />
            </div>


            <div>
              <label className="block text-sm mb-1">AI Persona 条件</label>
              <select
                {...expForm.register("persona_condition")}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              >
                {Object.entries(PERSONA_CONDITIONS).map(([value, persona]) => (
                  <option key={value} value={value}>
                    {persona.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                该条件会固定应用于本次实验中的全部 AI 语音交互。
              </p>
            </div>
            <div>
              <label className="block text-sm mb-1">训练视频文件名</label>
              <input
                {...expForm.register("training_video_filename")}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                placeholder="例：air_crash_ep01.mp4"
              />
              {expForm.formState.errors.training_video_filename && (
                <p className="text-red-400 text-xs mt-1">
                  {expForm.formState.errors.training_video_filename.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
            >
              下一步
            </button>
          </form>
        ) : (
          <form
            onSubmit={partForm.handleSubmit(onCreateParticipantAndSession)}
            className="space-y-4 bg-gray-900 p-6 rounded-lg"
          >

            <div>
              <label className="block text-sm mb-1">姓名</label>
              <input
                {...partForm.register("name")}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1">年龄</label>
                <input
                  type="number"
                  {...partForm.register("age")}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">性别</label>
                <select
                  {...partForm.register("gender")}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                >
                  <option value="">未选择</option>
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </div>

            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep("experiment")}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                返回
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
              >
                开始实验
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
