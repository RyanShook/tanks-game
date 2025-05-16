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
    BONUS_LIFE_SCORE: 15000
};

// Game State
let scene, camera, renderer;
let tankBody, tankTurret, tankCannon;
let enemyTanks = [];
let obstacles = [];
let projectiles = [];
let projectilePool, explosionPool;
let score = 0;
let playerHealth = GAME_PARAMS.MAX_HEALTH;
let playerHitCount = 0;
let isGameOver = false;
let playerInvulnerable = false;

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

function createBattlezoneMountain(size, position) {
    const points = [];
    
    // Battlezone mountains are simple pyramids with a triangular profile
    points.push(
        new THREE.Vector3(-size * 0.5, 0, 0),      // Left base
        new THREE.Vector3(0, size * 1.2, 0),       // Peak
        new THREE.Vector3(size * 0.5, 0, 0),       // Right base
        new THREE.Vector3(-size * 0.5, 0, 0)       // Close the shape
    );
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const mountain = new THREE.Line(geometry, VECTOR_MATERIAL);
    
    // Position and orient the mountain
    mountain.position.copy(position);
    mountain.lookAt(new THREE.Vector3(0, mountain.position.y, 0));
    
    return mountain;
}

function createTankBody(width, height, depth) {
    const points = [];
    
    // Front trapezoid
    points.push(
        // Front face (wider at bottom, narrower at top)
        new THREE.Vector3(-width/2, 0, -depth/2),          // Bottom left
        new THREE.Vector3(-width/3, height, -depth/3),     // Top left
        new THREE.Vector3(width/3, height, -depth/3),      // Top right
        new THREE.Vector3(width/2, 0, -depth/2),          // Bottom right
        new THREE.Vector3(-width/2, 0, -depth/2)          // Close front face
    );
    
    // Back trapezoid
    points.push(
        new THREE.Vector3(-width/2, 0, depth/2),          // Bottom left back
        new THREE.Vector3(-width/3, height, depth/3),     // Top left back
        new THREE.Vector3(width/3, height, depth/3),      // Top right back
        new THREE.Vector3(width/2, 0, depth/2),          // Bottom right back
        new THREE.Vector3(-width/2, 0, depth/2)          // Close back face
    );
    
    // Connect front to back
    points.push(
        // Bottom rectangle
        new THREE.Vector3(-width/2, 0, -depth/2),
        new THREE.Vector3(-width/2, 0, depth/2),
        new THREE.Vector3(width/2, 0, depth/2),
        new THREE.Vector3(width/2, 0, -depth/2),
        
        // Top rectangle
        new THREE.Vector3(-width/3, height, -depth/3),
        new THREE.Vector3(-width/3, height, depth/3),
        new THREE.Vector3(width/3, height, depth/3),
        new THREE.Vector3(width/3, height, -depth/3)
    );
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineSegments(geometry, VECTOR_MATERIAL);
}

function createTurret(radius, height) {
    const points = [];
    const segments = 6; // Hexagonal turret like the original
    
    // Top hexagon
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        points.push(
            new THREE.Vector3(x, height, z),
            new THREE.Vector3(
                Math.cos(((i + 1) % segments) / segments * Math.PI * 2) * radius,
                height,
                Math.sin(((i + 1) % segments) / segments * Math.PI * 2) * radius
            )
        );
    }
    
    // Vertical lines
    for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        points.push(
            new THREE.Vector3(x, 0, z),
            new THREE.Vector3(x, height, z)
        );
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineSegments(geometry, VECTOR_MATERIAL);
}

