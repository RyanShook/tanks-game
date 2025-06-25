import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Game Constants
const VECTOR_GREEN = 0x00ff00;
const VECTOR_MATERIAL = new THREE.LineBasicMaterial({ 
    color: VECTOR_GREEN,
    linewidth: 1
});

// Game Parameters
const GAME_PARAMS = {
    // Player settings
    MOVE_SPEED: 0.1,
    ROTATION_SPEED: 0.03,
    MAX_HEALTH: 100,
    MAX_HITS: 3,
    
    // Projectile settings
    PROJECTILE_SPEED: 0.8,
    PROJECTILE_MAX_DISTANCE: 150,
    PROJECTILE_GRAVITY: 0.001,
    
    // Enemy settings
    ENEMY_SPEED: 0.05,
    ENEMY_TURN_SPEED: 0.02,
    ENEMY_SHOT_INTERVAL: 3000,
    ENEMY_IDEAL_DISTANCE: 20,
    
    // World settings
    GRID_SIZE: 200,
    GRID_DIVISIONS: 20,
    MOUNTAIN_DISTANCE: 140, // 70% of grid size
    NUM_MOUNTAINS: 16,
    NUM_OBSTACLES: 25,
    WORLD_BOUNDS: 90,
    
    // Scoring
    TANK_SCORE: 1000,
    SAUCER_SCORE: 1500,
    FIGHTER_SCORE: 2000,
    WAVE_BONUS: 500,
    BONUS_LIFE_SCORE: 15000,

    // Power-up settings
    POWERUP_TYPES: {
        SPEED_BOOST: {
            duration: 10000,
            effect: () => {
                GAME_PARAMS.MOVE_SPEED *= 1.5;
                GAME_PARAMS.ROTATION_SPEED *= 1.5;
            },
            reset: () => {
                GAME_PARAMS.MOVE_SPEED = 0.1;
                GAME_PARAMS.ROTATION_SPEED = 0.03;
            }
        },
        RAPID_FIRE: {
            duration: 8000,
            effect: () => {
                GAME_PARAMS.ENEMY_SHOT_INTERVAL = 1500;
            },
            reset: () => {
                GAME_PARAMS.ENEMY_SHOT_INTERVAL = 3000;
            }
        },
        SHIELD: {
            duration: 5000,
            effect: () => {
                playerInvulnerable = true;
            },
            reset: () => {
                playerInvulnerable = false;
            }
        }
    },
    POWERUP_SPAWN_INTERVAL: 15000,
    POWERUP_DURATION: 10000
};

// Game State
let scene, camera, renderer;
let tankBody, tankTurret, tankCannon;
let enemyTanks = [];
let enemySpaceships = [];
let obstacles = [];
let projectiles = [];
let projectilePool, explosionPool;
let score = 0;
let playerHealth = GAME_PARAMS.MAX_HEALTH;
let playerHitCount = 0;
let isGameOver = false;
let playerInvulnerable = false;
let radarContext; // Add radar context to global state
let currentWave = 1;
let enemiesRemaining = 0;

// Input State
const keyboardState = {};
let handleKeyDown, handleKeyUp;

// HUD Elements
let labelRenderer;
let healthLabel;
let gameOverScreen;

// Sound System
const audioListener = new THREE.AudioListener();
const audioLoader = new THREE.AudioLoader();
const sounds = {
    shoot: null,
    explosion: null,
    hit: null,
    engineIdle: null
};

// Add to game state
let activePowerUps = new Set();

function initSounds() {
    // Create sound objects
    sounds.shoot = new THREE.Audio(audioListener);
    sounds.explosion = new THREE.Audio(audioListener);
    sounds.hit = new THREE.Audio(audioListener);
    sounds.engineIdle = new THREE.Audio(audioListener);
    
    // Load sound files
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
}

function playSound(soundName) {
    const sound = sounds[soundName];
    if (sound && sound.buffer && !sound.isPlaying) {
        sound.play();
    }
}

// Initialize the game
window.addEventListener('load', () => {
    init();
});

// Object Pool System
class ObjectPool {
    constructor(createFn, initialSize = 20) {
        this.createFn = createFn;
        this.objects = Array(initialSize).fill(null).map(() => ({
            object: this.createFn(),
            inUse: false
        }));
    }

    acquire() {
        let obj = this.objects.find(o => !o.inUse);
        if (!obj) {
            obj = { object: this.createFn(), inUse: false };
            this.objects.push(obj);
        }
        obj.inUse = true;
        return obj.object;
    }

    release(object) {
        const obj = this.objects.find(o => o.object === object);
        if (obj) {
            obj.inUse = false;
            object.visible = false;
        }
    }
}

