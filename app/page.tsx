"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleHelp, Gauge, Headphones, Mic, MicOff, Music2, Settings2, Volume2, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTuner } from "@/hooks/use-tuner";
import { frequencyForNote, noteLabel } from "@/lib/pitch";

const COURSE_PRESETS = {
  shurD: { label: "Shur on D", notes: ["D3", "E3", "F3", "G3", "A3", "B♭3", "C4", "D4", "E♭4"] },
  mahurC: { label: "Mahur on C", notes: ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4", "D4"] },
  chromatic: { label: "Chromatic", notes: ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4", "D4"] },
} as const;

type PresetKey = keyof typeof COURSE_PRESETS;
const METER_TICKS = Array.from({ length: 21 }, (_, index) => index - 10);

type TunerToolInput = { concertPitch?: number; preset?: PresetKey; course?: number | null };

declare global {
  interface Document {
    modelContext?: {
      registerTool: (tool: {
        name: string;
        title: string;
        description: string;
        inputSchema: object;
        annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
        execute: (input: unknown) => unknown;
      }, options?: { signal?: AbortSignal }) => void | Promise<void>;
    };
  }
}

export default function Home() {
  const [concertPitch, setConcertPitch] = useState(440);
  const [preset, setPreset] = useState<PresetKey>("shurD");
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const tuner = useTuner(concertPitch);

  const displayNote = tuner.pitch ? noteLabel(tuner.pitch.midi) : "—";
  const displayFrequency = tuner.pitch?.frequency ?? 0;
  const rawCents = tuner.pitch?.cents ?? 0;
  const cents = Math.max(-50, Math.min(50, rawCents));
  const inTune = Boolean(tuner.pitch && Math.abs(rawCents) <= 3);
  const status = !tuner.isListening ? "Ready when you are" : !tuner.pitch ? "Listening for a clear tone" : inTune ? "In tune" : rawCents < 0 ? "Tune higher" : "Tune lower";
  const currentCourse = selectedCourse === null ? null : COURSE_PRESETS[preset].notes[selectedCourse];

  const targetFrequency = useMemo(() => {
    if (!currentCourse) return null;
    const match = currentCourse.replace("♭", "b").match(/^([A-G])([b#]?)(\d)$/);
    if (!match) return null;
    const [, letter, accidental, octave] = match;
    const semitones: Record<string, number> = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
    const midi = (Number(octave) + 1) * 12 + semitones[`${letter}${accidental}`];
    return frequencyForNote(midi, concertPitch);
  }, [concertPitch, currentCourse]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const validPresets = Object.keys(COURSE_PRESETS) as PresetKey[];
    void Promise.resolve(context.registerTool({
      name: "configure_tuner",
      title: "Configure Santour tuner",
      description: "Set the visible concert pitch, Santour tuning preset, and optional course target.",
      inputSchema: {
        type: "object",
        properties: {
          concertPitch: { type: "number", minimum: 430, maximum: 450 },
          preset: { type: "string", enum: validPresets },
          course: { anyOf: [{ type: "integer", minimum: 1, maximum: 9 }, { type: "null" }] },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Configuration must be an object.");
        const config = input as TunerToolInput;
        if (config.concertPitch !== undefined) {
          if (!Number.isFinite(config.concertPitch) || config.concertPitch < 430 || config.concertPitch > 450) throw new Error("concertPitch must be between 430 and 450 Hz.");
          setConcertPitch(Math.round(config.concertPitch));
        }
        if (config.preset !== undefined) {
          if (!validPresets.includes(config.preset)) throw new Error("Unknown tuning preset.");
          setPreset(config.preset);
        }
        if (config.course !== undefined) {
          if (config.course !== null && (!Number.isInteger(config.course) || config.course < 1 || config.course > 9)) throw new Error("course must be from 1 to 9, or null.");
          setSelectedCourse(config.course === null ? null : config.course - 1);
        }
        return { configured: true, concertPitch: config.concertPitch, preset: config.preset, course: config.course };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const noteLetter = displayNote === "—" ? "—" : displayNote.slice(0, 1);
  const noteSuffix = displayNote === "—" ? "" : displayNote.slice(1);

  return (
    <TooltipProvider>
      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b border-white/[0.08]">
          <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-12">
            <div className="flex items-center gap-3">
              <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
              <div>
                <p className="font-display text-[1.35rem] leading-none tracking-[-0.02em] text-white">A Tuner</p>
                <p className="mt-1 text-[0.66rem] font-semibold uppercase tracking-[0.24em] text-brass">Santour tuner</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-xs text-muted-foreground sm:flex">
                <span className={`h-1.5 w-1.5 rounded-full ${tuner.isListening ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : "bg-white/25"}`} />
                {tuner.isListening ? "Microphone active" : "Microphone idle"}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:bg-white/[0.07] hover:text-white" aria-label="Tuning tips"><CircleHelp /></Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Play one course at a time and let the tone settle.</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1500px] gap-5 px-5 py-5 sm:px-8 sm:py-8 lg:grid-cols-[minmax(0,1fr)_310px] lg:px-12">
          <section className="tuner-panel relative min-h-[650px] overflow-hidden rounded-[1.75rem] border border-white/[0.08] p-5 sm:p-8 lg:p-10">
            <div className="ambient-glow" aria-hidden="true" />
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow"><Waves className="size-3.5" /> Live pitch</div>
                <h1 className="mt-2 font-display text-2xl tracking-tight text-white sm:text-3xl">Tune by ear. Confirm by precision.</h1>
              </div>
              <div className="hidden rounded-full border border-white/[0.08] bg-black/15 px-3 py-1.5 font-mono text-xs text-white/45 sm:block">± 50 cents</div>
            </div>

            <div className="relative z-10 mx-auto mt-10 flex max-w-3xl flex-col items-center sm:mt-14">
              <div className={`pitch-orbit ${inTune ? "is-tuned" : ""}`}>
                <div className="pitch-orbit-inner">
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">{tuner.isListening ? "Detected note" : "Waiting"}</p>
                  <div className="mt-1 flex items-start justify-center text-white">
                    <span className="font-display text-[6.5rem] leading-none tracking-[-0.07em] sm:text-[8rem]">{noteLetter}</span>
                    <span className="mt-3 font-display text-3xl text-brass sm:text-4xl">{noteSuffix}</span>
                  </div>
                  <p className="mt-1 font-mono text-sm tabular-nums text-white/50">{displayFrequency ? `${displayFrequency.toFixed(1)} Hz` : "— Hz"}</p>
                </div>
              </div>

              <div className="mt-10 w-full max-w-[680px]">
                <div className="relative h-20">
                  <div className="absolute inset-x-0 bottom-0 flex h-11 items-end justify-between">
                    {METER_TICKS.map((tick) => <span key={tick} className={`w-px bg-white/20 ${tick % 5 === 0 ? "h-5" : "h-2.5"} ${tick === 0 ? "bg-brass" : ""}`} />)}
                  </div>
                  <div className="absolute bottom-0 left-1/2 h-11 w-px -translate-x-1/2 bg-brass/80 shadow-[0_0_16px_rgba(207,168,92,0.65)]" />
                  <div className={`meter-needle ${tuner.pitch ? "opacity-100" : "opacity-0"}`} style={{ transform: `translateX(-50%) rotate(${cents * 0.8}deg)` }} aria-hidden="true"><span /></div>
                </div>
                <div className="mt-2 flex justify-between font-mono text-[0.68rem] uppercase tracking-[0.16em] text-white/30">
                  <span>Flat</span><span className={inTune ? "text-brass" : "text-white/45"}>{tuner.pitch ? `${rawCents > 0 ? "+" : ""}${rawCents.toFixed(1)} ct` : "0 ct"}</span><span>Sharp</span>
                </div>
              </div>

              <div className="mt-9 flex min-h-12 items-center justify-center"><div className={`status-pill ${inTune ? "is-tuned" : ""}`}><span className="status-dot" />{status}</div></div>
              {tuner.error && <p role="alert" className="mt-4 max-w-md text-center text-sm leading-relaxed text-red-300/90">{tuner.error}</p>}
              <Button onClick={tuner.isListening ? tuner.stop : tuner.start} className="mt-7 h-13 rounded-full bg-brass px-7 text-[0.92rem] font-semibold text-[#15120d] shadow-[0_12px_40px_rgba(207,168,92,0.18)] hover:bg-[#dfbd75] focus-visible:ring-brass/40">
                {tuner.isListening ? <MicOff className="size-[18px]" /> : <Mic className="size-[18px]" />}{tuner.isListening ? "Stop listening" : "Start listening"}
              </Button>
              <p className="mt-3 text-center text-xs text-white/30">Best results: pluck a single course in a quiet room.</p>
            </div>
          </section>

          <aside className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <section className="control-card rounded-[1.5rem] border border-white/[0.08] p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5"><Music2 className="size-4 text-brass" /><h2 className="text-sm font-semibold text-white">Santour courses</h2></div>
                <Tooltip><TooltipTrigger asChild><button className="text-white/30 transition hover:text-white/70" aria-label="About Santour course targets"><CircleHelp className="size-4" /></button></TooltipTrigger><TooltipContent className="max-w-56">Targets are a guide. Final tuning changes with dastgah, instrument, and performer.</TooltipContent></Tooltip>
              </div>
              <Select value={preset} onValueChange={(value) => { setPreset(value as PresetKey); setSelectedCourse(null); }}>
                <SelectTrigger className="mt-5 h-11 w-full rounded-xl border-white/[0.09] bg-white/[0.04] px-3.5 text-white shadow-none focus-visible:border-brass/60 focus-visible:ring-brass/15"><SelectValue /></SelectTrigger>
                <SelectContent className="border-white/10 bg-[#191b1c] text-white">
                  {Object.entries(COURSE_PRESETS).map(([value, item]) => <SelectItem key={value} value={value} className="focus:bg-white/10 focus:text-white">{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Course targets">
                {COURSE_PRESETS[preset].notes.map((note, index) => (
                  <button key={`${note}-${index}`} onClick={() => setSelectedCourse(selectedCourse === index ? null : index)} className={`course-key ${selectedCourse === index ? "is-selected" : ""}`} aria-pressed={selectedCourse === index}>
                    <span className="text-[0.62rem] text-white/30">{String(index + 1).padStart(2, "0")}</span><span className="font-display text-lg text-white">{note}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/15 px-3.5 py-3 text-xs leading-relaxed text-white/42">
                {currentCourse && targetFrequency ? <>Course target <span className="font-semibold text-brass">{currentCourse}</span> · {targetFrequency.toFixed(1)} Hz</> : "Select a course to pin its reference frequency."}
              </div>
            </section>

            <section className="control-card rounded-[1.5rem] border border-white/[0.08] p-5 sm:p-6">
              <div className="flex items-center gap-2.5"><Settings2 className="size-4 text-brass" /><h2 className="text-sm font-semibold text-white">Calibration</h2></div>
              <div className="mt-6 flex items-end justify-between">
                <div><p className="text-xs uppercase tracking-[0.14em] text-white/35">Concert pitch</p><p className="mt-1 font-mono text-2xl text-white">A4 = {concertPitch} <span className="text-sm text-white/35">Hz</span></p></div>
                <Button variant="ghost" size="sm" onClick={() => setConcertPitch(440)} disabled={concertPitch === 440} className="h-8 rounded-full px-3 text-xs text-white/40 hover:bg-white/[0.06] hover:text-white">Reset</Button>
              </div>
              <Slider className="mt-5 [&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-brass [&_[data-slot=slider-thumb]]:border-brass [&_[data-slot=slider-thumb]]:bg-[#efe2c1]" min={430} max={450} step={1} value={[concertPitch]} onValueChange={(value) => setConcertPitch(value[0])} aria-label="Concert pitch" />
              <div className="mt-2 flex justify-between font-mono text-[0.65rem] text-white/25"><span>430</span><span>440</span><span>450</span></div>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <div className="mini-stat"><Volume2 className="size-4 text-white/35" /><div><p className="text-[0.65rem] uppercase tracking-wider text-white/30">Signal</p><p className="mt-0.5 text-sm text-white/75">{tuner.signalLabel}</p></div></div>
                <div className="mini-stat"><Gauge className="size-4 text-white/35" /><div><p className="text-[0.65rem] uppercase tracking-wider text-white/30">Precision</p><p className="mt-0.5 text-sm text-white/75">± 1 cent</p></div></div>
              </div>
            </section>
            <div className="hidden items-center gap-3 px-2 text-xs leading-relaxed text-white/30 lg:flex"><Headphones className="size-4 shrink-0" />Headphones can help prevent feedback while tuning.</div>
          </aside>
        </div>
      </main>
    </TooltipProvider>
  );
}
