/**
 * TimeAnchor - 实验时间同步的核心锚点
 *
 * 实验开始瞬间生成 anchor_timestamp_ms = Date.now()
 * 所有后续事件都基于此锚点记录绝对时间 + 视频相对时间
 */
export class TimeAnchor {
  private _anchorMs: number = 0;
  private _started = false;

  /** 初始化锚点（实验开始时调用一次） */
  start(): number {
    if (this._started) {
      console.warn("TimeAnchor already started, returning existing anchor");
      return this._anchorMs;
    }
    this._anchorMs = Date.now();
    this._started = true;
    return this._anchorMs;
  }

  /** 获取锚点的绝对毫秒时间戳 */
  get anchorMs(): number {
    return this._anchorMs;
  }

  get isStarted(): boolean {
    return this._started;
  }

  /** 获取当前的绝对时间戳 */
  now(): number {
    return Date.now();
  }

  /** 获取自锚点以来经过的毫秒数 */
  elapsed(): number {
    if (!this._started) return 0;
    return Date.now() - this._anchorMs;
  }

  /** 重置（通常仅用于测试） */
  reset(): void {
    this._anchorMs = 0;
    this._started = false;
  }
}

export const timeAnchor = new TimeAnchor();
