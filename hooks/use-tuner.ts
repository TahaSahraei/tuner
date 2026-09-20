"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { detectPitch, MIN_DETECTABLE_RMS, pitchFromFrequency, type PitchReading } from "@/lib/pitch";

const NOTE_HOLD_MS = 1000;
const NOTE_SWITCH_CONFIRM_MS = 180;
const FREQUENCY_SMOOTHING = 0.12;

export function useTuner(concertPitch: number) {
  const [isListening, setIsListening] = useState(false);
  const [pitch, setPitch] = useState<PitchReading | null>(null);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const smoothedFrequencyRef = useRef<number | null>(null);
  const displayedMidiRef = useRef<number | null>(null);
  const candidateMidiRef = useRef<number | null>(null);
  const candidateSinceRef = useRef(0);
  const lastDetectedAtRef = useRef(0);
  const concertPitchRef = useRef(concertPitch);

  useEffect(() => {
    concertPitchRef.current = concertPitch;
  }, [concertPitch]);

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();
    frameRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    bufferRef.current = null;
    smoothedFrequencyRef.current = null;
    displayedMidiRef.current = null;
    candidateMidiRef.current = null;
    candidateSinceRef.current = 0;
    lastDetectedAtRef.current = 0;
    setIsListening(false);
    setPitch(null);
    setVolume(0);
  }, []);

  const analyse = useCallback(function analyseFrame() {
    const analyser = analyserRef.current;
    const context = audioContextRef.current;
    const buffer = bufferRef.current;
    if (!analyser || !context || !buffer) return;

    analyser.getFloatTimeDomainData(buffer);
    let sumSquares = 0;
    for (const sample of buffer) sumSquares += sample * sample;
    const rms = Math.sqrt(sumSquares / buffer.length);
    setVolume(rms);

    const now = performance.now();
    let receivedReliablePitch = false;

    if (rms >= MIN_DETECTABLE_RMS) {
      const detected = detectPitch(buffer, context.sampleRate);
      if (detected) {
        receivedReliablePitch = true;
        lastDetectedAtRef.current = now;
        const reading = pitchFromFrequency(detected, concertPitchRef.current);
        const displayedMidi = displayedMidiRef.current;

        if (displayedMidi === null) {
          displayedMidiRef.current = reading.midi;
          smoothedFrequencyRef.current = detected;
          setPitch(reading);
        } else if (reading.midi !== displayedMidi) {
          if (candidateMidiRef.current !== reading.midi) {
            candidateMidiRef.current = reading.midi;
            candidateSinceRef.current = now;
          } else if (now - candidateSinceRef.current >= NOTE_SWITCH_CONFIRM_MS) {
            displayedMidiRef.current = reading.midi;
            candidateMidiRef.current = null;
            smoothedFrequencyRef.current = detected;
            setPitch(reading);
          }
        } else {
          candidateMidiRef.current = null;
          const previous = smoothedFrequencyRef.current;
          const smoothed = previous === null
            ? detected
            : previous * (1 - FREQUENCY_SMOOTHING) + detected * FREQUENCY_SMOOTHING;
          smoothedFrequencyRef.current = smoothed;
          setPitch(pitchFromFrequency(smoothed, concertPitchRef.current));
        }
      }
    }

    if (!receivedReliablePitch && now - lastDetectedAtRef.current >= NOTE_HOLD_MS) {
      smoothedFrequencyRef.current = null;
      displayedMidiRef.current = null;
      candidateMidiRef.current = null;
      setPitch(null);
    }

    frameRef.current = requestAnimationFrame(analyseFrame);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Live audio is not supported in this browser. Try a current version of Chrome, Edge, or Safari.");
      return;
    }
    try {
      // Start the audio engine while the button tap still counts as a user
      // gesture. Mobile WebViews can otherwise leave it suspended after the
      // asynchronous operating-system permission dialog closes.
      const context = new AudioContext({ latencyHint: "interactive" });
      audioContextRef.current = context;
      await context.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
      });
      streamRef.current = stream;
      await context.resume();

      const analyser = context.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0;
      context.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      bufferRef.current = new Float32Array(analyser.fftSize);
      setIsListening(true);
      analyse();
    } catch (cause) {
      const denied = cause instanceof DOMException && cause.name === "NotAllowedError";
      setError(denied
        ? Capacitor.isNativePlatform()
          ? "Microphone access was denied. Enable microphone permission for A Tuner in your device settings, then try again."
          : "Microphone access was blocked. Allow microphone access in your browser, then try again."
        : "The microphone could not be started. Check that another app is not using it.");
      stop();
    }
  }, [analyse, stop]);

  useEffect(() => stop, [stop]);

  return {
    isListening, pitch, error, start, stop,
    signalLabel: !isListening ? "Idle" : volume < MIN_DETECTABLE_RMS ? "Low" : volume < 0.05 ? "Good" : "Strong",
  };
}
