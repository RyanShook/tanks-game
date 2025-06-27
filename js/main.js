import * as THREE from 'three';
import { GAME_PARAMS } from './constants.js';
import * as state from './state.js';
import { initProjectiles, updateProjectiles, fireProjectile } from './projectile.js';
import { initEffects, createExplosion } from './effects.js';
import { updatePowerUps } from './powerup.js';
import { createHUD, updateHealthDisplay, updateRadar, updateWaveDisplay, showWaveCompletionMessage } from './hud.js';
import { initSounds, playSound } from './sound.js';
import { createMountainRange, createHorizontalGrid, createObstacles } from './world.js';
import { createPlayer, handleMovement } from './player.js';
import { spawnWave } from './enemy.js';

function init() {
    state.setScene(new THREE.Scene());
    state.scene.background = new THREE.Color(0x001100); // Very dark green instead of pure black

    // Add basic lighting to help with visibility
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    state.scene.add(ambientLight);

    // Initialize game state
    state.setPlayerHealth(GAME_PARAMS.MAX_HEALTH);
    state.setGameOverScreen(document.getElementById('gameOver'));

    initProjectiles(state.scene);
    initEffects(state.scene);

    state.setCamera(new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000));
    // Don't set camera position here - it will be set when player is created

    state.setRenderer(new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    state.renderer.setPixelRatio(window.devicePixelRatio);
    // Add canvas FIRST to ensure it's behind HUD elements
    document.body.appendChild(state.renderer.domElement);

    const grid = createHorizontalGrid(GAME_PARAMS.GRID_SIZE, GAME_PARAMS.GRID_DIVISIONS, 0x00ff00);
    grid.position.y = -0.5;
    state.scene.add(grid);

    createMountainRange();
    createObstacles();
    createPlayer();
    // Create HUD AFTER canvas so it appears on top
    createHUD();

    spawnWave(state.currentWave);

    // Debug logging
    console.log('Game initialized:');
    console.log('- Scene children count:', state.scene.children.length);
    console.log('- Camera position:', state.camera.position);
    console.log('- Camera world position:', state.camera.getWorldPosition(new THREE.Vector3()));
    console.log('- Tank body visible:', state.tankBody?.visible);
    console.log('- Tank body position:', state.tankBody?.position);
    console.log('- Renderer size:', state.renderer.getSize(new THREE.Vector2()));
    console.log('- Canvas element:', state.renderer.domElement);
    console.log('- Canvas parent:', state.renderer.domElement.parentElement);

    state.handleKeyDown = (event) => {
        state.keyboardState[event.code] = true;
        if (event.code === 'Space') {
            fireProjectile();
        }
    };

    state.handleKeyUp = (event) => {
        state.keyboardState[event.code] = false;
    };

    document.addEventListener('keydown', state.handleKeyDown);
    document.addEventListener('keyup', state.handleKeyUp);
    window.addEventListener('resize', onWindowResize, false);

    initSounds(state.camera);
    setTimeout(() => playSound('engineIdle'), 1000);

    animate();
}

function onWindowResize() {
    state.camera.aspect = window.innerWidth / window.innerHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    try {
        if (!state.isGameOver) {
            handleMovement();
            updateProjectiles(gameOver);
            state.enemyTanks.forEach(enemy => enemy.update());
            state.enemySpaceships.forEach(spaceship => spaceship.update());
            updatePowerUps();
            updateRadar();
            updateWaveDisplay();
            checkWaveCompletion();
        }
        
        updateHealthDisplay();
        
        // Force render - this should show something!
        if (state.renderer && state.scene && state.camera) {
            state.renderer.render(state.scene, state.camera);
        } else {
            console.error('Missing renderer components:', {
                renderer: !!state.renderer,
                scene: !!state.scene,
                camera: !!state.camera
            });
        }
    } catch (error) {
        console.error('Animation error:', error);
        console.error('Error stack:', error.stack);
    }
}

function gameOver() {
    state.setGameOver(true);
    
    if (state.gameOverScreen) {
        state.gameOverScreen.style.display = 'block';
    }

    createExplosion(state.tankBody.position, 0x00ff00, 4);
    
    for (let i = 0; i < 8; i++) {
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            Math.random() * 2,
            (Math.random() - 0.5) * 3
        );
        const position = state.tankBody.position.clone().add(offset);
        setTimeout(() => {
            createExplosion(position, 0x00ff00, 1.5 + Math.random());
        }, i * 100);
    }

    state.tankBody.visible = false;

    document.removeEventListener('keydown', state.handleKeyDown);
    document.removeEventListener('keyup', state.handleKeyUp);

    document.addEventListener('keydown', handleRestart);
}

function handleRestart(event) {
    if (event.code === 'KeyR' && state.isGameOver) {
        document.removeEventListener('keydown', handleRestart);
        resetGame();
    }
}

function resetGame() {
    state.setPlayerHealth(GAME_PARAMS.MAX_HEALTH);
    state.setPlayerHitCount(0);
    state.setGameOver(false);
    state.setPlayerInvulnerable(false);

    state.tankBody.position.set(0, 0.5, 0);
    state.tankBody.rotation.set(0, 0, 0);
    state.tankTurret.rotation.set(0, 0, 0);
    state.tankCannon.rotation.set(0, 0, 0);

    for (const projectile of state.projectiles) {
        state.scene.remove(projectile);
    }
    state.projectiles.length = 0;

    for (const enemy of state.enemyTanks) {
        state.scene.remove(enemy.body);
    }
    for (const spaceship of state.enemySpaceships) {
        state.scene.remove(spaceship.mesh);
    }
    state.enemyTanks.length = 0;
    state.enemySpaceships.length = 0;

    for (const powerUp of state.powerUps) {
        state.scene.remove(powerUp.mesh);
    }
    state.powerUps.length = 0;
    state.setLastPowerUpSpawn(0);

    state.setCurrentWave(1);
    state.score = 0;
    state.setEnemiesRemaining(0);

    GAME_PARAMS.MOVE_SPEED = 0.1;
    GAME_PARAMS.ROTATION_SPEED = 0.03;
    GAME_PARAMS.ENEMY_SHOT_INTERVAL = 3000;

    spawnWave(state.currentWave);

    state.gameOverScreen.style.display = 'none';

    document.addEventListener('keydown', state.handleKeyDown);
    document.addEventListener('keyup', state.handleKeyUp);

    updateHealthDisplay();
}

function checkWaveCompletion() {
    if (state.enemiesRemaining <= 0 && !state.isGameOver) {
        state.setCurrentWave(state.currentWave + 1);
        
        // Show wave completion message
        if (typeof showWaveCompletionMessage === 'function') {
            const waveBonus = GAME_PARAMS.WAVE_BONUS;
            state.score += waveBonus;
            showWaveCompletionMessage(waveBonus);
        }
        
        // Spawn next wave after a short delay
        setTimeout(() => {
            spawnWave(state.currentWave);
        }, 2000);
    }
}

// Initialize the game
init();
