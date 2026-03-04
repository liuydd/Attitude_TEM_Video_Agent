import { eventLogger } from "@/core/EventLogger";
import { Radio } from "lucide-react";

/**
 * PhysioSyncButton - 生理采集同步按钮
 *
 * 按下时在事件日志中打点，用于后续对齐 HRV 等生理数据
 */
export function PhysioSyncButton() {
  const handleSync = () => {
    eventLogger.log("physio_sync", { action: "button_press" }, "physio_sync");
  };

  return (
    <button
      onClick={handleSync}
      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
    >
      <Radio className="w-4 h-4" />
      生理同步打点
    </button>
  );
}