// Spaceship Classes
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
        this.direction = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            0,
            (Math.random() - 0.5) * 2
        ).normalize();
        this.hoverOffset = Math.random() * Math.PI * 2;
        
        scene.add(this.mesh);
    }
    
    update() {
        if (this.isDestroyed) return;
        
        const now = Date.now();
        
        // Floating movement with direction changes
        this.mesh.position.add(this.direction.clone().multiplyScalar(this.speed));
        this.mesh.position.y = 8 + Math.sin(now * 0.003 + this.hoverOffset) * 3;
        
        // Occasional direction changes
        if (Math.random() < 0.02) {
            this.direction = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                0,
                (Math.random() - 0.5) * 2
            ).normalize();
        }
        
        // Stay within bounds
        if (Math.abs(this.mesh.position.x) > GAME_PARAMS.WORLD_BOUNDS) {
            this.direction.x *= -1;
        }
        if (Math.abs(this.mesh.position.z) > GAME_PARAMS.WORLD_BOUNDS) {
            this.direction.z *= -1;
        }
        
        // Rotate slowly
        this.mesh.rotation.y += 0.01;
        
        // Fire at player occasionally
        const distanceToPlayer = this.mesh.position.distanceTo(tankBody.position);
        if (now - this.lastShotTime > 4000 && distanceToPlayer < 50 && Math.random() < 0.3) {
            this.fireAtPlayer();
            this.lastShotTime = now;
        }
    }
    
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDestroyed) {
            this.destroy();
            score += GAME_PARAMS.SAUCER_SCORE;
            enemiesRemaining--;
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
        
        const toPlayer = tankBody.position.clone()
            .sub(this.mesh.position)
            .normalize()
            .multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED * 0.6);
        
        projectile.userData.velocity = toPlayer;
        projectile.userData.distanceTraveled = 0;
        projectile.userData.creationTime = Date.now();
        projectile.userData.isEnemyProjectile = true;
        
        projectiles.push(projectile);
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
            // Circular attack pattern
            this.patternTimer += 0.02;
            const radius = 25;
            this.mesh.position.x = this.centerPoint.x + Math.cos(this.patternTimer) * radius;
            this.mesh.position.z = this.centerPoint.z + Math.sin(this.patternTimer) * radius;
            this.mesh.lookAt(tankBody.position);
        } else {
            // Dive attack pattern
            const toPlayer = tankBody.position.clone().sub(this.mesh.position);
            if (toPlayer.length() > 15) {
                toPlayer.normalize().multiplyScalar(this.speed);
                this.mesh.position.add(toPlayer);
                this.mesh.lookAt(tankBody.position);
            } else {
                // Pull up after diving
                this.mesh.position.y += 0.1;
                if (this.mesh.position.y > 20) {
                    this.attackPattern = 'circle';
                    this.centerPoint = this.mesh.position.clone();
                }
            }
        }
        
        // Stay within bounds
        this.mesh.position.x = THREE.MathUtils.clamp(
            this.mesh.position.x,
            -GAME_PARAMS.WORLD_BOUNDS,
            GAME_PARAMS.WORLD_BOUNDS
        );
        this.mesh.position.z = THREE.MathUtils.clamp(
            this.mesh.position.z,
            -GAME_PARAMS.WORLD_BOUNDS,
            GAME_PARAMS.WORLD_BOUNDS
        );
        
        // Fire more frequently than saucers
        const distanceToPlayer = this.mesh.position.distanceTo(tankBody.position);
        if (now - this.lastShotTime > 2500 && distanceToPlayer < 40) {
            this.fireAtPlayer();
            this.lastShotTime = now;
        }
    }
    
    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDestroyed) {
            this.destroy();
            score += GAME_PARAMS.FIGHTER_SCORE;
            enemiesRemaining--;
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
        
        const toPlayer = tankBody.position.clone()
            .sub(this.mesh.position)
            .normalize()
            .multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED * 0.7);
        
        projectile.userData.velocity = toPlayer;
        projectile.userData.distanceTraveled = 0;
        projectile.userData.creationTime = Date.now();
        projectile.userData.isEnemyProjectile = true;
        
        projectiles.push(projectile);
        createExplosion(this.mesh.position, 0xff6666, 0.4);
    }
}

// Enemy Tank Class
class EnemyTank {
    constructor(scene, position) {
        // Tank dimensions
        this.dimensions = {
            body: { width: 2, height: 1, depth: 3 },
            turret: { radius: 0.6, height: 0.8 },
            cannon: { radius: 0.15, length: 2 }
        };

        // Create tank parts
        this.body = createTankBody(
            this.dimensions.body.width,
            this.dimensions.body.height,
            this.dimensions.body.depth
        );
        this.body.position.copy(position);
        this.body.position.y = 0.5;

        this.turret = createTurret(
            this.dimensions.turret.radius,
            this.dimensions.turret.height
        );
        this.turret.position.y = this.dimensions.body.height;
        this.body.add(this.turret);

        this.cannon = createCannon(
            this.dimensions.cannon.radius,
            this.dimensions.cannon.length
        );
        this.cannon.position.y = 0.1;
        this.turret.add(this.cannon);

        // State
        this.health = GAME_PARAMS.MAX_HEALTH;
        this.isDestroyed = false;
        this.lastShotTime = Date.now();
        this.scene = scene;
        this.state = 'seeking'; // seeking, attacking, retreating
        this.stateTimer = 0;

        scene.add(this.body);
    }

    update() {
        if (this.isDestroyed) return;

        const now = Date.now();
        const previousPosition = this.body.position.clone();
        const toPlayer = tankBody.position.clone().sub(this.body.position);
        const distanceToPlayer = toPlayer.length();

        // Update state
        if (this.stateTimer < now) {
            if (Math.random() < 0.3) { // 30% chance to change state
                this.state = Math.random() < 0.7 ? 'seeking' : 'retreating';
                this.stateTimer = now + 2000 + Math.random() * 3000;
            }
        }

        // Movement based on state
        if (this.state === 'seeking' && distanceToPlayer > GAME_PARAMS.ENEMY_IDEAL_DISTANCE) {
            this.body.lookAt(tankBody.position);
            this.body.translateZ(GAME_PARAMS.ENEMY_SPEED);
        } else if (this.state === 'retreating' || distanceToPlayer < GAME_PARAMS.ENEMY_IDEAL_DISTANCE - 5) {
            this.body.lookAt(tankBody.position);
            this.body.translateZ(-GAME_PARAMS.ENEMY_SPEED);
        }

        // Collision check and boundary enforcement
        if (checkTerrainCollision(this.body.position, 2)) {
            this.body.position.copy(previousPosition);
        }

        this.body.position.x = THREE.MathUtils.clamp(
            this.body.position.x,
            -GAME_PARAMS.WORLD_BOUNDS,
            GAME_PARAMS.WORLD_BOUNDS
        );
        this.body.position.z = THREE.MathUtils.clamp(
            this.body.position.z,
            -GAME_PARAMS.WORLD_BOUNDS,
            GAME_PARAMS.WORLD_BOUNDS
        );

        // Aim at player
        this.turret.lookAt(tankBody.position);

        // Fire if conditions are met
        if (now - this.lastShotTime > GAME_PARAMS.ENEMY_SHOT_INTERVAL && 
            distanceToPlayer < 40 && 
            this.state === 'seeking') {
            this.fireAtPlayer();
            this.lastShotTime = now;
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0 && !this.isDestroyed) {
            this.destroy();
            score += GAME_PARAMS.TANK_SCORE;
            enemiesRemaining--;
            // Check for bonus life
            if (Math.floor(score / GAME_PARAMS.BONUS_LIFE_SCORE) > 
                Math.floor((score - GAME_PARAMS.TANK_SCORE) / GAME_PARAMS.BONUS_LIFE_SCORE)) {
                playerHitCount = Math.max(0, playerHitCount - 1);
                updateHealthDisplay();
            }
        }
    }

