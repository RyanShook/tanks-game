import * as THREE from 'three';
import { GAME_PARAMS, VECTOR_GREEN } from './constants.js';
import * as state from './state.js';
import { playSound } from './sound.js';
import { ObjectPool, checkCollision } from './utils.js';
import { createExplosion, shakeCamera, createProjectileTrail, updateProjectileTrail, releaseProjectileTrail } from './effects.js';

// Damage feedback functions
function showDamageFlash() {
    const damageFlash = document.querySelector('.damage-flash');
    if (damageFlash) {
        damageFlash.classList.add('active');
        setTimeout(() => {
            damageFlash.classList.remove('active');
        }, 200);
    }
}

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

export let projectilePool;

export function initProjectiles(scene) {
    projectilePool = new ObjectPool(() => {
        // Bold, visible projectiles like original Battlezone
        const projectileGeometry = new THREE.CylinderGeometry(0.3, 0.3, 2.0, 6);
        const projectile = new THREE.LineSegments(
            new THREE.EdgesGeometry(projectileGeometry),
            new THREE.LineBasicMaterial({ 
                color: VECTOR_GREEN,
                linewidth: 3,
                transparent: false,
                opacity: 1.0
            })
        );
        projectile.visible = false;
        projectile.rotation.x = Math.PI / 2; // Orient vertically for better visibility
        scene.add(projectile);
        return projectile;
    });
    
    // Set the projectile pool in state for access by other modules
    state.setProjectilePool(projectilePool);
}

export function fireProjectile() {
    if (state.isGameOver || !projectilePool) return;

    playSound('shoot');

    // Fire multiple projectiles if dual cannon is unlocked
    const numProjectiles = state.weaponUpgrades.dualCannon ? 2 : 1;
    
    for (let i = 0; i < numProjectiles; i++) {
        const projectile = projectilePool.acquire();
        projectile.visible = true;

        // Get cannon world position and direction
        const cannonWorldPos = new THREE.Vector3();
        state.tankCannon.getWorldPosition(cannonWorldPos);
        
        // Offset for dual cannons
        if (numProjectiles > 1) {
            const offset = (i === 0) ? -0.5 : 0.5;
            cannonWorldPos.x += offset;
        }
        
        projectile.position.copy(cannonWorldPos);

        // Use turret rotation for firing direction (more accurate)
        const direction = new THREE.Vector3(0, 0, 1);
        direction.applyQuaternion(state.tankTurret.quaternion);
        direction.applyQuaternion(state.tankBody.quaternion);

        // Power shot increases speed and damage
        const speed = state.weaponUpgrades.powerShot ? GAME_PARAMS.PROJECTILE_SPEED * 1.5 : GAME_PARAMS.PROJECTILE_SPEED;
        projectile.userData.velocity = direction.multiplyScalar(speed);
        
        // Add slight upward trajectory for authentic Battlezone arc
        projectile.userData.velocity.y = 0.3;
        projectile.userData.distanceTraveled = 0;
        projectile.userData.creationTime = Date.now();
        projectile.userData.isEnemyProjectile = false;
        projectile.userData.isPowerShot = state.weaponUpgrades.powerShot;
        
        // Create trail for this projectile
        projectile.userData.trail = createProjectileTrail(projectile);

        state.projectiles.push(projectile);

        // Dramatic muzzle flash like original Battlezone
        const flashSize = state.weaponUpgrades.powerShot ? 2.0 : 1.5;
        createExplosion(cannonWorldPos, VECTOR_GREEN, flashSize);
    }
    
    const shakeIntensity = state.weaponUpgrades.powerShot ? 1.2 : 0.8;
    shakeCamera(shakeIntensity, 300);

    // Cannon recoil animation
    state.tankCannon.rotation.x = -0.15;
    setTimeout(() => { state.tankCannon.rotation.x = 0; }, 150);
}

export function updateProjectiles(gameOver) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const projectile = state.projectiles[i];
        
        // Add gravity for authentic Battlezone projectile arc
        if (!projectile.userData.isEnemyProjectile) {
            projectile.userData.velocity.y -= GAME_PARAMS.PROJECTILE_GRAVITY;
        }
        
        projectile.position.add(projectile.userData.velocity);
        projectile.userData.distanceTraveled += projectile.userData.velocity.length();
        
        // Update projectile trail
        if (projectile.userData.trail) {
            updateProjectileTrail(projectile.userData.trail, projectile);
        }

        if (projectile.position.y < 0) {
            createExplosion(projectile.position, projectile.userData.isEnemyProjectile ? 0xff0000 : VECTOR_GREEN, 0.5);
            // Clean up trail before releasing projectile
            if (projectile.userData.trail) {
                releaseProjectileTrail(projectile.userData.trail);
            }
            projectilePool.release(projectile);
            state.projectiles.splice(i, 1);
            continue;
        }

        if (projectile.userData.distanceTraveled > GAME_PARAMS.PROJECTILE_MAX_DISTANCE) {
            // Clean up trail before releasing projectile
            if (projectile.userData.trail) {
                releaseProjectileTrail(projectile.userData.trail);
            }
            projectilePool.release(projectile);
            state.projectiles.splice(i, 1);
            continue;
        }

        if (projectile.userData.isEnemyProjectile) {
            if (checkCollision(projectile, state.tankBody, 1.5)) {
                if (!state.playerInvulnerable) {
                    playSound('hit');
                    state.setLives(state.lives - 1);
                    
                    // Show damage flash effect
                    showDamageFlash();
                    
                    // Authentic Battlezone: One hit = one life lost
                    if (state.lives <= 0) {
                        gameOver();
                    } else {
                        // Brief invulnerability after hit
                        state.setPlayerInvulnerable(true);
                        showInvulnerabilityIndicator(true);
                        setTimeout(() => { 
                            state.setPlayerInvulnerable(false); 
                            showInvulnerabilityIndicator(false);
                        }, 1500);
                        
                        // Dramatic hit feedback like original Battlezone
                        shakeCamera(2.0, 800);
                        createExplosion(state.tankBody.position, 0xff4444, 4.0);
                    }
                }
                // Clean up trail before releasing projectile
                if (projectile.userData.trail) {
                    releaseProjectileTrail(projectile.userData.trail);
                }
                projectilePool.release(projectile);
                state.projectiles.splice(i, 1);
                createExplosion(projectile.position, 0xff4444, 1.5);
            }
        } else {
            // Check collision with enemy tanks
            for (const enemyTank of state.enemyTanks) {
                if (!enemyTank.isDestroyed && checkCollision(projectile, enemyTank.body, 1.5)) {
                    playSound('hit');
                    enemyTank.takeDamage(); // Let each enemy handle its own damage system
                    // Clean up trail before releasing projectile
                    if (projectile.userData.trail) {
                        releaseProjectileTrail(projectile.userData.trail);
                    }
                    projectilePool.release(projectile);
                    state.projectiles.splice(i, 1);
                    createExplosion(projectile.position, VECTOR_GREEN, 3.0);
                    shakeCamera(1.0, 400); // Satisfying hit feedback
                    break;
                }
            }
        }
    }
}
