// Procedural Web Audio API synthesizer for CHEF BASTION (100% offline, zero external MP3 dependencies)

import {
  AdaptiveMusicEngine,
  type AdaptiveMusicTelemetry,
} from './musicEngine';
import type { GameMode } from './types';

class SoundEngine {
  public static readonly HAPTIC_MIN_COOLDOWN_MS = 140;
  public static readonly MAX_ACTIVE_SFX_VOICES = 6;
  public static readonly SFX_TYPE_GATE_MS = 45;

  private ctx: AudioContext | null = null;
  public muted = false;
  public masterVolume = 0.8; // 0..1
  public sfxVolume = 0.9;    // 0..1
  public bgmVolume = 0.7;    // 0..1
  public hapticsEnabled = true;
  public readonly musicEngine: AdaptiveMusicEngine;
  private lifecycleBound = false;
  private lastHapticAtMs = -Infinity;
  private voiceEndTimesSec = new Float64Array(SoundEngine.MAX_ACTIVE_SFX_VOICES);
  private lastSfxTypeMs: Record<string, number> = {};

  constructor() {
    this.musicEngine = new AdaptiveMusicEngine(() => this.ensureContext());
    this.bindMobileLifecycle();
  }

  private bindMobileLifecycle() {
    if (this.lifecycleBound || typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }
    this.lifecycleBound = true;

    const handleVisibility = () => {
      if (document.hidden) {
        this.musicEngine.onVisibilityChange(true);
        if (this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend().catch(() => {});
        }
      } else {
        if (!this.muted && this.masterVolume > 0 && this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        this.musicEngine.onVisibilityChange(false);
      }
    };

    const handlePageHide = () => {
      this.musicEngine.onVisibilityChange(true);
      if (this.ctx && this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    };

    const unlockAudioOnGesture = () => {
      if (this.muted || document.hidden) return;
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pointerdown', unlockAudioOnGesture, { passive: true });
    window.addEventListener('keydown', unlockAudioOnGesture, { passive: true });
  }

  public applySettings(settings: {
    masterVolume: number;
    sfxVolume: number;
    bgmVolume: number;
    muted: boolean;
    hapticsEnabled?: boolean;
    gameSpeedMultiplier?: 0.75 | 1.0 | 1.25;
  }) {
    this.masterVolume = Math.max(0, Math.min(1, settings.masterVolume / 100));
    this.sfxVolume = Math.max(0, Math.min(1, settings.sfxVolume / 100));
    this.bgmVolume = Math.max(0, Math.min(1, settings.bgmVolume / 100));
    this.muted = settings.muted;
    if (typeof settings.hapticsEnabled === 'boolean') {
      this.hapticsEnabled = settings.hapticsEnabled;
    }
    this.musicEngine.setVolumeScale(this.getBgmScale());
    if (settings.gameSpeedMultiplier) {
      this.musicEngine.updateTelemetry({ gameSpeedMultiplier: settings.gameSpeedMultiplier });
    }
    if (this.muted || this.masterVolume <= 0 || this.bgmVolume <= 0) {
      this.stopBackgroundMusic();
    }
  }

  public triggerHaptic(style: 'light' | 'medium' | 'heavy' = 'light', nowMs = Date.now()) {
    if (!this.hapticsEnabled || typeof window === 'undefined') return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (nowMs - this.lastHapticAtMs < SoundEngine.HAPTIC_MIN_COOLDOWN_MS) return;
    this.lastHapticAtMs = nowMs;
    try {
      const capHaptics = (
        window as unknown as {
          Capacitor?: {
            Plugins?: {
              Haptics?: {
                impact?: (opts: { style: 'LIGHT' | 'MEDIUM' | 'HEAVY' }) => Promise<void>;
              };
            };
          };
        }
      ).Capacitor?.Plugins?.Haptics;

      if (capHaptics?.impact) {
        const capStyle = style === 'heavy' ? 'HEAVY' : style === 'medium' ? 'MEDIUM' : 'LIGHT';
        capHaptics.impact({ style: capStyle }).catch(() => {});
        return;
      }

      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(style === 'heavy' ? [20, 16, 26] : style === 'medium' ? 14 : 8);
      }
    } catch {
      // Ignore blocked vibration on desktop browsers without user gesture
    }
  }

  private acquireSfxVoices(
    ctx: AudioContext,
    typeKey: string,
    voicesNeeded: number,
    durationSec: number
  ): boolean {
    const perfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const prevTypeMs = this.lastSfxTypeMs[typeKey] ?? -Infinity;
    if (perfNow - prevTypeMs < SoundEngine.SFX_TYPE_GATE_MS) {
      return false;
    }

    const nowSec = ctx.currentTime;
    let freeCount = 0;
    for (let i = 0; i < this.voiceEndTimesSec.length; i++) {
      if (this.voiceEndTimesSec[i] <= nowSec) {
        freeCount++;
      }
    }
    if (freeCount < 1) {
      return false;
    }

    const toClaim = Math.min(voicesNeeded, freeCount);
    let claimed = 0;
    for (let i = 0; i < this.voiceEndTimesSec.length && claimed < toClaim; i++) {
      if (this.voiceEndTimesSec[i] <= nowSec) {
        this.voiceEndTimesSec[i] = nowSec + durationSec;
        claimed++;
      }
    }
    this.lastSfxTypeMs[typeKey] = perfNow;
    return true;
  }

  private getSfxScale(): number {
    if (this.muted) return 0;
    return this.masterVolume * this.sfxVolume;
  }

  private getBgmScale(): number {
    if (this.muted) return 0;
    return this.masterVolume * this.bgmVolume;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (typeof document !== 'undefined' && document.hidden) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playSprayShot() {
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.acquireSfxVoices(ctx, 'spray', 1, 0.07)) return;
    const now = ctx.currentTime;
    const pitchVar = 0.94 + Math.random() * 0.14;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520 * pitchVar, now);
    osc.frequency.exponentialRampToValueAtTime(190 * pitchVar, now + 0.065);

    gain.gain.setValueAtTime(Math.max(0.001, 0.08 * scale), now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.065);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  public playFoamSplit() {
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.acquireSfxVoices(ctx, 'foam', 2, 0.09)) return;
    const now = ctx.currentTime;
    [640, 980].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.015);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + idx * 0.015 + 0.06);
      gain.gain.setValueAtTime(Math.max(0.001, 0.05 * scale), now + idx * 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + idx * 0.015 + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.015);
      osc.stop(now + idx * 0.015 + 0.065);
    });
  }

  public playShieldClink() {
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.acquireSfxVoices(ctx, 'clink', 1, 0.09)) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.08);
    gain.gain.setValueAtTime(Math.max(0.001, 0.11 * scale), now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.085);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playSoapSlip() {
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.acquireSfxVoices(ctx, 'slip', 1, 0.24)) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.24);
    gain.gain.setValueAtTime(Math.max(0.001, 0.14 * scale), now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playSnapPiece(isCombo: boolean) {
    this.triggerHaptic(isCombo ? 'medium' : 'light');
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.acquireSfxVoices(ctx, 'snap', 1, 0.11)) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(isCombo ? 660 : 380, now + 0.09);
    gain.gain.setValueAtTime(Math.max(0.001, 0.16 * scale), now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playSlowMoEnter() {
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.acquireSfxVoices(ctx, 'slowmo', 1, 0.2)) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
    gain.gain.setValueAtTime(Math.max(0.001, 0.12 * scale), now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.19);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Ascending C Major Pentatonic scale (C5, D5, E5, G5, A5, C6, D6, E6) for rapid kill chains (< 1.2s apart)
  public static readonly PENTATONIC_SCALE_HZ = [
    523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51,
  ];
  public static readonly KILL_CHAIN_RESET_MS = 1200;

  private killChainStep = 0;
  private lastKillAtMs = -Infinity;

  /**
   * Advances the pentatonic pitch step when kills occur < 1.2s (1200ms) apart,
   * and resets to step 0 after >= 1.2s without kills.
   */
  public registerKillChainStep(nowMs = Date.now()): {
    step: number;
    freqHz: number;
    pitchMult: number;
  } {
    if (nowMs - this.lastKillAtMs > 0 && nowMs - this.lastKillAtMs < SoundEngine.KILL_CHAIN_RESET_MS) {
      this.killChainStep = Math.min(
        SoundEngine.PENTATONIC_SCALE_HZ.length - 1,
        this.killChainStep + 1
      );
    } else if (nowMs === this.lastKillAtMs) {
      // Simultaneous multi-kill in the exact same ms also steps up cleanly
      this.killChainStep = Math.min(
        SoundEngine.PENTATONIC_SCALE_HZ.length - 1,
        this.killChainStep + 1
      );
    } else {
      this.killChainStep = 0;
    }
    this.lastKillAtMs = nowMs;
    const freqHz = SoundEngine.PENTATONIC_SCALE_HZ[this.killChainStep];
    const pitchMult = Number((freqHz / SoundEngine.PENTATONIC_SCALE_HZ[0]).toFixed(4));
    return { step: this.killChainStep, freqHz, pitchMult };
  }

  public resetKillChain() {
    this.killChainStep = 0;
    this.lastKillAtMs = -Infinity;
  }

  public playStarKill(stars: 1 | 2 | 3, nowMs = Date.now()) {
    const chain = this.registerKillChainStep(nowMs);
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.acquireSfxVoices(ctx, 'kill', stars >= 3 ? 3 : 2, 0.26)) return;
    const now = ctx.currentTime;

    // Primary ascending pentatonic bell note so chained kills sing upward musically
    const bellOsc = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(chain.freqHz, now);
    bellGain.gain.setValueAtTime(Math.max(0.001, 0.14 * scale), now);
    bellGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.24);
    bellOsc.connect(bellGain);
    bellGain.connect(ctx.destination);
    bellOsc.start(now);
    bellOsc.stop(now + 0.26);

    const baseNotes =
      stars === 3
        ? [523.25, 783.99, 1567.98]
        : stars === 2
        ? [440, 659.25]
        : [330];

    const pitchShift = Math.min(1.85, 1 + chain.step * 0.08);
    baseNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = stars === 3 && i === baseNotes.length - 1 ? 'sine' : 'triangle';
      const t = now + i * 0.045;
      osc.frequency.setValueAtTime(freq * pitchShift, t);
      gain.gain.setValueAtTime(Math.max(0.001, (stars === 3 ? 0.14 : 0.095) * scale), t);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + (stars === 3 ? 0.24 : 0.13));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playTowelWhip() {
    this.triggerHaptic('medium');
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.acquireSfxVoices(ctx, 'whip', 2, 0.13)) return;
    const now = ctx.currentTime;

    // Fast cloth whoosh + crisp high-frequency snap crack
    const whoosh = ctx.createOscillator();
    const whooshGain = ctx.createGain();
    whoosh.type = 'sawtooth';
    whoosh.frequency.setValueAtTime(190, now);
    whoosh.frequency.exponentialRampToValueAtTime(1420, now + 0.065);
    whooshGain.gain.setValueAtTime(Math.max(0.001, 0.15 * scale), now);
    whooshGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.085);
    whoosh.connect(whooshGain);
    whooshGain.connect(ctx.destination);
    whoosh.start(now);
    whoosh.stop(now + 0.09);

    const crack = ctx.createOscillator();
    const crackGain = ctx.createGain();
    crack.type = 'square';
    crack.frequency.setValueAtTime(1850, now + 0.055);
    crack.frequency.exponentialRampToValueAtTime(420, now + 0.11);
    crackGain.gain.setValueAtTime(Math.max(0.001, 0.16 * scale), now + 0.055);
    crackGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.12);
    crack.connect(crackGain);
    crackGain.connect(ctx.destination);
    crack.start(now + 0.055);
    crack.stop(now + 0.125);
  }

  public playChainShock() {
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.acquireSfxVoices(ctx, 'chain_shock', 2, 0.1)) return;
    const now = ctx.currentTime;

    [920, 1560].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + idx * 0.025;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.62, t + 0.05);
      gain.gain.setValueAtTime(Math.max(0.001, 0.09 * scale), t);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    });
  }

  public playBleachWave() {
    this.triggerHaptic('heavy');
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.acquireSfxVoices(ctx, 'bleach_wave', 1, 0.4)) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.35);
    gain.gain.setValueAtTime(Math.max(0.001, 0.18 * scale), now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  public playMergeUpgrade(newLevel: number) {
    this.triggerHaptic(newLevel >= 4 ? 'heavy' : 'medium');
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.acquireSfxVoices(ctx, 'merge', 3, 0.3)) return;
    const now = ctx.currentTime;

    const notes =
      newLevel >= 4
        ? [523.25, 783.99, 1046.5, 1567.98] // Supreme Evolution fanfare!
        : newLevel === 3
        ? [523.25, 659.25, 1046.5] // Gold Lv.3 chord
        : [440, 554.37, 659.25]; // Silver Lv.2 chord

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = newLevel >= 4 ? 'sawtooth' : 'triangle';
      const t = now + idx * 0.04;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.06, t + 0.16);
      gain.gain.setValueAtTime(Math.max(0.001, (newLevel >= 4 ? 0.15 : 0.12) * scale), t);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + (newLevel >= 4 ? 0.28 : 0.18));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playChaosSiren() {
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.acquireSfxVoices(ctx, 'siren', 2, 0.32)) return;
    const now = ctx.currentTime;

    [0, 0.16].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now + offset);
      osc.frequency.exponentialRampToValueAtTime(980, now + offset + 0.12);
      gain.gain.setValueAtTime(Math.max(0.001, 0.13 * scale), now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + offset + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });
  }

  public syncBackgroundMusic(isPlaying: boolean, level: number, gameMode?: GameMode) {
    const bgmScale = this.getBgmScale();
    this.musicEngine.setVolumeScale(bgmScale);
    if (!isPlaying || bgmScale <= 0.001 || typeof window === 'undefined') {
      this.stopBackgroundMusic();
      return;
    }
    this.musicEngine.updateTelemetry({
      isPlaying: true,
      level: Math.max(1, level),
      ...(gameMode ? { gameMode } : {}),
    });
  }

  public updateAdaptiveMusic(telemetry: Partial<AdaptiveMusicTelemetry>) {
    const bgmScale = this.getBgmScale();
    this.musicEngine.setVolumeScale(bgmScale);
    if (this.muted || bgmScale <= 0.001) {
      this.musicEngine.stop();
      return;
    }
    this.musicEngine.updateTelemetry(telemetry);
  }

  public stopBackgroundMusic() {
    this.musicEngine.stop();
  }
}

export const soundEngine = new SoundEngine();
