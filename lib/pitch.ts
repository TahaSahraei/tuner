export type PitchReading = {
  frequency: number;
  midi: number;
  cents: number;
};

export const MIN_DETECTABLE_RMS = 0.002;

const MIN_FREQUENCY = 80;
const MAX_FREQUENCY = 1400;
const YIN_THRESHOLD = 0.2;

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export function frequencyForNote(midi: number, concertPitch = 440) {
  return concertPitch * 2 ** ((midi - 69) / 12);
}

export function pitchFromFrequency(frequency: number, concertPitch = 440): PitchReading {
  const midiFloat = 69 + 12 * Math.log2(frequency / concertPitch);
  const midi = Math.round(midiFloat);
  return {
    frequency,
    midi,
    cents: 1200 * Math.log2(frequency / frequencyForNote(midi, concertPitch)),
  };
}

export function noteLabel(midi: number) {
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

/** YIN pitch detector tuned for the Santour's range. */
export function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  let sum = 0;
  let sumSquares = 0;
  for (const sample of buffer) {
    sum += sample;
    sumSquares += sample * sample;
  }
  const mean = sum / buffer.length;
  const rms = Math.sqrt(Math.max(0, sumSquares / buffer.length - mean * mean));
  if (rms < MIN_DETECTABLE_RMS) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_FREQUENCY));
  const maxLag = Math.min(Math.floor(sampleRate / MIN_FREQUENCY), Math.floor(buffer.length / 2));
  const difference = new Float32Array(maxLag + 1);

  for (let lag = 1; lag <= maxLag; lag += 1) {
    let deltaSum = 0;
    const limit = buffer.length - lag;
    for (let index = 0; index < limit; index += 1) {
      const delta = buffer[index] - buffer[index + lag];
      deltaSum += delta * delta;
    }
    difference[lag] = deltaSum;
  }

  const normalized = new Float32Array(maxLag + 1);
  normalized[0] = 1;
  let cumulative = 0;
  for (let lag = 1; lag <= maxLag; lag += 1) {
    cumulative += difference[lag];
    normalized[lag] = cumulative === 0 ? 1 : (difference[lag] * lag) / cumulative;
  }

  let bestLag = -1;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if (normalized[lag] < YIN_THRESHOLD) {
      while (lag + 1 <= maxLag && normalized[lag + 1] < normalized[lag]) lag += 1;
      bestLag = lag;
      break;
    }
  }

  if (bestLag < 0) return null;
  const left = normalized[bestLag - 1];
  const center = normalized[bestLag];
  const right = normalized[bestLag + 1] ?? center;
  const denominator = left - 2 * center + right;
  const rawShift = denominator === 0 ? 0 : 0.5 * (left - right) / denominator;
  const shift = Math.max(-1, Math.min(1, rawShift));
  return sampleRate / (bestLag + shift);
}
