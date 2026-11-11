// Pure Web Audio API Adaptive Musical Sequencer for CHEF BASTION
// Lookahead scheduler using AudioContext.currentTime — 100% procedural, zero external MP3s.

import type { GameMode } from './types';

export type BarSectionId = 'A' | 'B' | 'C';

export interface EstablishmentHarmony {
  index: number;
  name: string;
  modeName: string;
  rootMidi: number;
  scaleIntervals: readonly number[]; // 8 intervals from root (0..12)
  bassPatternA: readonly number[];   // 16 scale-degree steps (-1 = rest)
  bassPatternB: readonly number[];
  bassPatternC: readonly number[];
  motifA: readonly number[];         // 16 scale-degree steps (-1 = rest)
  motifB: readonly number[];
  motifC: readonly number[];
  chordDegrees: readonly [number, number, number][]; // 4 bars of 3-note scale degree triads
}

export interface AdaptiveMusicTelemetry {
  isPlaying: boolean;
  gameMode: GameMode;
  level: number;
  phase: 1 | 2 | 3;
  inPlacementPhase: boolean;
  liveBugCount: number;
  maxBugYProgress: number; // -0.4 (vent) to 6.85 (plates); >= 4.8 is critical zone
  hasBoss: boolean;
  grandBossFinalPhase: boolean; // Grand Boss <= 33% HP (Phase 3)
  lastStandActive: boolean;     // 1.2s "Salvada In Extremis"
  tacticalSlowMoActive: boolean;// Holding a piece with "Cámara Lenta al Mover ON" (20%)
  rushElapsedSec: number;
  gameSpeedMultiplier: 0.75 | 1.0 | 1.25;
}

export const DEFAULT_MUSIC_TELEMETRY: AdaptiveMusicTelemetry = {
  isPlaying: false,
  gameMode: 'strategic',
  level: 1,
  phase: 1,
  inPlacementPhase: false,
  liveBugCount: 0,
  maxBugYProgress: 0,
  hasBoss: false,
  grandBossFinalPhase: false,
  lastStandActive: false,
  tacticalSlowMoActive: false,
  rushElapsedSec: 0,
  gameSpeedMultiplier: 1.0,
};

export const CRITICAL_ZONE_Y_PROGRESS = 4.8;
export const PREP_LOWPASS_HZ = 450;
export const SLOWMO_LOWPASS_HZ = 400;
export const ACTION_LOWPASS_HZ = 12000;