    destroy() {
        this.isDestroyed = true;
        createExplosion(this.body.position, VECTOR_GREEN, 3);
        
        // Create smaller explosions around the tank
        for (let i = 0; i < 5; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 1,
                (Math.random() - 0.5) * 2
            );
            const position = this.body.position.clone().add(offset);
            setTimeout(() => {
                createExplosion(position, VECTOR_GREEN, 1 + Math.random());
            }, i * 100);
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

        const toPlayer = tankBody.position.clone()
            .sub(cannonWorldPos)
            .normalize()
            .multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED * 0.8);

        projectile.userData.velocity = toPlayer;
        projectile.userData.distanceTraveled = 0;
        projectile.userData.creationTime = Date.now();
        projectile.userData.isEnemyProjectile = true;

        projectiles.push(projectile);

        // Muzzle flash
        createExplosion(cannonWorldPos, VECTOR_GREEN, 0.3);
    }
}

function createMountain(size, position) {
    const mountainHeight = size * (2 + Math.random() * 3);
    const radialSegments = 4 + Math.floor(Math.random() * 3);
    const geometry = new THREE.ConeGeometry(size, mountainHeight, radialSegments);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00, wireframe: true });
    const mountain = new THREE.Mesh(geometry, material);
    mountain.position.set(position.x, mountainHeight / 2 - 0.5, position.z);
    return mountain;
}

function createMapObstacle(position) {
    const size = 1 + Math.random() * 1.5;
    const geometry = new THREE.TetrahedronGeometry(size);
    const obstacle = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x00ff00 })
    );
    obstacle.position.set(position.x, size * 0.5 - 0.5, position.z);
    obstacle.rotation.y = Math.random() * Math.PI * 2;
    return obstacle;
}

function createWireframePyramid(size, height, position) {
    // Create a square-based pyramid geometry
    const geometry = new THREE.CylinderGeometry(0, size, height, 4, 1);
    geometry.rotateY(Math.PI / 4); // Align base with axes
    const edges = new THREE.EdgesGeometry(geometry);
    const pyramid = new THREE.LineSegments(edges, VECTOR_MATERIAL);
    pyramid.position.copy(position);
    pyramid.position.y = height / 2 - 0.5;
    return pyramid;
}

function createBattlezoneMountain(size, position) {
    // Use the new 3D wireframe pyramid
    return createWireframePyramid(size, size * 1.2, position);
}

function createTankBody(width, height, depth) {
    // Trapezoidal prism: wider at base, narrower at top
    const shape = [
        [-width/2, 0, -depth/2], // 0: bottom front left
        [ width/2, 0, -depth/2], // 1: bottom front right
        [ width/2, 0,  depth/2], // 2: bottom back right
        [-width/2, 0,  depth/2], // 3: bottom back left
        [-width/3, height, -depth/3], // 4: top front left
        [ width/3, height, -depth/3], // 5: top front right
        [ width/3, height,  depth/3], // 6: top back right
        [-width/3, height,  depth/3], // 7: top back left
    ];
    const indices = [
        // Bottom
        [0,1],[1,2],[2,3],[3,0],
        // Top
        [4,5],[5,6],[6,7],[7,4],
        // Sides
        [0,4],[1,5],[2,6],[3,7],
        [0,1],[1,5],[5,4],[4,0], // front
        [3,2],[2,6],[6,7],[7,3], // back
    ];
    const points = [];
    indices.forEach(([a,b]) => {
        points.push(new THREE.Vector3(...shape[a]), new THREE.Vector3(...shape[b]));
    });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineSegments(geometry, VECTOR_MATERIAL);
}

function createTurret(radius, height) {
    // Hexagonal prism
    const points = [];
    const segments = 6;
    for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i+1) / segments) * Math.PI * 2;
        // Bottom hex
        points.push(
            new THREE.Vector3(Math.cos(angle1)*radius, 0, Math.sin(angle1)*radius),
            new THREE.Vector3(Math.cos(angle2)*radius, 0, Math.sin(angle2)*radius)
        );
        // Top hex
        points.push(
            new THREE.Vector3(Math.cos(angle1)*radius, height, Math.sin(angle1)*radius),
            new THREE.Vector3(Math.cos(angle2)*radius, height, Math.sin(angle2)*radius)
        );
        // Vertical lines
        points.push(
            new THREE.Vector3(Math.cos(angle1)*radius, 0, Math.sin(angle1)*radius),
            new THREE.Vector3(Math.cos(angle1)*radius, height, Math.sin(angle1)*radius)
        );
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineSegments(geometry, VECTOR_MATERIAL);
}

function createCannon(radius, length) {
    // Simple rectangular prism (wireframe)
    const w = radius;
    const l = length;
    const h = radius * 0.6;
    const shape = [
        [0, -h, -w], [l, -h, -w], [l, h, -w], [0, h, -w], // bottom face
        [0, -h, w],  [l, -h, w],  [l, h, w],  [0, h, w],  // top face
    ];
    const indices = [
        // Bottom
        [0,1],[1,2],[2,3],[3,0],
        // Top
        [4,5],[5,6],[6,7],[7,4],
        // Sides
        [0,4],[1,5],[2,6],[3,7]
    ];
    const points = [];
    indices.forEach(([a,b]) => {
        points.push(new THREE.Vector3(...shape[a]), new THREE.Vector3(...shape[b]));
    });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const cannon = new THREE.LineSegments(geometry, VECTOR_MATERIAL);
    cannon.rotation.z = Math.PI / 2;
    return cannon;
}

