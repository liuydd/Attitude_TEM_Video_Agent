import { eventLogger } from "./EventLogger";

const PREFERRED_MIME = "video/webm;codecs=vp9,opus";
const FALLBACK_MIMES = [
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9",
  "video/webm",
];

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  trackType: "camera" | "microphone";
}

/**
 * MediaRecorderManager - 音视频录制管理
 *
 * 使用原生 MediaRecorder API，锁定高码率 WebM 格式
 * timeslice=1000ms 防内存堆积
 */
export class MediaRecorderManager {
  private _mediaRecorder: MediaRecorder | null = null;
  private _chunks: Blob[] = [];
  private _stream: MediaStream | null = null;
  private _mimeType: string = "";

  /** 检测支持的 MIME type */
  static getSupportedMime(): string | null {
    if (typeof MediaRecorder === "undefined") return null;
    if (MediaRecorder.isTypeSupported(PREFERRED_MIME)) return PREFERRED_MIME;
    for (const mime of FALLBACK_MIMES) {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    }
    return null;
  }

  /** 获取摄像头+麦克风流 */
  async requestMedia(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 48000,
      },
    });
    this._stream = stream;
    return stream;
  }

  /** 开始录制 */
  start(): void {
    if (!this._stream) {
      throw new Error("No media stream. Call requestMedia() first.");
    }

    const mime = MediaRecorderManager.getSupportedMime();
    if (!mime) {
      throw new Error("No supported MediaRecorder MIME type found.");
    }
    this._mimeType = mime;
    this._chunks = [];

    this._mediaRecorder = new MediaRecorder(this._stream, {
      mimeType: mime,
      videoBitsPerSecond: 8_000_000, // 8Mbps
      audioBitsPerSecond: 256_000,   // 256kbps
    });

    this._mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this._chunks.push(e.data);
      }
    };

    this._mediaRecorder.onerror = (e) => {
      console.error("MediaRecorder error:", e);
      eventLogger.log("recording_error", { error: String(e) }, "media_recorder");
    };

    // timeslice=1000ms: 每秒回调一次防止内存堆积
    this._mediaRecorder.start(1000);

    eventLogger.log("recording_start", { mimeType: mime }, "media_recorder");
  }

  /** 停止录制，返回录制结果 */
  async stop(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this._mediaRecorder || this._mediaRecorder.state === "inactive") {
        reject(new Error("MediaRecorder is not recording."));
        return;
      }

      this._mediaRecorder.onstop = () => {
        const blob = new Blob(this._chunks, { type: this._mimeType });
        eventLogger.log(
          "recording_stop",
          { sizeBytes: blob.size, mimeType: this._mimeType },
          "media_recorder"
        );
        resolve({
          blob,
          mimeType: this._mimeType,
          trackType: "camera",
        });
      };

      this._mediaRecorder.stop();
    });
  }

  /** 释放所有媒体资源 */
  release(): void {
    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
      this._stream = null;
    }
    this._mediaRecorder = null;
    this._chunks = [];
  }

  get isRecording(): boolean {
    return this._mediaRecorder?.state === "recording";
  }

  get stream(): MediaStream | null {
    return this._stream;
  }
}