// 6 Harmonic Establishments (changes every 10 levels so it never feels like a short loop)
export const ESTABLISHMENT_HARMONIES: readonly EstablishmentHarmony[] = [
  // 0: Nv. 1-10 — Bistró La Encimera (C Ionian / Major electro-bistro bounce)
  {
    index: 0,
    name: 'Bistró La Encimera',
    modeName: 'C Ionian',
    rootMidi: 48, // C3
    scaleIntervals: [0, 2, 4, 5, 7, 9, 11, 12],
    bassPatternA: [0, -1, 0, 4, -1, 0, 2, -1, 3, -1, 3, 5, -1, 4, 2, 4],
    bassPatternB: [5, -1, 5, 2, -1, 3, 4, -1, 2, -1, 4, 5, -1, 6, 4, 2],
    bassPatternC: [3, -1, 3, 5, 4, -1, 4, 6, 4, 4, 5, 5, 6, 6, 7, 4],
    motifA: [4, -1, 2, -1, 0, 2, 4, -1, 5, -1, 4, -1, 2, -1, 4, -1],
    motifB: [5, -1, 4, 2, -1, 0, 2, -1, 6, -1, 5, 4, -1, 2, 0, -1],
    motifC: [3, -1, 5, -1, 4, -1, 6, -1, 7, -1, 6, 5, 4, 5, 6, 7],
    chordDegrees: [
      [0, 2, 4],
      [5, 0, 2],
      [3, 5, 7],
      [4, 6, 1],
    ],
  },
  // 1: Nv. 11-20 — Trattoria Vapor & Acero (A Aeolian / Natural Minor tarantella drive)
  {
    index: 1,
    name: 'Trattoria Vapor & Acero',
    modeName: 'A Aeolian',
    rootMidi: 45, // A2
    scaleIntervals: [0, 2, 3, 5, 7, 8, 10, 12],
    bassPatternA: [0, 0, -1, 4, 0, -1, 2, 3, 5, 5, -1, 4, 3, -1, 2, 4],
    bassPatternB: [3, 3, -1, 5, 4, -1, 2, 0, 6, 6, -1, 4, 5, -1, 4, 2],
    bassPatternC: [5, -1, 5, 3, 6, -1, 6, 4, 4, 4, 5, 5, 6, 6, 7, 4],
    motifA: [0, 2, 4, -1, 5, 4, 2, -1, 3, 2, 0, -1, 4, -1, 2, -1],
    motifB: [5, 4, 2, -1, 6, 5, 4, -1, 4, 3, 2, 1, 2, -1, 4, -1],
    motifC: [3, 5, 7, -1, 6, 4, 2, -1, 4, 5, 6, 7, 6, 5, 4, 7],
    chordDegrees: [
      [0, 2, 4],
      [5, 7, 2],
      [6, 1, 3],
      [4, 6, 1],
    ],
  },
  // 2: Nv. 21-30 — Gran Comedor Imperial (G Mixolydian chamber funk)
  {
    index: 2,
    name: 'Gran Comedor Imperial',
    modeName: 'G Mixolydian',
    rootMidi: 43, // G2
    scaleIntervals: [0, 2, 4, 5, 7, 9, 10, 12],
    bassPatternA: [0, -1, 4, 6, 0, -1, 5, 4, 6, -1, 4, 2, 3, -1, 4, 6],
    bassPatternB: [3, -1, 5, 7, 6, -1, 4, 2, 0, -1, 2, 4, 6, -1, 5, 4],
    bassPatternC: [6, 6, -1, 4, 3, 3, -1, 5, 4, 5, 6, 4, 5, 6, 7, 4],
    motifA: [7, -1, 6, 4, -1, 2, 4, -1, 6, -1, 5, 4, 2, -1, 0, -1],
    motifB: [3, -1, 5, 7, -1, 6, 4, -1, 2, 4, 6, -1, 5, 4, 2, -1],
    motifC: [6, -1, 4, -1, 5, -1, 3, -1, 4, 5, 6, 7, 6, 7, 4, 7],
    chordDegrees: [
      [0, 2, 4],
      [6, 1, 3],
      [3, 5, 7],
      [6, 0, 4],
    ],
  },
  // 3: Nv. 31-40 — Taberna Neón & Conductos (D Dorian cyber-lounge groove)
  {
    index: 3,
    name: 'Taberna Neón & Conductos',
    modeName: 'D Dorian',
    rootMidi: 50, // D3
    scaleIntervals: [0, 2, 3, 5, 7, 9, 10, 12],
    bassPatternA: [0, -1, 0, 2, 3, -1, 5, 4, 0, -1, 6, 5, 3, -1, 2, 4],
    bassPatternB: [3, -1, 3, 5, 6, -1, 5, 4, 2, -1, 4, 5, 6, -1, 4, 2],
    bassPatternC: [3, 3, 5, 5, 6, 6, 5, 4, 0, 2, 3, 4, 5, 6, 7, 5],
    motifA: [2, -1, 4, 5, -1, 4, 2, 0, -1, 6, 5, -1, 4, 2, -1, -1],
    motifB: [5, -1, 6, 7, -1, 5, 4, 2, -1, 3, 5, -1, 6, 4, 2, -1],
    motifC: [3, 5, 6, -1, 4, 6, 7, -1, 5, 6, 7, 5, 6, 7, 5, 7],
    chordDegrees: [
      [0, 2, 4],
      [3, 5, 7],
      [6, 1, 3],
      [5, 0, 2],
    ],
  },
  // 4: Nv. 41-50 — Bastión de Brasas (E Phrygian Dominant fiery tension)
  {
    index: 4,
    name: 'Bastión de Brasas',
    modeName: 'E Phrygian Dominant',
    rootMidi: 40, // E2
    scaleIntervals: [0, 1, 4, 5, 7, 8, 10, 12],
    bassPatternA: [0, 0, 1, 0, -1, 4, 5, 4, 0, 0, 1, 2, 3, -1, 2, 1],
    bassPatternB: [5, 5, 4, 2, -1, 1, 0, 4, 3, 3, 2, 1, 2, -1, 4, 1],
    bassPatternC: [1, 1, 2, 2, 3, 3, 4, 4, 5, 4, 3, 2, 4, 5, 6, 7],
    motifA: [0, 1, 2, -1, 4, 2, 1, -1, 5, 4, 2, 1, 2, -1, -1, -1],
    motifB: [5, 4, 2, 1, 0, -1, 2, 4, 6, 5, 4, 2, 4, -1, 2, 1],
    motifC: [1, 2, 4, 5, 4, 2, 1, 2, 3, 4, 5, 6, 7, 6, 4, 7],
    chordDegrees: [
      [0, 2, 4],
      [1, 3, 5],
      [5, 0, 2],
      [6, 1, 4],
    ],
  },
  // 5: Nv. 51-60+ — Cámara Frigorífica Suprema (F Lydian crystalline overdrive)
  {
    index: 5,
    name: 'Cámara Frigorífica Suprema',
    modeName: 'F Lydian',
    rootMidi: 41, // F2
    scaleIntervals: [0, 2, 4, 6, 7, 9, 11, 12],
    bassPatternA: [0, -1, 4, 7, 1, -1, 4, 6, 0, -1, 5, 4, 3, -1, 4, 6],
    bassPatternB: [1, -1, 3, 5, 4, -1, 6, 7, 5, -1, 4, 2, 1, -1, 3, 4],
    bassPatternC: [1, 1, 3, 4, 5, 5, 6, 7, 3, 4, 5, 6, 4, 6, 7, 4],
    motifA: [4, -1, 3, 4, 7, -1, 6, 4, 3, -1, 2, 4, -1, 3, 2, -1],
    motifB: [5, -1, 4, 3, 6, -1, 4, 2, 7, -1, 6, 4, 3, 4, 6, -1],
    motifC: [1, 3, 4, 6, 4, 6, 7, -1, 3, 4, 6, 7, 6, 7, 4, 7],
    chordDegrees: [
      [0, 2, 4],
      [1, 3, 5],
      [5, 7, 2],
      [4, 6, 1],
    ],
  },
];

