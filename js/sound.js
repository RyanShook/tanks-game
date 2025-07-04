import * as THREE from 'three';

const audioListener = new THREE.AudioListener();
const audioLoader = new THREE.AudioLoader();
const sounds = {
    shoot: null,
    explosion: null,
    hit: null,
    engineIdle: null,
    waveComplete: null,
    newWave: null
};

export function initSounds(camera) {
    camera.add(audioListener);

    sounds.shoot = new THREE.Audio(audioListener);
    sounds.explosion = new THREE.Audio(audioListener);
    sounds.hit = new THREE.Audio(audioListener);
    sounds.engineIdle = new THREE.Audio(audioListener);
    sounds.waveComplete = new THREE.Audio(audioListener);
    sounds.newWave = new THREE.Audio(audioListener);
    
    audioLoader.load('https://cdn.freesound.org/previews/495/495005_6142149-lq.mp3', buffer => {
        sounds.shoot.setBuffer(buffer);
        sounds.shoot.setVolume(0.5);
    });
    
    audioLoader.load('https://cdn.freesound.org/previews/587/587183_7724198-lq.mp3', buffer => {
        sounds.explosion.setBuffer(buffer);
        sounds.explosion.setVolume(0.6);
    });
    
    audioLoader.load('https://cdn.freesound.org/previews/563/563197_12517458-lq.mp3', buffer => {
        sounds.hit.setBuffer(buffer);
        sounds.hit.setVolume(0.4);
    });
    
    audioLoader.load('https://cdn.freesound.org/previews/573/573577_13532577-lq.mp3', buffer => {
        sounds.engineIdle.setBuffer(buffer);
        sounds.engineIdle.setVolume(0.2);
        sounds.engineIdle.setLoop(true);
    });
    
    // Wave complete sound (victory chime)
    audioLoader.load('https://cdn.freesound.org/previews/316/316847_5123451-lq.mp3', buffer => {
        sounds.waveComplete.setBuffer(buffer);
        sounds.waveComplete.setVolume(0.7);
    });
    
    // New wave sound (warning/alert)
    audioLoader.load('https://cdn.freesound.org/previews/456/456965_9785839-lq.mp3', buffer => {
        sounds.newWave.setBuffer(buffer);
        sounds.newWave.setVolume(0.6);
    });
}

export function playSound(soundName) {
    const sound = sounds[soundName];
    if (sound && sound.buffer && !sound.isPlaying) {
        sound.play();
    }
}
