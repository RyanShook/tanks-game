/**
 * AUTHENTIC 1980 BATTLE ZONE RECREATION
 * 
 * Main game controller and initialization
 * Handles scene setup, game loop, controls, and game state management
 * 
 * Key Features:
 * - Authentic dual-joystick style controls mapped to tank treads
 * - First-person tank combat with fixed camera view
 * - Single-shot projectile system like original arcade
 * - Wave-based enemy progression
 * - No mouse look controls (authentic to 1980 arcade)
 */

import * as THREE from 'three';
import { GAME_PARAMS } from './constants.js';
import * as state from './state.js';
import { initProjectiles, updateProjectiles, fireProjectile, clearProjectiles, damagePlayer } from './projectile.js';
import { initEffects, createExplosion, updateCameraShake } from './effects.js';
import { createHUD, updateLivesDisplay, updateRadar, updateWaveDisplay, showWaveCompletionMessage } from './hud.js';
import { initSounds, playSound } from './sound.js';
import { createMountainRange, createObstacles } from './world.js';
import { createPlayer, handleMovement, resetTracks, queueMouseTurn, getMovementState } from './player.js';
import { spawnWave } from './enemy.js';

let gameStarted = false;
let isPaused = false;
let animationFrameId = null;
let lastFrameTime = 0;
let simulationTime = 0;
let lastFireTime = -Infinity;
let waveTransitionActive = false;
let waveTimer = null;
let combatMessageTimer = null;
let audioInitialized = false;

/**
 * Initialize the game scene, renderer, and all game systems
 * Sets up the 3D world, lighting, and game objects
 */
function init() {
    // === SCENE SETUP ===
    state.setScene(new THREE.Scene());
    state.scene.background = new THREE.Color(0x000000); // Authentic pure black background

    // Minimal ambient lighting for authentic vector look
    const ambientLight = new THREE.AmbientLight(0x002200, 0.3);
    state.scene.add(ambientLight);

    // === GAME SYSTEM INITIALIZATION ===
    state.setGameOverScreen(document.getElementById('gameOver'));
    initProjectiles(state.scene);  // Initialize projectile object pool
    initEffects(state.scene);      // Initialize explosion and effect systems

    // === CAMERA SETUP ===
    // Wide FOV camera for authentic Battle Zone feel
    state.setCamera(new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 2000));
    // Camera position set when player tank is created

    // === RENDERER SETUP ===
    state.setRenderer(new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }));
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    state.renderer.domElement.setAttribute('aria-label', 'Battlezone battlefield');
    document.body.appendChild(state.renderer.domElement); // Canvas must be first for proper layering

    // === WORLD CREATION ===
    // No ground grid - pure black ground

    createMountainRange();  // Distant mountains on horizon
    createObstacles();      // Pyramids and blocks for cover
    createPlayer();         // Create player tank and camera setup
    createHUD();           // Radar, score, lives display (must be after canvas)

    // Keyboard input handlers
    state.setHandleKeyDown((event) => {
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            event.preventDefault();
        }

        if (!gameStarted && (event.code === 'Enter' || event.code === 'Space')) {
            startGame();
            return;
        }
        if (state.isGameOver) {
            if (event.code === 'KeyR' || event.code === 'Enter') resetGame();
            if (event.code === 'Escape') returnToMainMenu();
            return;
        }
        if (gameStarted && (event.code === 'KeyP' || event.code === 'Escape')) {
            togglePause();
            return;
        }
        if (event.code === 'KeyF') {
            toggleFullscreen();
            return;
        }
        if (!gameStarted || isPaused) return;

        state.keyboardState[event.code] = true;
        if (event.code === 'Space') attemptFire();
    });

    state.setHandleKeyUp((event) => {
        state.keyboardState[event.code] = false;
    });

    // === EVENT LISTENERS ===
    document.addEventListener('keydown', state.handleKeyDown);
    document.addEventListener('keyup', state.handleKeyUp);
    state.renderer.domElement.addEventListener('mousedown', (event) => {
        if (event.button !== 0 || !gameStarted || isPaused || state.isGameOver) return;
        if (document.pointerLockElement !== state.renderer.domElement) {
            state.renderer.domElement.requestPointerLock?.();
        }
        attemptFire();
    });
    state.renderer.domElement.addEventListener('contextmenu', event => event.preventDefault());
    document.addEventListener('mousemove', (event) => {
        if (gameStarted && !isPaused && !state.isGameOver && document.pointerLockElement === state.renderer.domElement) {
            queueMouseTurn(event.movementX);
        }
    });
    window.addEventListener('blur', () => {
        clearKeyboardState();
        if (gameStarted && !state.isGameOver) togglePause(true);
    });
    window.addEventListener('resize', onWindowResize, false);

    state.renderer.render(state.scene, state.camera);
}