const CYCLE_SECTIONS: readonly BarSectionId[] = ['A', 'B', 'A', 'C'];

export function getCycleSectionABAC(barIndex: number): BarSectionId {
  const normalized = ((Math.floor(barIndex) % 4) + 4) % 4;
  return CYCLE_SECTIONS[normalized];
}

export function getEstablishmentHarmony(level: number): EstablishmentHarmony {
  const safeLevel = Math.max(1, Math.floor(level));
  const idx = Math.floor((safeLevel - 1) / 10) % ESTABLISHMENT_HARMONIES.length;
  return ESTABLISHMENT_HARMONIES[idx];
}

export function midiToFreqHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Computes real-time vertical dangerLevel (0.0 to 1.0) from Phase, live bug count,
 * boss presence, and closest bug proximity to the plates.
 */
export function computeDangerLevel(input: {
  inPlacementPhase: boolean;
  gameMode: GameMode;
  phase: 1 | 2 | 3;
  liveBugCount: number;
  maxBugYProgress: number;
  hasBoss: boolean;
  rushElapsedSec?: number;
}): number {
  if (input.inPlacementPhase) return 0;

  let base =
    input.gameMode === 'rush'
      ? 0.24 + Math.min(0.46, Math.max(0, input.rushElapsedSec ?? 0) / 360)
      : input.phase === 1
      ? 0.16
      : input.phase === 2
      ? 0.42
      : 0.72;

  const countFactor = Math.min(0.28, Math.max(0, input.liveBugCount) * 0.04);
  const proximityNorm =
    input.liveBugCount > 0
      ? Math.max(0, Math.min(1, (input.maxBugYProgress - 1.0) / 4.8))
      : 0;
  const proximityFactor = proximityNorm * 0.42;

  let danger = base + countFactor + proximityFactor;

  if (input.hasBoss || input.phase === 3) {
    danger = Math.max(danger, 0.72);
  }
  if (input.liveBugCount > 0 && input.maxBugYProgress >= CRITICAL_ZONE_Y_PROGRESS) {
    danger = Math.max(danger, 0.82);
  }

  return Number(Math.max(0, Math.min(1, danger)).toFixed(3));
}

/**
 * Computes reactive Low-Pass filter target frequency (Hz):
 * - Strategic preparation (`inPlacementPhase`): 450 Hz
 * - Salvada In Extremis (`lastStandActive`) OR Tactical Drag Slow-Mo (`tacticalSlowMoActive`): 400 Hz
 * - Live combat action: 12000 Hz
 */
export function computeTargetLowPassHz(input: {
  inPlacementPhase: boolean;
  lastStandActive: boolean;
  tacticalSlowMoActive: boolean;
}): number {
  if (input.lastStandActive || input.tacticalSlowMoActive) {
    return SLOWMO_LOWPASS_HZ;
  }
  if (input.inPlacementPhase) {
    return PREP_LOWPASS_HZ;
  }
  return ACTION_LOWPASS_HZ;
}

/**
 * Computes progressive BPM:
 * - Strategic/Campaign: 112 (Phase 1) -> 124 (Phase 2) -> 136 (Phase 3 / Boss),
 *   +8 BPM extra if live bugs step into critical zone, scaled +10% / -10% for 1.25x / 0.75x.
 * - Survival Rush: starts directly at 126 BPM and scales with Frenzy up to 172 BPM,
 *   also respecting +10% / -10% speed setting.
 */
