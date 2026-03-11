/**
 * AudioPlaybackManager — plays PCM 24kHz 16-bit LE mono audio chunks in sequence.
 *
 * Pre-schedules AudioBuffers on arrival using precise timing (_nextStartTime)
 * to eliminate gaps between chunks. Web Audio's hardware scheduler guarantees
 * sample-accurate playback without relying on JS event loop timing.
 */

export class AudioPlaybackManager {
  private _audioContext: AudioContext | null = null;
  private _scheduledCount = 0;
  private _nextStartTime = 0;
  private _interrupted = false;

  onPlaybackEnd: (() => void) | null = null;

  init(): void {
    if (!this._audioContext) {
      this._audioContext = new AudioContext();
    }
  }

  enqueue(pcmArrayBuffer: ArrayBuffer): void {
    if (this._interrupted) return;
    if (!this._audioContext) this.init();
    const ctx = this._audioContext!;

    // Convert Int16 LE → Float32
    const int16 = new Int16Array(pcmArrayBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    // Create buffer at source sample rate — browser resamples to hardware rate
    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    // Schedule immediately with precise timing — no waiting for onended
    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.01, this._nextStartTime); // 10ms min lead time
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(startAt);
    this._nextStartTime = startAt + audioBuffer.duration;

    this._scheduledCount++;
    source.onended = () => {
      this._scheduledCount--;
      if (this._scheduledCount === 0 && !this._interrupted) {
        this._nextStartTime = 0;
        this.onPlaybackEnd?.();
      }
    };
  }

  interrupt(): void {
    this._interrupted = true;
    if (this._audioContext) {
      // Close and recreate context to stop all scheduled sources instantly
      this._audioContext.close();
      this._audioContext = null;
    }
    this._scheduledCount = 0;
    this._nextStartTime = 0;
    // Reinit for future use
    this._interrupted = false;
    this.init();
  }

  get isPlaying(): boolean {
    return this._scheduledCount > 0;
  }

  destroy(): void {
    this._interrupted = true;
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
    this._scheduledCount = 0;
    this._nextStartTime = 0;
  }
}
