// Audio System for Openspacemarin
// Requirements: 17.1–17.6
//
// Programmatic chiptune music and SFX using the Web Audio API.
// All audio is synthesised at runtime — no external audio files are loaded.
//
// Design decisions:
//   - AudioContext is created lazily on the first user interaction to comply
//     with browser autoplay policies (Requirement 17.1).
//   - If Web Audio API is unavailable the system degrades silently — all
//     public methods become no-ops so the rest of the game is unaffected
//     (Requirement 17.6).
//   - Music is built from simple oscillator note sequences looped via
//     recursive scheduling (look-ahead scheduling pattern for glitch-free
//     looping).
//   - SFX are one-shot oscillator envelopes created fresh per call so
//     multiple sounds can overlap without interference.

import type { IAudioSystem, SFXType } from '../types/index.js';

// ---------------------------------------------------------------------------
// Music note helpers
// ---------------------------------------------------------------------------

/** Equal-temperament frequency for a MIDI note number (A4 = 69 = 440 Hz). */
function midiToHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Convert a note name + octave string to a MIDI note number. */
function note(name: string, octave: number): number {
  const SEMITONES: Record<string, number> = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3,
    E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8,
    A: 9, 'A#': 10, Bb: 10, B: 11,
  };
  return (octave + 1) * 12 + (SEMITONES[name] ?? 0);
}

// ---------------------------------------------------------------------------
// Music pattern definitions
// ---------------------------------------------------------------------------

interface NoteEvent {
  /** MIDI note number, or -1 for a rest. */
  midi: number;
  /** Duration in beats (1 beat = one 16th note at the pattern's BPM). */
  beats: number;
}

interface MusicPattern {
  bpm: number;
  /** Melody channel — square wave. */
  melody: NoteEvent[];
  /** Bass channel — triangle wave. */
  bass: NoteEvent[];
}

// Three short looping chiptune patterns with an office/calm atmosphere.
const MUSIC_PATTERNS: MusicPattern[] = [
  // Pattern 0 — "Office Morning" (gentle, upbeat)
  {
    bpm: 120,
    melody: [
      { midi: note('E', 5), beats: 2 }, { midi: note('G', 5), beats: 2 },
      { midi: note('A', 5), beats: 2 }, { midi: note('G', 5), beats: 2 },
      { midi: note('E', 5), beats: 2 }, { midi: note('D', 5), beats: 2 },
      { midi: note('C', 5), beats: 4 },
      { midi: note('D', 5), beats: 2 }, { midi: note('E', 5), beats: 2 },
      { midi: note('G', 5), beats: 2 }, { midi: note('A', 5), beats: 2 },
      { midi: note('G', 5), beats: 4 },
      { midi: -1, beats: 4 },
    ],
    bass: [
      { midi: note('C', 3), beats: 4 }, { midi: note('G', 3), beats: 4 },
      { midi: note('A', 3), beats: 4 }, { midi: note('F', 3), beats: 4 },
      { midi: note('C', 3), beats: 4 }, { midi: note('G', 3), beats: 4 },
      { midi: note('A', 3), beats: 4 }, { midi: note('F', 3), beats: 4 },
    ],
  },
  // Pattern 1 — "Deadline Approaching" (slightly tense, faster)
  {
    bpm: 140,
    melody: [
      { midi: note('A', 5), beats: 1 }, { midi: note('G', 5), beats: 1 },
      { midi: note('F', 5), beats: 2 }, { midi: note('E', 5), beats: 2 },
      { midi: note('D', 5), beats: 1 }, { midi: note('E', 5), beats: 1 },
      { midi: note('F', 5), beats: 4 },
      { midi: note('G', 5), beats: 1 }, { midi: note('A', 5), beats: 1 },
      { midi: note('Bb', 5), beats: 2 }, { midi: note('A', 5), beats: 2 },
      { midi: note('G', 5), beats: 1 }, { midi: note('F', 5), beats: 1 },
      { midi: note('E', 5), beats: 4 },
      { midi: -1, beats: 4 },
    ],
    bass: [
      { midi: note('D', 3), beats: 4 }, { midi: note('A', 3), beats: 4 },
      { midi: note('Bb', 3), beats: 4 }, { midi: note('F', 3), beats: 4 },
      { midi: note('D', 3), beats: 4 }, { midi: note('A', 3), beats: 4 },
      { midi: note('G', 3), beats: 4 }, { midi: note('A', 3), beats: 4 },
    ],
  },
  // Pattern 2 — "Cat Nap" (slow, dreamy)
  {
    bpm: 90,
    melody: [
      { midi: note('C', 5), beats: 4 }, { midi: note('E', 5), beats: 4 },
      { midi: note('G', 5), beats: 4 }, { midi: note('E', 5), beats: 4 },
      { midi: note('F', 5), beats: 4 }, { midi: note('A', 5), beats: 4 },
      { midi: note('G', 5), beats: 8 },
      { midi: note('E', 5), beats: 4 }, { midi: note('D', 5), beats: 4 },
      { midi: note('C', 5), beats: 8 },
      { midi: -1, beats: 4 },
    ],
    bass: [
      { midi: note('C', 3), beats: 8 }, { midi: note('F', 3), beats: 8 },
      { midi: note('G', 3), beats: 8 }, { midi: note('C', 3), beats: 8 },
    ],
  },
];