function onWindowResize() {
    state.camera.aspect = window.innerWidth / window.innerHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(window.innerWidth, window.innerHeight);
}

function clearKeyboardState() {
    Object.keys(state.keyboardState).forEach(code => {
        state.keyboardState[code] = false;
    });
}

function attemptFire() {
    const now = performance.now();
    if (!gameStarted || isPaused || state.isGameOver || now - lastFireTime < GAME_PARAMS.FIRE_COOLDOWN) return;
    if (fireProjectile()) {
        lastFireTime = now;
    }
}

function updateGame(deltaSeconds) {
    try {
        if (gameStarted && !isPaused && !state.isGameOver) {
            simulationTime += deltaSeconds;
            handleMovement(deltaSeconds);
            updateProjectiles(deltaSeconds, gameOver);
            state.enemyTanks.filter(enemy => !enemy.isDestroyed).forEach(enemy => {
                if (enemy.update) enemy.update(deltaSeconds, () => damagePlayer(gameOver));
            });
            updateRadar();
            updateWaveDisplay();
            checkWaveCompletion();
        }

        updateLivesDisplay();
        updateCameraShake(deltaSeconds);
    } catch (error) {
        console.error('Animation error:', error);
        console.error('Error stack:', error.stack);
    }
}

function render() {
    if (state.renderer && state.scene && state.camera) {
        state.renderer.render(state.scene, state.camera);
    }
}

function animate(timestamp) {
    animationFrameId = requestAnimationFrame(animate);
    const deltaSeconds = lastFrameTime ? Math.min((timestamp - lastFrameTime) / 1000, 0.05) : 1 / 60;
    lastFrameTime = timestamp;
    updateGame(deltaSeconds);
    render();
}

function gameOver() {
    if (state.isGameOver) return;
    state.setGameOver(true);
    isPaused = false;
    clearKeyboardState();
    document.exitPointerLock?.();
    document.querySelector('.invulnerable-indicator')?.classList.remove('active');
    const combatMessage = document.getElementById('combatMessage');
    combatMessage?.classList.remove('active');
    if (combatMessage) combatMessage.textContent = '';
    
    // Update high score
    const currentHighScore = parseInt(localStorage.getItem('battleZoneHighScore') || '0');
    if (state.score > currentHighScore) {
        localStorage.setItem('battleZoneHighScore', state.score.toString());
        updateHighScoreDisplay();
    }
    
    // Update game over screen with final stats
    updateGameOverStats();
    
    if (state.gameOverScreen) {
        state.gameOverScreen.style.display = 'block';
    }

    // Dramatic tank destruction sequence
    createExplosion(state.tankBody.position, 0x00ff00, 4);
    playSound('explosion');
    
    for (let i = 0; i < 8; i++) {
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            Math.random() * 2,
            (Math.random() - 0.5) * 3
        );
        const position = state.tankBody.position.clone().add(offset);
        setTimeout(() => {
            createExplosion(position, 0x00ff00, 1.5 + Math.random());
        }, i * 150);
    }

    state.tankBody.visible = false;

}

