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

    // Create power-up display div (not in HTML)
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

    // Set reference to existing game over screen
    const gameOverDiv = document.getElementById('gameOver');
    if (gameOverDiv) {
        state.setGameOverScreen(gameOverDiv);
    }
}

export function updateHealthDisplay() {
    const hits = GAME_PARAMS.MAX_HITS - state.playerHitCount;
    const healthBar = '█'.repeat(hits) + '░'.repeat(state.playerHitCount);
    const healthDiv = document.getElementById('health');
    if (healthDiv) {
        healthDiv.innerHTML = `ARMOR: ${healthBar}`;
        healthDiv.style.color = state.playerInvulnerable ? '#ffff00' : '#00ff00';
    }
}

export function updateRadar() {
    if (!state.radarContext) return;
    state.radarContext.clearRect(0, 0, state.radarContext.canvas.width, state.radarContext.canvas.height);
    state.radarContext.strokeStyle = '#00ff00';
    state.radarContext.lineWidth = 1;
    state.radarContext.beginPath();
    state.radarContext.moveTo(160, 0);
    state.radarContext.lineTo(160, 32);
    state.radarContext.stroke();
    
    state.radarContext.fillStyle = '#00ff00';
    state.enemyTanks.forEach(enemy => {
        if (!enemy.isDestroyed) {
            const dx = enemy.body.position.x - state.tankBody.position.x;
            const dz = enemy.body.position.z - state.tankBody.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < GAME_PARAMS.WORLD_BOUNDS) {
                const x = 160 + (dx / GAME_PARAMS.WORLD_BOUNDS) * 140;
                const y = 24 - (dz / GAME_PARAMS.WORLD_BOUNDS) * 20;
                state.radarContext.beginPath();
                state.radarContext.arc(x, y, 2, 0, Math.PI * 2);
                state.radarContext.fill();
            }
        }
    });
    
    state.radarContext.fillStyle = '#ffff00';
    state.enemySpaceships.forEach(spaceship => {
        if (!spaceship.isDestroyed) {
            const dx = spaceship.mesh.position.x - state.tankBody.position.x;
            const dz = spaceship.mesh.position.z - state.tankBody.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance < GAME_PARAMS.WORLD_BOUNDS) {
                const x = 160 + (dx / GAME_PARAMS.WORLD_BOUNDS) * 140;
                const y = 24 - (dz / GAME_PARAMS.WORLD_BOUNDS) * 20;
                state.radarContext.fillRect(x - 1.5, y - 1.5, 3, 3);
            }
        }
    });
}

export function updateWaveDisplay() {
    const scoreDiv = document.getElementById('score');
    if (scoreDiv) {
        const formattedScore = state.score.toString().padStart(4, '0');
        scoreDiv.innerHTML = `WAVE: ${state.currentWave} | SCORE: ${formattedScore} | ENEMIES: ${state.enemiesRemaining}`;
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
        WAVE ${state.currentWave} COMPLETE<br>
        BONUS: ${bonus} POINTS<br>
        <div style="font-size: 16px; margin-top: 10px;">PREPARING WAVE ${state.currentWave + 1}...</div>
    `;
    
    document.body.appendChild(message);
    
    createWaveFlash();
    
    setTimeout(() => {
        document.body.removeChild(message);
    }, 2500);
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

export function updatePowerUpDisplay() {
    const powerUpDiv = document.getElementById('powerUps');
    if (!powerUpDiv) return;

    const powerUpText = Array.from(state.activePowerUps).map(type => {
        switch(type) {
            case 'SPEED_BOOST': return '⚡ SPEED';
            case 'RAPID_FIRE': return '🔥 RAPID FIRE';
            case 'SHIELD': return '🛡️ SHIELD';
            default: return type;
        }
    }).join(' | ');

    powerUpDiv.innerHTML = powerUpText || '';
}
