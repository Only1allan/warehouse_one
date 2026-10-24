import { describe, expect, it } from "vitest";
import { encodeWav } from "@/lib/audio-wav";

describe("encodeWav", () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 2, -2]);
  const wav = encodeWav(samples, 16000);
  const view = new DataView(wav);
  const text = (o: number, n: number) => String.fromCharCode(...new Uint8Array(wav, o, n));

  it("writes a valid 16 kHz mono 16-bit PCM header", () => {
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(text(12, 4)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36, 4)).toBe("data");
  });

  it("sizes the file from the number of samples", () => {
    expect(wav.byteLength).toBe(44 + samples.length * 2);
    expect(view.getUint32(40, true)).toBe(samples.length * 2);
    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2);
  });

  it("converts samples to 16-bit and clips anything outside the range", () => {
    const pcm = (i: number) => view.getInt16(44 + i * 2, true);
    expect(pcm(0)).toBe(0);
    expect(pcm(1)).toBe(16383);
    expect(pcm(2)).toBe(-16384);
    expect(pcm(3)).toBe(32767);
    expect(pcm(4)).toBe(-32768);
    expect(pcm(5)).toBe(32767);
    expect(pcm(6)).toBe(-32768);
  });
});
