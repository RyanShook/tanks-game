/**
 * BATTLE ZONE AUDIO SYSTEM
 * 
 * Audio management for authentic arcade sound effects
 * 
 * Key Features:
 * - Three.js positional audio system
 * - Arcade-style sound effects
 * - Background engine sounds
 * - Explosion and weapon audio
 * - Wave progression audio cues
 */

let audioContext = null;
let masterGain = null;
let engineStarted = false;

export function initSounds() {
    if (audioContext) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.28;
    masterGain.connect(audioContext.destination);
}

function tone(frequency, duration, type = 'square', volume = 0.12, endFrequency = frequency) {
    if (!audioContext || !masterGain) return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration);
}

function noise(duration = 0.3, volume = 0.1) {
    if (!audioContext || !masterGain) return;
    const frameCount = Math.floor(audioContext.sampleRate * duration);
    const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);
    }
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    gain.gain.value = volume;
    source.connect(gain).connect(masterGain);
    source.start();
}

function startEngine() {
    if (!audioContext || !masterGain || engineStarted) return;
    engineStarted = true;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 42;
    gain.gain.value = 0.018;
    oscillator.connect(gain).connect(masterGain);
    oscillator.start();
}

export function playSound(soundName) {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume();

    if (soundName === 'shoot') tone(180, 0.12, 'square', 0.16, 48);
    if (soundName === 'hit') tone(92, 0.2, 'sawtooth', 0.16, 36);
    if (soundName === 'explosion') noise(0.28, 0.17);
    if (soundName === 'engineIdle') startEngine();
    if (soundName === 'waveComplete') {
        tone(330, 0.18, 'square', 0.1, 440);
        setTimeout(() => tone(495, 0.28, 'square', 0.1, 660), 140);
    }
    if (soundName === 'newWave') tone(110, 0.45, 'sawtooth', 0.11, 220);
}
