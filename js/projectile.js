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
        // Simple, highly visible projectile like original Battlezone
        const projectileGeometry = new THREE.BoxGeometry(0.2, 0.2, 1.5);
        const projectile = new THREE.LineSegments(
            new THREE.EdgesGeometry(projectileGeometry),
            new THREE.LineBasicMaterial({ 
                color: VECTOR_GREEN,
                linewidth: 2
            })
        );
        projectile.visible = false;
        projectile.position.set(0, 0, 0);
        scene.add(projectile);
        return projectile;
    });
    
    // Set the projectile pool in state for access by other modules
    state.setProjectilePool(projectilePool);
}

export function fireProjectile() {
    if (state.isGameOver || !projectilePool) {
        return;
    }

    // AUTHENTIC BATTLE ZONE: Only one projectile at a time!
    // Check if we already have a player projectile in flight
    const hasPlayerProjectile = state.projectiles.some(p => !p.userData.isEnemyProjectile);
    if (hasPlayerProjectile) {
        return; // Cannot fire until current projectile is gone
    }

    playSound('shoot');

    const projectile = projectilePool.acquire();
    projectile.visible = true;

    // Get firing position from camera/turret center (first-person view)
    const cameraWorldPos = new THREE.Vector3();
    state.camera.getWorldPosition(cameraWorldPos);
    projectile.position.copy(cameraWorldPos);
    
    // Move projectile slightly forward from camera
    projectile.position.y += 0.2; // Slight elevation
    
    // Get firing direction from camera/turret rotation
    const direction = new THREE.Vector3(0, 0, -1); // Forward direction
    direction.applyQuaternion(state.camera.quaternion);
    
    // Authentic Battle Zone projectile properties
    projectile.userData.velocity = direction.multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED);
    projectile.userData.distanceTraveled = 0;
    projectile.userData.isEnemyProjectile = false;
    
    // No trail for authentic Battle Zone - projectiles were simple lines
    projectile.userData.trail = null;

    state.projectiles.push(projectile);
    
    console.log('Fired projectile from position:', projectile.position, 'direction:', direction);
    
    // Authentic Battle Zone camera shake
    shakeCamera(0.8, 300);

    // Cannon recoil animation
    state.tankCannon.rotation.x = -0.15;
    setTimeout(() => { state.tankCannon.rotation.x = 0; }, 150);
}

export function updateProjectiles(gameOver) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const projectile = state.projectiles[i];
        
        // Move projectile forward
        projectile.position.add(projectile.userData.velocity);
        projectile.userData.distanceTraveled += projectile.userData.velocity.length();

        // Check if projectile hit ground or went too far
        if (projectile.position.y < -2 || projectile.userData.distanceTraveled > GAME_PARAMS.PROJECTILE_MAX_DISTANCE) {
            createExplosion(projectile.position, projectile.userData.isEnemyProjectile ? 0xff0000 : VECTOR_GREEN, 1.0);
            projectilePool.release(projectile);
            state.projectiles.splice(i, 1);
            console.log('Projectile removed - hit ground or max distance');
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
