/**
 * AudioPlaybackManager — plays PCM 24kHz 16-bit LE mono audio chunks in sequence.
 *
 * Queues AudioBuffers and plays them back-to-back for seamless TTS playback.
 */

export class AudioPlaybackManager {
  private _audioContext: AudioContext | null = null;
  private _queue: AudioBuffer[] = [];
  private _currentSource: AudioBufferSourceNode | null = null;
  private _isPlaying = false;
  private _nextStartTime = 0;

  onPlaybackEnd: (() => void) | null = null;

  init(): void {
    if (!this._audioContext) {
      this._audioContext = new AudioContext({ sampleRate: 24000 });
    }
  }

  enqueue(pcmArrayBuffer: ArrayBuffer): void {
    if (!this._audioContext) this.init();
    const ctx = this._audioContext!;

    // Convert Int16 LE → Float32
    const int16 = new Int16Array(pcmArrayBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    this._queue.push(audioBuffer);
    if (!this._isPlaying) {
      this._playNext();
    }
  }

  interrupt(): void {
    this._queue = [];
    if (this._currentSource) {
      try {
        this._currentSource.stop();
      } catch {
        // already stopped
      }
      this._currentSource = null;
    }
    this._isPlaying = false;
    this._nextStartTime = 0;
  }

  private _playNext(): void {
    if (!this._audioContext || this._queue.length === 0) {
      this._isPlaying = false;
      this._nextStartTime = 0;
      this.onPlaybackEnd?.();
      return;
    }

    this._isPlaying = true;
    const ctx = this._audioContext;
    const buffer = this._queue.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, this._nextStartTime);
    source.start(startAt);
    this._nextStartTime = startAt + buffer.duration;

    this._currentSource = source;
    source.onended = () => {
      if (this._currentSource === source) {
        this._currentSource = null;
      }
      this._playNext();
    };
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  destroy(): void {
    this.interrupt();
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
  }
}
