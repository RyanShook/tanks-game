import * as THREE from 'three';
import { GAME_PARAMS, VECTOR_GREEN, VECTOR_RED, VECTOR_YELLOW } from './constants.js';
import * as state from './state.js';
import { createExplosion } from './effects.js';
import { checkCollision } from './utils.js';
import { projectilePool } from './projectile.js';

// Authentic Battlezone Enemy Tank
class EnemyTank {
    constructor(scene, position) {
        this.type = 'tank';
        this.scene = scene;
        this.isDestroyed = false;
        this.lastShotTime = Date.now();
        this.score = GAME_PARAMS.TANK_SCORE;
        
        // Create authentic tank wireframe
        this.createTankGeometry(position);
        scene.add(this.body);
    }
    
    createTankGeometry(position) {
        // Tank body - rectangular wireframe
        const bodyGeometry = new THREE.BoxGeometry(2, 1, 3);
        this.body = new THREE.LineSegments(
            new THREE.EdgesGeometry(bodyGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_GREEN })
        );
        this.body.position.copy(position);
        this.body.position.y = 0.5;
        
        // Tank turret
        const turretGeometry = new THREE.CylinderGeometry(0.6, 0.6, 0.8, 6);
        this.turret = new THREE.LineSegments(
            new THREE.EdgesGeometry(turretGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_GREEN })
        );
        this.turret.position.y = 1;
        this.body.add(this.turret);
        
        // Tank cannon
        const cannonGeometry = new THREE.BoxGeometry(0.2, 0.2, 2);
        this.cannon = new THREE.LineSegments(
            new THREE.EdgesGeometry(cannonGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_GREEN })
        );
        this.cannon.position.set(0, 0.1, 1);
        this.turret.add(this.cannon);
    }
    
    update() {
        if (this.isDestroyed) return;
        
        const now = Date.now();
        const previousPosition = this.body.position.clone();
        const toPlayer = state.tankBody.position.clone().sub(this.body.position);
        const distanceToPlayer = toPlayer.length();
        
        // Authentic Battlezone AI - more aggressive and strategic
        const optimalDistance = 30 + Math.random() * 20;
        
        if (distanceToPlayer > optimalDistance) {
            // Approach with slight evasive maneuvering
            const approachAngle = Math.atan2(toPlayer.z, toPlayer.x) + (Math.random() - 0.5) * 0.5;
            const targetX = this.body.position.x + Math.cos(approachAngle) * GAME_PARAMS.TANK_SPEED;
            const targetZ = this.body.position.z + Math.sin(approachAngle) * GAME_PARAMS.TANK_SPEED;
            
            this.body.position.x = targetX;
            this.body.position.z = targetZ;
            this.body.lookAt(state.tankBody.position);
        } else if (distanceToPlayer < optimalDistance - 10) {
            // Back away while keeping gun trained on player
            this.body.lookAt(state.tankBody.position);
            this.body.translateZ(-GAME_PARAMS.TANK_SPEED * 0.7);
        } else {
            // Strafe around player
            const strafeAngle = Math.atan2(toPlayer.z, toPlayer.x) + Math.PI / 2;
            this.body.position.x += Math.cos(strafeAngle) * GAME_PARAMS.TANK_SPEED * 0.5;
            this.body.position.z += Math.sin(strafeAngle) * GAME_PARAMS.TANK_SPEED * 0.5;
        }
        
        // Smart obstacle avoidance
        if (this.checkTerrainCollision(this.body.position, 2)) {
            this.body.position.copy(previousPosition);
            // Try to go around obstacle
            const avoidAngle = Math.atan2(toPlayer.z, toPlayer.x) + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 3;
            this.body.position.x += Math.cos(avoidAngle) * GAME_PARAMS.TANK_SPEED;
            this.body.position.z += Math.sin(avoidAngle) * GAME_PARAMS.TANK_SPEED;
        }
        
        // Keep within bounds
        this.body.position.x = THREE.MathUtils.clamp(this.body.position.x, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        this.body.position.z = THREE.MathUtils.clamp(this.body.position.z, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        
        // Always point turret at player
        this.turret.lookAt(state.tankBody.position);
        
        // Aggressive firing like original Battlezone
        if (now - this.lastShotTime > GAME_PARAMS.TANK_SHOT_INTERVAL && distanceToPlayer < 120) {
            this.fireAtPlayer();
            this.lastShotTime = now;
        }
    }
    
    fireAtPlayer() {
        const projectile = projectilePool.acquire();
        projectile.visible = true;
        
        const cannonWorldPos = new THREE.Vector3();
        this.cannon.getWorldPosition(cannonWorldPos);
        projectile.position.copy(cannonWorldPos);
        
        const toPlayer = state.tankBody.position.clone().sub(cannonWorldPos).normalize();
        projectile.userData.velocity = toPlayer.multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED * 0.8);
        projectile.userData.distanceTraveled = 0;
        projectile.userData.isEnemyProjectile = true;
        
        state.projectiles.push(projectile);
        createExplosion(cannonWorldPos, VECTOR_GREEN, 0.3);
    }
    
    takeDamage() {
        if (!this.isDestroyed) {
            this.destroy();
            state.score += this.score;
            state.setEnemiesRemaining(state.enemiesRemaining - 1);
        }
    }
    
    destroy() {
        this.isDestroyed = true;
        createExplosion(this.body.position, VECTOR_GREEN, 3);
        this.scene.remove(this.body);
    }
    
    checkTerrainCollision(position, radius) {
        for (const obstacle of state.obstacles) {
            if (checkCollision({ position }, obstacle, radius + 1.5)) return true;
        }
        return false;
    }
}

