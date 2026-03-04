import type { ExperimentEvent, EventType } from "@/types/event";
import { timeAnchor } from "./TimeAnchor";

const LOCAL_STORAGE_KEY = "pcme_event_buffer";
const FLUSH_THRESHOLD = 50;

/**
 * EventLogger - 事件记录器
 *
 * 在内存中累积事件，每 FLUSH_THRESHOLD 条写入 localStorage 兜底
 * 实验结束后调用 flush() 批量上传到服务器
 */
export class EventLogger {
  private _events: ExperimentEvent[] = [];
  private _seq = 0;
  private _videoTimeGetter: () => number = () => 0;

  /** 设置获取视频当前时间的回调 */
  setVideoTimeGetter(getter: () => number): void {
    this._videoTimeGetter = getter;
  }

  /** 记录一条事件 */
  log(
    eventType: EventType | string,
    payload: Record<string, unknown>,
    source: string
  ): ExperimentEvent {
    this._seq += 1;
    const event: ExperimentEvent = {
      seq: this._seq,
      ts_abs: timeAnchor.now(),
      ts_video: this._videoTimeGetter(),
      event_type: eventType,
      payload,
      source,
    };
    this._events.push(event);

    // 每 FLUSH_THRESHOLD 条写入 localStorage 兜底
    if (this._events.length % FLUSH_THRESHOLD === 0) {
      this._saveToLocalStorage();
    }

    return event;
  }

  /** 获取所有缓存事件（用于上传） */
  getEvents(): ExperimentEvent[] {
    return [...this._events];
  }

  /** 获取事件数量 */
  get count(): number {
    return this._events.length;
  }

  /** 清空缓存并移除 localStorage 兜底 */
  clear(): void {
    this._events = [];
    this._seq = 0;
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  /** 从 localStorage 恢复（应用启动时调用，防崩溃恢复） */
  recover(): ExperimentEvent[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const recovered = JSON.parse(stored) as ExperimentEvent[];
        return recovered;
      }
    } catch {
      // ignore
    }
    return [];
  }

  private _saveToLocalStorage(): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this._events));
    } catch {
      console.warn("Failed to save events to localStorage");
    }
  }
}

export const eventLogger = new EventLogger();
