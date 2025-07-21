import * as THREE from 'three';
import { GAME_PARAMS } from './constants.js';
import * as state from './state.js';
import { initProjectiles, updateProjectiles, fireProjectile } from './projectile.js';
import { initEffects, createExplosion, updateCameraShake } from './effects.js';
import { createHUD, updateLivesDisplay, updateRadar, updateWaveDisplay, showWaveCompletionMessage } from './hud.js';
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

    // Authentic Battlezone firing control with cooldown
    let lastFireTime = 0;

    state.setHandleKeyDown((event) => {
        state.keyboardState[event.code] = true;
        if (event.code === 'Space') {
            event.preventDefault();
            const now = Date.now();
            // Rapid fire upgrade reduces cooldown
            const fireRate = state.weaponUpgrades.rapidFire ? GAME_PARAMS.FIRE_COOLDOWN * 0.5 : GAME_PARAMS.FIRE_COOLDOWN;
            if (now - lastFireTime > fireRate) {
                fireProjectile();
                lastFireTime = now;
            }
        }
    });

    state.setHandleKeyUp((event) => {
        state.keyboardState[event.code] = false;
    });

    // Simple mouse controls without pointer lock
    const handleMouseMove = (event) => {
        if (state.isGameOver) return;
        
        const sensitivity = 0.005;
        const deltaX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
        state.tankTurret.rotation.y -= deltaX * sensitivity;
    };

    const handleMouseClick = () => {
        const now = Date.now();
        // Rapid fire upgrade reduces cooldown
        const fireRate = state.weaponUpgrades.rapidFire ? GAME_PARAMS.FIRE_COOLDOWN * 0.5 : GAME_PARAMS.FIRE_COOLDOWN;
        if (now - lastFireTime > fireRate) {
            fireProjectile();
            lastFireTime = now;
        }
    };

    document.addEventListener('keydown', state.handleKeyDown);
    document.addEventListener('keyup', state.handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleMouseClick);
    window.addEventListener('resize', onWindowResize, false);

    // Don't start sounds or animation until user clicks start button
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
            // Filter out destroyed enemies before updating for better performance
            state.enemyTanks.filter(enemy => !enemy.isDestroyed).forEach(enemy => enemy.update());
            updateRadar();
            updateWaveDisplay();
            checkWaveCompletion();
        }
        
        updateLivesDisplay();
        updateCameraShake(); // Update camera shake effect
        
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

    document.removeEventListener('keydown', state.handleKeyDown);
    document.removeEventListener('keyup', state.handleKeyUp);

    document.addEventListener('keydown', handleGameOverInput);
}

function handleGameOverInput(event) {
    if (!state.isGameOver) return;
    
    if (event.code === 'KeyR') {
        document.removeEventListener('keydown', handleGameOverInput);
        resetGame();
    } else if (event.code === 'Escape') {
        document.removeEventListener('keydown', handleGameOverInput);
        returnToMainMenu();
    }
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
        tanksDestroyedElement.textContent = Math.floor(state.score / GAME_PARAMS.TANK_SCORE).toString();
    }
}

function updateHighScoreDisplay() {
    const highScore = parseInt(localStorage.getItem('battleZoneHighScore') || '0');
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
    
    // Reset game state but don't start
    resetGameState();
}

function resetGame() {
    resetGameState();
    
    // Hide game over screen and start playing
    state.gameOverScreen.style.display = 'none';
    
    // Re-enable controls
    document.addEventListener('keydown', state.handleKeyDown);
    document.addEventListener('keyup', state.handleKeyUp);

    // Spawn first wave
    spawnWave(state.currentWave);
    updateLivesDisplay();
    
    console.log('Game restarted');
}

function resetGameState() {
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

    // Clear all projectiles
    for (const projectile of state.projectiles) {
        state.scene.remove(projectile);
    }
    state.projectiles.length = 0;

    // Clear all enemies
    for (const enemy of state.enemyTanks) {
        state.scene.remove(enemy.body);
    }
    state.enemyTanks.length = 0;

    // Reset authentic Battlezone game state
    state.setCurrentWave(1);
    state.setScore(0);
    state.setLives(GAME_PARAMS.STARTING_LIVES);
    state.setLastBonusLifeScore(0);
    state.setEnemiesRemaining(0);
    
    // Reset weapon upgrades
    state.weaponUpgrades.rapidFire = false;
    state.weaponUpgrades.dualCannon = false;
    state.weaponUpgrades.powerShot = false;
}

function checkWaveCompletion() {
    if (state.enemiesRemaining <= 0 && !state.isGameOver) {
        const completedWave = state.currentWave;
        state.setCurrentWave(state.currentWave + 1);
        
        // Calculate wave completion bonus
        const waveBonus = completedWave * 50;
        state.score += waveBonus;
        
        // Show wave completion message
        if (typeof showWaveCompletionMessage === 'function') {
            showWaveCompletionMessage(waveBonus);
        }
        
        // Play victory sound
        playSound('waveComplete');
        
        // Increase difficulty for next wave
        increaseDifficulty();
        
        // Spawn next wave after dramatic pause
        setTimeout(() => {
            spawnWave(state.currentWave);
            playSound('newWave');
        }, 3000);
    }
}

function increaseDifficulty() {
    // Authentic Battle Zone: Enemies get slightly faster and more aggressive
    if (state.currentWave % 3 === 0) {
        GAME_PARAMS.TANK_SPEED = Math.min(GAME_PARAMS.TANK_SPEED + 0.01, 0.25);
        GAME_PARAMS.TANK_SHOT_INTERVAL = Math.max(GAME_PARAMS.TANK_SHOT_INTERVAL - 200, 1000);
        console.log(`Wave ${state.currentWave}: Difficulty increased - Speed: ${GAME_PARAMS.TANK_SPEED}, Shot interval: ${GAME_PARAMS.TANK_SHOT_INTERVAL}`);
    }
}

function startGame() {
    // Hide start screen
    const startScreen = document.getElementById('startScreen');
    if (startScreen) {
        startScreen.style.display = 'none';
    }
    
    // Initialize audio AFTER user interaction
    initSounds(state.camera);
    setTimeout(() => playSound('engineIdle'), 1000);
    
    // Reset game state for new game
    resetGameState();
    
    // Spawn first wave
    spawnWave(state.currentWave);
    updateLivesDisplay();
    
    // Start game loop
    animate();
    
    console.log('Game started with audio enabled!');
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
});