function updateGameOverStats() {
    const finalScoreElement = document.getElementById('finalScore');
    const finalWaveElement = document.getElementById('finalWave');
    const tanksDestroyedElement = document.getElementById('tanksDestroyed');
    
    if (finalScoreElement) {
        finalScoreElement.textContent = state.score.toString().padStart(6, '0');
    }
    if (finalWaveElement) {
        finalWaveElement.textContent = (state.currentWave - 1).toString();
    }
    if (tanksDestroyedElement) {
        // Estimate enemies destroyed based on minimum score per enemy
        tanksDestroyedElement.textContent = state.tanksDestroyed.toString();
    }
}

function updateHighScoreDisplay() {
    const highScore = parseInt(localStorage.getItem('battleZoneHighScore') || '0');
    state.setHighScore(highScore);
    const highScoreElement = document.getElementById('highScoreDisplay');
    if (highScoreElement) {
        highScoreElement.textContent = highScore.toString().padStart(6, '0');
    }
}

function returnToMainMenu() {
    // Hide game over screen
    if (state.gameOverScreen) {
        state.gameOverScreen.style.display = 'none';
    }
    
    // Show start screen
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
        startScreen.style.display = 'flex';
    }
    gameStarted = false;
    isPaused = false;
    document.getElementById('pauseScreen')?.classList.remove('active');
    document.exitPointerLock?.();

    // Reset game state but don't start
    resetGameState();
    render();
}

function resetGame() {
    resetGameState();
    gameStarted = true;
    isPaused = false;

    // Hide game over screen and start playing
    state.gameOverScreen.style.display = 'none';
    document.getElementById('pauseScreen')?.classList.remove('active');

    // Spawn first wave
    spawnWave(state.currentWave);
    updateLivesDisplay();
}

function resetGameState() {
    if (waveTimer) {
        clearTimeout(waveTimer);
        waveTimer = null;
    }
    waveTransitionActive = false;
    simulationTime = 0;
    lastFireTime = -Infinity;
    clearKeyboardState();
    document.querySelector('.invulnerable-indicator')?.classList.remove('active');
    const combatMessage = document.getElementById('combatMessage');
    combatMessage?.classList.remove('active');
    if (combatMessage) combatMessage.textContent = '';
    state.setGameOver(false);
    state.setPlayerInvulnerable(false);

    // Reset tank position and make it visible
    if (state.tankBody) {
        state.tankBody.position.set(0, 0.5, 0);
        state.tankBody.rotation.set(0, 0, 0);
        state.tankBody.visible = false; // First-person view, tank is invisible
    }
    if (state.tankTurret) {
        state.tankTurret.rotation.set(0, 0, 0);
    }
    if (state.tankCannon) {
        state.tankCannon.rotation.set(0, 0, 0);
    }

    clearProjectiles();

    // Clear all enemies
    for (const enemy of state.enemyTanks) {
        state.scene.remove(enemy.body);
    }
    state.enemyTanks.length = 0;

    // Reset authentic Battlezone game state
    state.setCurrentWave(1);
    state.setScore(0);
    state.setLives(GAME_PARAMS.STARTING_LIVES);
    state.setTanksDestroyed(0);
    state.setLastBonusLifeScore(0);
    state.setEnemiesRemaining(0);
    
    resetTracks();
}

function checkWaveCompletion() {
    if (state.enemiesRemaining <= 0 && !state.isGameOver && !waveTransitionActive) {
        waveTransitionActive = true;
        const completedWave = state.currentWave;
        state.setCurrentWave(state.currentWave + 1);
        
        // Calculate wave completion bonus
        const waveBonus = completedWave * 50;
        state.setScore(state.score + waveBonus);
        
        // Show wave completion message
        if (typeof showWaveCompletionMessage === 'function') {
            showWaveCompletionMessage(waveBonus);
        }
        
        // Play victory sound
        playSound('waveComplete');
        
        // Increase difficulty for next wave
        increaseDifficulty();
        
        // Spawn next wave after dramatic pause
        waveTimer = setTimeout(() => {
            spawnWave(state.currentWave);
            waveTransitionActive = false;
            waveTimer = null;
            playSound('newWave');
        }, 2200);
    }
}