// ---------------------------------------------------------------------------
// SFX definitions
// ---------------------------------------------------------------------------

interface SFXDef {
  /** Oscillator waveform. */
  type: OscillatorType;
  /** Starting frequency in Hz. */
  freqStart: number;
  /** Ending frequency in Hz (for pitch sweep). */
  freqEnd: number;
  /** Total duration in seconds. */
  duration: number;
  /** Attack time in seconds. */
  attack: number;
  /** Decay time in seconds. */
  decay: number;
  /** Peak gain (0–1). */
  gain: number;
}

const SFX_DEFS: Record<SFXType, SFXDef> = {
  button_click: {
    type: 'square', freqStart: 880, freqEnd: 660,
    duration: 0.08, attack: 0.005, decay: 0.07, gain: 0.25,
  },
  window_open: {
    type: 'triangle', freqStart: 440, freqEnd: 880,
    duration: 0.15, attack: 0.01, decay: 0.12, gain: 0.3,
  },
  window_close: {
    type: 'triangle', freqStart: 880, freqEnd: 440,
    duration: 0.12, attack: 0.005, decay: 0.11, gain: 0.25,
  },
  purchase: {
    type: 'square', freqStart: 523, freqEnd: 784,
    duration: 0.25, attack: 0.01, decay: 0.22, gain: 0.35,
  },
  upgrade: {
    type: 'square', freqStart: 659, freqEnd: 1047,
    duration: 0.3, attack: 0.01, decay: 0.27, gain: 0.35,
  },
  error: {
    type: 'sawtooth', freqStart: 220, freqEnd: 110,
    duration: 0.2, attack: 0.005, decay: 0.19, gain: 0.3,
  },
  achievement: {
    type: 'square', freqStart: 523, freqEnd: 1047,
    duration: 0.5, attack: 0.02, decay: 0.46, gain: 0.4,
  },
  currency_tick: {
    type: 'triangle', freqStart: 1047, freqEnd: 1047,
    duration: 0.05, attack: 0.005, decay: 0.04, gain: 0.15,
  },
};

// ---------------------------------------------------------------------------
// AudioSystem implementation
// ---------------------------------------------------------------------------

export class AudioSystem implements IAudioSystem {
  private ctx: AudioContext | null = null;
  private readonly available: boolean;

  // Volume levels (0–10 → 0–1 gain)
  private musicVolume: number = 5;
  private sfxVolume: number = 5;

  // Music state
  private musicGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;
  private currentPattern: number = -1;
  private musicScheduled: boolean = false;
  private musicStopRequested: boolean = false;

  // Look-ahead scheduling state
  private melodyIndex: number = 0;
  private bassIndex: number = 0;
  private nextMelodyTime: number = 0;
  private nextBassTime: number = 0;
  private scheduleTimerId: ReturnType<typeof setTimeout> | null = null;

  // Active oscillator nodes for the current music (kept so we can stop them)
  private activeOscillators: OscillatorNode[] = [];

  constructor() {
    this.available = typeof AudioContext !== 'undefined' ||
      typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined';
  }

  // ---------------------------------------------------------------------------
  // IAudioSystem interface
  // ---------------------------------------------------------------------------