// Authentic Battlezone Missile Enemy
class EnemyMissile {
    constructor(scene, position) {
        this.type = 'missile';
        this.scene = scene;
        this.isDestroyed = false;
        this.lastShotTime = Date.now();
        this.score = GAME_PARAMS.MISSILE_SCORE;
        
        this.createMissileGeometry(position);
        scene.add(this.body);
    }
    
    createMissileGeometry(position) {
        // Missile body - elongated pyramid
        const missileGeometry = new THREE.ConeGeometry(0.5, 4, 4);
        this.body = new THREE.LineSegments(
            new THREE.EdgesGeometry(missileGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_RED })
        );
        this.body.position.copy(position);
        this.body.position.y = 2;
        this.body.rotation.x = Math.PI / 2;
    }
    
    update() {
        if (this.isDestroyed) return;
        
        const now = Date.now();
        const toPlayer = state.tankBody.position.clone().sub(this.body.position);
        const distanceToPlayer = toPlayer.length();
        
        // Fast, direct tracking of player
        this.body.lookAt(state.tankBody.position);
        this.body.translateZ(GAME_PARAMS.MISSILE_SPEED);
        
        // Keep within bounds
        this.body.position.x = THREE.MathUtils.clamp(this.body.position.x, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        this.body.position.z = THREE.MathUtils.clamp(this.body.position.z, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        
        // Rapid fire
        if (now - this.lastShotTime > GAME_PARAMS.MISSILE_SHOT_INTERVAL && distanceToPlayer < 120) {
            this.fireAtPlayer();
            this.lastShotTime = now;
        }
    }
    
    fireAtPlayer() {
        const projectile = projectilePool.acquire();
        projectile.visible = true;
        projectile.position.copy(this.body.position);
        
        const toPlayer = state.tankBody.position.clone().sub(this.body.position).normalize();
        projectile.userData.velocity = toPlayer.multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED);
        projectile.userData.distanceTraveled = 0;
        projectile.userData.isEnemyProjectile = true;
        
        state.projectiles.push(projectile);
        createExplosion(this.body.position, VECTOR_RED, 0.4);
    }
    
    takeDamage() {
        if (!this.isDestroyed) {
            this.destroy();
            state.score += this.score;
            state.setEnemiesRemaining(state.enemiesRemaining - 1);
        }
    }
    
    destroy() {
        this.isDestroyed = true;
        createExplosion(this.body.position, VECTOR_RED, 2.5);
        this.scene.remove(this.body);
    }
}

// Authentic Battlezone Supertank
class EnemySupertank {
    constructor(scene, position) {
        this.type = 'supertank';
        this.scene = scene;
        this.isDestroyed = false;
        this.lastShotTime = Date.now();
        this.score = GAME_PARAMS.SUPERTANK_SCORE;
        
        this.createSupertankGeometry(position);
        scene.add(this.body);
    }
    
