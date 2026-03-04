import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

interface Props {
  answers: Record<string, number>;
}

const NASA_TLX_LABELS: Record<string, string> = {
  mental_demand: "Mental",
  physical_demand: "Physical",
  temporal_demand: "Temporal",
  performance: "Performance",
  effort: "Effort",
  frustration: "Frustration",
};

export function NasaTlxRadar({ answers }: Props) {
  const data = Object.entries(NASA_TLX_LABELS).map(([key, label]) => ({
    dimension: label,
    value: answers[key] ?? 0,
  }));

  return (
    <div className="bg-slate-800/60 rounded p-3">
      <div className="text-xs text-slate-400 mb-2">NASA-TLX Workload</div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fontSize: 10, fill: "#94a3b8" }}
            />
            <PolarRadiusAxis
              domain={[0, 100]}
              tick={{ fontSize: 8, fill: "#64748b" }}
              axisLine={false}
            />
            <Radar
              dataKey="value"
              stroke="#60a5fa"
              fill="#60a5fa"
              fillOpacity={0.25}
              strokeWidth={1.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
