import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useReviewStore } from "@/stores/reviewStore";
import type { ExperimentEvent, PhysioData } from "@/types/session";

/** Predefined color map for known channel keys */
const CHANNEL_COLORS: Record<string, string> = {
  hr: "#f87171",
  scl: "#34d399",
  acc: "#60a5fa",
  resp: "#fbbf24",
  rmssd: "#c084fc",
  lf_hf: "#fb923c",
  scr_count: "#2dd4bf",
  gyro: "#818cf8",
};

interface Props {
  events: ExperimentEvent[];
  anchorMs: number | null;
  currentTime: number;
  physio?: PhysioData | null;
}

interface ChartChannel {
  key: string;
  label: string;
  unit: string;
  color: string;
  data: { time: number; value: number }[];
}

/**
 * Fallback: extract physio from event log (legacy physio_sync events).
 */
function buildChannelsFromEvents(
  events: ExperimentEvent[],
  anchorMs: number | null
): ChartChannel[] {
  if (anchorMs == null) return [];

  const channelMap = new Map<string, { time: number; value: number }[]>();

  for (const e of events) {
    if (e.event_type !== "physio_sync") continue;
    const time = Math.round(((e.ts_abs - anchorMs) / 1000) * 10) / 10;
    const payload = e.payload ?? {};

    if (typeof payload["channel"] === "string" && typeof payload["value"] === "number") {
      const ch = payload["channel"] as string;
      if (!channelMap.has(ch)) channelMap.set(ch, []);
      channelMap.get(ch)!.push({ time, value: payload["value"] as number });
    } else {
      for (const [k, v] of Object.entries(payload)) {
        if (typeof v === "number" && k !== "ts" && k !== "seq") {
          if (!channelMap.has(k)) channelMap.set(k, []);
          channelMap.get(k)!.push({ time, value: v });
        }
      }
    }
  }

  return Array.from(channelMap.entries()).map(([key, data]) => ({
    key,
    label: key,
    unit: "",
    color: CHANNEL_COLORS[key] ?? "#94a3b8",
    data: data.sort((a, b) => a.time - b.time),
  }));
}

/**
 * Convert backend PhysioData into chart channels.
 */
function buildChannelsFromPhysioData(physio: PhysioData): ChartChannel[] {
  return physio.channels.map((ch) => ({
    key: ch.key,
    label: ch.label,
    unit: ch.unit,
    color: CHANNEL_COLORS[ch.key] ?? "#94a3b8",
    data: ch.data.map((p) => ({ time: p.time, value: p.value })),
  }));
}

export function PhysioChart({ events, anchorMs, currentTime, physio }: Props) {
  const { duration } = useReviewStore();
  const [collapsed, setCollapsed] = useState(false);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const channels = useMemo(() => {
    // Prefer structured physio data from backend CSV parsing
    if (physio?.has_data && physio.channels.length > 0) {
      return buildChannelsFromPhysioData(physio);
    }
    // Fallback to event log physio_sync events
    return buildChannelsFromEvents(events, anchorMs);
  }, [physio, events, anchorMs]);

  const visibleChannels = useMemo(
    () => channels.filter((ch) => !hiddenKeys.has(ch.key)),
    [channels, hiddenKeys]
  );

  const toggleChannel = (key: string) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // No data — show placeholder
  if (channels.length === 0) {
    return (
      <div>
        <div className="text-xs text-slate-400 mb-1 flex items-center gap-2">
          生理特征数据
          <span className="text-slate-600 text-[10px]">(Physiological Signals)</span>
        </div>
        <div className="bg-slate-800/60 border border-dashed border-slate-700 rounded p-4 h-36 flex flex-col items-center justify-center gap-2">
          <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l4.5-4.5 3.75 3.75 4.5-6 3.75 3.75" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 17.25h16.5" />
          </svg>
          <div className="text-xs text-slate-500 text-center">
            暂无生理特征数据
            <br />
            <span className="text-slate-600 text-[10px]">
              请将手环导出的 CSV 文件放入对应 session 的 physio_data 文件夹
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs text-slate-400 mb-1 flex items-center gap-2">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1 hover:text-slate-300 transition-colors"
        >
          <svg
            className={`w-3 h-3 transition-transform ${collapsed ? "" : "rotate-90"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          生理特征数据
        </button>
        <span className="text-slate-600 text-[10px]">(Physiological Signals)</span>

        {/* Channel toggle chips */}
        <div className="flex gap-1.5 ml-auto flex-wrap">
          {channels.map((ch) => {
            const hidden = hiddenKeys.has(ch.key);
            return (
              <button
                key={ch.key}
                onClick={() => toggleChannel(ch.key)}
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all ${
                  hidden
                    ? "opacity-40 line-through hover:opacity-60"
                    : "opacity-100 hover:bg-slate-700/50"
                }`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: hidden ? "#475569" : ch.color }}
                />
                {ch.label}
              </button>
            );
          })}
        </div>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-1">
          {visibleChannels.length === 0 ? (
            <div className="bg-slate-800/60 rounded p-3 text-center text-xs text-slate-500">
              所有通道已隐藏，点击上方标签可重新显示
            </div>
          ) : (
            visibleChannels.map((ch) => (
              <SingleChannelChart
                key={ch.key}
                channel={ch}
                currentTime={currentTime}
                duration={duration}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SingleChannelChart({
  channel,
  currentTime,
  duration,
}: {
  channel: ChartChannel;
  currentTime: number;
  duration: number;
}) {
  const xDomain = duration > 0 ? [0, duration] : undefined;

  return (
    <div className="bg-slate-800 rounded p-2 h-28">
      <div className="text-[10px] text-slate-500 mb-0.5 pl-1">
        {channel.label} {channel.unit && `(${channel.unit})`}
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={channel.data}>
          <XAxis
            dataKey="time"
            domain={xDomain}
            tick={{ fontSize: 9, fill: "#64748b" }}
            tickFormatter={(v: number) => `${v.toFixed(0)}s`}
            type="number"
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#64748b" }}
            width={36}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #334155",
              fontSize: 11,
              borderRadius: 4,
            }}
            formatter={(value: number) => [
              `${value.toFixed(2)} ${channel.unit}`,
              channel.label,
            ]}
            labelFormatter={(label: number) => `${label.toFixed(1)}s`}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={channel.color}
            dot={false}
            strokeWidth={1.5}
            connectNulls
          />
          <ReferenceLine
            x={currentTime}
            stroke="#ef4444"
            strokeWidth={1}
            strokeDasharray="3 2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
