/**
 * AUTHENTIC BATTLE ZONE ENEMY SYSTEM
 * 
 * Implements AI-controlled enemies from the original 1980 arcade game
 * 
 * Enemy Types:
 * - EnemyTank: Standard green wireframe tanks with tactical AI
 * - EnemyMissile: Fast-moving red projectile enemies
 * - EnemySuperTank: Heavily armored yellow tanks with dual cannons
 * - EnemyUFO: Bonus target flying saucers (non-aggressive)
 * 
 * Key Features:
 * - Authentic wireframe geometry matching original arcade
 * - Smart AI with tactical positioning and evasive maneuvers
 * - Progressive wave spawning system
 * - Collision detection with terrain and obstacles
 */

import * as THREE from 'three';
import { GAME_PARAMS, VECTOR_GREEN, VECTOR_RED, VECTOR_YELLOW } from './constants.js';
import * as state from './state.js';
import { createExplosion } from './effects.js';
import { checkCollision } from './utils.js';
import { projectilePool } from './projectile.js';

/**
 * ENEMY TANK CLASS
 * Standard Battle Zone enemy with tactical AI
 */
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
        // Tank body - larger and more visible wireframe
        const bodyGeometry = new THREE.BoxGeometry(4, 2, 6);
        this.body = new THREE.LineSegments(
            new THREE.EdgesGeometry(bodyGeometry),
            new THREE.LineBasicMaterial({ 
                color: VECTOR_GREEN,
                linewidth: 2 // Thicker lines for better visibility
            })
        );
        this.body.position.copy(position);
        this.body.position.y = 1;
        
        // Tank turret - larger
        const turretGeometry = new THREE.CylinderGeometry(1.2, 1.2, 1.6, 6);
        this.turret = new THREE.LineSegments(
            new THREE.EdgesGeometry(turretGeometry),
            new THREE.LineBasicMaterial({ 
                color: VECTOR_GREEN,
                linewidth: 2
            })
        );
        this.turret.position.y = 1.8;
        this.body.add(this.turret);
        
        // Tank cannon - larger and more visible
        const cannonGeometry = new THREE.BoxGeometry(0.4, 0.4, 4);
        this.cannon = new THREE.LineSegments(
            new THREE.EdgesGeometry(cannonGeometry),
            new THREE.LineBasicMaterial({ 
                color: VECTOR_GREEN,
                linewidth: 2
            })
        );
        this.cannon.position.set(0, 0.2, 2);
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
        if (checkTerrainCollision(this.body.position, 2)) {
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
            state.setScore(state.score + this.score);
            state.setTanksDestroyed(state.tanksDestroyed + 1);
            state.setEnemiesRemaining(state.enemiesRemaining - 1);
        }
    }
    
    destroy() {
        this.isDestroyed = true;
        createExplosion(this.body.position, VECTOR_GREEN, 3);
        this.scene.remove(this.body);
    }
}

// Wave spawning system - Authentic Battle Zone approach
export function spawnWave(waveNumber) {
    // Clear existing enemies
    state.setEnemiesRemaining(0);
    state.enemyTanks.forEach(enemy => state.scene.remove(enemy.body));
    state.enemyTanks.length = 0;
    
    // More enemies for better gameplay experience
    const baseEnemies = Math.min(3 + waveNumber, 8);
    const spawnRadius = 80 + waveNumber * 10; // Spawn closer for easier finding
    
    for (let i = 0; i < baseEnemies; i++) {
        const angle = (i / baseEnemies) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const distance = spawnRadius + (Math.random() - 0.5) * 60;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const position = new THREE.Vector3(x, 0, z);
        
        let enemy;
        const rand = Math.random();
        
        // Authentic Battle Zone enemy progression
        if (waveNumber === 1) {
            // Wave 1: Only tanks
            enemy = new EnemyTank(state.scene, position);
        } else if (waveNumber === 2) {
            // Wave 2: Tanks and occasional missile
            if (rand < 0.3) {
                enemy = new EnemyMissile(state.scene, position);
            } else {
                enemy = new EnemyTank(state.scene, position);
            }
        } else if (waveNumber >= 3) {
            // Wave 3+: All enemy types
            if (rand < 0.15 && waveNumber >= 4) {
                enemy = new EnemySuperTank(state.scene, position);
            } else if (rand < 0.4) {
                enemy = new EnemyMissile(state.scene, position);
            } else {
                enemy = new EnemyTank(state.scene, position);
            }
        }
        
        state.enemyTanks.push(enemy);
        state.setEnemiesRemaining(state.enemiesRemaining + 1);
    }
    
    // Occasionally spawn a UFO for bonus points (doesn't count toward wave completion)
    if (Math.random() < 0.2 && waveNumber >= 2) {
        const ufoAngle = Math.random() * Math.PI * 2;
        const ufoDistance = 200 + Math.random() * 100;
        const ufoX = Math.cos(ufoAngle) * ufoDistance;
        const ufoZ = Math.sin(ufoAngle) * ufoDistance;
        const ufoPosition = new THREE.Vector3(ufoX, 0, ufoZ);
        
        const ufo = new EnemyUFO(state.scene, ufoPosition);
        state.enemyTanks.push(ufo);
        // UFO doesn't count toward enemiesRemaining for wave completion
    }
}