  /**
   * Start playing a music pattern (0–2). Creates the AudioContext on first
   * call (satisfies autoplay policy — must be called from a user gesture
   * handler or after one has occurred).
   *
   * Requirement 17.1
   */
  playMusic(pattern: number): void {
    if (!this.available) return;
    const ctx = this._getOrCreateContext();
    if (!ctx) return;

    // Stop any currently playing music first
    this._stopMusicInternal();

    const idx = Math.max(0, Math.min(MUSIC_PATTERNS.length - 1, pattern));
    this.currentPattern = idx;
    this.musicStopRequested = false;
    this.musicScheduled = true;

    // Reset sequence positions
    this.melodyIndex = 0;
    this.bassIndex = 0;
    this.nextMelodyTime = ctx.currentTime + 0.05; // small start delay
    this.nextBassTime = ctx.currentTime + 0.05;

    this._scheduleMusicChunk();
  }

  /**
   * Stop background music.
   * Requirement 17.1
   */
  stopMusic(): void {
    if (!this.available) return;
    this._stopMusicInternal();
  }

  /**
   * Set music volume (0–10). Applied immediately.
   * Requirement 17.3, 17.4
   */
  setMusicVolume(level: number): void {
    this.musicVolume = Math.max(0, Math.min(10, level));
    if (this.musicGainNode) {
      this.musicGainNode.gain.setTargetAtTime(
        this._toGain(this.musicVolume),
        this._ctx()?.currentTime ?? 0,
        0.05,
      );
    }
  }

  /**
   * Play a one-shot sound effect.
   * Requirement 17.2
   */
  playSFX(effect: SFXType): void {
    if (!this.available) return;
    if (this.sfxVolume === 0) return;
    const ctx = this._getOrCreateContext();
    if (!ctx) return;

    const def = SFX_DEFS[effect];
    if (!def) return;

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.connect(this.sfxGainNode ?? ctx.destination);

    // Envelope: attack → decay → silence
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(def.gain, now + def.attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + def.duration);

    const osc = ctx.createOscillator();
    osc.type = def.type;
    osc.frequency.setValueAtTime(def.freqStart, now);
    if (def.freqEnd !== def.freqStart) {
      osc.frequency.exponentialRampToValueAtTime(def.freqEnd, now + def.duration);
    }
    osc.connect(gainNode);
    osc.start(now);
    osc.stop(now + def.duration + 0.01);

    // Achievement SFX gets a second harmonic for a richer "fanfare" feel
    if (effect === 'achievement') {
      this._playAchievementFanfare(ctx, now);
    }
  }