function createSaucerMesh() {
    // Classic flying saucer shape
    const group = new THREE.Group();
    
    // Main disc - top and bottom rings
    const rings = [];
    const segments = 16;
    const radius = 2;
    
    // Top ring
    for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;
        rings.push(
            new THREE.Vector3(Math.cos(angle1) * radius, 0.5, Math.sin(angle1) * radius),
            new THREE.Vector3(Math.cos(angle2) * radius, 0.5, Math.sin(angle2) * radius)
        );
    }
    
    // Bottom ring
    for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;
        rings.push(
            new THREE.Vector3(Math.cos(angle1) * radius, -0.5, Math.sin(angle1) * radius),
            new THREE.Vector3(Math.cos(angle2) * radius, -0.5, Math.sin(angle2) * radius)
        );
    }
    
    // Vertical connecting lines
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        rings.push(
            new THREE.Vector3(Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius),
            new THREE.Vector3(Math.cos(angle) * radius, -0.5, Math.sin(angle) * radius)
        );
    }
    
    // Central dome
    const domeRadius = radius * 0.6;
    for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;
        rings.push(
            new THREE.Vector3(Math.cos(angle1) * domeRadius, 1, Math.sin(angle1) * domeRadius),
            new THREE.Vector3(Math.cos(angle2) * domeRadius, 1, Math.sin(angle2) * domeRadius)
        );
    }
    
    // Connect dome to main body
    for (let i = 0; i < segments; i += 2) {
        const angle = (i / segments) * Math.PI * 2;
        rings.push(
            new THREE.Vector3(Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius),
            new THREE.Vector3(Math.cos(angle) * domeRadius, 1, Math.sin(angle) * domeRadius)
        );
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(rings);
    const saucer = new THREE.LineSegments(geometry, VECTOR_MATERIAL);
    group.add(saucer);
    
    return group;
}

function createFighterMesh() {
    // Classic space fighter shape
    const group = new THREE.Group();
    const points = [];
    
    // Main body - diamond shape from above
    const bodyPoints = [
        [0, 0, -3],    // nose
        [-1, 0, 0],    // left wing tip
        [0, 0, 2],     // tail
        [1, 0, 0],     // right wing tip
        [0, 0, -3]     // back to nose
    ];
    
    // Body outline
    for (let i = 0; i < bodyPoints.length - 1; i++) {
        points.push(
            new THREE.Vector3(...bodyPoints[i]),
            new THREE.Vector3(...bodyPoints[i + 1])
        );
    }
    
    // Wing struts
    points.push(
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(-0.5, 0, 1)
    );
    points.push(
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0.5, 0, 1)
    );
    
    // Vertical stabilizers
    points.push(
        new THREE.Vector3(0, 0, 2),
        new THREE.Vector3(0, 1, 1.5)
    );
    points.push(
        new THREE.Vector3(-0.3, 0, 1.5),
        new THREE.Vector3(-0.3, 0.8, 1.3)
    );
    points.push(
        new THREE.Vector3(0.3, 0, 1.5),
        new THREE.Vector3(0.3, 0.8, 1.3)
    );
    
    // Engine details
    points.push(
        new THREE.Vector3(-0.3, 0, 2),
        new THREE.Vector3(-0.3, 0, 2.5)
    );
    points.push(
        new THREE.Vector3(0.3, 0, 2),
        new THREE.Vector3(0.3, 0, 2.5)
    );
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const fighter = new THREE.LineSegments(geometry, VECTOR_MATERIAL);
    group.add(fighter);
    
    return group;
}

function fireProjectile() {
    if (isGameOver) return;

    // Play shoot sound
    playSound('shoot');

    // Get projectile from pool
    const projectile = projectilePool.acquire();
    projectile.visible = true;

    // Position at cannon tip
    const cannonWorldPos = new THREE.Vector3();
    tankCannon.getWorldPosition(cannonWorldPos);
    projectile.position.copy(cannonWorldPos);

    // Simplified direction calculation
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(tankBody.quaternion);

    // Store velocity and reset distance
    projectile.userData.velocity = direction.multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED);
    projectile.userData.distanceTraveled = 0;
    projectile.userData.creationTime = Date.now();
    projectile.userData.isEnemyProjectile = false;

    // Add to active projectiles array
    projectiles.push(projectile);

    // Create muzzle flash
    const muzzleFlash = explosionPool.acquire();
    muzzleFlash.visible = true;
    muzzleFlash.position.copy(cannonWorldPos);
    muzzleFlash.scale.set(0.3, 0.3, 0.3);

    // Simple recoil
    tankCannon.rotation.x = -0.1;
    setTimeout(() => {
        tankCannon.rotation.x = 0;
    }, 100);

    // Animate muzzle flash
    setTimeout(() => {
        explosionPool.release(muzzleFlash);
    }, 100);
}

function createHUD() {
    // Create radar
    const radar = document.createElement('div');
    radar.id = 'radar';
    const radarCanvas = document.createElement('canvas');
    radarCanvas.width = 320;
    radarCanvas.height = 32;
    radar.appendChild(radarCanvas);
    document.body.appendChild(radar);
    radarContext = radarCanvas.getContext('2d');

    // Create score display
    const scoreDiv = document.createElement('div');
    scoreDiv.id = 'score';
    scoreDiv.innerHTML = 'SCORE: 0000';
    document.body.appendChild(scoreDiv);

    // Create health display
    const healthDiv = document.createElement('div');
    healthDiv.id = 'health';
    healthDiv.innerHTML = 'ARMOR: ████';
    document.body.appendChild(healthDiv);

    // Create power-up display
    const powerUpDiv = document.createElement('div');
    powerUpDiv.id = 'powerUps';
    powerUpDiv.style.position = 'fixed';
    powerUpDiv.style.bottom = '10px';
    powerUpDiv.style.left = '50%';
    powerUpDiv.style.transform = 'translateX(-50%)';
    powerUpDiv.style.color = '#00ff00';
    powerUpDiv.style.fontFamily = 'monospace';
    powerUpDiv.style.fontSize = '16px';
    powerUpDiv.style.zIndex = '1000';
    document.body.appendChild(powerUpDiv);

    // Create game over screen
    const gameOverDiv = document.createElement('div');
    gameOverDiv.id = 'gameOver';
    gameOverDiv.innerHTML = `
        <div>GAME OVER</div>
        <div style="font-size: 24px; margin-top: 20px">PRESS R TO RESTART</div>
    `;
    document.body.appendChild(gameOverDiv);
    gameOverScreen = gameOverDiv;
}

