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
  group_type: z.enum(["control", "experimental"]),
  training_video_filename: z.string().min(1, "请输入视频文件名"),
});

const participantSchema = z.object({
  student_id: z.string().min(1, "学号不能为空"),
  name: z.string().min(1, "姓名不能为空"),
  age: z.coerce.number().int().positive().optional(),
  gender: z.string().optional(),
  flight_hours: z.coerce.number().nonnegative().optional(),
});

type ExperimentForm = z.infer<typeof experimentSchema>;
type ParticipantForm = z.infer<typeof participantSchema>;

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
      group_type: "control",
      training_video_filename: "",
    },
  });

  const partForm = useForm<ParticipantForm>({
    resolver: zodResolver(participantSchema),
    defaultValues: { student_id: "", name: "", gender: "" },
  });

  const onCreateExperiment = async (data: ExperimentForm) => {
    try {
      setError(null);
      const exp = await api.post("experiments", { json: data }).json<Experiment>();
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
        throw new Error("被试注册失败，请检查学号是否重复");
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

      navigate("/session");
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
              <label className="block text-sm mb-1">实验组别</label>
              <select
                {...expForm.register("group_type")}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              >
                <option value="control">对照组（人人讨论）</option>
                <option value="experimental">实验组（人机交互）</option>
              </select>
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
              <label className="block text-sm mb-1">学号</label>
              <input
                {...partForm.register("student_id")}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">姓名</label>
              <input
                {...partForm.register("name")}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
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
              <div>
                <label className="block text-sm mb-1">飞行小时</label>
                <input
                  type="number"
                  step="0.1"
                  {...partForm.register("flight_hours")}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                />
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
