import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Object Pools
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

let projectilePool, explosionPool;

let scene, camera, renderer;
let tankBody, tankTurret, tankCannon;
let enemyTanks = []; // Array to store enemy tanks
let playerHealth = 100;
let playerHitCount = 0;
let isGameOver = false;
let playerInvulnerable = false;
const playerMaxHits = 3;

// Movement states
const keyboardState = {};
const moveSpeed = 0.1;
const rotationSpeed = 0.03;

// Obstacles and scenery
const obstacles = [];
const projectiles = [];
const projectileSpeed = 0.8; // Slightly reduced for better control
const projectileMaxDistance = 150;
const projectileGravity = 0.001; // Small amount of gravity for slight arc

let labelRenderer;
let healthLabel;
let gameOverScreen;

// Add these declarations at the top with other globals
let handleKeyDown, handleKeyUp;

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

class EnemyTank {
    constructor(scene, position) {
        const bodyWidth = 2;
        const bodyHeight = 1;
        const bodyDepth = 3;
        const tankMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            wireframe: true,
            side: THREE.DoubleSide,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });

        // Create main body
        this.body = createTankBody(bodyWidth, bodyHeight, bodyDepth, tankMaterial);
        this.body.position.copy(position);
        this.body.position.y = 0.5;

        // Create turret
        this.turret = createTurret(0.6, 0.8, tankMaterial);
        this.turret.position.y = bodyHeight;
        this.body.add(this.turret);

        // Create cannon
        this.cannon = createCannon(0.15, 2, tankMaterial);
        this.cannon.position.y = 0.1;
        this.turret.add(this.cannon);

        // Basic properties
        this.speed = 0.05;
        this.turnSpeed = 0.02;
        this.health = 100;
        this.isDestroyed = false;
        this.lastShotTime = Date.now();
        this.shotInterval = 3000;
        this.scene = scene;

        scene.add(this.body);
    }

    takeDamage(amount) {
        if (this.isDestroyed) return;
        
        this.health -= amount;
        if (this.health <= 0) {
            this.destroy();
        }
    }

    destroy() {
        this.isDestroyed = true;
        
        // Create a series of explosions for dramatic effect
        createExplosion(this.body.position, 0xff0000, 3);  // Large center explosion
        
        // Create smaller explosions around the tank
        for (let i = 0; i < 5; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 1,
                (Math.random() - 0.5) * 2
            );
            const position = this.body.position.clone().add(offset);
            setTimeout(() => {
                createExplosion(position, 0xff5500, 1 + Math.random());
            }, i * 100);  // Stagger the explosions
        }

        // Remove the tank from scene
        this.scene.remove(this.body);
    }

    update() {
        if (this.isDestroyed) return;

        const previousPosition = this.body.position.clone();

        // Simple movement - move towards player if far, away if too close
        const toPlayer = tankBody.position.clone().sub(this.body.position);
        const distanceToPlayer = toPlayer.length();
        const idealDistance = 20;

        if (distanceToPlayer > idealDistance + 5) {
            // Move towards player
            this.body.lookAt(tankBody.position);
            this.body.translateZ(this.speed);
        } else if (distanceToPlayer < idealDistance - 5) {
            // Move away from player
            this.body.lookAt(tankBody.position);
            this.body.translateZ(-this.speed);
        }

        // Check collisions
        if (checkTerrainCollision(this.body.position, 2)) {
            this.body.position.copy(previousPosition);
        }

        // Keep within boundaries
        const maxDistance = 90;
        this.body.position.x = THREE.MathUtils.clamp(this.body.position.x, -maxDistance, maxDistance);
        this.body.position.z = THREE.MathUtils.clamp(this.body.position.z, -maxDistance, maxDistance);

        // Aim at player
        this.turret.lookAt(tankBody.position);

        // Try to fire
        const now = Date.now();
        if (now - this.lastShotTime > this.shotInterval && distanceToPlayer < 40) {
            this.fireAtPlayer();
            this.lastShotTime = now;
        }
    }

    fireAtPlayer() {
        if (this.isDestroyed) return;

        const projectile = projectilePool.acquire();
        projectile.visible = true;

        const cannonWorldPos = new THREE.Vector3();
        this.cannon.getWorldPosition(cannonWorldPos);
        projectile.position.copy(cannonWorldPos);

        const toPlayer = tankBody.position.clone().sub(cannonWorldPos).normalize();
        projectile.userData.velocity = toPlayer.multiplyScalar(projectileSpeed * 0.8);
        projectile.userData.distanceTraveled = 0;
        projectile.userData.creationTime = Date.now();
        projectile.userData.isEnemyProjectile = true;

        this.scene.add(projectile);
        projectiles.push(projectile);

        // Muzzle flash
        const muzzleFlash = explosionPool.acquire();
        muzzleFlash.visible = true;
        muzzleFlash.position.copy(cannonWorldPos);
        muzzleFlash.scale.set(0.3, 0.3, 0.3);

        setTimeout(() => {
            explosionPool.release(muzzleFlash);
        }, 100);
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
    const material = new THREE.MeshStandardMaterial({ color: 0x00dd00, wireframe: true });
    const obstacle = new THREE.Mesh(geometry, material);
    obstacle.position.set(position.x, size * 0.5 - 0.5, position.z);
    obstacle.rotation.y = Math.random() * Math.PI * 2;
    return obstacle;
}

