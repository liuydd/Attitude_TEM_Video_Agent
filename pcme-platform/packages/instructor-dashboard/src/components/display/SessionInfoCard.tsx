import type { SessionDetail } from "@/types/session";
import { Clock, Users, FlaskConical } from "lucide-react";

interface Props {
  session: SessionDetail;
}

const GROUP_LABELS: Record<string, string> = {
  experimental: "实验组",
  control: "控制组",
};

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return "--";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (isNaN(ms) || ms < 0) return "--";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SessionInfoCard({ session }: Props) {
  return (
    <div className="flex items-center gap-6 text-sm text-slate-300 flex-wrap">
      <span className="flex items-center gap-1">
        <FlaskConical className="w-4 h-4 text-blue-400" />
        {session.experiment_name}
      </span>
      <span className="flex items-center gap-1">
        <Users className="w-4 h-4 text-blue-400" />
        {session.participant_name}
      </span>
      <span
        className={`px-2 py-0.5 rounded text-xs ${
          session.group_type === "experimental"
            ? "bg-purple-900/50 text-purple-300"
            : "bg-teal-900/50 text-teal-300"
        }`}
      >
        {GROUP_LABELS[session.group_type] ?? session.group_type}
      </span>
      <span className="flex items-center gap-1 text-slate-400">
        <Clock className="w-4 h-4" />
        {formatDuration(session.started_at, session.ended_at)}
      </span>
      <span className="text-slate-500 text-xs">
        {new Date(session.created_at).toLocaleString("zh-CN")}
      </span>
    </div>
  );
}
