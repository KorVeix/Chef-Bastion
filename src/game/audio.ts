// Procedural Web Audio API synthesizer for CHEF BASTION (100% offline, zero external MP3 dependencies)

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;
  public masterVolume = 0.8; // 0..1
  public sfxVolume = 0.9;    // 0..1
  public bgmVolume = 0.7;    // 0..1

  public applySettings(settings: {
    masterVolume: number;
    sfxVolume: number;
    bgmVolume: number;
    muted: boolean;
  }) {
    this.masterVolume = Math.max(0, Math.min(1, settings.masterVolume / 100));
    this.sfxVolume = Math.max(0, Math.min(1, settings.sfxVolume / 100));
    this.bgmVolume = Math.max(0, Math.min(1, settings.bgmVolume / 100));
    this.muted = settings.muted;
    if (this.muted || this.masterVolume <= 0 || this.bgmVolume <= 0) {
      this.stopBackgroundMusic();
    }
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
    if (!ctx) return;
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
    if (!ctx) return;
    const now = ctx.currentTime;
    [640, 880, 1120].forEach((freq, idx) => {
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
    if (!ctx) return;
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
    if (!ctx) return;
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
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
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
    if (!ctx) return;
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
    if (!ctx) return;
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
        ? [523.25, 659.25, 783.99, 1046.5, 1567.98] // High TV-ad sparkle DING!
        : stars === 2
        ? [440, 554.37, 659.25]
        : [330, 440];

    const pitchShift = Math.min(1.85, 1 + chain.step * 0.08);
    baseNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = stars === 3 && i === baseNotes.length - 1 ? 'sine' : 'triangle';
      const t = now + i * 0.05;
      osc.frequency.setValueAtTime(freq * pitchShift, t);
      gain.gain.setValueAtTime(Math.max(0.001, (stars === 3 ? 0.14 : 0.095) * scale), t);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + (stars === 3 ? 0.26 : 0.13));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  public playTowelWhip() {
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
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
    if (!ctx) return;
    const now = ctx.currentTime;

    [920, 1380, 1760].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      const t = now + idx * 0.022;
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
    const scale = this.getSfxScale();
    if (scale <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
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

  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private bgmLevel = 1;
  private bgmActive = false;

  // 6 subtle musical motifs — changes every 10 levels (1 per Establishment)
  private static readonly BGM_THEMES: {
    wave: OscillatorType;
    tempoMs: number;
    notes: number[];
    bass: number[];
  }[] = [
    // Nv. 1-10: Bistró La Encimera (Light French Bistro pizzicato in C Major)
    {
      wave: 'triangle',
      tempoMs: 420,
      notes: [261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 392.0],
      bass: [130.81, 130.81, 196.0, 196.0, 146.83, 146.83, 196.0, 130.81],
    },
    // Nv. 11-20: Trattoria Vapor & Acero (Warm A minor tarantella walking pulse)
    {
      wave: 'triangle',
      tempoMs: 390,
      notes: [220.0, 261.63, 329.63, 349.23, 329.63, 293.66, 246.94, 329.63],
      bass: [110.0, 110.0, 164.81, 164.81, 146.83, 146.83, 123.47, 164.81],
    },
    // Nv. 21-30: Gran Comedor Imperial (Elegant chamber arpeggio in G Major)
    {
      wave: 'sine',
      tempoMs: 410,
      notes: [196.0, 246.94, 293.66, 392.0, 369.99, 293.66, 246.94, 293.66],
      bass: [98.0, 146.83, 123.47, 146.83, 110.0, 146.83, 98.0, 146.83],
    },
    // Nv. 31-40: Taberna Neón & Conductos (Cool D Dorian lounge synth-bass)
    {
      wave: 'triangle',
      tempoMs: 360,
      notes: [146.83, 174.61, 220.0, 261.63, 246.94, 220.0, 174.61, 196.0],
      bass: [73.42, 73.42, 110.0, 130.81, 123.47, 110.0, 87.31, 98.0],
    },
    // Nv. 41-50: Bastión de Brasas Nocturno (Tactical E Phrygian tension pulse)
    {
      wave: 'triangle',
      tempoMs: 340,
      notes: [164.81, 174.61, 220.0, 246.94, 261.63, 246.94, 220.0, 196.0],
      bass: [82.41, 87.31, 110.0, 123.47, 130.81, 123.47, 110.0, 98.0],
    },
    // Nv. 51-60+: Cámara Frigorífica Suprema (Crystalline F Lydian bell pulse)
    {
      wave: 'sine',
      tempoMs: 370,
      notes: [349.23, 440.0, 523.25, 493.88, 523.25, 659.25, 587.33, 440.0],
      bass: [174.61, 174.61, 220.0, 246.94, 196.0, 196.0, 164.81, 174.61],
    },
  ];

  public syncBackgroundMusic(isPlaying: boolean, level: number) {
    const establishmentIdx = Math.min(
      SoundEngine.BGM_THEMES.length - 1,
      Math.floor((Math.max(1, level) - 1) / 10)
    );
    const prevIdx = Math.min(
      SoundEngine.BGM_THEMES.length - 1,
      Math.floor((Math.max(1, this.bgmLevel) - 1) / 10)
    );
    this.bgmLevel = level;

    if (!isPlaying || this.getBgmScale() <= 0.001 || typeof window === 'undefined') {
      this.stopBackgroundMusic();
      return;
    }

    if (this.bgmActive && establishmentIdx === prevIdx && this.bgmTimer !== null) {
      return;
    }

    this.stopBackgroundMusic();
    this.bgmActive = true;
    const theme = SoundEngine.BGM_THEMES[establishmentIdx];

    const tickNote = () => {
      const bgmScale = this.getBgmScale();
      if (!this.bgmActive || bgmScale <= 0.001) return;
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'running') return;

      const now = ctx.currentTime;
      const step = this.bgmStep % theme.notes.length;
      this.bgmStep += 1;

      // Soft low-passed lead pluck (base gain 0.032 * bgmScale — stays well below SFX!)
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = theme.wave;
      osc.frequency.setValueAtTime(theme.notes[step], now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(880, now);

      gain.gain.setValueAtTime(0.0005, now);
      gain.gain.linearRampToValueAtTime(Math.max(0.001, 0.032 * bgmScale), now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.28);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);

      // Soft warm bass on even beats
      if (step % 2 === 0) {
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'sine';
        bassOsc.frequency.setValueAtTime(theme.bass[step], now);
        bassGain.gain.setValueAtTime(0.0005, now);
        bassGain.gain.linearRampToValueAtTime(Math.max(0.001, 0.026 * bgmScale), now + 0.03);
        bassGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.34);
        bassOsc.connect(bassGain);
        bassGain.connect(ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.36);
      }
    };

    this.bgmTimer = window.setInterval(tickNote, theme.tempoMs);
  }

  public stopBackgroundMusic() {
    this.bgmActive = false;
    if (this.bgmTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
}

export const soundEngine = new SoundEngine();