export function computeTargetBpm(input: {
  gameMode: GameMode;
  phase: 1 | 2 | 3;
  hasBoss: boolean;
  inPlacementPhase: boolean;
  liveBugCount: number;
  maxBugYProgress: number;
  rushElapsedSec: number;
  gameSpeedMultiplier: 0.75 | 1.0 | 1.25;
}): number {
  const speedScale =
    input.gameSpeedMultiplier === 1.25
      ? 1.1
      : input.gameSpeedMultiplier === 0.75
      ? 0.9
      : 1.0;

  const inCriticalZone =
    !input.inPlacementPhase &&
    input.liveBugCount > 0 &&
    input.maxBugYProgress >= CRITICAL_ZONE_Y_PROGRESS;

  let baseBpm: number;
  if (input.gameMode === 'rush') {
    const frenzyProgress = Math.max(0, Math.min(1, input.rushElapsedSec / 240));
    const rushRamp = 126 + frenzyProgress * (172 - 126);
    baseBpm = Math.min(172, rushRamp + (inCriticalZone ? 4 : 0));
  } else {
    if (input.hasBoss || input.phase === 3) {
      baseBpm = 136;
    } else if (input.phase === 2) {
      baseBpm = 124;
    } else {
      baseBpm = 112;
    }
    if (inCriticalZone) {
      baseBpm += 8;
    }
  }

  return Math.round(baseBpm * speedScale * 10) / 10;
}

/**
 * Computes dopamine semitone transposition (+1 per elapsed Rush minute or when Grand Boss
 * enters final <= 33% HP, capped at +4 semitones maximum).
 */
export function computeSemitoneShift(input: {
  gameMode: GameMode;
  rushElapsedSec: number;
  grandBossFinalPhase: boolean;
}): number {
  const rushMinutes =
    input.gameMode === 'rush' ? Math.max(0, Math.floor(input.rushElapsedSec / 60)) : 0;
  const bossBoost = input.grandBossFinalPhase ? 1 : 0;
  return Math.min(4, rushMinutes + bossBoost);
}

/**
 * Pure Web Audio API Lookahead Adaptive Music Sequencer.
 */
export class AdaptiveMusicEngine {
  private ctxProvider: () => AudioContext | null;
  private masterGain: GainNode | null = null;
  private masterLowPass: BiquadFilterNode | null = null;
  private boundCtx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private schedulerTimer: number | null = null;
  private nextNoteTime = 0;
  private currentStep = 0; // 0..63 across 4-bar A-B-A-C cycle (16 steps/bar)
  private barCounter = 0;

  private isRunning = false;
  private bgmGainScale = 0.56; // masterVolume * bgmVolume
  private telemetry: AdaptiveMusicTelemetry = { ...DEFAULT_MUSIC_TELEMETRY };
  private currentLowPassTarget = ACTION_LOWPASS_HZ;
  private activeSemitoneShift = 0;

  private static readonly LOOKAHEAD_INTERVAL_MS = 25;
  private static readonly SCHEDULE_AHEAD_SEC = 0.11;
  private static readonly BASE_MASTER_GAIN = 0.24;

  constructor(ctxProvider: () => AudioContext | null) {
    this.ctxProvider = ctxProvider;
  }

  public setVolumeScale(bgmScale: number) {
    this.bgmGainScale = Math.max(0, Math.min(1, bgmScale));
    if (this.masterGain && this.boundCtx) {
      const now = this.boundCtx.currentTime;
      const target = this.isRunning ? AdaptiveMusicEngine.BASE_MASTER_GAIN * this.bgmGainScale : 0.0001;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(target, now, 0.04);
    }
    if (this.bgmGainScale <= 0.001 && this.isRunning) {
      this.stop();
    }
  }

  public resetSession() {
    this.activeSemitoneShift = 0;
    this.currentStep = 0;
    this.barCounter = 0;
  }

  public updateTelemetry(patch: Partial<AdaptiveMusicTelemetry>) {
    const prevPlacement = this.telemetry.inPlacementPhase;
    const prevMatchMode = this.telemetry.gameMode;
    const prevLevel = this.telemetry.level;

    this.telemetry = { ...this.telemetry, ...patch };

    // Reset semitone shift if level changed in strategic mode or Rush clock restarted near 0
    if (
      (this.telemetry.gameMode !== prevMatchMode) ||
      (this.telemetry.gameMode === 'strategic' && this.telemetry.level !== prevLevel) ||
      (this.telemetry.gameMode === 'rush' && this.telemetry.rushElapsedSec < 2 && this.activeSemitoneShift > 0 && !this.telemetry.grandBossFinalPhase)
    ) {
      this.activeSemitoneShift = 0;
    }

    if (!this.telemetry.isPlaying || this.bgmGainScale <= 0.001) {
      if (this.isRunning) this.stop();
      return;
    }

    if (!this.isRunning) {
      this.start();
    }

    // Apply reactive Low-Pass filter transitions immediately!
    const nextCutoff = computeTargetLowPassHz({
      inPlacementPhase: this.telemetry.inPlacementPhase,
      lastStandActive: this.telemetry.lastStandActive,
      tacticalSlowMoActive: this.telemetry.tacticalSlowMoActive,
    });

    if (nextCutoff !== this.currentLowPassTarget) {
      const openingFromPrep = prevPlacement && !this.telemetry.inPlacementPhase && nextCutoff === ACTION_LOWPASS_HZ;
      this.rampMasterLowPass(nextCutoff, openingFromPrep ? 0.3 : nextCutoff < this.currentLowPassTarget ? 0.09 : 0.22);
      this.currentLowPassTarget = nextCutoff;
    }

    // Check for Dopamine Semitone Key-Up (+1 semitone up to +4 + drum roll!)
    const desiredSemitone = computeSemitoneShift({
      gameMode: this.telemetry.gameMode,
      rushElapsedSec: this.telemetry.rushElapsedSec,
      grandBossFinalPhase: this.telemetry.grandBossFinalPhase,
    });

    if (desiredSemitone > this.activeSemitoneShift) {
      this.activeSemitoneShift = desiredSemitone;
      if (this.boundCtx && this.boundCtx.state === 'running' && this.masterLowPass) {
        this.scheduleDrumRollFill(this.boundCtx, Math.max(this.boundCtx.currentTime + 0.01, this.nextNoteTime));
      }
    }
  }