    createSupertankGeometry(position) {
        // Larger, more aggressive tank
        const bodyGeometry = new THREE.BoxGeometry(3, 1.5, 4);
        this.body = new THREE.LineSegments(
            new THREE.EdgesGeometry(bodyGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_YELLOW })
        );
        this.body.position.copy(position);
        this.body.position.y = 0.75;
        
        // Larger turret
        const turretGeometry = new THREE.CylinderGeometry(0.8, 0.8, 1.2, 6);
        this.turret = new THREE.LineSegments(
            new THREE.EdgesGeometry(turretGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_YELLOW })
        );
        this.turret.position.y = 1.5;
        this.body.add(this.turret);
        
        // Dual cannons
        const cannonGeometry = new THREE.BoxGeometry(0.3, 0.3, 2.5);
        this.cannon1 = new THREE.LineSegments(
            new THREE.EdgesGeometry(cannonGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_YELLOW })
        );
        this.cannon1.position.set(-0.4, 0.1, 1.25);
        this.turret.add(this.cannon1);
        
        this.cannon2 = new THREE.LineSegments(
            new THREE.EdgesGeometry(cannonGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_YELLOW })
        );
        this.cannon2.position.set(0.4, 0.1, 1.25);
        this.turret.add(this.cannon2);
    }
    
    update() {
        if (this.isDestroyed) return;
        
        const now = Date.now();
        const previousPosition = this.body.position.clone();
        const toPlayer = state.tankBody.position.clone().sub(this.body.position);
        const distanceToPlayer = toPlayer.length();
        
        // Aggressive pursuit
        if (distanceToPlayer > 25) {
            this.body.lookAt(state.tankBody.position);
            this.body.translateZ(GAME_PARAMS.SUPERTANK_SPEED);
        }
        
        // Obstacle avoidance
        if (this.checkTerrainCollision(this.body.position, 3)) {
            this.body.position.copy(previousPosition);
            this.body.rotateY((Math.random() - 0.5) * 0.6);
        }
        
        // Keep within bounds
        this.body.position.x = THREE.MathUtils.clamp(this.body.position.x, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        this.body.position.z = THREE.MathUtils.clamp(this.body.position.z, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        
        this.turret.lookAt(state.tankBody.position);
        
        // More frequent shooting
        if (now - this.lastShotTime > GAME_PARAMS.SUPERTANK_SHOT_INTERVAL && distanceToPlayer < 140) {
            this.fireAtPlayer();
            this.lastShotTime = now;
        }
    }
    
    fireAtPlayer() {
        // Fire from both cannons
        [this.cannon1, this.cannon2].forEach(cannon => {
            const projectile = projectilePool.acquire();
            projectile.visible = true;
            
            const cannonWorldPos = new THREE.Vector3();
            cannon.getWorldPosition(cannonWorldPos);
            projectile.position.copy(cannonWorldPos);
            
            const toPlayer = state.tankBody.position.clone().sub(cannonWorldPos).normalize();
            projectile.userData.velocity = toPlayer.multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED * 0.9);
            projectile.userData.distanceTraveled = 0;
            projectile.userData.isEnemyProjectile = true;
            
            state.projectiles.push(projectile);
            createExplosion(cannonWorldPos, VECTOR_YELLOW, 0.4);
        });
    }
    
    takeDamage() {
        if (!this.isDestroyed) {
            this.destroy();
            state.score += this.score;
            state.setEnemiesRemaining(state.enemiesRemaining - 1);
        }
    }
    
    destroy() {
        this.isDestroyed = true;
        createExplosion(this.body.position, VECTOR_YELLOW, 4);
        this.scene.remove(this.body);
    }
    
    checkTerrainCollision(position, radius) {
        for (const obstacle of state.obstacles) {
            if (checkCollision({ position }, obstacle, radius + 2)) return true;
        }
        return false;
    }
}

// Authentic Battlezone UFO (Bonus Enemy)
class EnemyUFO {
    constructor(scene, position) {
        this.type = 'ufo';
        this.scene = scene;
        this.isDestroyed = false;
        this.score = GAME_PARAMS.UFO_SCORE;
        this.hoverHeight = 8 + Math.random() * 4;
        this.oscillateTime = 0;
        
        this.createUFOGeometry(position);
        scene.add(this.body);
    }
    