function createTankBody(width, height, depth, material) {
    const tankGroup = new THREE.Group();
    const halfDepth = depth / 2;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Main hull (slightly angled sides)
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-halfWidth, -halfDepth);
    hullShape.lineTo(halfWidth, -halfDepth);
    hullShape.lineTo(halfWidth * 0.8, halfDepth);
    hullShape.lineTo(-halfWidth * 0.8, halfDepth);
    hullShape.lineTo(-halfWidth, -halfDepth);

    const extrudeSettings = {
        steps: 1,
        depth: height,
        bevelEnabled: false
    };

    const hullGeometry = new THREE.ExtrudeGeometry(hullShape, extrudeSettings);
    const hull = new THREE.Mesh(hullGeometry, material);
    hull.rotation.x = -Math.PI / 2;
    hull.position.y = 0;
    tankGroup.add(hull);

    // Tracks
    const trackWidth = 0.3;
    const trackGeometry = new THREE.BoxGeometry(trackWidth, height * 0.3, depth);
    
    // Left track
    const leftTrack = new THREE.Mesh(trackGeometry, material);
    leftTrack.position.set(-halfWidth - trackWidth/2, -height * 0.3, 0);
    tankGroup.add(leftTrack);

    // Right track
    const rightTrack = new THREE.Mesh(trackGeometry, material);
    rightTrack.position.set(halfWidth + trackWidth/2, -height * 0.3, 0);
    tankGroup.add(rightTrack);

    // Front armor plate (angled)
    const frontPlateGeometry = new THREE.PlaneGeometry(width * 0.8, height * 0.7);
    const frontPlate = new THREE.Mesh(frontPlateGeometry, material);
    frontPlate.position.z = halfDepth;
    frontPlate.position.y = height * 0.15;
    frontPlate.rotation.x = -Math.PI * 0.1;
    tankGroup.add(frontPlate);

    // Rear armor plate (angled)
    const rearPlateGeometry = new THREE.PlaneGeometry(width * 0.9, height * 0.8);
    const rearPlate = new THREE.Mesh(rearPlateGeometry, material);
    rearPlate.position.z = -halfDepth;
    rearPlate.position.y = height * 0.1;
    rearPlate.rotation.x = Math.PI + Math.PI * 0.1;
    tankGroup.add(rearPlate);

    return tankGroup;
}

