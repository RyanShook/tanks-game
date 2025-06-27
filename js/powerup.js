import * as THREE from 'three';
import { GAME_PARAMS, VECTOR_GREEN } from './constants.js';
import * as state from './state.js';
import { createExplosion } from './effects.js';
import { checkCollision } from './utils.js';
import { updatePowerUpDisplay } from './hud.js';

class PowerUp {
    constructor(scene, position, type) {
        this.scene = scene;
        this.type = type;
        this.isCollected = false;
        
        const geometry = new THREE.OctahedronGeometry(0.8);
        this.mesh = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({ color: VECTOR_GREEN })
        );
        this.mesh.position.copy(position);
        this.mesh.position.y = 1;
        this.mesh.userData.isPowerUp = true;
        this.mesh.userData.type = type;
        
        scene.add(this.mesh);
        
        this.startTime = Date.now();
        this.animate();
    }
    
    animate() {
        if (this.isCollected) return;
        
        const elapsed = Date.now() - this.startTime;
        this.mesh.position.y = 1 + Math.sin(elapsed * 0.003) * 0.2;
        this.mesh.rotation.y += 0.02;
        
        requestAnimationFrame(() => this.animate());
    }
    
    collect() {
        if (this.isCollected) return;
        
        this.isCollected = true;
        this.scene.remove(this.mesh);
        
        const powerUp = GAME_PARAMS.POWERUP_TYPES[this.type];
        powerUp.effect(state);
        
        state.activePowerUps.add(this.type);
        updatePowerUpDisplay();
        
        createExplosion(this.mesh.position, VECTOR_GREEN, 1);
        
        setTimeout(() => {
            powerUp.reset(state);
            state.activePowerUps.delete(this.type);
            updatePowerUpDisplay();
        }, powerUp.duration);
    }
}

function spawnPowerUp() {
    if (state.isGameOver) return;
    
    const now = Date.now();
    if (now - state.lastPowerUpSpawn < GAME_PARAMS.POWERUP_SPAWN_INTERVAL) return;
    
    const x = (Math.random() - 0.5) * GAME_PARAMS.WORLD_BOUNDS * 1.5;
    const z = (Math.random() - 0.5) * GAME_PARAMS.WORLD_BOUNDS * 1.5;
    
    const types = Object.keys(GAME_PARAMS.POWERUP_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    
    const powerUp = new PowerUp(state.scene, new THREE.Vector3(x, 0, z), type);
    state.powerUps.push(powerUp);
    
    state.setLastPowerUpSpawn(now);
}

export function updatePowerUps() {
    for (let i = state.powerUps.length - 1; i >= 0; i--) {
        const powerUp = state.powerUps[i];
        if (powerUp.isCollected) {
            state.powerUps.splice(i, 1);
            continue;
        }
        
        if (checkCollision(powerUp.mesh, state.tankBody, 2)) {
            powerUp.collect();
        }
    }
    
    spawnPowerUp();
}