    createUFOGeometry(position) {
        // UFO saucer shape
        const ufoGeometry = new THREE.CylinderGeometry(2, 3, 0.8, 8);
        this.body = new THREE.LineSegments(
            new THREE.EdgesGeometry(ufoGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_YELLOW })
        );
        this.body.position.copy(position);
        this.body.position.y = this.hoverHeight;
        
        // UFO dome
        const domeGeometry = new THREE.SphereGeometry(1.2, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2);
        this.dome = new THREE.LineSegments(
            new THREE.EdgesGeometry(domeGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_YELLOW })
        );
        this.dome.position.y = 0.4;
        this.body.add(this.dome);
    }
    
    update() {
        if (this.isDestroyed) return;
        
        this.oscillateTime += 0.02;
        
        // Slow, wandering movement
        this.body.position.x += Math.sin(this.oscillateTime * 0.7) * GAME_PARAMS.UFO_SPEED;
        this.body.position.z += Math.cos(this.oscillateTime * 0.5) * GAME_PARAMS.UFO_SPEED;
        
        // Gentle hovering
        this.body.position.y = this.hoverHeight + Math.sin(this.oscillateTime * 2) * 0.5;
        
        // Keep within bounds
        this.body.position.x = THREE.MathUtils.clamp(this.body.position.x, -GAME_PARAMS.WORLD_BOUNDS * 0.8, GAME_PARAMS.WORLD_BOUNDS * 0.8);
        this.body.position.z = THREE.MathUtils.clamp(this.body.position.z, -GAME_PARAMS.WORLD_BOUNDS * 0.8, GAME_PARAMS.WORLD_BOUNDS * 0.8);
        
        // Rotate slowly
        this.body.rotation.y += 0.01;
    }
    
    takeDamage() {
        if (!this.isDestroyed) {
            this.destroy();
            state.score += this.score;
            state.setEnemiesRemaining(state.enemiesRemaining - 1);
        }
    }
    
    destroy() {
        this.isDestroyed = true;
        createExplosion(this.body.position, VECTOR_YELLOW, 3.5);
        this.scene.remove(this.body);
    }
}

// Wave spawning system
export function spawnWave(waveNumber) {
    // Clear existing enemies
    state.setEnemiesRemaining(0);
    state.enemyTanks.forEach(enemy => state.scene.remove(enemy.body));
    state.enemyTanks.length = 0;
    
    // Calculate enemy count based on wave
    const baseEnemies = Math.min(2 + Math.floor(waveNumber / 2), 6);
    const spawnRadius = 100 + waveNumber * 10;
    
    for (let i = 0; i < baseEnemies; i++) {
        const angle = (i / baseEnemies) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const distance = spawnRadius + (Math.random() - 0.5) * 40;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        // Spawn different enemy types based on authentic Battlezone probabilities
        const spawnRoll = Math.random();
        let enemy;
        
        if (spawnRoll < GAME_PARAMS.TANK_SPAWN_CHANCE) {
            enemy = new EnemyTank(state.scene, new THREE.Vector3(x, 0, z));
        } else if (spawnRoll < GAME_PARAMS.TANK_SPAWN_CHANCE + GAME_PARAMS.MISSILE_SPAWN_CHANCE) {
            enemy = new EnemyMissile(state.scene, new THREE.Vector3(x, 0, z));
        } else if (spawnRoll < GAME_PARAMS.TANK_SPAWN_CHANCE + GAME_PARAMS.MISSILE_SPAWN_CHANCE + GAME_PARAMS.SUPERTANK_SPAWN_CHANCE) {
            enemy = new EnemySupertank(state.scene, new THREE.Vector3(x, 0, z));
        } else {
            enemy = new EnemyUFO(state.scene, new THREE.Vector3(x, 0, z));
        }
        
        state.enemyTanks.push(enemy);
        state.setEnemiesRemaining(state.enemiesRemaining + 1);
    }
}

// Export terrain collision function for player use
export function checkTerrainCollision(position, radius) {
    for (const obstacle of state.obstacles) {
        if (checkCollision({ position }, obstacle, radius + 1.5)) return true;
    }
    return false;
}

export { EnemyTank, EnemyMissile, EnemySupertank, EnemyUFO };