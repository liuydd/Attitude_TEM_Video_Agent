/**
 * AudioCaptureManager — captures microphone audio as PCM 16-bit LE 16kHz mono.
 *
 * Uses AudioWorklet for low-latency capture. Emits ~100ms chunks (1600 samples = 3200 bytes).
 */

const WORKLET_CODE = `
class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(0);
    this._chunkSize = 1600; // 100ms at 16kHz
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0];

    // Append to buffer
    const newBuf = new Float32Array(this._buffer.length + channel.length);
    newBuf.set(this._buffer);
    newBuf.set(channel, this._buffer.length);
    this._buffer = newBuf;

    // Emit chunks
    while (this._buffer.length >= this._chunkSize) {
      const chunk = this._buffer.slice(0, this._chunkSize);
      this._buffer = this._buffer.slice(this._chunkSize);
      this.port.postMessage(chunk.buffer, [chunk.buffer]);
    }

    return true;
  }
}

registerProcessor('pcm-capture-processor', PCMCaptureProcessor);
`;

export class AudioCaptureManager {
  private _audioContext: AudioContext | null = null;
  private _stream: MediaStream | null = null;
  private _sourceNode: MediaStreamAudioSourceNode | null = null;
  private _workletNode: AudioWorkletNode | null = null;

  onAudioChunk: ((pcm: ArrayBuffer) => void) | null = null;

  async start(): Promise<void> {
    // Request mic with echo cancellation enabled (prevents TTS feedback)
    this._stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
      },
    });

    this._audioContext = new AudioContext({ sampleRate: 16000 });

    // Load worklet from inline code via Blob URL
    const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    await this._audioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    this._sourceNode = this._audioContext.createMediaStreamSource(this._stream);
    this._workletNode = new AudioWorkletNode(this._audioContext, "pcm-capture-processor");

    this._workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      // Convert Float32 to Int16 LE
      const float32 = new Float32Array(event.data);
      const int16 = float32ToInt16(float32);
      this.onAudioChunk?.(int16.buffer);
    };

    this._sourceNode.connect(this._workletNode);
    this._workletNode.connect(this._audioContext.destination);
  }

  stop(): void {
    if (this._workletNode) {
      this._workletNode.disconnect();
      this._workletNode = null;
    }
    if (this._sourceNode) {
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }
    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
      this._stream = null;
    }
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
  }
}

function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}
