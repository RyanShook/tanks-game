/**
 * POWER-UP SYSTEM
 *
 * Adds collectible battlefield modifiers that reward aggressive play and wave clears.
 * Power-ups are rare, visually bright pickups that rotate and reward the player with
 * temporary shields, rapid-fire cannons, or emergency repairs.
 */

import * as THREE from 'three';
import { VECTOR_GREEN, VECTOR_YELLOW } from './constants.js';
import * as state from './state.js';
import { createExplosion, shakeCamera } from './effects.js';
import { toggleInvulnerabilityIndicator } from './projectile.js';
import { playSound } from './sound.js';

const POWER_UP_CONFIG = {
    shield: {
        duration: 8000,
        color: 0x00ff88,
        label: 'SHIELD',
    },
    rapidFire: {
        duration: 6500,
        color: VECTOR_YELLOW,
        label: 'RAPID FIRE',
    },
    repair: {
        duration: 0,
        color: VECTOR_GREEN,
        label: '+1 LIFE',
    },
};

let nextSpawnTime = Date.now() + 15000;

function createPowerUpMesh(type, position) {
    const { color } = POWER_UP_CONFIG[type];
    const geometry = new THREE.OctahedronGeometry(2.2);
    const wire = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color })
    );

    wire.position.copy(position);
    wire.position.y = 2.5;
    wire.userData.type = type;
    wire.userData.spin = 0.01 + Math.random() * 0.02;
    return wire;
}

function getRandomType() {
    const roll = Math.random();
    if (roll < 0.45) return 'shield';
    if (roll < 0.8) return 'rapidFire';
    return 'repair';
}

function findSpawnPosition(basePosition) {
    const radius = 20 + Math.random() * 30;
    const angle = Math.random() * Math.PI * 2;
    const offset = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const position = basePosition ? basePosition.clone().add(offset) : offset;
    const clamped = Math.min(Math.max(radius, 10), 60);

    position.x = THREE.MathUtils.clamp(position.x, -clamped, clamped);
    position.z = THREE.MathUtils.clamp(position.z, -clamped, clamped);
    return position;
}

export function initPowerUps() {
    state.clearPowerUps();
    state.setActivePowerUps({});
    state.setFireCooldownModifier(1);
    state.setPlayerProjectileLimit(1);
    state.setInvulnerableUntil(0);
    toggleInvulnerabilityIndicator(false);
}

export function spawnPowerUp(type = getRandomType(), anchor) {
    if (!state.scene) return;
    if (state.powerUps.length >= 3) return;

    const position = findSpawnPosition(anchor || state.tankBody?.position || new THREE.Vector3());
    const mesh = createPowerUpMesh(type, position);
    state.scene.add(mesh);
    state.addPowerUp(mesh);
}

export function maybeDropPowerUp(position) {
    if (Math.random() < 0.25) {
        spawnPowerUp(getRandomType(), position);
    }
}

export function rewardWaveClear(waveNumber) {
    const type = waveNumber % 2 === 0 ? 'rapidFire' : 'shield';
    spawnPowerUp(type, state.tankBody?.position);
}

function activatePowerUp(type) {
    const config = POWER_UP_CONFIG[type];
    if (!config) return;

    playSound('newWave');
    shakeCamera(0.6, 240);

    if (type === 'repair') {
        state.setLives(state.lives + 1);
        return;
    }

    const expiresAt = Date.now() + config.duration;
    state.setActivePowerUp(type, expiresAt);

    if (type === 'shield') {
        state.setPlayerInvulnerable(true);
        state.setInvulnerableUntil(Math.max(state.invulnerableUntil, expiresAt));
        toggleInvulnerabilityIndicator(true);
    }

    if (type === 'rapidFire') {
        state.setFireCooldownModifier(0.35);
        state.setPlayerProjectileLimit(3);
    }
}

function deactivatePowerUp(type) {
    state.clearActivePowerUp(type);

    if (type === 'shield' && Date.now() >= state.invulnerableUntil) {
        state.setPlayerInvulnerable(false);
        state.setInvulnerableUntil(0);
        toggleInvulnerabilityIndicator(false);
    }

    if (type === 'rapidFire') {
        state.setFireCooldownModifier(1);
        state.setPlayerProjectileLimit(1);
    }
}

function removePowerUpMesh(powerUp) {
    state.removePowerUp(powerUp);
    if (powerUp.parent) {
        powerUp.parent.remove(powerUp);
    }
}

export function updatePowerUps() {
    const now = Date.now();

    // Timed spawn cadence to keep pickups flowing
    if (now > nextSpawnTime && !state.isGameOver) {
        spawnPowerUp();
        nextSpawnTime = now + 20000 + Math.random() * 5000;
    }

    // Expire active effects
    Object.entries(state.activePowerUps).forEach(([type, expiresAt]) => {
        if (expiresAt <= now) {
            deactivatePowerUp(type);
        }
    });

    for (let i = state.powerUps.length - 1; i >= 0; i--) {
        const powerUp = state.powerUps[i];
        if (!powerUp) {
            state.powerUps.splice(i, 1);
            continue;
        }

        if (!state.tankBody) continue;

        powerUp.rotation.y += powerUp.userData.spin;
        powerUp.rotation.x += 0.01;

        // Pulsing effect
        const scale = 1 + Math.sin(now * 0.005) * 0.1;
        powerUp.scale.set(scale, scale, scale);

        // Pickup detection
        const distance = powerUp.position.distanceTo(state.tankBody.position);
        if (distance < 3.5) {
            activatePowerUp(powerUp.userData.type);
            createExplosion(powerUp.position, powerUp.material.color.getHex(), 2.5);
            removePowerUpMesh(powerUp);
        }
    }
}

export function resetPowerUpTimers() {
    nextSpawnTime = Date.now() + 15000;
}