// Export terrain collision function for player use
export function checkTerrainCollision(position, radius) {
    for (const obstacle of state.obstacles) {
        if (checkCollision({ position }, obstacle, radius + 1.5)) return true;
    }
    return false;
}

// Authentic Battlezone Missile
class EnemyMissile {
    constructor(scene, position) {
        this.type = 'missile';
        this.scene = scene;
        this.isDestroyed = false;
        this.score = GAME_PARAMS.MISSILE_SCORE;
        this.speed = 0.1;
        this.target = state.tankBody.position.clone();
        
        this.createMissileGeometry(position);
        scene.add(this.body);
    }
    
    createMissileGeometry(position) {
        // Missile - thin, fast-moving projectile
        const missileGeometry = new THREE.ConeGeometry(0.3, 4, 6);
        this.body = new THREE.LineSegments(
            new THREE.EdgesGeometry(missileGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_RED })
        );
        this.body.position.copy(position);
        this.body.position.y = 1;
        this.body.rotation.x = Math.PI;
    }
    
    update() {
        if (this.isDestroyed) return;
        
        // Missile flies straight toward initial target position
        const direction = this.target.clone().sub(this.body.position).normalize();
        this.body.position.add(direction.multiplyScalar(this.speed));
        this.body.lookAt(this.target);
        
        // Check if missile hit ground
        if (this.body.position.y <= 0) {
            createExplosion(this.body.position, VECTOR_RED, 2);
            this.destroy();
        }
        
        // Check if missile reached target area
        const distanceToTarget = this.body.position.distanceTo(this.target);
        if (distanceToTarget < 3) {
            createExplosion(this.body.position, VECTOR_RED, 4);
            this.destroy();
        }
    }
    
    takeDamage() {
        if (!this.isDestroyed) {
            this.destroy();
            state.setScore(state.score + this.score);
            state.setTanksDestroyed(state.tanksDestroyed + 1);
            state.setEnemiesRemaining(state.enemiesRemaining - 1);
        }
    }
    
    destroy() {
        this.isDestroyed = true;
        createExplosion(this.body.position, VECTOR_RED, 2);
        this.scene.remove(this.body);
    }
}

// Authentic Battlezone Super Tank
class EnemySuperTank {
    constructor(scene, position) {
        this.type = 'supertank';
        this.scene = scene;
        this.isDestroyed = false;
        this.lastShotTime = Date.now();
        this.score = GAME_PARAMS.SUPERTANK_SCORE;
        this.health = 2; // Takes 2 hits
        
        this.createSuperTankGeometry(position);
        scene.add(this.body);
    }
    
    createSuperTankGeometry(position) {
        // Larger, more angular tank
        const bodyGeometry = new THREE.BoxGeometry(3, 1.5, 4);
        this.body = new THREE.LineSegments(
            new THREE.EdgesGeometry(bodyGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_YELLOW })
        );
        this.body.position.copy(position);
        this.body.position.y = 0.75;
        