function updateHealthDisplay() {
    const hits = GAME_PARAMS.MAX_HITS - playerHitCount;
    const healthBar = '█'.repeat(hits) + '░'.repeat(playerHitCount);
    const healthDiv = document.getElementById('health');
    if (healthDiv) {
        healthDiv.innerHTML = `ARMOR: ${healthBar}`;
        healthDiv.style.color = playerInvulnerable ? '#ffff00' : '#00ff00';
    }
}

function gameOver() {
    isGameOver = true;
    
    // Show game over screen
    if (gameOverScreen) {
        gameOverScreen.style.display = 'block';
    }

    // Create dramatic explosion sequence
    createExplosion(tankBody.position, 0x00ff00, 4);  // Large center explosion
    
    // Create multiple explosions around the tank
    for (let i = 0; i < 8; i++) {
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            Math.random() * 2,
            (Math.random() - 0.5) * 3
        );
        const position = tankBody.position.clone().add(offset);
        setTimeout(() => {
            createExplosion(position, 0x00ff00, 1.5 + Math.random());
        }, i * 100);  // Stagger the explosions
    }

    // Hide the tank
    tankBody.visible = false;

    // Disable controls
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);

    // Add restart handler
    document.addEventListener('keydown', handleRestart);
}

function handleRestart(event) {
    if (event.code === 'KeyR' && isGameOver) {
        document.removeEventListener('keydown', handleRestart);
        resetGame();
    }
}

function resetGame() {
    // Reset player state
    playerHealth = GAME_PARAMS.MAX_HEALTH;
    playerHitCount = 0;
    isGameOver = false;
    playerInvulnerable = false;

    // Reset tank position and rotation
    tankBody.position.set(0, 0.5, 0);
    tankBody.rotation.set(0, 0, 0);
    tankTurret.rotation.set(0, 0, 0);
    tankCannon.rotation.set(0, 0, 0);

    // Clear projectiles
    for (const projectile of projectiles) {
        scene.remove(projectile);
    }
    projectiles.length = 0;

    // Reset enemies
    for (const enemy of enemyTanks) {
        scene.remove(enemy.body);
    }
    for (const spaceship of enemySpaceships) {
        scene.remove(spaceship.mesh);
    }
    enemyTanks.length = 0;
    enemySpaceships.length = 0;

    // Reset power-ups
    for (const powerUp of powerUps) {
        scene.remove(powerUp.mesh);
    }
    powerUps.length = 0;
    lastPowerUpSpawn = 0;

    // Reset wave and score
    currentWave = 1;
    score = 0;
    enemiesRemaining = 0;

    // Reset game parameters
    GAME_PARAMS.MOVE_SPEED = 0.1;
    GAME_PARAMS.ROTATION_SPEED = 0.03;
    GAME_PARAMS.ENEMY_SHOT_INTERVAL = 3000;

    // Start first wave
    spawnWave(currentWave);

    // Hide game over screen
    gameOverScreen.style.display = 'none';

    // Re-enable controls
    handleKeyDown = (event) => {
        keyboardState[event.code] = true;
        if (event.code === 'Space') {
            fireProjectile();
        }
    };

    handleKeyUp = (event) => {
        keyboardState[event.code] = false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Update health display
    updateHealthDisplay();
}

function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);  // Pure black background

    // Initialize object pools
    projectilePool = new ObjectPool(() => {
        const projectileGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
        const projectile = new THREE.LineSegments(
            new THREE.EdgesGeometry(projectileGeometry),
            VECTOR_MATERIAL
        );
        projectile.visible = false;
        scene.add(projectile);
        return projectile;
    });

    explosionPool = new ObjectPool(() => {
        const particles = new THREE.Group();
        for (let i = 0; i < 8; i++) {
            const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const particle = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                VECTOR_MATERIAL
            );
            particles.add(particle);
        }
        particles.visible = false;
        scene.add(particles);
        return particles;
    });

    // Camera setup
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 2, 5);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Ground grid - only horizontal lines
    const grid = createHorizontalGrid(GAME_PARAMS.GRID_SIZE, GAME_PARAMS.GRID_DIVISIONS, VECTOR_GREEN);
    grid.position.y = -0.5;
    scene.add(grid);

    // Create mountain range
    createMountainRange();

    // Create player tank
    const bodyWidth = 2;
    const bodyHeight = 1;
    const bodyDepth = 3;

    tankBody = createTankBody(bodyWidth, bodyHeight, bodyDepth);
    tankBody.position.y = 0.5;
    scene.add(tankBody);

    tankTurret = createTurret(0.6, 0.8);
    tankTurret.position.y = bodyHeight;
    tankBody.add(tankTurret);

    tankCannon = createCannon(0.15, 2);
    tankCannon.position.y = 0.1;
    tankTurret.add(tankCannon);

    // Create HUD
    createHUD();

    // Camera parenting
    camera.position.set(0, bodyHeight + 0.5, 0.5);
    tankTurret.add(camera);
    camera.lookAt(new THREE.Vector3(0, bodyHeight + 0.5, -10));

    // Hide player's own tank model in first person
    tankBody.visible = false;
    tankTurret.visible = false;
    tankCannon.visible = false;

    // Start the first wave
    spawnWave(currentWave);

    // Create obstacles
    const numObstacles = GAME_PARAMS.NUM_OBSTACLES;
    const obstacleSpread = GAME_PARAMS.GRID_SIZE * 0.4;
    for (let i = 0; i < numObstacles; i++) {
        const x = (Math.random() - 0.5) * obstacleSpread;
        const z = (Math.random() - 0.5) * obstacleSpread;
        if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;  // Keep center area clear
        const obstacle = createMapObstacle(new THREE.Vector3(x, 0, z));
        scene.add(obstacle);
        obstacles.push(obstacle);
    }

    // Event handlers
    handleKeyDown = (event) => {
        keyboardState[event.code] = true;
        if (event.code === 'Space') {
            fireProjectile();
        }
    };

    handleKeyUp = (event) => {
        keyboardState[event.code] = false;
    };

    // Event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    window.addEventListener('resize', onWindowResize, false);

    // Initialize sounds
    camera.add(audioListener);
    initSounds();

    // Start engine sound
    setTimeout(() => {
        playSound('engineIdle');
    }, 1000);

    // Start animation loop
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    
    try {
        if (!isGameOver) {
            handleMovement();
            updateProjectiles();
            enemyTanks.forEach(enemy => enemy.update());
            enemySpaceships.forEach(spaceship => spaceship.update());
            updatePowerUps();
            updateRadar();
            updateWaveDisplay();
            checkWaveCompletion();
        }
        
        updateHealthDisplay();
        renderer.render(scene, camera);
    } catch (error) {
        console.error('Animation error:', error);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function handleMovement() {
    if (isGameOver) return;

    const previousPosition = tankBody.position.clone();

    // Simplified movement
    if (keyboardState['KeyW']) {
        tankBody.translateZ(-GAME_PARAMS.MOVE_SPEED);
    }
    if (keyboardState['KeyS']) {
        tankBody.translateZ(GAME_PARAMS.MOVE_SPEED);
    }
    if (keyboardState['KeyA']) {
        tankBody.rotation.y += GAME_PARAMS.ROTATION_SPEED;
    }
    if (keyboardState['KeyD']) {
        tankBody.rotation.y -= GAME_PARAMS.ROTATION_SPEED;
    }

    // Check collisions and revert if needed
    if (checkTerrainCollision(tankBody.position, 2)) {
        tankBody.position.copy(previousPosition);
    }

    // Keep tank within boundaries
    const maxDistance = 90;
    tankBody.position.x = THREE.MathUtils.clamp(tankBody.position.x, -maxDistance, maxDistance);
    tankBody.position.z = THREE.MathUtils.clamp(tankBody.position.z, -maxDistance, maxDistance);

    // Update turret to follow tank rotation
    tankTurret.rotation.y = 0;
}

function updateProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        // Apply gravity to velocity
        projectile.userData.velocity.y -= GAME_PARAMS.PROJECTILE_GRAVITY;
        
        // Update position
        projectile.position.add(projectile.userData.velocity);
        projectile.userData.distanceTraveled += projectile.userData.velocity.length();

        // Check if projectile hit ground
        if (projectile.position.y < 0) {
            createExplosion(projectile.position, projectile.userData.isEnemyProjectile ? 0xff0000 : VECTOR_GREEN, 0.5);
            projectilePool.release(projectile);
            projectiles.splice(i, 1);
            continue;
        }

        // Check if projectile should be removed due to distance
        if (projectile.userData.distanceTraveled > GAME_PARAMS.PROJECTILE_MAX_DISTANCE) {
            projectilePool.release(projectile);
            projectiles.splice(i, 1);
            continue;
        }

        // Check for collisions
        if (projectile.userData.isEnemyProjectile) {
            if (checkCollision(projectile, tankBody, 1.5)) {
                if (!playerInvulnerable) {
                    playSound('hit');
                    playerHealth -= 20;
                    updateHealthDisplay();
                    playerHitCount++;
                    
                    if (playerHealth <= 0 || playerHitCount >= GAME_PARAMS.MAX_HITS) {
                        gameOver();
                    } else {
                        // Temporary invulnerability
                        playerInvulnerable = true;
                        setTimeout(() => { playerInvulnerable = false; }, 1000);
                    }
                }
                projectilePool.release(projectile);
                projectiles.splice(i, 1);
                createExplosion(projectile.position, 0xff0000);
            }
        } else {
            // Check collisions with enemy tanks
            for (const enemyTank of enemyTanks) {
                if (!enemyTank.isDestroyed && checkCollision(projectile, enemyTank.body, 1.5)) {
                    playSound('hit');
                    enemyTank.takeDamage(34);
                    projectilePool.release(projectile);
                    projectiles.splice(i, 1);
                    createExplosion(projectile.position, VECTOR_GREEN);
                    break;
                }
            }
            
            // Check collisions with enemy spaceships
            for (const spaceship of enemySpaceships) {
                if (!spaceship.isDestroyed && checkCollision(projectile, spaceship.mesh, 2)) {
                    playSound('hit');
                    spaceship.takeDamage(34);
                    projectilePool.release(projectile);
                    projectiles.splice(i, 1);
                    createExplosion(projectile.position, VECTOR_GREEN);
                    break;
                }
            }
        }
    }
}