function createTurret(radius, height, material) {
    const turretGroup = new THREE.Group();

    // Main turret body (octagonal)
    const segments = 8;
    const turretGeometry = new THREE.CylinderGeometry(radius, radius * 1.1, height, segments);
    const turret = new THREE.Mesh(turretGeometry, material);
    turretGroup.add(turret);

    // Turret top (slightly domed)
    const topGeometry = new THREE.SphereGeometry(radius, segments, segments, 0, Math.PI * 2, 0, Math.PI / 2);
    const top = new THREE.Mesh(topGeometry, material);
    top.position.y = height / 2;
    turretGroup.add(top);

    // Commander's hatch
    const hatchRadius = radius * 0.4;
    const hatchGeometry = new THREE.CylinderGeometry(hatchRadius, hatchRadius, height * 0.2, segments);
    const hatch = new THREE.Mesh(hatchGeometry, material);
    hatch.position.set(-radius * 0.3, height / 2, 0);
    turretGroup.add(hatch);

    return turretGroup;
}

function createCannon(radius, length, material) {
    const cannonGroup = new THREE.Group();

    // Main gun barrel
    const barrelGeometry = new THREE.CylinderGeometry(radius, radius * 0.9, length, 8);
    const barrel = new THREE.Mesh(barrelGeometry, material);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.x = length / 2;
    cannonGroup.add(barrel);

    // Gun mantlet (the reinforced area where the gun meets the turret)
    const mantletGeometry = new THREE.CylinderGeometry(radius * 2, radius * 2, radius * 2, 8);
    const mantlet = new THREE.Mesh(mantletGeometry, material);
    mantlet.rotation.z = Math.PI / 2;
    cannonGroup.add(mantlet);

    return cannonGroup;
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
    projectile.userData.velocity = direction.multiplyScalar(projectileSpeed);
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
    const hits = playerMaxHits - playerHitCount;
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
    playerHealth = 100;
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
    scene.background = new THREE.Color(0x000000);

    // Initialize object pools
    projectilePool = new ObjectPool(() => {
        const projectileGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
        const projectileMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00ff00,
            wireframe: true,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5
        });
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
        projectile.visible = false;
        scene.add(projectile);
        return projectile;
    });

    explosionPool = new ObjectPool(() => {
        const particles = new THREE.Group();
        for (let i = 0; i < 8; i++) {
            const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const material = new THREE.MeshStandardMaterial({
                color: 0xff0000,
                wireframe: true,
                emissive: 0xff0000,
                emissiveIntensity: 0.5
            });
            const particle = new THREE.Mesh(geometry, material);
            particles.add(particle);
        }
        particles.visible = false;
        scene.add(particles);
        return particles;
    });

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    console.log('Three.js initialized');

    // Enhanced lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Increased intensity
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5); // Increased intensity
    directionalLight.position.set(10, 10, 5);
    scene.add(directionalLight);

    // Add hemisphere light for better overall illumination
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    scene.add(hemisphereLight);

    console.log('Lights added to scene');

    // Ground setup
    const groundSize = 200;
    const divisions = 100;
    const gridHelper = new THREE.GridHelper(groundSize, divisions, 0x00ff00, 0x008000);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    console.log('Grid added');

    // Create mountains
    const mountainDistance = groundSize * 0.7;
    const numMountains = 8;
    for (let i = 0; i < numMountains; i++) {
        const angle = (i / numMountains) * Math.PI * 2;
        const x = Math.cos(angle) * mountainDistance * (0.8 + Math.random() * 0.4);
        const z = Math.sin(angle) * mountainDistance * (0.8 + Math.random() * 0.4);
        const mountainSize = 20 + Math.random() * 30;
        const mountain = createMountain(mountainSize, new THREE.Vector3(x, 0, z));
        scene.add(mountain);
    }

    console.log('Mountains added');

    // Create obstacles
    const numObstacles = 25;
    const obstacleSpread = groundSize * 0.4;
    for (let i = 0; i < numObstacles; i++) {
        const x = (Math.random() - 0.5) * obstacleSpread;
        const z = (Math.random() - 0.5) * obstacleSpread;
        if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
        const obstacle = createMapObstacle(new THREE.Vector3(x, 0, z));
        scene.add(obstacle);
        obstacles.push(obstacle);
    }

    console.log('Obstacles added');

    // Create player tank
    const bodyWidth = 2;
    const bodyHeight = 1;
    const bodyDepth = 3;
    const tankMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x00ff00, 
        wireframe: true, 
        side: THREE.DoubleSide,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5
    });

    // Create tank body
    tankBody = createTankBody(bodyWidth, bodyHeight, bodyDepth, tankMaterial);
    tankBody.position.y = 0.5;
    scene.add(tankBody);

    console.log('Player tank body added');

    // Create turret
    tankTurret = createTurret(0.6, 0.8, new THREE.MeshStandardMaterial({ 
        color: 0x00ff00,
        wireframe: true,
        opacity: 0.3,
        transparent: true,
        emissive: 0x00ff00,
        emissiveIntensity: 0.3
    }));
    tankTurret.position.y = bodyHeight;
    tankBody.add(tankTurret);

    // Create cannon
    tankCannon = createCannon(0.15, 2, new THREE.MeshStandardMaterial({ 
        color: 0x00ff00,
        wireframe: true,
        opacity: 0.3,
        transparent: true,
        emissive: 0x00ff00,
        emissiveIntensity: 0.3
    }));
    tankCannon.position.y = 0.1;
    tankTurret.add(tankCannon);

    console.log('Tank turret and cannon added');

    // Camera setup
    camera.position.y = bodyHeight + 0.2;
    camera.position.z = 0.3;
    tankTurret.add(camera);

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

    console.log('Enemy tanks added');

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

    // Create HUD
    createHUD();

    console.log('Setup complete, starting animation');
    // Start animation loop
    animate();

    // Add camera listener in init function
    camera.add(audioListener);
    initSounds();

    // Start engine sound when game starts
    setTimeout(() => {
        playSound('engineIdle');
    }, 1000);
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
        tankBody.translateZ(-moveSpeed);
    }
    if (keyboardState['KeyS']) {
        tankBody.translateZ(moveSpeed);
    }
    if (keyboardState['KeyA']) {
        tankBody.rotation.y += rotationSpeed;
    }
    if (keyboardState['KeyD']) {
        tankBody.rotation.y -= rotationSpeed;
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
        projectile.userData.velocity.y -= projectileGravity;
        
        // Update position
        projectile.position.add(projectile.userData.velocity);
        projectile.userData.distanceTraveled += projectile.userData.velocity.length();

        // Check if projectile hit ground
        if (projectile.position.y < 0) {
            createExplosion(projectile.position, projectile.userData.isEnemyProjectile ? 0xff0000 : 0x00ff00, 0.5);
            projectilePool.release(projectile);
            projectiles.splice(i, 1);
            continue;
        }

        // Check if projectile should be removed due to distance
        if (projectile.userData.distanceTraveled > projectileMaxDistance) {
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
                    
                    if (playerHealth <= 0 || playerHitCount >= playerMaxHits) {
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
                    createExplosion(projectile.position, 0x00ff00);
                    break;
                }
            }
        }
    }
}

function createExplosion(position, color, size = 1) {
    // Play explosion sound
    playSound('explosion');

    const explosion = explosionPool.acquire();
    explosion.visible = true;
    explosion.position.copy(position);
    explosion.scale.set(size, size, size);

    // Set color for all particles
    explosion.children.forEach(particle => {
        particle.material.color.setHex(color);
        particle.material.emissive.setHex(color);
        
        // Random velocity
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.2,
            (Math.random() - 0.5) * 0.2
        );
    });

    // Animate explosion
    const startTime = Date.now();
    const duration = 1000;

    function animateExplosion() {
        const elapsed = Date.now() - startTime;
        if (elapsed > duration) {
            explosionPool.release(explosion);
            return;
        }

        const progress = elapsed / duration;
        explosion.children.forEach(particle => {
            particle.position.add(particle.userData.velocity);
            particle.rotation.x += 0.1;
            particle.rotation.y += 0.1;
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
