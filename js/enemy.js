import * as THREE from 'three';
import { GAME_PARAMS, VECTOR_GREEN } from './constants.js';
import * as state from './state.js';
import { createExplosion, createEnhancedExplosion } from './effects.js';
import { checkCollision } from './utils.js';
import { projectilePool } from './projectile.js';
import { createTankBody, createTurret, createCannon } from './player.js';

class EnemyTank {
    constructor(scene, position) {
        this.dimensions = { body: { width: 2, height: 1, depth: 3 }, turret: { radius: 0.6, height: 0.8 }, cannon: { radius: 0.15, length: 2 } };
        this.body = createTankBody(this.dimensions.body.width, this.dimensions.body.height, this.dimensions.body.depth);
        this.body.position.copy(position);
        this.body.position.y = 0.5;
        this.turret = createTurret(this.dimensions.turret.radius, this.dimensions.turret.height);
        this.turret.position.y = this.dimensions.body.height;
        this.body.add(this.turret);
        this.cannon = createCannon(this.dimensions.cannon.radius, this.dimensions.cannon.length);
        this.cannon.position.y = 0.1;
        this.turret.add(this.cannon);
        this.isDestroyed = false;
        this.lastShotTime = Date.now();
        this.scene = scene;
        scene.add(this.body);
    }

    update() {
        if (this.isDestroyed) return;
        const now = Date.now();
        const previousPosition = this.body.position.clone();
        const toPlayer = state.tankBody.position.clone().sub(this.body.position);
        const distanceToPlayer = toPlayer.length();

        // Authentic Battle Zone: Simple direct approach toward player
        if (distanceToPlayer > 15) {
            this.body.lookAt(state.tankBody.position);
            this.body.translateZ(GAME_PARAMS.ENEMY_SPEED);
        } else {
            // Stop and turn turret to face player when close
            this.body.lookAt(state.tankBody.position);
        }

        // Basic collision with obstacles only
        if (checkTerrainCollision(this.body.position, 2)) {
            this.body.position.copy(previousPosition);
            // Simple obstacle avoidance - turn slightly and try again
            this.body.rotateY((Math.random() - 0.5) * 0.5);
        }

        // Keep within world bounds
        this.body.position.x = THREE.MathUtils.clamp(this.body.position.x, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        this.body.position.z = THREE.MathUtils.clamp(this.body.position.z, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        
        // Always point turret at player
        this.turret.lookAt(state.tankBody.position);

        // Simple shooting - fire when in range and timer allows
        if (now - this.lastShotTime > GAME_PARAMS.ENEMY_SHOT_INTERVAL && distanceToPlayer < 60) {
            this.fireAtPlayer();
            this.lastShotTime = now;
        }
    }

    takeDamage(amount) {
        // Authentic Battle Zone: One hit destroys tank
        if (!this.isDestroyed) {
            this.destroy();
            state.score += GAME_PARAMS.TANK_SCORE;
            state.setEnemiesRemaining(state.enemiesRemaining - 1);
        }
    }

    destroy() {
        this.isDestroyed = true;
        createExplosion(this.body.position, VECTOR_GREEN, 3);
        for (let i = 0; i < 5; i++) {
            const offset = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1, (Math.random() - 0.5) * 2);
            const position = this.body.position.clone().add(offset);
            setTimeout(() => createExplosion(position, VECTOR_GREEN, 1 + Math.random()), i * 100);
        }
        this.scene.remove(this.body);
    }

    fireAtPlayer() {
        if (this.isDestroyed) return;
        const projectile = projectilePool.acquire();
        projectile.visible = true;
        const cannonWorldPos = new THREE.Vector3();
        this.cannon.getWorldPosition(cannonWorldPos);
        projectile.position.copy(cannonWorldPos);
        const toPlayer = state.tankBody.position.clone().sub(cannonWorldPos).normalize().multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED * 0.8);
        projectile.userData.velocity = toPlayer;
        projectile.userData.distanceTraveled = 0;
        projectile.userData.creationTime = Date.now();
        projectile.userData.isEnemyProjectile = true;
        state.projectiles.push(projectile);
        createExplosion(cannonWorldPos, VECTOR_GREEN, 0.3);
    }
}


export function spawnWave(waveNumber) {
    state.setEnemiesRemaining(0);
    state.enemyTanks.forEach(tank => state.scene.remove(tank.body));
    state.enemyTanks.length = 0;

    // Authentic Battle Zone: Progressive tank spawning like original
    const numTanks = Math.min(1 + Math.floor(waveNumber / 2), 4);
    const spawnRadius = 80 + waveNumber * 5;
    
    for (let i = 0; i < numTanks; i++) {
        const angle = (i / numTanks) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const distance = spawnRadius + (Math.random() - 0.5) * 20;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const enemyTank = new EnemyTank(state.scene, new THREE.Vector3(x, 0, z));
        state.enemyTanks.push(enemyTank);
        state.setEnemiesRemaining(state.enemiesRemaining + 1);
    }
}



export function checkTerrainCollision(position, radius) {
    if (!position || typeof position.x === 'undefined') {
        console.warn('Invalid position passed to checkTerrainCollision:', position);
        return false;
    }
    const tempObj = { position: position };
    for (const obstacle of state.obstacles) {
        if (!obstacle) continue;
        if (checkCollision(tempObj, obstacle, radius + 1.5)) return true;
    }
    for (const enemy of state.enemyTanks) {
        if (!enemy || !enemy.body || enemy.isDestroyed) continue;
        if (checkCollision(tempObj, enemy.body, radius + 2)) return true;
    }
    return false;
}