function createExplosion(position, color, size = 1) {
    playSound('explosion');
    
    const explosion = explosionPool.acquire();
    explosion.visible = true;
    explosion.position.copy(position);
    
    // Create expanding geometric shapes
    const lines = [];
    const numLines = 8;
    
    for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2;
        const line = new THREE.Vector3(
            Math.cos(angle) * size,
            Math.sin(angle) * size,
            0
        );
        lines.push(line);
    }
    
    // Update each particle to be a line segment
    explosion.children.forEach((particle, i) => {
        const lineGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            lines[i % lines.length]
        ]);
        particle.geometry = lineGeom;
    });
    
    // Animate explosion
    const startTime = Date.now();
    const duration = 300; // Faster, more arcade-like explosion
    
    function animateExplosion() {
        const elapsed = Date.now() - startTime;
        if (elapsed > duration) {
            explosionPool.release(explosion);
            return;
        }
        
        const progress = elapsed / duration;
        explosion.children.forEach((particle, i) => {
            particle.scale.setScalar(1 + progress * 2);
            particle.rotation.z = progress * Math.PI * 2;
        });
        
        requestAnimationFrame(animateExplosion);
    }
    
    animateExplosion();
}

function checkCollision(obj1, obj2, minDistance) {
    // Safety check to ensure both objects exist and have positions
    if (!obj1 || !obj2 || !obj1.position || !obj2.position) {
        console.warn('Invalid objects passed to checkCollision:', { obj1, obj2 });
        return false;
    }

    const dx = obj1.position.x - obj2.position.x;
    const dz = obj1.position.z - obj2.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    return distance < minDistance;
}

function checkTerrainCollision(position, radius) {
    // Safety check for position
    if (!position || typeof position.x === 'undefined') {
        console.warn('Invalid position passed to checkTerrainCollision:', position);
        return false;
    }

    // Create a temporary object with the position for collision checking
    const tempObj = { position: position };

    // Check collision with obstacles
    for (const obstacle of obstacles) {
        if (!obstacle) continue;
        if (checkCollision(tempObj, obstacle, radius + 1.5)) {
            return true;
        }
    }

    // Check collision with enemy tanks
    for (const enemy of enemyTanks) {
        if (!enemy || !enemy.body || enemy.isDestroyed) continue;
        if (checkCollision(tempObj, enemy.body, radius + 2)) {
            return true;
        }
    }

    return false;
}

