import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionListStore } from "@/stores/sessionListStore";
import { ClipboardCheck, Clock, Users } from "lucide-react";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const STATUS_LABELS: Record<string, string> = {
  created: "已创建",
  started: "进行中",
  recording: "录制中",
  questionnaire: "问卷中",
  uploading: "上传中",
  completed: "已完成",
  aborted: "已中止",
};

const GROUP_LABELS: Record<string, string> = {
  experimental: "实验组",
  control: "控制组",
};

export function SessionList() {
  const {
    items,
    loading,
    experimentId,
    status,
    hasEvaluation,
    setFilter,
    fetchSessions,
  } = useSessionListStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardCheck className="w-7 h-7 text-blue-400" />
          教官评估工作台
        </h1>
        <p className="text-slate-400 mt-1">浏览实验会话，进行胜任力评估与标注</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <select
          className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="">全部状态</option>
          <option value="completed">已完成</option>
          <option value="recording">录制中</option>
          <option value="aborted">已中止</option>
        </select>
        <select
          className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
          value={hasEvaluation}
          onChange={(e) => setFilter("hasEvaluation", e.target.value)}
        >
          <option value="">全部评估状态</option>
          <option value="false">未评估</option>
          <option value="true">已评估</option>
        </select>
        {experimentId && (
          <button
            className="text-sm text-blue-400 hover:text-blue-300"
            onClick={() => setFilter("experimentId", "")}
          >
            清除实验筛选
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center text-slate-400 py-20">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-center text-slate-500 py-20">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          暂无会话数据
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="text-left py-3 px-4">实验名称</th>
                <th className="text-left py-3 px-4">被试</th>
                <th className="text-left py-3 px-4">组别</th>
                <th className="text-left py-3 px-4">状态</th>
                <th className="text-left py-3 px-4">时长</th>
                <th className="text-left py-3 px-4">评估</th>
                <th className="text-left py-3 px-4">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/review/${s.id}`)}
                >
                  <td className="py-3 px-4 font-medium">{s.experiment_name}</td>
                  <td className="py-3 px-4">{s.participant_name}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        s.group_type === "experimental"
                          ? "bg-purple-900/50 text-purple-300"
                          : "bg-teal-900/50 text-teal-300"
                      }`}
                    >
                      {GROUP_LABELS[s.group_type] ?? s.group_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        s.status === "completed"
                          ? "bg-green-900/50 text-green-300"
                          : s.status === "aborted"
                            ? "bg-red-900/50 text-red-300"
                            : "bg-yellow-900/50 text-yellow-300"
                      }`}
                    >
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatDuration(s.duration_seconds)}
                  </td>
                  <td className="py-3 px-4">
                    {s.has_evaluation ? (
                      <span className="text-green-400 text-xs">已评估</span>
                    ) : (
                      <span className="text-slate-500 text-xs">待评估</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs">
                    {new Date(s.created_at).toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