function createCannon(radius, length) {
    const points = [];
    
    // Simple rectangular cannon (two parallel lines)
    points.push(
        // Top line
        new THREE.Vector3(0, radius, 0),
        new THREE.Vector3(length, radius, 0),
        
        // Bottom line
        new THREE.Vector3(0, -radius, 0),
        new THREE.Vector3(length, -radius, 0),
        
        // Front end
        new THREE.Vector3(length, -radius, 0),
        new THREE.Vector3(length, radius, 0)
    );
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const cannon = new THREE.LineSegments(geometry, VECTOR_MATERIAL);
    cannon.rotation.z = Math.PI / 2;
    return cannon;
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
    // Create health display
    const healthDiv = document.createElement('div');
    healthDiv.style.color = '#00ff00';
    healthDiv.style.fontSize = '24px';
    healthDiv.style.fontFamily = 'monospace';
    healthDiv.style.padding = '10px';
    healthDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    healthDiv.style.position = 'fixed';
    healthDiv.style.top = '20px';
    healthDiv.style.left = '20px';
    healthDiv.style.borderRadius = '5px';
    healthDiv.style.border = '2px solid #00ff00';
    document.body.appendChild(healthDiv);
    healthLabel = healthDiv;
    updateHealthDisplay();

    // Create game over screen (hidden initially)
    const gameOverDiv = document.createElement('div');
    gameOverDiv.style.position = 'fixed';
    gameOverDiv.style.top = '50%';
    gameOverDiv.style.left = '50%';
    gameOverDiv.style.transform = 'translate(-50%, -50%)';
    gameOverDiv.style.color = '#ff0000';
    gameOverDiv.style.fontSize = '48px';
    gameOverDiv.style.fontFamily = 'monospace';
    gameOverDiv.style.textAlign = 'center';
    gameOverDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    gameOverDiv.style.padding = '40px';
    gameOverDiv.style.borderRadius = '10px';
    gameOverDiv.style.border = '3px solid #ff0000';
    gameOverDiv.style.display = 'none';
    gameOverDiv.innerHTML = `
        <div>GAME OVER</div>
        <div style="font-size: 24px; margin-top: 20px;">Press R to Restart</div>
    `;
    document.body.appendChild(gameOverDiv);
    gameOverScreen = gameOverDiv;
}

function updateHealthDisplay() {
    const hits = GAME_PARAMS.MAX_HITS - playerHitCount;
    const healthBar = '█'.repeat(hits) + '░'.repeat(playerHitCount);
    healthLabel.innerHTML = `ARMOR: ${healthBar}`;
    healthLabel.style.color = playerInvulnerable ? '#ffff00' : '#00ff00';
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

    // Reset enemy tanks
    for (const enemy of enemyTanks) {
        scene.remove(enemy.body);
    }
    enemyTanks.length = 0;

    // Respawn enemy tanks
    const numEnemyTanks = 5;
    const enemyRadius = 30;
    for (let i = 0; i < numEnemyTanks; i++) {
        const angle = (i / numEnemyTanks) * Math.PI * 2;
        const x = Math.cos(angle) * enemyRadius;
        const z = Math.sin(angle) * enemyRadius;
        const enemyTank = new EnemyTank(scene, new THREE.Vector3(x, 0, z));
        enemyTanks.push(enemyTank);
    }

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

    // Ground grid - simplified to match original
    const gridSize = GAME_PARAMS.GRID_SIZE;
    const divisions = GAME_PARAMS.GRID_DIVISIONS;
    const gridHelper = new THREE.GridHelper(gridSize, divisions, VECTOR_GREEN, VECTOR_GREEN);
    gridHelper.position.y = -0.5;
    // Make grid lines thinner and more faint like the original
    gridHelper.material.opacity = 0.5;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

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

    // Create enemy tanks
    const numEnemyTanks = 5;
    const enemyRadius = 30;
    for (let i = 0; i < numEnemyTanks; i++) {
        const angle = (i / numEnemyTanks) * Math.PI * 2;
        const x = Math.cos(angle) * enemyRadius;
        const z = Math.sin(angle) * enemyRadius;
        const enemyTank = new EnemyTank(scene, new THREE.Vector3(x, 0, z));
        enemyTanks.push(enemyTank);
    }

    // Create obstacles
    const numObstacles = GAME_PARAMS.NUM_OBSTACLES;
    const obstacleSpread = gridSize * 0.4;
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