function createMountainRange() {
    // Remove any existing mountains
    scene.children.forEach(child => {
        if (child.userData.isMountain) {
            scene.remove(child);
        }
    });
    
    // Create three rings of pyramid mountains
    const mountainRings = [
        { distance: GAME_PARAMS.MOUNTAIN_DISTANCE * 0.6, count: 8, size: 15 },
        { distance: GAME_PARAMS.MOUNTAIN_DISTANCE * 0.8, count: 12, size: 20 },
        { distance: GAME_PARAMS.MOUNTAIN_DISTANCE, count: 16, size: 25 }
    ];
    
    mountainRings.forEach(ring => {
        const angleOffset = Math.random() * Math.PI; // Random offset for each ring
        for (let i = 0; i < ring.count; i++) {
            const angle = angleOffset + (i / ring.count) * Math.PI * 2;
            const x = Math.cos(angle) * ring.distance;
            const z = Math.sin(angle) * ring.distance;
            
            const mountain = createBattlezoneMountain(
                ring.size + (Math.random() - 0.5) * 2,
                new THREE.Vector3(x, 0, z)
            );
            
            mountain.userData.isMountain = true;
            scene.add(mountain);
        }
    });
}

function updateRadar() {
    if (!radarContext) return;
    radarContext.clearRect(0, 0, radarContext.canvas.width, radarContext.canvas.height);
    radarContext.strokeStyle = '#00ff00';
    radarContext.lineWidth = 1;
    // Draw center vertical line
    radarContext.beginPath();
    radarContext.moveTo(160, 0);
    radarContext.lineTo(160, 32);
    radarContext.stroke();
    
    // Draw enemy tanks as dots
    radarContext.fillStyle = '#00ff00';
    enemyTanks.forEach(enemy => {
        if (!enemy.isDestroyed) {
            const dx = enemy.body.position.x - tankBody.position.x;
            const dz = enemy.body.position.z - tankBody.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < GAME_PARAMS.WORLD_BOUNDS) {
                const x = 160 + (dx / GAME_PARAMS.WORLD_BOUNDS) * 140;
                const y = 24 - (dz / GAME_PARAMS.WORLD_BOUNDS) * 20;
                radarContext.beginPath();
                radarContext.arc(x, y, 2, 0, Math.PI * 2);
                radarContext.fill();
            }
        }
    });
    
    // Draw enemy spaceships as squares
    radarContext.fillStyle = '#ffff00';
    enemySpaceships.forEach(spaceship => {
        if (!spaceship.isDestroyed) {
            const dx = spaceship.mesh.position.x - tankBody.position.x;
            const dz = spaceship.mesh.position.z - tankBody.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < GAME_PARAMS.WORLD_BOUNDS) {
                const x = 160 + (dx / GAME_PARAMS.WORLD_BOUNDS) * 140;
                const y = 24 - (dz / GAME_PARAMS.WORLD_BOUNDS) * 20;
                radarContext.fillRect(x - 1.5, y - 1.5, 3, 3);
            }
        }
    });
}

function spawnWave(waveNumber) {
    enemiesRemaining = 0;
    
    // Clear existing enemies
    enemyTanks.forEach(tank => scene.remove(tank.body));
    enemySpaceships.forEach(ship => scene.remove(ship.mesh));
    enemyTanks.length = 0;
    enemySpaceships.length = 0;
    
    // Spawn tanks
    const numTanks = Math.min(3 + Math.floor(waveNumber / 2), 8);
    const tankRadius = 25 + waveNumber * 2;
    for (let i = 0; i < numTanks; i++) {
        const angle = (i / numTanks) * Math.PI * 2;
        const x = Math.cos(angle) * tankRadius;
        const z = Math.sin(angle) * tankRadius;
        const enemyTank = new EnemyTank(scene, new THREE.Vector3(x, 0, z));
        enemyTanks.push(enemyTank);
        enemiesRemaining++;
    }
    
    // Spawn spaceships starting from wave 2
    if (waveNumber >= 2) {
        const numSaucers = Math.min(Math.floor(waveNumber / 2), 4);
        const numFighters = Math.min(Math.floor((waveNumber - 1) / 3), 3);
        
        // Spawn saucers
        for (let i = 0; i < numSaucers; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 30 + Math.random() * 20;
            const x = Math.cos(angle) * distance;
            const z = Math.sin(angle) * distance;
            const saucer = new EnemySaucer(scene, new THREE.Vector3(x, 0, z));
            enemySpaceships.push(saucer);
            enemiesRemaining++;
        }
        
        // Spawn fighters starting from wave 4
        if (waveNumber >= 4) {
            for (let i = 0; i < numFighters; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = 35 + Math.random() * 15;
                const x = Math.cos(angle) * distance;
                const z = Math.sin(angle) * distance;
                const fighter = new EnemyFighter(scene, new THREE.Vector3(x, 0, z));
                enemySpaceships.push(fighter);
                enemiesRemaining++;
            }
        }
    }
    
    updateWaveDisplay();
}

function checkWaveCompletion() {
    if (enemiesRemaining <= 0 && !isGameOver) {
        // Wave completion bonus
        const waveBonus = GAME_PARAMS.WAVE_BONUS * currentWave;
        score += waveBonus;
        
        // Show wave completion message
        showWaveCompletionMessage(waveBonus);
        
        currentWave++;
        // Brief pause before next wave
        setTimeout(() => {
            if (!isGameOver) {
                spawnWave(currentWave);
            }
        }, 3000);
    }
}

