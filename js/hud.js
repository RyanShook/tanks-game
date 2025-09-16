/**
 * BATTLE ZONE HUD SYSTEM
 * 
 * Heads-up display for game information and radar
 * 
 * Key Features:
 * - Authentic Battle Zone radar display
 * - Score, lives, and wave indicators
 * - Real-time enemy tracking on minimap
 * - Classic arcade-style UI elements
 * - Wave completion messages
 */

import * as state from './state.js';
import { GAME_PARAMS } from './constants.js';

export function createHUD() {
    // Use existing HTML elements instead of creating new ones
    const radar = document.getElementById('radar');
    if (radar) {
        const radarCanvas = document.createElement('canvas');
        radarCanvas.width = 320;
        radarCanvas.height = 32;
        radar.appendChild(radarCanvas);
        state.setRadarContext(radarCanvas.getContext('2d'));
    }


    // Set reference to existing game over screen
    const gameOverDiv = document.getElementById('gameOver');
    if (gameOverDiv) {
        state.setGameOverScreen(gameOverDiv);
    }
}

export function updateLivesDisplay() {
    const livesDiv = document.getElementById('health');
    if (livesDiv) {
        livesDiv.textContent = `LIVES ${state.lives}`;
        livesDiv.style.color = state.playerInvulnerable ? '#ffff00' : (state.lives <= 1 ? '#ff0000' : '#00ff00');
    }
}

export function updateRadar() {
    if (!state.radarContext) return;
    
    // Clear radar
    state.radarContext.clearRect(0, 0, state.radarContext.canvas.width, state.radarContext.canvas.height);
    
    // Authentic Battlezone radar - simple green scope
    state.radarContext.strokeStyle = '#00ff00';
    state.radarContext.lineWidth = 1;
    
    // Center crosshair
    state.radarContext.beginPath();
    state.radarContext.moveTo(160, 0);
    state.radarContext.lineTo(160, 32);
    state.radarContext.moveTo(140, 16);
    state.radarContext.lineTo(180, 16);
    state.radarContext.stroke();
    
    // Show enemies based on type with different symbols
    state.enemyTanks.forEach(enemy => {
        if (!enemy.isDestroyed) {
            const dx = enemy.body.position.x - state.tankBody.position.x;
            const dz = enemy.body.position.z - state.tankBody.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < GAME_PARAMS.WORLD_BOUNDS * 0.8) {
                const x = 160 + (dx / (GAME_PARAMS.WORLD_BOUNDS * 0.8)) * 140;
                const y = 16 + (dz / (GAME_PARAMS.WORLD_BOUNDS * 0.8)) * 12;
                
                // Different radar signatures for different enemy types
                state.radarContext.fillStyle = '#00ff00';
                
                if (enemy.type === 'tank') {
                    // Tank - small square
                    state.radarContext.fillRect(x - 1, y - 1, 2, 2);
                } else if (enemy.type === 'missile') {
                    // Missile - triangle
                    state.radarContext.fillStyle = '#ff0000';
                    state.radarContext.beginPath();
                    state.radarContext.moveTo(x, y - 2);
                    state.radarContext.lineTo(x - 1.5, y + 1);
                    state.radarContext.lineTo(x + 1.5, y + 1);
                    state.radarContext.closePath();
                    state.radarContext.fill();
                } else if (enemy.type === 'supertank') {
                    // Supertank - larger square
                    state.radarContext.fillStyle = '#ffff00';
                    state.radarContext.fillRect(x - 1.5, y - 1.5, 3, 3);
                } else if (enemy.type === 'ufo') {
                    // UFO - circle
                    state.radarContext.fillStyle = '#ffff00';
                    state.radarContext.beginPath();
                    state.radarContext.arc(x, y, 2, 0, Math.PI * 2);
                    state.radarContext.fill();
                }
            }
        }
    });
}

export function updateWaveDisplay() {
    const scoreDiv = document.getElementById('score');
    if (scoreDiv) {
        const formattedScore = state.score.toString().padStart(6, '0');
        scoreDiv.textContent = `SCORE ${formattedScore}`;
    }

    const hiScoreDiv = document.getElementById('hiScore');
    if (hiScoreDiv) {
        const formattedHighScore = state.highScore.toString().padStart(6, '0');
        hiScoreDiv.textContent = `HI-SCORE ${formattedHighScore}`;
    }

    const waveDiv = document.getElementById('waveInfo');
    if (waveDiv) {
        const enemies = Math.max(0, state.enemiesRemaining);
        const formattedEnemies = enemies.toString().padStart(2, '0');
        waveDiv.textContent = `WAVE ${state.currentWave}  ENEMY ${formattedEnemies}`;
    }
}

export function showWaveCompletionMessage(bonus) {
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
        <div style="font-size: 28px; margin-bottom: 10px;">WAVE ${state.currentWave - 1} ELIMINATED</div>
        <div style="font-size: 20px;">ALL TARGETS DESTROYED</div>
        <div style="font-size: 18px; margin: 10px 0;">WAVE BONUS: ${bonus} POINTS</div>
        <div style="font-size: 16px; color: #ffff00;">INCOMING WAVE ${state.currentWave}...</div>
        <div style="font-size: 14px; margin-top: 10px;">PREPARE FOR BATTLE</div>
    `;
    
    document.body.appendChild(message);
    
    createWaveFlash();
    
    setTimeout(() => {
        document.body.removeChild(message);
    }, 3000);
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