  /**
   * Set SFX volume (0–10). Applied immediately.
   * Requirement 17.3, 17.5
   */
  setSFXVolume(level: number): void {
    this.sfxVolume = Math.max(0, Math.min(10, level));
    if (this.sfxGainNode) {
      this.sfxGainNode.gain.setTargetAtTime(
        this._toGain(this.sfxVolume),
        this._ctx()?.currentTime ?? 0,
        0.05,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Convert a 0–10 volume level to a 0–1 gain value. */
  private _toGain(level: number): number {
    return level / 10;
  }

  /** Return the current AudioContext, or null if unavailable. */
  private _ctx(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Create the AudioContext on first call (lazy init for autoplay policy).
   * Sets up the master gain nodes for music and SFX.
   */
  private _getOrCreateContext(): AudioContext | null {
    if (!this.available) return null;
    if (this.ctx) {
      // Resume if suspended (browser may suspend after inactivity)
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return this.ctx;
    }

    try {
      const Ctor =
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
        AudioContext;
      this.ctx = new Ctor();

      // Master gain nodes — one for music, one for SFX
      this.musicGainNode = this.ctx.createGain();
      this.musicGainNode.gain.value = this._toGain(this.musicVolume);
      this.musicGainNode.connect(this.ctx.destination);

      this.sfxGainNode = this.ctx.createGain();
      this.sfxGainNode.gain.value = this._toGain(this.sfxVolume);
      this.sfxGainNode.connect(this.ctx.destination);

      return this.ctx;
    } catch {
      // Web Audio API unavailable despite feature detection — degrade silently
      return null;
    }
  }

  /** Stop music and clean up scheduled oscillators. */
  private _stopMusicInternal(): void {
    this.musicStopRequested = true;
    this.musicScheduled = false;

    if (this.scheduleTimerId !== null) {
      clearTimeout(this.scheduleTimerId);
      this.scheduleTimerId = null;
    }

    const now = this.ctx?.currentTime ?? 0;
    for (const osc of this.activeOscillators) {
      try {
        osc.stop(now + 0.02);
      } catch {
        // Already stopped — ignore
      }
    }
    this.activeOscillators = [];
    this.currentPattern = -1;
  }

  // ---------------------------------------------------------------------------
  // Look-ahead music scheduling
  // ---------------------------------------------------------------------------

  /**
   * Schedule the next ~0.5 s of music notes ahead of time, then set a
   * timeout to call itself again. This "look-ahead scheduler" pattern
   * produces glitch-free looping without blocking the main thread.
   */
  private _scheduleMusicChunk(): void {
    if (this.musicStopRequested || !this.musicScheduled) return;
    const ctx = this.ctx;
    if (!ctx || !this.musicGainNode) return;

    const pattern = MUSIC_PATTERNS[this.currentPattern];
    if (!pattern) return;

    const LOOK_AHEAD_S = 0.5; // schedule this many seconds ahead
    const SCHEDULE_INTERVAL_MS = 200; // re-schedule every 200 ms

    const beatDuration = 60 / (pattern.bpm * 4); // 16th-note duration in seconds

    // Schedule melody notes
    while (this.nextMelodyTime < ctx.currentTime + LOOK_AHEAD_S) {
      const ev = pattern.melody[this.melodyIndex % pattern.melody.length];
      if (ev.midi >= 0) {
        this._scheduleNote(
          ctx,
          'square',
          midiToHz(ev.midi),
          this.nextMelodyTime,
          ev.beats * beatDuration,
          0.18,
          this.musicGainNode,
        );
      }
      this.nextMelodyTime += ev.beats * beatDuration;
      this.melodyIndex++;
      // Loop: when we've played the full melody once, wrap index
      if (this.melodyIndex >= pattern.melody.length) {
        this.melodyIndex = 0;
      }
    }

    // Schedule bass notes
    while (this.nextBassTime < ctx.currentTime + LOOK_AHEAD_S) {
      const ev = pattern.bass[this.bassIndex % pattern.bass.length];
      if (ev.midi >= 0) {
        this._scheduleNote(
          ctx,
          'triangle',
          midiToHz(ev.midi),
          this.nextBassTime,
          ev.beats * beatDuration,
          0.12,
          this.musicGainNode,
        );
      }
      this.nextBassTime += ev.beats * beatDuration;
      this.bassIndex++;
      if (this.bassIndex >= pattern.bass.length) {
        this.bassIndex = 0;
      }
    }

    // Re-schedule
    this.scheduleTimerId = setTimeout(() => {
      this._scheduleMusicChunk();
    }, SCHEDULE_INTERVAL_MS);
  }

  /**
   * Create and start a single oscillator note at a scheduled time.
   * The oscillator is tracked in `activeOscillators` so it can be stopped.
   */
  private _scheduleNote(
    ctx: AudioContext,
    type: OscillatorType,
    frequency: number,
    startTime: number,
    duration: number,
    gain: number,
    destination: AudioNode,
  ): void {
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.005);
    gainNode.gain.setValueAtTime(gain, startTime + duration - 0.02);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
    gainNode.connect(destination);

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.connect(gainNode);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);

    this.activeOscillators.push(osc);

    // Prune finished oscillators periodically to avoid unbounded growth
    if (this.activeOscillators.length > 64) {
      this.activeOscillators = this.activeOscillators.filter((o) => {
        try {
          // If the oscillator has already stopped, accessing its state
          // may throw in some browsers — treat that as "done"
          return o.context.state !== 'closed';
        } catch {
          return false;
        }
      });
    }
  }

  /**
   * Play a short two-note fanfare chord for the achievement SFX.
   * Called in addition to the main SFX oscillator.
   */
  private _playAchievementFanfare(ctx: AudioContext, now: number): void {
    const dest = this.sfxGainNode ?? ctx.destination;
    // Major third above the base note (E5 + G#5)
    const notes = [midiToHz(note('E', 5)), midiToHz(note('G', 5)), midiToHz(note('B', 5))];
    notes.forEach((freq, i) => {
      const delay = i * 0.08;
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, now + delay);
      gainNode.gain.linearRampToValueAtTime(0.25, now + delay + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.4);
      gainNode.connect(dest);

      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;
      osc.connect(gainNode);
      osc.start(now + delay);
      osc.stop(now + delay + 0.45);
    });
  }
}
