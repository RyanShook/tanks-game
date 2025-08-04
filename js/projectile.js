/**
 * AUTHENTIC BATTLE ZONE PROJECTILE SYSTEM
 * 
 * Implements the single-shot projectile system from the original 1980 arcade game
 * 
 * Key Features:
 * - Single projectile limitation (only one bullet in flight at a time)
 * - Object pooling for performance optimization
 * - Collision detection with enemies and terrain
 * - Authentic firing mechanics and ballistics
 * - Visual feedback with explosions and camera shake
 */

import * as THREE from 'three';
import { GAME_PARAMS, VECTOR_GREEN } from './constants.js';
import * as state from './state.js';
import { playSound } from './sound.js';
import { ObjectPool, checkCollision } from './utils.js';
import { createExplosion, shakeCamera, createProjectileTrail, updateProjectileTrail, releaseProjectileTrail } from './effects.js';

// === DAMAGE FEEDBACK FUNCTIONS ===

/**
 * Show red damage flash when player is hit
 */
function showDamageFlash() {
    const damageFlash = document.querySelector('.damage-flash');
    if (damageFlash) {
        damageFlash.classList.add('active');
        setTimeout(() => {
            damageFlash.classList.remove('active');
        }, 200);
    }
}

/**
 * Show/hide invulnerability indicator after player is hit
 * @param {boolean} show - Whether to show or hide the indicator
 */
function showInvulnerabilityIndicator(show) {
    const indicator = document.querySelector('.invulnerable-indicator');
    if (indicator) {
        if (show) {
            indicator.classList.add('active');
        } else {
            indicator.classList.remove('active');
        }
    }
}

// === PROJECTILE SYSTEM ===

export let projectilePool;

/**
 * Initialize the projectile object pool system
 * Creates reusable projectile objects for performance optimization
 * @param {THREE.Scene} scene - The game scene to add projectiles to
 */
export function initProjectiles(scene) {
    projectilePool = new ObjectPool(() => {
        // HIGHLY VISIBLE projectile - use solid mesh instead of wireframe
        const projectileGeometry = new THREE.BoxGeometry(0.5, 0.5, 2.0);
        const projectile = new THREE.Mesh(
            projectileGeometry,
            new THREE.MeshBasicMaterial({ 
                color: VECTOR_GREEN,
                wireframe: false // Solid green projectile for visibility
            })
        );
        projectile.visible = false;
        projectile.position.set(0, 0, 0);
        scene.add(projectile);
        console.log('Created projectile:', projectile);
        return projectile;
    });
    
    // Set the projectile pool in state for access by other modules
    state.setProjectilePool(projectilePool);
    console.log('Projectile pool initialized with', projectilePool.objects.length, 'projectiles');
}

/**
 * Fire a projectile from the player tank
 * Implements authentic Battle Zone single-shot limitation
 * Only one player projectile can exist at a time
 */
