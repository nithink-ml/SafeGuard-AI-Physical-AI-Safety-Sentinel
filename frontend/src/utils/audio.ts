/**
 * Web Audio API Piezo Buzzer Synthesizer
 * Synthesizes a high-fidelity 2.4 kHz active piezo alarm in the browser,
 * matching ESP32 GPIO 4 PWM acoustic output.
 */

let audioCtx: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let isBeeping = false;
let audioEnabled = true;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Starts continuous alternating emergency buzzer chirp (2400 Hz)
 */
export function startAlarmBuzzer(): void {
  if (!audioEnabled || isBeeping) return;

  try {
    const ctx = getAudioContext();
    isBeeping = true;

    oscillator = ctx.createOscillator();
    gainNode = ctx.createGain();

    // 2.4 kHz is standard industrial piezo resonant frequency
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(2400, ctx.currentTime);

    // Initial silent gain
    gainNode.gain.setValueAtTime(0, ctx.currentTime);

    // Rapid pulsing beep pattern (150ms ON, 100ms OFF)
    const now = ctx.currentTime;
    for (let i = 0; i < 40; i++) {
      const startTime = now + i * 0.25;
      gainNode.gain.setValueAtTime(0.08, startTime);
      gainNode.gain.setValueAtTime(0, startTime + 0.15);
    }

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
  } catch (err) {
    console.warn('Web Audio buzzer start prevented by browser policy:', err);
  }
}

/**
 * Stops buzzer playback immediately
 */
export function stopAlarmBuzzer(): void {
  if (!isBeeping) return;

  try {
    if (gainNode && audioCtx) {
      gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    }
    if (oscillator) {
      oscillator.stop();
      oscillator.disconnect();
      oscillator = null;
    }
    gainNode = null;
    isBeeping = false;
  } catch (err) {
    console.warn('Web Audio buzzer stop error:', err);
    isBeeping = false;
  }
}

/**
 * Triggers a single acoustic warning beep
 */
export function triggerSingleBeep(frequency = 2400, durationMs = 120): void {
  if (!audioEnabled) return;

  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch (err) {
    console.warn('Single beep error:', err);
  }
}

let volume = 0.08;

export function setVolume(newVol: number): void {
  volume = Math.max(0, Math.min(1, newVol));
}

export function getVolume(): number {
  return volume;
}

/**
 * Plays a subtle, tactile mechanical switch click (800Hz to 350Hz over 18ms)
 * to provide authentic industrial HMI tactile feedback on button clicks.
 */
export function playTactileClick(): void {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(750, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.016);

    gain.gain.setValueAtTime(volume * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.018);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.02);
  } catch {
    // Ignore audio context autoplay policy restrictions
  }
}

/**
 * Fires a single 350ms 2.4kHz siren chirp so operators can test auditory alerts
 */
export function testSirenChirp(): void {
  if (!audioEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(2400, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(volume, ctx.currentTime + 0.20);
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.32);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignore audio context autoplay policy restrictions
  }
}

export function setAudioEnabled(enabled: boolean): void {
  audioEnabled = enabled;
  if (!enabled) {
    stopAlarmBuzzer();
  }
}

export function isAudioEnabled(): boolean {
  return audioEnabled;
}

