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
        this.health = GAME_PARAMS.MAX_HEALTH;
        this.isDestroyed = false;
        this.lastShotTime = Date.now();
        this.scene = scene;
        this.state = 'seeking';
        this.stateTimer = 0;
        scene.add(this.body);
    }

    update() {
        if (this.isDestroyed) return;
        const now = Date.now();
        const previousPosition = this.body.position.clone();
        const toPlayer = state.tankBody.position.clone().sub(this.body.position);
        const distanceToPlayer = toPlayer.length();

        if (this.stateTimer < now) {
            if (Math.random() < 0.3) {
                this.state = Math.random() < 0.7 ? 'seeking' : 'retreating';
                this.stateTimer = now + 2000 + Math.random() * 3000;
            }
        }

        if (this.state === 'seeking' && distanceToPlayer > GAME_PARAMS.ENEMY_IDEAL_DISTANCE) {
            this.body.lookAt(state.tankBody.position);
            this.body.translateZ(GAME_PARAMS.ENEMY_SPEED);
        } else if (this.state === 'retreating' || distanceToPlayer < GAME_PARAMS.ENEMY_IDEAL_DISTANCE - 5) {
            this.body.lookAt(state.tankBody.position);
            this.body.translateZ(-GAME_PARAMS.ENEMY_SPEED);
        }

        if (checkTerrainCollision(this.body.position, 2)) {
            this.body.position.copy(previousPosition);
        }

        this.body.position.x = THREE.MathUtils.clamp(this.body.position.x, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        this.body.position.z = THREE.MathUtils.clamp(this.body.position.z, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        this.turret.lookAt(state.tankBody.position);

        if (now - this.lastShotTime > GAME_PARAMS.ENEMY_SHOT_INTERVAL && distanceToPlayer < 40 && this.state === 'seeking') {
            this.fireAtPlayer();
            this.lastShotTime = now;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDestroyed) {
            this.destroy();
            state.score += GAME_PARAMS.TANK_SCORE;
            state.setEnemiesRemaining(state.enemiesRemaining - 1);
            if (Math.floor(state.score / GAME_PARAMS.BONUS_LIFE_SCORE) > Math.floor((state.score - GAME_PARAMS.TANK_SCORE) / GAME_PARAMS.BONUS_LIFE_SCORE)) {
                state.setPlayerHitCount(Math.max(0, state.playerHitCount - 1));
            }
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

class EnemySaucer {
    constructor(scene, position) {
        this.scene = scene;
        this.mesh = createSaucerMesh();
        this.mesh.position.copy(position);
        this.mesh.position.y = 8 + Math.random() * 10;
        this.health = 50;
        this.isDestroyed = false;
        this.lastShotTime = Date.now();
        this.speed = 0.03;
        this.direction = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize();
        this.hoverOffset = Math.random() * Math.PI * 2;
        scene.add(this.mesh);
    }

    update() {
        if (this.isDestroyed) return;
        const now = Date.now();
        this.mesh.position.add(this.direction.clone().multiplyScalar(this.speed));
        this.mesh.position.y = 8 + Math.sin(now * 0.003 + this.hoverOffset) * 3;
        if (Math.random() < 0.02) {
            this.direction = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize();
        }
        if (Math.abs(this.mesh.position.x) > GAME_PARAMS.WORLD_BOUNDS) this.direction.x *= -1;
        if (Math.abs(this.mesh.position.z) > GAME_PARAMS.WORLD_BOUNDS) this.direction.z *= -1;
        this.mesh.rotation.y += 0.01;
        const distanceToPlayer = this.mesh.position.distanceTo(state.tankBody.position);
        if (now - this.lastShotTime > 4000 && distanceToPlayer < 50 && Math.random() < 0.3) {
            this.fireAtPlayer();
            this.lastShotTime = now;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDestroyed) {
            this.destroy();
            state.score += GAME_PARAMS.SAUCER_SCORE;
            state.setEnemiesRemaining(state.enemiesRemaining - 1);
        }
    }

    destroy() {
        this.isDestroyed = true;
        createEnhancedExplosion(this.mesh.position, VECTOR_GREEN, 2);
        this.scene.remove(this.mesh);
    }

    fireAtPlayer() {
        if (this.isDestroyed) return;
        const projectile = projectilePool.acquire();
        projectile.visible = true;
        projectile.position.copy(this.mesh.position);
        const toPlayer = state.tankBody.position.clone().sub(this.mesh.position).normalize().multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED * 0.6);
        projectile.userData.velocity = toPlayer;
        projectile.userData.distanceTraveled = 0;
        projectile.userData.creationTime = Date.now();
        projectile.userData.isEnemyProjectile = true;
        state.projectiles.push(projectile);
        createExplosion(this.mesh.position, 0xff4444, 0.3);
    }
}

class EnemyFighter {
    constructor(scene, position) {
        this.scene = scene;
        this.mesh = createFighterMesh();
        this.mesh.position.copy(position);
        this.mesh.position.y = 12 + Math.random() * 8;
        this.health = 75;
        this.isDestroyed = false;
        this.lastShotTime = Date.now();
        this.speed = 0.05;
        this.attackPattern = Math.random() < 0.5 ? 'circle' : 'dive';
        this.patternTimer = 0;
        this.centerPoint = position.clone();
        scene.add(this.mesh);
    }

    update() {
        if (this.isDestroyed) return;
        const now = Date.now();
        if (this.attackPattern === 'circle') {
            this.patternTimer += 0.02;
            const radius = 25;
            this.mesh.position.x = this.centerPoint.x + Math.cos(this.patternTimer) * radius;
            this.mesh.position.z = this.centerPoint.z + Math.sin(this.patternTimer) * radius;
            this.mesh.lookAt(state.tankBody.position);
        } else {
            const toPlayer = state.tankBody.position.clone().sub(this.mesh.position);
            if (toPlayer.length() > 15) {
                toPlayer.normalize().multiplyScalar(this.speed);
                this.mesh.position.add(toPlayer);
                this.mesh.lookAt(state.tankBody.position);
            } else {
                this.mesh.position.y += 0.1;
                if (this.mesh.position.y > 20) {
                    this.attackPattern = 'circle';
                    this.centerPoint = this.mesh.position.clone();
                }
            }
        }
        this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        this.mesh.position.z = THREE.MathUtils.clamp(this.mesh.position.z, -GAME_PARAMS.WORLD_BOUNDS, GAME_PARAMS.WORLD_BOUNDS);
        const distanceToPlayer = this.mesh.position.distanceTo(state.tankBody.position);
        if (now - this.lastShotTime > 2500 && distanceToPlayer < 40) {
            this.fireAtPlayer();
            this.lastShotTime = now;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDestroyed) {
            this.destroy();
            state.score += GAME_PARAMS.FIGHTER_SCORE;
            state.setEnemiesRemaining(state.enemiesRemaining - 1);
        }
    }

    destroy() {
        this.isDestroyed = true;
        createEnhancedExplosion(this.mesh.position, VECTOR_GREEN, 2.5);
        this.scene.remove(this.mesh);
    }

    fireAtPlayer() {
        if (this.isDestroyed) return;
        const projectile = projectilePool.acquire();
        projectile.visible = true;
        projectile.position.copy(this.mesh.position);
        const toPlayer = state.tankBody.position.clone().sub(this.mesh.position).normalize().multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED * 0.7);
        projectile.userData.velocity = toPlayer;
        projectile.userData.distanceTraveled = 0;
        projectile.userData.creationTime = Date.now();
        projectile.userData.isEnemyProjectile = true;
        state.projectiles.push(projectile);
        createExplosion(this.mesh.position, 0xff6666, 0.4);
    }
}

export function spawnWave(waveNumber) {
    state.setEnemiesRemaining(0);
    state.enemyTanks.forEach(tank => state.scene.remove(tank.body));
    state.enemySpaceships.forEach(ship => state.scene.remove(ship.mesh));
    state.enemyTanks.length = 0;
    state.enemySpaceships.length = 0;

    const numTanks = Math.min(3 + Math.floor(waveNumber / 2), 8);
    const tankRadius = 25 + waveNumber * 2;
    for (let i = 0; i < numTanks; i++) {
        const angle = (i / numTanks) * Math.PI * 2;
        const x = Math.cos(angle) * tankRadius;
        const z = Math.sin(angle) * tankRadius;
        const enemyTank = new EnemyTank(state.scene, new THREE.Vector3(x, 0, z));
        state.enemyTanks.push(enemyTank);
        state.setEnemiesRemaining(state.enemiesRemaining + 1);
    }

    if (waveNumber >= 2) {
        const numSaucers = Math.min(Math.floor(waveNumber / 2), 4);
        const numFighters = Math.min(Math.floor((waveNumber - 1) / 3), 3);
        for (let i = 0; i < numSaucers; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 30 + Math.random() * 20;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            const saucer = new EnemySaucer(state.scene, new THREE.Vector3(x, 0, z));
            state.enemySpaceships.push(saucer);
            state.setEnemiesRemaining(state.enemiesRemaining + 1);
        }
        if (waveNumber >= 4) {
            for (let i = 0; i < numFighters; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = 35 + Math.random() * 15;
                const x = Math.cos(angle) * distance;
                const z = Math.sin(angle) * distance;
                const fighter = new EnemyFighter(state.scene, new THREE.Vector3(x, 0, z));
                state.enemySpaceships.push(fighter);
                state.setEnemiesRemaining(state.enemiesRemaining + 1);
            }
        }
    }
}


function createSaucerMesh() {
    const group = new THREE.Group();
    const rings = [];
    const segments = 16;
    const radius = 2;
    for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;
        rings.push(
            new THREE.Vector3(Math.cos(angle1) * radius, 0.5, Math.sin(angle1) * radius),
            new THREE.Vector3(Math.cos(angle2) * radius, 0.5, Math.sin(angle2) * radius)
        );
    }
    for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;
        rings.push(
            new THREE.Vector3(Math.cos(angle1) * radius, -0.5, Math.sin(angle1) * radius),
            new THREE.Vector3(Math.cos(angle2) * radius, -0.5, Math.sin(angle2) * radius)
        );
    }
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        rings.push(
            new THREE.Vector3(Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius),
            new THREE.Vector3(Math.cos(angle) * radius, -0.5, Math.sin(angle) * radius)
        );
    }
    const domeRadius = radius * 0.6;
    for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;
        rings.push(
            new THREE.Vector3(Math.cos(angle1) * domeRadius, 1, Math.sin(angle1) * domeRadius),
            new THREE.Vector3(Math.cos(angle2) * domeRadius, 1, Math.sin(angle2) * domeRadius)
        );
    }
    for (let i = 0; i < segments; i += 2) {
        const angle = (i / segments) * Math.PI * 2;
        rings.push(
            new THREE.Vector3(Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius),
            new THREE.Vector3(Math.cos(angle) * domeRadius, 1, Math.sin(angle) * domeRadius)
        );
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(rings);
    const saucer = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: VECTOR_GREEN }));
    group.add(saucer);
    return group;
}

function createFighterMesh() {
    const group = new THREE.Group();
    const points = [];
    const bodyPoints = [[0, 0, -3], [-1, 0, 0], [0, 0, 2], [1, 0, 0], [0, 0, -3]];
    for (let i = 0; i < bodyPoints.length - 1; i++) {
        points.push(new THREE.Vector3(...bodyPoints[i]), new THREE.Vector3(...bodyPoints[i + 1]));
    }
    points.push(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-0.5, 0, 1));
    points.push(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0.5, 0, 1));
    points.push(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 1, 1.5));
    points.push(new THREE.Vector3(-0.3, 0, 1.5), new THREE.Vector3(-0.3, 0.8, 1.3));
    points.push(new THREE.Vector3(0.3, 0, 1.5), new THREE.Vector3(0.3, 0.8, 1.3));
    points.push(new THREE.Vector3(-0.3, 0, 2), new THREE.Vector3(-0.3, 0, 2.5));
    points.push(new THREE.Vector3(0.3, 0, 2), new THREE.Vector3(0.3, 0, 2.5));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const fighter = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: VECTOR_GREEN }));
    group.add(fighter);
    return group;
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

