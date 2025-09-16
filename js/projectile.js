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
import { createExplosion, shakeCamera } from './effects.js';

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
        // HIGHLY VISIBLE projectile for debugging
        const projectileGeometry = new THREE.SphereGeometry(0.5, 8, 6);
        const projectile = new THREE.Mesh(
            projectileGeometry,
            new THREE.MeshBasicMaterial({ 
                color: 0xff0000, // Bright red for maximum visibility
                wireframe: false
            })
        );
        projectile.visible = false;
        projectile.position.set(0, 0, 0);
        scene.add(projectile);
        return projectile;
    }, 100); // Much larger pool size
    
    // Set the projectile pool in state for access by other modules
    state.setProjectilePool(projectilePool);
}

/**
 * Fire a projectile from the player tank
 * Implements authentic Battle Zone single-shot limitation
 * Only one player projectile can exist at a time
 */
export function fireProjectile() {
    console.log('🎯 FireProjectile called!');
    
    // === FIRING VALIDATION ===
    if (state.isGameOver) {
        console.log('❌ Cannot fire - gameOver:', state.isGameOver);
        return;
    }

    // AUTHENTIC BATTLE ZONE: Only one projectile at a time!
    const hasPlayerProjectile = state.projectiles.some(p => !p.userData.isEnemyProjectile);
    if (hasPlayerProjectile) {
        console.log('❌ Cannot fire - already have player projectile in flight');
        return;
    }

    // === FIRE PROJECTILE ===
    playSound('shoot');

    // CREATE AUTHENTIC BATTLEZONE PROJECTILE - small green wireframe
    const projectileGeometry = new THREE.SphereGeometry(0.3, 6, 4);
    const projectile = new THREE.LineSegments(
        new THREE.EdgesGeometry(projectileGeometry),
        new THREE.LineBasicMaterial({ 
            color: VECTOR_GREEN, // Authentic green
            linewidth: 2
        })
    );
    
    // Get camera position and direction
    const cameraWorldPos = new THREE.Vector3();
    state.camera.getWorldPosition(cameraWorldPos);
    
    // Position projectile directly in front of camera
    projectile.position.copy(cameraWorldPos);
    projectile.position.y += 0.5;
    
    // Calculate firing direction - completely level straight ahead
    const direction = new THREE.Vector3(0, 0, -1); // Forward direction
    direction.applyQuaternion(state.tankBody.quaternion); // Apply tank rotation only
    direction.y = 0; // Force completely level - no vertical component
    direction.normalize();
    
    // Move projectile forward so it's clearly visible
    projectile.position.add(direction.clone().multiplyScalar(10));
    
    // Set up projectile data
    projectile.userData.velocity = direction.multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED);
    projectile.userData.distanceTraveled = 0;
    projectile.userData.isEnemyProjectile = false;

    // Add to scene and array
    state.scene.add(projectile);
    state.projectiles.push(projectile);
    
    console.log('🚀 PROJECTILE CREATED AND FIRED!');
    console.log('- Position:', projectile.position);
    console.log('- Direction:', direction);
    console.log('- Velocity:', projectile.userData.velocity);
    console.log('- In scene:', projectile.parent === state.scene);
    
    // Effects
    shakeCamera(0.8, 300);
    if (state.tankCannon) {
        state.tankCannon.rotation.x = -0.15;
        setTimeout(() => { state.tankCannon.rotation.x = 0; }, 150);
    }
}

export function updateProjectiles(gameOver) {
    if (state.projectiles.length > 0) {
        console.log('🔄 Updating', state.projectiles.length, 'projectiles');
    }
    
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const projectile = state.projectiles[i];
        
        if (!projectile) {
            state.projectiles.splice(i, 1);
            continue;
        }
        
        
        // Move projectile forward
        projectile.position.add(projectile.userData.velocity);
        projectile.userData.distanceTraveled += projectile.userData.velocity.length();

        // Check if projectile hit ground or went too far
        if (projectile.position.y < -5 || projectile.userData.distanceTraveled > GAME_PARAMS.PROJECTILE_MAX_DISTANCE) {
            console.log('💥 Projectile expired - distance:', projectile.userData.distanceTraveled, 'y-pos:', projectile.position.y);
            createExplosion(projectile.position, projectile.userData.isEnemyProjectile ? 0xff0000 : VECTOR_GREEN, 1.0);
            
            // Remove from scene and dispose geometry
            if (projectile.parent) {
                projectile.parent.remove(projectile);
            }
            if (projectile.geometry) projectile.geometry.dispose();
            if (projectile.material) projectile.material.dispose();
            
            state.projectiles.splice(i, 1);
            console.log('🗑️ Projectile removed. Remaining:', state.projectiles.length);
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
                // Remove projectile from scene
                if (projectile.parent) {
                    projectile.parent.remove(projectile);
                }
                if (projectile.geometry) projectile.geometry.dispose();
                if (projectile.material) projectile.material.dispose();
                
                state.projectiles.splice(i, 1);
                createExplosion(projectile.position, 0xff4444, 1.5);
                continue;
            }
        } else {
            // Player projectile hitting enemies
            let hitEnemy = false;
            for (const enemyTank of state.enemyTanks) {
                if (!enemyTank.isDestroyed && checkCollision(projectile, enemyTank.body, 3.0)) {
                    playSound('hit');
                    enemyTank.takeDamage();
                    // Remove projectile from scene
                    if (projectile.parent) {
                        projectile.parent.remove(projectile);
                    }
                    if (projectile.geometry) projectile.geometry.dispose();
                    if (projectile.material) projectile.material.dispose();
                    
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