  public start() {
    if (typeof window === 'undefined' || this.bgmGainScale <= 0.001) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const ctx = this.ctxProvider();
    if (!ctx) return;

    this.ensureAudioGraph(ctx);
    this.isRunning = true;

    const initialHz = computeTargetLowPassHz({
      inPlacementPhase: this.telemetry.inPlacementPhase,
      lastStandActive: this.telemetry.lastStandActive,
      tacticalSlowMoActive: this.telemetry.tacticalSlowMoActive,
    });
    this.currentLowPassTarget = initialHz;
    if (this.masterLowPass) {
      const now = ctx.currentTime;
      this.masterLowPass.frequency.cancelScheduledValues(now);
      this.masterLowPass.frequency.setValueAtTime(initialHz, now);
    }
    if (this.masterGain) {
      const now = ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(0.0005, now);
      this.masterGain.gain.linearRampToValueAtTime(
        Math.max(0.001, AdaptiveMusicEngine.BASE_MASTER_GAIN * this.bgmGainScale),
        now + 0.12
      );
    }

    this.nextNoteTime = ctx.currentTime + 0.04;

    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
    }
    this.schedulerTimer = window.setInterval(
      () => this.schedulerTick(),
      AdaptiveMusicEngine.LOOKAHEAD_INTERVAL_MS
    );
  }

  public stop() {
    this.isRunning = false;
    if (this.schedulerTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.masterGain && this.boundCtx) {
      const now = this.boundCtx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(0.0001, now, 0.035);
    }
  }

  public onVisibilityChange(isHidden: boolean) {
    if (isHidden) {
      if (this.schedulerTimer !== null && typeof window !== 'undefined') {
        window.clearInterval(this.schedulerTimer);
        this.schedulerTimer = null;
      }
      if (this.boundCtx && this.boundCtx.state === 'running') {
        this.boundCtx.suspend().catch(() => {});
      }
    } else if (this.isRunning && this.telemetry.isPlaying && this.bgmGainScale > 0.001) {
      const ctx = this.ctxProvider();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        this.nextNoteTime = ctx.currentTime + 0.05;
        if (this.schedulerTimer === null && typeof window !== 'undefined') {
          this.schedulerTimer = window.setInterval(
            () => this.schedulerTick(),
            AdaptiveMusicEngine.LOOKAHEAD_INTERVAL_MS
          );
        }
      }
    }
  }

  public getDebugSnapshot() {
    return {
      isRunning: this.isRunning,
      bpm: computeTargetBpm(this.telemetry),
      dangerLevel: computeDangerLevel(this.telemetry),
      lowPassHz: this.currentLowPassTarget,
      semitoneShift: this.activeSemitoneShift,
      establishment: getEstablishmentHarmony(this.telemetry.level).modeName,
      section: getCycleSectionABAC(this.barCounter),
    };
  }

  private ensureAudioGraph(ctx: AudioContext) {
    if (this.boundCtx === ctx && this.masterGain && this.masterLowPass && this.noiseBuffer) {
      return;
    }
    this.boundCtx = ctx;

    this.masterLowPass = ctx.createBiquadFilter();
    this.masterLowPass.type = 'lowpass';
    this.masterLowPass.Q.setValueAtTime(1.15, ctx.currentTime);
    this.masterLowPass.frequency.setValueAtTime(ACTION_LOWPASS_HZ, ctx.currentTime);

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(
      Math.max(0.001, AdaptiveMusicEngine.BASE_MASTER_GAIN * this.bgmGainScale),
      ctx.currentTime
    );

    this.masterLowPass.connect(this.masterGain);
    this.masterGain.connect(ctx.destination);

    // Pre-allocate 1.0s reusable white noise buffer for filtered Snare & Hi-Hats
    const sampleCount = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  private rampMasterLowPass(targetHz: number, durationSec: number) {
    if (!this.masterLowPass || !this.boundCtx) return;
    const now = this.boundCtx.currentTime;
    const safeTarget = Math.max(120, Math.min(16000, targetHz));
    const currentVal = Math.max(120, this.masterLowPass.frequency.value || ACTION_LOWPASS_HZ);
    this.masterLowPass.frequency.cancelScheduledValues(now);
    this.masterLowPass.frequency.setValueAtTime(currentVal, now);
    this.masterLowPass.frequency.exponentialRampToValueAtTime(safeTarget, now + Math.max(0.04, durationSec));
  }

  private schedulerTick() {
    if (!this.isRunning || this.bgmGainScale <= 0.001) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const ctx = this.boundCtx ?? this.ctxProvider();
    if (!ctx || ctx.state !== 'running') return;
    this.ensureAudioGraph(ctx);

    // Guard against stale nextNoteTime if tab hiccupped
    if (this.nextNoteTime < ctx.currentTime - 0.15) {
      this.nextNoteTime = ctx.currentTime + 0.03;
    }

    while (this.nextNoteTime < ctx.currentTime + AdaptiveMusicEngine.SCHEDULE_AHEAD_SEC) {
      const bpm = computeTargetBpm(this.telemetry);
      const sixteenthSec = 60 / bpm / 4;
      this.scheduleStep(ctx, this.currentStep, this.nextNoteTime, sixteenthSec);
      this.nextNoteTime += sixteenthSec;
      this.currentStep = (this.currentStep + 1) % 64;
      if (this.currentStep % 16 === 0) {
        this.barCounter += 1;
      }
    }
  }

  private scheduleStep(ctx: AudioContext, cycleStep: number, time: number, stepSec: number) {
    if (!this.masterLowPass) return;

    const stepInBar = cycleStep % 16;
    const barInCycle = Math.floor(cycleStep / 16); // 0..3
    const section = CYCLE_SECTIONS[barInCycle];   // 'A' | 'B' | 'A' | 'C'

    // In Rush mode, rotate establishment harmonic color subtly every 90s while keeping level harmony in Strategic
    const effectiveLevel =
      this.telemetry.gameMode === 'rush'
        ? this.telemetry.level + Math.floor(this.telemetry.rushElapsedSec / 90) * 10
        : this.telemetry.level;
    const harmony = getEstablishmentHarmony(effectiveLevel);
    const danger = computeDangerLevel(this.telemetry);
    const inPrep = this.telemetry.inPlacementPhase;
    const highDanger =
      !inPrep &&
      (danger >= 0.68 ||
        this.telemetry.phase === 3 ||
        this.telemetry.hasBoss ||
        (this.telemetry.liveBugCount > 0 && this.telemetry.maxBugYProgress >= CRITICAL_ZONE_Y_PROGRESS));
    const mediumDanger = !inPrep && (danger >= 0.38 || highDanger);

    const resolveMidi = (degree: number, octaveOffset = 0): number => {
      const degFloor = ((degree % 8) + 8) % 8;
      const extraOct = Math.floor(degree / 8);
      return (
        harmony.rootMidi +
        harmony.scaleIntervals[degFloor] +
        (octaveOffset + extraOct) * 12 +
        this.activeSemitoneShift
      );
    };

    // 1. PUNCHY KICK (4-on-the-floor + syncopated ghost kicks in B/C)
    const isFourFloor = stepInBar % 4 === 0;
    const isSyncopatedKick =
      !inPrep &&
      ((section === 'B' && stepInBar === 10) ||
        (section === 'C' && stepInBar === 6) ||
        (highDanger && stepInBar === 14 && Math.random() < 0.45));
    if (isFourFloor || (inPrep && stepInBar === 8) || (!inPrep && isSyncopatedKick)) {
      if (!inPrep || stepInBar === 0 || stepInBar === 8) {
        this.triggerKick(ctx, time, isFourFloor ? 1.0 : 0.72);
      }
    }

    // 2. FILTERED NOISE SNARE + PROBABILISTIC RHYTHMIC FILLS IN 4TH BAR ('C')
    if (!inPrep) {
      const isBackbeat = stepInBar === 4 || stepInBar === 12;
      const isProbabilisticFillC =
        section === 'C' &&
        stepInBar >= 11 &&
        ((stepInBar === 11 && Math.random() < 0.55) ||
          (stepInBar === 13 && Math.random() < 0.65) ||
          (stepInBar === 14 && Math.random() < 0.75) ||
          (stepInBar === 15 && Math.random() < 0.85));

      if (isBackbeat) {
        this.triggerSnare(ctx, time, 0.9);
      } else if (isProbabilisticFillC) {
        this.triggerSnare(ctx, time, 0.55 + (stepInBar - 10) * 0.08);
      }
    }

    // 3. FILTERED HI-HATS (Sparse offbeat at low danger; fast 16th hats at medium+ danger)
    if (!inPrep) {
      if (mediumDanger) {
        const isOffbeatOpen = stepInBar % 4 === 2;
        if (isOffbeatOpen) {
          this.triggerHiHat(ctx, time, true, 0.78);
        } else if (highDanger || stepInBar % 2 === 0 || Math.random() < 0.65) {
          this.triggerHiHat(ctx, time, false, stepInBar % 2 === 0 ? 0.52 : 0.34);
        }
      } else if (stepInBar % 4 === 2) {
        this.triggerHiHat(ctx, time, false, 0.44);
      }
    }

    // 4. RESONANT SAWTOOTH BASSLINE (A-B-A-C phrasing)
    const bassPattern =
      section === 'B'
        ? harmony.bassPatternB
        : section === 'C'
        ? harmony.bassPatternC
        : harmony.bassPatternA;
    const bassDeg = bassPattern[stepInBar];
    if (bassDeg >= 0 && (!inPrep || stepInBar % 2 === 0)) {
      const bassFreq = midiToFreqHz(resolveMidi(bassDeg, -1));
      this.triggerResonantBass(ctx, time, bassFreq, stepSec * 0.92, inPrep ? 0.15 : danger);
    }

    // 5. SYNCOPATED CHORD STABS (Enter at medium danger >= 0.38)
    if (mediumDanger && (stepInBar === 2 || stepInBar === 6 || stepInBar === 11 || (section === 'B' && stepInBar === 14))) {
      const triad = harmony.chordDegrees[barInCycle];
      this.triggerSyncopatedChord(
        ctx,
        time,
        [
          midiToFreqHz(resolveMidi(triad[0], 1)),
          midiToFreqHz(resolveMidi(triad[1], 1)),
          midiToFreqHz(resolveMidi(triad[2], 1)),
        ],
        stepSec * 1.15
      );
    }

    // 6. DETUNED LEAD MOTIF & HIGH-DANGER 16TH-NOTE ARPEGGIATOR
    const motif =
      section === 'B' ? harmony.motifB : section === 'C' ? harmony.motifC : harmony.motifA;
    const motifDeg = motif[stepInBar];

    if (highDanger) {
      // Fast 16th-note arpeggiator (semicorcheas) cycling chord tones + octave!
      const triad = harmony.chordDegrees[barInCycle];
      const arpOrder = [triad[0], triad[1], triad[2], triad[0] + 7];
      const arpDeg = motifDeg >= 0 && stepInBar % 4 === 0 ? motifDeg : arpOrder[stepInBar % 4];
      const arpOct = stepInBar % 8 >= 6 ? 2 : 1;
      const arpFreq = midiToFreqHz(resolveMidi(arpDeg, arpOct));
      this.triggerDetunedLead(ctx, time, arpFreq, stepSec * 0.78, stepInBar % 4 === 0 ? 0.9 : 0.65);
    } else if (motifDeg >= 0 && (!inPrep || stepInBar % 4 === 0)) {
      const leadFreq = midiToFreqHz(resolveMidi(motifDeg, 1));
      this.triggerDetunedLead(ctx, time, leadFreq, stepSec * 1.45, inPrep ? 0.55 : 0.82);
    }
  }

  private triggerKick(ctx: AudioContext, time: number, velocity: number) {
    if (!this.masterLowPass) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(158, time);
    osc.frequency.exponentialRampToValueAtTime(43, time + 0.085);

    gain.gain.setValueAtTime(Math.max(0.001, 0.52 * velocity), time);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + 0.19);

    osc.connect(gain);
    gain.connect(this.masterLowPass);
    osc.start(time);
    osc.stop(time + 0.2);

    // Subtle beater click transient
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(340, time);
    click.frequency.exponentialRampToValueAtTime(85, time + 0.02);
    clickGain.gain.setValueAtTime(Math.max(0.001, 0.16 * velocity), time);
    clickGain.gain.exponentialRampToValueAtTime(0.0005, time + 0.024);
    click.connect(clickGain);
    clickGain.connect(this.masterLowPass);
    click.start(time);
    click.stop(time + 0.028);
  }

  private triggerSnare(ctx: AudioContext, time: number, velocity: number) {
    if (!this.masterLowPass || !this.noiseBuffer) return;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1850, time);
    bp.Q.setValueAtTime(1.1, time);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(Math.max(0.001, 0.28 * velocity), time);
    nGain.gain.exponentialRampToValueAtTime(0.0006, time + 0.135);

    noise.connect(bp);
    bp.connect(nGain);
    nGain.connect(this.masterLowPass);
    noise.start(time, (time * 13) % 0.65, 0.15);
    noise.stop(time + 0.145);

    // Snare drum shell body snap
    const body = ctx.createOscillator();
    const bGain = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(195, time);
    body.frequency.exponentialRampToValueAtTime(112, time + 0.065);
    bGain.gain.setValueAtTime(Math.max(0.001, 0.2 * velocity), time);
    bGain.gain.exponentialRampToValueAtTime(0.0006, time + 0.075);
    body.connect(bGain);
    bGain.connect(this.masterLowPass);
    body.start(time);
    body.stop(time + 0.08);
  }

  private triggerHiHat(ctx: AudioContext, time: number, open: boolean, velocity: number) {
    if (!this.masterLowPass || !this.noiseBuffer) return;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(7600, time);
    hp.Q.setValueAtTime(0.85, time);

    const dur = open ? 0.095 : 0.036;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.001, 0.16 * velocity), time);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + dur);

    noise.connect(hp);
    hp.connect(gain);
    gain.connect(this.masterLowPass);
    noise.start(time, (time * 19) % 0.7, dur + 0.01);
    noise.stop(time + dur + 0.012);
  }

  private triggerResonantBass(
    ctx: AudioContext,
    time: number,
    freqHz: number,
    durSec: number,
    danger: number
  ) {
    if (!this.masterLowPass) return;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freqHz, time);

    // Dynamic resonant filter envelope that opens brighter as danger rises
    const peakCutoff = 680 + danger * 1050;
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(5.2, time);
    filter.frequency.setValueAtTime(175, time);
    filter.frequency.exponentialRampToValueAtTime(peakCutoff, time + 0.022);
    filter.frequency.exponentialRampToValueAtTime(195, time + Math.max(0.06, durSec));

    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.24, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, time + Math.max(0.065, durSec));

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterLowPass);
    osc.start(time);
    osc.stop(time + Math.max(0.075, durSec + 0.01));
  }

  private triggerDetunedLead(
    ctx: AudioContext,
    time: number,
    freqHz: number,
    durSec: number,
    velocity: number
  ) {
    if (!this.masterLowPass) return;

    const voiceFilter = ctx.createBiquadFilter();
    voiceFilter.type = 'lowpass';
    voiceFilter.frequency.setValueAtTime(2800, time);
    voiceFilter.frequency.exponentialRampToValueAtTime(950, time + Math.max(0.06, durSec));

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0008, time);
    gain.gain.linearRampToValueAtTime(Math.max(0.001, 0.12 * velocity), time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0006, time + Math.max(0.065, durSec));

    // Dual oscillators with gentle +-7 cents detune for warm stereo-like chorus body
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscB.type = 'triangle';
    oscA.frequency.setValueAtTime(freqHz, time);
    oscB.frequency.setValueAtTime(freqHz, time);
    oscA.detune.setValueAtTime(-7, time);
    oscB.detune.setValueAtTime(7, time);

    oscA.connect(voiceFilter);
    oscB.connect(voiceFilter);
    voiceFilter.connect(gain);
    gain.connect(this.masterLowPass);

    const stopAt = time + Math.max(0.075, durSec + 0.01);
    oscA.start(time);
    oscB.start(time);
    oscA.stop(stopAt);
    oscB.stop(stopAt);
  }

  private triggerSyncopatedChord(
    ctx: AudioContext,
    time: number,
    freqs: [number, number, number],
    durSec: number
  ) {
    if (!this.masterLowPass) return;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350, time);
    filter.Q.setValueAtTime(0.9, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0008, time);
    gain.gain.linearRampToValueAtTime(0.085, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0006, time + Math.max(0.06, durSec));

    filter.connect(gain);
    gain.connect(this.masterLowPass);

    const stopAt = time + Math.max(0.07, durSec + 0.01);
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, time);
      osc.detune.setValueAtTime((idx - 1) * 5, time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(stopAt);
    });
  }

  /**
   * Brief ascending snare + tom drum roll triggered right before a +1 semitone key-up!
   */
  private scheduleDrumRollFill(ctx: AudioContext, startTime: number) {
    if (!this.masterLowPass) return;
    const hitCount = 6;
    const spacing = 0.045;
    for (let i = 0; i < hitCount; i++) {
      const t = startTime + i * spacing;
      const vel = 0.48 + (i / (hitCount - 1)) * 0.52;
      this.triggerSnare(ctx, t, vel);

      // Pitched tom rising into the new key
      const tom = ctx.createOscillator();
      const tGain = ctx.createGain();
      tom.type = 'sine';
      const basePitch = 135 + i * 24;
      tom.frequency.setValueAtTime(basePitch * 1.35, t);
      tom.frequency.exponentialRampToValueAtTime(basePitch, t + 0.055);
      tGain.gain.setValueAtTime(Math.max(0.001, 0.22 * vel), t);
      tGain.gain.exponentialRampToValueAtTime(0.0006, t + 0.065);
      tom.connect(tGain);
      tGain.connect(this.masterLowPass);
      tom.start(t);
      tom.stop(t + 0.07);
    }
  }
}