function increaseDifficulty() {
    if (state.currentWave % 3 === 0) {
        showCombatMessage(`THREAT LEVEL ${state.currentWave}`, 1600);
    }
}

function startGame() {
    if (gameStarted && !state.isGameOver) return;
    // Hide start screen
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
        startScreen.style.display = 'none';
    }
    
    gameStarted = true;
    isPaused = false;

    if (!audioInitialized) {
        initSounds(state.camera);
        audioInitialized = true;
        setTimeout(() => playSound('engineIdle'), 1000);
    }
    
    // Reset game state for new game
    resetGameState();
    
    // Spawn first wave
    spawnWave(state.currentWave);
    updateLivesDisplay();
    
    showCombatMessage('LINK ESTABLISHED');

    if (animationFrameId === null) {
        lastFrameTime = 0;
        animationFrameId = requestAnimationFrame(animate);
    }
}

function togglePause(forcePaused) {
    if (!gameStarted || state.isGameOver) return;
    isPaused = typeof forcePaused === 'boolean' ? forcePaused : !isPaused;
    clearKeyboardState();
    document.getElementById('pauseScreen')?.classList.toggle('active', isPaused);
    if (isPaused) document.exitPointerLock?.();
    lastFrameTime = 0;
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
    } else {
        document.exitFullscreen?.();
    }
}

function showCombatMessage(message, duration = 1200) {
    const element = document.getElementById('combatMessage');
    if (!element) return;
    clearTimeout(combatMessageTimer);
    element.textContent = message;
    element.classList.add('active');
    combatMessageTimer = setTimeout(() => element.classList.remove('active'), duration);
}

// Set up the scene but don't start the game yet
init();

// Add event listener for start button and load high score
document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('startButton');
    if (startButton) {
        startButton.addEventListener('click', startGame);
    }
    
    // Load and display high score
    updateHighScoreDisplay();

    document.getElementById('resumeButton')?.addEventListener('click', () => togglePause(false));
});

window.render_game_to_text = () => {
    const playerPosition = state.tankBody?.position || new THREE.Vector3();
    const movement = getMovementState();
    const mode = !gameStarted ? 'menu' : state.isGameOver ? 'gameOver' : isPaused ? 'paused' : waveTransitionActive ? 'waveTransition' : 'playing';
    const enemies = state.enemyTanks
        .filter(enemy => !enemy.isDestroyed)
        .map(enemy => {
            const dx = enemy.body.position.x - playerPosition.x;
            const dz = enemy.body.position.z - playerPosition.z;
            return {
                type: enemy.type,
                x: Number(enemy.body.position.x.toFixed(1)),
                z: Number(enemy.body.position.z.toFixed(1)),
                distance: Number(Math.hypot(dx, dz).toFixed(1))
            };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);

    return JSON.stringify({
        coordinateSystem: 'Ground plane uses x east/west and z north/south; heading 0 faces -z.',
        mode,
        player: {
            x: Number(playerPosition.x.toFixed(2)),
            z: Number(playerPosition.z.toFixed(2)),
            headingDegrees: Number(THREE.MathUtils.radToDeg(state.tankBody?.rotation.y || 0).toFixed(1)),
            speed: Number(movement.speed.toFixed(2)),
            lives: state.lives,
            shielded: state.playerInvulnerable
        },
        score: state.score,
        highScore: state.highScore,
        wave: state.currentWave,
        enemiesRemaining: state.enemiesRemaining,
        enemies,
        projectiles: state.projectiles.map(projectile => ({
            owner: projectile.userData.isEnemyProjectile ? 'enemy' : 'player',
            x: Number(projectile.position.x.toFixed(1)),
            z: Number(projectile.position.z.toFixed(1))
        }))
    });
};

window.advanceTime = (milliseconds) => {
    const steps = Math.max(1, Math.round(milliseconds / (1000 / 60)));
    for (let i = 0; i < steps; i++) updateGame(1 / 60);
    render();
};