function showWaveCompletionMessage(bonus) {
    const message = document.createElement('div');
    message.style.position = 'fixed';
    message.style.top = '50%';
    message.style.left = '50%';
    message.style.transform = 'translate(-50%, -50%)';
    message.style.color = '#00ff00';
    message.style.fontFamily = 'monospace';
    message.style.fontSize = '24px';
    message.style.textAlign = 'center';
    message.style.zIndex = '2000';
    message.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    message.style.padding = '20px';
    message.style.border = '2px solid #00ff00';
    message.innerHTML = `
        WAVE ${currentWave} COMPLETE<br>
        BONUS: ${bonus} POINTS<br>
        <div style="font-size: 16px; margin-top: 10px;">PREPARING WAVE ${currentWave + 1}...</div>
    `;
    
    document.body.appendChild(message);
    
    // Add flash effect for wave completion
    createWaveFlash();
    
    setTimeout(() => {
        document.body.removeChild(message);
    }, 2500);
}

function updateWaveDisplay() {
    const scoreDiv = document.getElementById('score');
    if (scoreDiv) {
        const formattedScore = score.toString().padStart(4, '0');
        scoreDiv.innerHTML = `WAVE: ${currentWave} | SCORE: ${formattedScore} | ENEMIES: ${enemiesRemaining}`;
    }
}

function createWaveFlash() {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100vw';
    flash.style.height = '100vh';
    flash.style.backgroundColor = '#00ff00';
    flash.style.opacity = '0.3';
    flash.style.zIndex = '1500';
    flash.style.pointerEvents = 'none';
    
    document.body.appendChild(flash);
    
    // Fade out animation
    let opacity = 0.3;
    const fadeInterval = setInterval(() => {
        opacity -= 0.05;
        flash.style.opacity = opacity;
        
        if (opacity <= 0) {
            clearInterval(fadeInterval);
            document.body.removeChild(flash);
        }
    }, 30);
}

function createEnhancedExplosion(position, color, size = 1) {
    playSound('explosion');
    
    const explosion = explosionPool.acquire();
    explosion.visible = true;
    explosion.position.copy(position);
    
    // Create more dramatic particle effects
    const numParticles = 12;
    for (let i = 0; i < numParticles; i++) {
        const angle = (i / numParticles) * Math.PI * 2;
        const particle = explosion.children[i % explosion.children.length];
        
        // Create expanding line segments
        const lineGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(
                Math.cos(angle) * size * 2,
                Math.sin(angle * 0.5) * size,
                Math.sin(angle) * size * 2
            )
        ]);
        particle.geometry = lineGeom;
    }
    
    // Animate explosion with rotation and scaling
    const startTime = Date.now();
    const duration = 400;
    
    function animateExplosion() {
        const elapsed = Date.now() - startTime;
        if (elapsed > duration) {
            explosionPool.release(explosion);
            return;
        }
        
        const progress = elapsed / duration;
        const scale = 1 + progress * 3;
        const rotation = progress * Math.PI * 4;
        
        explosion.children.forEach((particle, i) => {
            particle.scale.setScalar(scale);
            particle.rotation.z = rotation + (i * 0.5);
            // Fade out over time
            particle.material.opacity = 1 - progress;
        });
        
        explosion.rotation.y = rotation * 0.5;
        
        requestAnimationFrame(animateExplosion);
    }
    
    animateExplosion();
}

// --- Grid: Only horizontal lines ---
function createHorizontalGrid(size, divisions, color) {
    const group = new THREE.Group();
    const step = size / divisions;
    for (let i = -divisions/2; i <= divisions/2; i++) {
        const z = i * step;
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-size/2, 0, z),
            new THREE.Vector3(size/2, 0, z)
        ]);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: color, linewidth: 1 }));
        group.add(line);
    }
    return group;
}

class PowerUp {
    constructor(scene, position, type) {
        this.scene = scene;
        this.type = type;
        this.isCollected = false;
        
        // Create power-up geometry
        const geometry = new THREE.OctahedronGeometry(0.8);
        this.mesh = new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            VECTOR_MATERIAL
        );
        this.mesh.position.copy(position);
        this.mesh.position.y = 1;
        this.mesh.userData.isPowerUp = true;
        this.mesh.userData.type = type;
        
        scene.add(this.mesh);
        
        // Start floating animation
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
        
        // Apply power-up effect
        const powerUp = GAME_PARAMS.POWERUP_TYPES[this.type];
        powerUp.effect();
        
        // Add to active power-ups
        activePowerUps.add(this.type);
        updatePowerUpDisplay();
        
        // Create collection effect
        createExplosion(this.mesh.position, VECTOR_GREEN, 1);
        
        // Reset after duration
        setTimeout(() => {
            powerUp.reset();
            activePowerUps.delete(this.type);
            updatePowerUpDisplay();
        }, powerUp.duration);
    }
}

// Add power-ups array to game state
let powerUps = [];
let lastPowerUpSpawn = 0;

function spawnPowerUp() {
    if (isGameOver) return;
    
    const now = Date.now();
    if (now - lastPowerUpSpawn < GAME_PARAMS.POWERUP_SPAWN_INTERVAL) return;
    
    // Random position within bounds
    const x = (Math.random() - 0.5) * GAME_PARAMS.WORLD_BOUNDS * 1.5;
    const z = (Math.random() - 0.5) * GAME_PARAMS.WORLD_BOUNDS * 1.5;
    
    // Random power-up type
    const types = Object.keys(GAME_PARAMS.POWERUP_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    
    const powerUp = new PowerUp(scene, new THREE.Vector3(x, 0, z), type);
    powerUps.push(powerUp);
    
    lastPowerUpSpawn = now;
}

function updatePowerUps() {
    // Check for power-up collection
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        if (powerUp.isCollected) {
            powerUps.splice(i, 1);
            continue;
        }
        
        // Check collision with player
        if (checkCollision(powerUp.mesh, tankBody, 2)) {
            powerUp.collect();
        }
    }
    
    // Spawn new power-ups
    spawnPowerUp();
}

function updatePowerUpDisplay() {
    const powerUpDiv = document.getElementById('powerUps');
    if (!powerUpDiv) return;

    const powerUpText = Array.from(activePowerUps).map(type => {
        switch(type) {
            case 'SPEED_BOOST': return '⚡ SPEED';
            case 'RAPID_FIRE': return '🔥 RAPID FIRE';
            case 'SHIELD': return '🛡️ SHIELD';
            default: return type;
        }
    }).join(' | ');

    powerUpDiv.innerHTML = powerUpText || '';
}
