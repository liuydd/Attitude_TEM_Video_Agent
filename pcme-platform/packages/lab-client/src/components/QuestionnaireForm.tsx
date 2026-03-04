import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// NASA-TLX 6维度量表
const NASA_TLX_DIMENSIONS = [
  { key: "mental_demand", label: "脑力需求", desc: "任务在心理上有多大难度？（思考、决策、计算、记忆等）" },
  { key: "physical_demand", label: "体力需求", desc: "任务在体力上有多大要求？" },
  { key: "temporal_demand", label: "时间压力", desc: "你感受到多大的时间压力？" },
  { key: "performance", label: "绩效表现", desc: "你认为自己在任务中的表现如何？" },
  { key: "effort", label: "努力程度", desc: "你在任务中需要付出多大努力？" },
  { key: "frustration", label: "挫败感", desc: "你在任务过程中感到多大程度的沮丧或焦虑？" },
] as const;

const schema = z.object(
  Object.fromEntries(
    NASA_TLX_DIMENSIONS.map((d) => [d.key, z.number().min(0).max(100)])
  ) as Record<string, z.ZodNumber>
);

type NasaTlxForm = z.infer<typeof schema>;

interface QuestionnaireFormProps {
  onSubmit: (answers: NasaTlxForm) => void;
  isSubmitting?: boolean;
}

export function QuestionnaireForm({ onSubmit, isSubmitting }: QuestionnaireFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NasaTlxForm>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      NASA_TLX_DIMENSIONS.map((d) => [d.key, 50])
    ) as NasaTlxForm,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <h2 className="text-xl font-bold text-gray-100">NASA-TLX 主观工作负荷评估</h2>
      <p className="text-gray-400 text-sm">
        请根据你刚才的实验体验，在每个维度上拖动滑块评分（0 = 非常低, 100 = 非常高）
      </p>

      {NASA_TLX_DIMENSIONS.map((dim) => (
        <div key={dim.key} className="space-y-2">
          <div className="flex justify-between items-baseline">
            <label className="text-sm font-medium text-gray-200">
              {dim.label}
            </label>
            {errors[dim.key] && (
              <span className="text-red-400 text-xs">请输入有效数值</span>
            )}
          </div>
          <p className="text-xs text-gray-400">{dim.desc}</p>
          <Controller
            name={dim.key as keyof NasaTlxForm}
            control={control}
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-6">0</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xs text-gray-500 w-6">100</span>
                <span className="text-sm font-mono text-blue-400 w-8 text-right">
                  {field.value}
                </span>
              </div>
            )}
          />
        </div>
      ))}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
      >
        {isSubmitting ? "提交中..." : "提交问卷"}
      </button>
    </form>
  );
}
