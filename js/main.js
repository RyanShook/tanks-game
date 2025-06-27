import * as THREE from 'three';
import { GAME_PARAMS } from './constants.js';
import * as state from './state.js';
import { createPlayer, handleMovement } from './player.js';
import { spawnWave } from './enemy.js';
import { initProjectiles, updateProjectiles, createExplosion } from './projectile.js';
import { updatePowerUps } from './powerup.js';
import { createHUD, updateHealthDisplay, updateRadar, updateWaveDisplay, showWaveCompletionMessage } from './hud.js';
import { initSounds, playSound } from './sound.js';
import { createMountainRange, createHorizontalGrid, createObstacles } from './world.js';

function init() {
    state.setScene(new THREE.Scene());
    state.scene.background = new THREE.Color(0x000000);

    initProjectiles();

    state.setCamera(new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000));
    state.camera.position.set(0, 2, 5);

    state.setRenderer(new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    state.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(state.renderer.domElement);

    const grid = createHorizontalGrid(GAME_PARAMS.GRID_SIZE, GAME_PARAMS.GRID_DIVISIONS, 0x00ff00);
    grid.position.y = -0.5;
    state.scene.add(grid);

    createMountainRange();
    createPlayer();
    createHUD();
    createObstacles();

    spawnWave(state.currentWave);

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

function animate() {
    requestAnimationFrame(animate);
    
    try {
        if (!state.isGameOver) {
            handleMovement();
            updateProjectiles();
            state.enemyTanks.forEach(enemy => enemy.update());
            state.enemySpaceships.forEach(spaceship => spaceship.update());
            updatePowerUps();
            updateRadar();
            updateWaveDisplay();
            checkWaveCompletion();
        }
        
        updateHealthDisplay();
        state.renderer.render(state.scene, state.camera);
    } catch (error) {
        console.error('Animation error:', error);
    }
}

function onWindowResize() {
    state.camera.aspect = window.innerWidth / window.innerHeight;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(window.innerWidth, window.innerHeight);
}

function checkWaveCompletion() {
    if (state.enemiesRemaining <= 0 && !state.isGameOver) {
        const waveBonus = GAME_PARAMS.WAVE_BONUS * state.currentWave;
        state.score += waveBonus;
        
        showWaveCompletionMessage(waveBonus);
        
        state.setCurrentWave(state.currentWave + 1);
        setTimeout(() => {
            if (!state.isGameOver) {
                spawnWave(state.currentWave);
            }
        }, 3000);
    }
}

window.addEventListener('load', () => {
    init();
});
