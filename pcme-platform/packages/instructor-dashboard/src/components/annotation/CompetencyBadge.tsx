interface Props {
  dimension: string;
  label: string;
  selected: boolean;
  onClick: () => void;
  small?: boolean;
}

const DIM_COLORS: Record<string, string> = {
  communication: "bg-blue-900/50 text-blue-300 border-blue-700",
  leadership_teamwork: "bg-purple-900/50 text-purple-300 border-purple-700",
  situation_awareness: "bg-amber-900/50 text-amber-300 border-amber-700",
  problem_solving: "bg-green-900/50 text-green-300 border-green-700",
  workload_management: "bg-red-900/50 text-red-300 border-red-700",
  knowledge_application: "bg-cyan-900/50 text-cyan-300 border-cyan-700",
  flight_path_manual: "bg-orange-900/50 text-orange-300 border-orange-700",
  flight_path_automated: "bg-teal-900/50 text-teal-300 border-teal-700",
  application_of_procedures: "bg-pink-900/50 text-pink-300 border-pink-700",
};

export function CompetencyBadge({
  dimension,
  label,
  selected,
  onClick,
  small,
}: Props) {
  const colors = DIM_COLORS[dimension] ?? "bg-slate-800 text-slate-300 border-slate-600";
  return (
    <button
      className={`border rounded transition-all ${
        small ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"
      } ${selected ? colors : "bg-slate-800/50 text-slate-500 border-slate-700 hover:border-slate-500"}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