export function fireProjectile() {
    console.log('FireProjectile called!');
    
    // === FIRING VALIDATION ===
    if (state.isGameOver || !projectilePool) {
        console.log('Cannot fire - gameOver:', state.isGameOver, 'projectilePool exists:', !!projectilePool);
        return;
    }

    // AUTHENTIC BATTLE ZONE: Only one projectile at a time!
    // This was a key limitation of the original arcade game
    const hasPlayerProjectile = state.projectiles.some(p => !p.userData.isEnemyProjectile);
    if (hasPlayerProjectile) {
        console.log('Cannot fire - already have projectile in flight');
        return; // Must wait for current projectile to expire
    }

    // === FIRE PROJECTILE ===
    console.log('Firing projectile!');
    playSound('shoot');

    const projectile = projectilePool.acquire();
    if (!projectile) {
        console.error('Failed to acquire projectile from pool!');
        return;
    }
    
    projectile.visible = true;

    // AUTHENTIC BATTLE ZONE: Fire from turret direction but camera position
    const cameraPos = new THREE.Vector3();
    state.camera.getWorldPosition(cameraPos);
    
    // Start projectile from camera (tank body) position
    projectile.position.copy(cameraPos);
    projectile.position.y += 0.5; // Slightly above view
    
    // Fire in turret direction (where turret is pointing)
    const direction = new THREE.Vector3(0, 0, -1);
    
    // Apply tank body rotation first
    direction.applyQuaternion(state.tankBody.quaternion);
    
    // Then apply turret rotation
    const turretRotation = new THREE.Quaternion();
    turretRotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), state.tankTurret.rotation.y);
    direction.applyQuaternion(turretRotation);
    
    // Move projectile forward so it's visible immediately
    projectile.position.add(direction.clone().multiplyScalar(4));
    
    console.log('Camera (tank) position:', cameraPos);
    console.log('Turret rotation Y:', state.tankTurret.rotation.y);
    console.log('Projectile start position:', projectile.position);
    console.log('Fire direction (turret aim):', direction);
    
    // Same velocity setup as enemies (this works!)
    projectile.userData.velocity = direction.multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED);
    projectile.userData.distanceTraveled = 0;
    projectile.userData.isEnemyProjectile = false;
    projectile.userData.trail = null;

    state.projectiles.push(projectile);
    
    console.log('Projectile fired!');
    console.log('- Position:', projectile.position);
    console.log('- Direction:', direction);
    console.log('- Visible:', projectile.visible);
    console.log('- Total projectiles:', state.projectiles.length);
    
    // Authentic Battle Zone camera shake
    shakeCamera(0.8, 300);

    // Cannon recoil animation
    state.tankCannon.rotation.x = -0.15;
    setTimeout(() => { state.tankCannon.rotation.x = 0; }, 150);
}

export function updateProjectiles(gameOver) {
    if (state.projectiles.length > 0) {
        console.log('Updating', state.projectiles.length, 'projectiles');
    }
    
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const projectile = state.projectiles[i];
        
        if (!projectile) {
            console.error('Null projectile found at index', i);
            state.projectiles.splice(i, 1);
            continue;
        }
        
        // Log projectile info for debugging
        if (i === 0) { // Only log first projectile to avoid spam
            console.log('Projectile', i, '- Position:', projectile.position, 'Visible:', projectile.visible);
        }
        
        // Move projectile forward
        projectile.position.add(projectile.userData.velocity);
        projectile.userData.distanceTraveled += projectile.userData.velocity.length();

        // Check if projectile hit ground or went too far
        if (projectile.position.y < -5 || projectile.userData.distanceTraveled > GAME_PARAMS.PROJECTILE_MAX_DISTANCE) {
            createExplosion(projectile.position, projectile.userData.isEnemyProjectile ? 0xff0000 : VECTOR_GREEN, 1.0);
            projectilePool.release(projectile);
            state.projectiles.splice(i, 1);
            console.log('Projectile removed - hit ground or max distance. Traveled:', projectile.userData.distanceTraveled);
            continue;
        }

        if (projectile.userData.isEnemyProjectile) {
            // Enemy projectile hitting player
            if (checkCollision(projectile, state.tankBody, 2.0)) {
                if (!state.playerInvulnerable) {
                    playSound('hit');
                    state.setLives(state.lives - 1);
                    showDamageFlash();
                    
                    if (state.lives <= 0) {
                        gameOver();
                    } else {
                        state.setPlayerInvulnerable(true);
                        showInvulnerabilityIndicator(true);
                        setTimeout(() => { 
                            state.setPlayerInvulnerable(false); 
                            showInvulnerabilityIndicator(false);
                        }, 1500);
                        shakeCamera(2.0, 800);
                        createExplosion(state.tankBody.position, 0xff4444, 4.0);
                    }
                }
                projectilePool.release(projectile);
                state.projectiles.splice(i, 1);
                createExplosion(projectile.position, 0xff4444, 1.5);
                continue;
            }
        } else {
            // Player projectile hitting enemies
            let hitEnemy = false;
            for (const enemyTank of state.enemyTanks) {
                if (!enemyTank.isDestroyed && checkCollision(projectile, enemyTank.body, 3.0)) {
                    console.log('Player projectile hit enemy!', enemyTank.type);
                    playSound('hit');
                    enemyTank.takeDamage();
                    projectilePool.release(projectile);
                    state.projectiles.splice(i, 1);
                    createExplosion(projectile.position, VECTOR_GREEN, 3.0);
                    shakeCamera(1.0, 400);
                    hitEnemy = true;
                    break;
                }
            }
            if (hitEnemy) continue;
        }
    }
}
