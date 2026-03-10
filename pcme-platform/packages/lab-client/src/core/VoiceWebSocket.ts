/**
 * VoiceWebSocket — manages WebSocket connection for voice agent communication.
 *
 * Distinguishes binary frames (TTS audio) from text frames (JSON control messages).
 * Includes exponential backoff reconnection (max 5 attempts).
 */

import type { ServerMessage } from "@/types/voice";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY = 1000;

export class VoiceWebSocket {
  private _ws: WebSocket | null = null;
  private _reconnectAttempts = 0;
  private _sessionId: string = "";
  private _shouldReconnect = false;

  onTextMessage: ((msg: ServerMessage) => void) | null = null;
  onBinaryMessage: ((data: ArrayBuffer) => void) | null = null;
  onStatusChange: ((status: ConnectionStatus) => void) | null = null;

  connect(sessionId: string): void {
    this._sessionId = sessionId;
    this._shouldReconnect = true;
    this._reconnectAttempts = 0;
    this._doConnect();
  }

  private _doConnect(): void {
    this.onStatusChange?.("connecting");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/voice-agent/${this._sessionId}`;
    this._ws = new WebSocket(url);
    this._ws.binaryType = "arraybuffer";

    this._ws.onopen = () => {
      this._reconnectAttempts = 0;
      this.onStatusChange?.("connected");
    };

    this._ws.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        this.onBinaryMessage?.(event.data);
      } else if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data) as ServerMessage;
          this.onTextMessage?.(msg);
        } catch {
          console.warn("Invalid JSON from voice WS:", event.data);
        }
      }
    };

    this._ws.onclose = () => {
      this.onStatusChange?.("disconnected");
      this._maybeReconnect();
    };

    this._ws.onerror = () => {
      this.onStatusChange?.("error");
    };
  }

  private _maybeReconnect(): void {
    if (!this._shouldReconnect) return;
    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.onStatusChange?.("error");
      return;
    }
    const delay = BASE_RECONNECT_DELAY * Math.pow(2, this._reconnectAttempts);
    this._reconnectAttempts++;
    setTimeout(() => {
      if (this._shouldReconnect) {
        this._doConnect();
      }
    }, delay);
  }

  sendAudio(pcmArrayBuffer: ArrayBuffer): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(pcmArrayBuffer);
    }
  }

  sendInterrupt(): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "interrupt" }));
    }
  }

  sendVideoTime(timeSec: number): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "video_time", time: timeSec }));
    }
  }

  sendSpeaker(speaker: number): void {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({ type: "set_speaker", speaker }));
    }
  }

  close(): void {
    this._shouldReconnect = false;
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.close();
      this._ws = null;
    }
    this.onStatusChange?.("idle");
  }

  get readyState(): number {
    return this._ws?.readyState ?? WebSocket.CLOSED;
  }
}