        // Larger turret
        const turretGeometry = new THREE.CylinderGeometry(0.8, 0.8, 1, 8);
        this.turret = new THREE.LineSegments(
            new THREE.EdgesGeometry(turretGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_YELLOW })
        );
        this.turret.position.y = 1.5;
        this.body.add(this.turret);
        
        // Dual cannons
        const cannonGeometry = new THREE.BoxGeometry(0.3, 0.3, 3);
        this.cannon1 = new THREE.LineSegments(
            new THREE.EdgesGeometry(cannonGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_YELLOW })
        );
        this.cannon1.position.set(-0.4, 0.1, 1.5);
        this.turret.add(this.cannon1);
        
        this.cannon2 = new THREE.LineSegments(
            new THREE.EdgesGeometry(cannonGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_YELLOW })
        );
        this.cannon2.position.set(0.4, 0.1, 1.5);
        this.turret.add(this.cannon2);
    }
    
    update() {
        if (this.isDestroyed) return;
        
        const now = Date.now();
        const previousPosition = this.body.position.clone();
        const toPlayer = state.tankBody.position.clone().sub(this.body.position);
        const distanceToPlayer = toPlayer.length();
        
        // More defensive AI - keeps distance
        const optimalDistance = 50 + Math.random() * 30;
        
        if (distanceToPlayer < optimalDistance) {
            // Back away while firing
            this.body.lookAt(state.tankBody.position);
            this.body.translateZ(-GAME_PARAMS.TANK_SPEED * 0.5);
        } else {
            // Strafe to maintain distance
            const strafeAngle = Math.atan2(toPlayer.z, toPlayer.x) + Math.PI / 2;
            this.body.position.x += Math.cos(strafeAngle) * GAME_PARAMS.TANK_SPEED * 0.3;
            this.body.position.z += Math.sin(strafeAngle) * GAME_PARAMS.TANK_SPEED * 0.3;
        }
        
        // Obstacle avoidance
        if (checkTerrainCollision(this.body.position, 3)) {
            this.body.position.copy(previousPosition);
        }
        
        // Keep within bounds
        this.body.position.x = THREE.MathUtils.clamp(this.body.position.x, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        this.body.position.z = THREE.MathUtils.clamp(this.body.position.z, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        
        this.turret.lookAt(state.tankBody.position);
        
        // Faster firing rate
        if (now - this.lastShotTime > GAME_PARAMS.TANK_SHOT_INTERVAL * 0.7 && distanceToPlayer < 150) {
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
            projectile.userData.velocity = toPlayer.multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED);
            projectile.userData.distanceTraveled = 0;
            projectile.userData.isEnemyProjectile = true;
            
            state.projectiles.push(projectile);
            createExplosion(cannonWorldPos, VECTOR_YELLOW, 0.4);
        });
    }
    
    takeDamage() {
        this.health--;
        createExplosion(this.body.position, VECTOR_YELLOW, 1.5);
        
        if (this.health <= 0 && !this.isDestroyed) {
            this.destroy();
            state.setScore(state.score + this.score);
            state.setTanksDestroyed(state.tanksDestroyed + 1);
            state.setEnemiesRemaining(state.enemiesRemaining - 1);
        }
    }
    
    destroy() {
        this.isDestroyed = true;
        createExplosion(this.body.position, VECTOR_YELLOW, 4);
        this.scene.remove(this.body);
    }
}

// Authentic Battlezone UFO (Flying Saucer)
class EnemyUFO {
    constructor(scene, position) {
        this.type = 'ufo';
        this.scene = scene;
        this.isDestroyed = false;
        this.score = GAME_PARAMS.UFO_SCORE;
        this.speed = GAME_PARAMS.TANK_SPEED * 0.8;
        this.hoverHeight = 15 + Math.random() * 10;
        this.hoverDirection = (Math.random() - 0.5) * 2;
        
        this.createUFOGeometry(position);
        scene.add(this.body);
    }
    
    createUFOGeometry(position) {
        // Classic flying saucer shape
        const saucerGroup = new THREE.Group();
        
        // Saucer body (flattened sphere)
        const bodyGeometry = new THREE.SphereGeometry(3, 8, 4);
        bodyGeometry.scale(1, 0.3, 1);
        this.body = new THREE.LineSegments(
            new THREE.EdgesGeometry(bodyGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_YELLOW })
        );
        
        // UFO dome
        const domeGeometry = new THREE.SphereGeometry(1.5, 6, 4);
        const dome = new THREE.LineSegments(
            new THREE.EdgesGeometry(domeGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_YELLOW })
        );
        dome.position.y = 0.5;
        this.body.add(dome);
        
        this.body.position.copy(position);
        this.body.position.y = this.hoverHeight;
    }
    
    update() {
        if (this.isDestroyed) return;
        
        // UFO behavior: Slowly drift across the battlefield, doesn't attack
        // Authentic Battle Zone: UFO moves in straight line and can be shot for bonus points
        this.body.position.x += this.hoverDirection * this.speed;
        this.body.position.z += (Math.random() - 0.5) * this.speed * 0.3;
        
        // Keep within bounds, reverse direction if needed
        if (Math.abs(this.body.position.x) > GAME_PARAMS.WORLD_BOUNDS * 0.8) {
            this.hoverDirection *= -1;
        }
        
        // Gentle floating motion
        this.body.position.y = this.hoverHeight + Math.sin(Date.now() * 0.001) * 2;
        this.body.rotation.y += 0.01;
        
        // Remove UFO if it gets too far away
        const distanceFromCenter = Math.sqrt(
            this.body.position.x * this.body.position.x + 
            this.body.position.z * this.body.position.z
        );
        if (distanceFromCenter > GAME_PARAMS.WORLD_BOUNDS) {
            this.destroy();
        }
    }
    
    takeDamage() {
        if (!this.isDestroyed) {
            this.destroy();
            state.setScore(state.score + this.score);
            state.setTanksDestroyed(state.tanksDestroyed + 1);
            // UFO doesn't count towards wave completion
        }
    }
    
    destroy() {
        this.isDestroyed = true;
        createExplosion(this.body.position, VECTOR_YELLOW, 3);
        this.scene.remove(this.body);
    }
}

export { EnemyTank, EnemyMissile, EnemySuperTank, EnemyUFO };