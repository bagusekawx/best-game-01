// All sound is synthesized with WebAudio — no audio files, no network.
// A tiny step-sequencer plays a bass + arp loop; one-shots cover the action.
let ctx = null;
let master = null;
let musicGain = null;
let muted = false;
let musicTimer = null;
let step = 0;

const BASS_LINE = [55, 55, 65.41, 55, 49, 55, 73.42, 65.41]; // A1 A1 C2 A1 G1 A1 D2 C2
const ARP_NOTES = [220, 261.63, 329.63, 440, 329.63, 261.63, 329.63, 392];

function ensureContext() {
  if (ctx) return ctx;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.16;
  musicGain.connect(master);
  return ctx;
}

export function unlockAudio() {
  const c = ensureContext();
  if (c && c.state === 'suspended') void c.resume();
  startMusic();
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
  return muted;
}

function tone({ freq, freqEnd, type = 'square', duration = 0.12, volume = 0.2, when = 0, dest = null }) {
  const c = ensureContext();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gain);
  gain.connect(dest || master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noise({ duration = 0.15, volume = 0.25, lowpass = 1200, when = 0 }) {
  const c = ensureContext();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const length = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t0);
}

export const sfx = {
  shoot() { tone({ freq: 880, freqEnd: 520, type: 'square', duration: 0.07, volume: 0.06 }); },
  hit() { noise({ duration: 0.06, volume: 0.10, lowpass: 2400 }); },
  kill() { tone({ freq: 340, freqEnd: 90, type: 'sawtooth', duration: 0.14, volume: 0.12 }); noise({ duration: 0.1, volume: 0.08, lowpass: 900 }); },
  pickup() { tone({ freq: 660, freqEnd: 990, type: 'sine', duration: 0.08, volume: 0.10 }); },
  heal() { tone({ freq: 520, freqEnd: 780, type: 'sine', duration: 0.18, volume: 0.14 }); tone({ freq: 780, freqEnd: 1040, type: 'sine', duration: 0.18, volume: 0.10, when: 0.08 }); },
  levelup() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.16, volume: 0.16, when: i * 0.07 }));
  },
  dash() { noise({ duration: 0.12, volume: 0.12, lowpass: 3200 }); },
  hurt() { tone({ freq: 180, freqEnd: 70, type: 'sawtooth', duration: 0.2, volume: 0.2 }); },
  nova() { tone({ freq: 140, freqEnd: 620, type: 'sine', duration: 0.25, volume: 0.2 }); },
  chest() { [392, 523.25, 659.25].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.14, volume: 0.14, when: i * 0.06 })); },
  boss() { tone({ freq: 65, freqEnd: 40, type: 'sawtooth', duration: 0.9, volume: 0.3 }); tone({ freq: 98, freqEnd: 55, type: 'square', duration: 0.7, volume: 0.16, when: 0.1 }); },
  win() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.22, volume: 0.16, when: i * 0.1 })); },
  lose() { [392, 329.63, 261.63, 196].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.3, volume: 0.16, when: i * 0.16 })); },
  click() { tone({ freq: 1200, freqEnd: 900, type: 'sine', duration: 0.05, volume: 0.08 }); },
};

function musicStep() {
  if (!ctx || muted) { step = (step + 1) % 16; return; }
  const i = step % 8;
  if (step % 2 === 0) tone({ freq: BASS_LINE[i], type: 'triangle', duration: 0.22, volume: 0.5, dest: musicGain });
  if (step % 4 === 1) tone({ freq: ARP_NOTES[i], type: 'square', duration: 0.1, volume: 0.12, dest: musicGain });
  step = (step + 1) % 16;
}

export function startMusic() {
  if (musicTimer || !ensureContext()) return;
  musicTimer = window.setInterval(musicStep, 170);
}

export function stopMusic() {
  if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; }
}
