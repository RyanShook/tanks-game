import * as THREE from 'three';
import { GAME_PARAMS, VECTOR_GREEN } from './constants.js';
import * as state from './state.js';
import { playSound } from './sound.js';
import { ObjectPool, checkCollision } from './utils.js';
import { createExplosion, shakeCamera } from './effects.js';

export let projectilePool;

export function initProjectiles(scene) {
    projectilePool = new ObjectPool(() => {
        // Make projectiles larger and more visible - authentic Battle Zone style
        const projectileGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1.0, 6);
        const projectile = new THREE.LineSegments(
            new THREE.EdgesGeometry(projectileGeometry),
            new THREE.LineBasicMaterial({ 
                color: VECTOR_GREEN,
                linewidth: 2,
                transparent: true,
                opacity: 0.9
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

    const projectile = projectilePool.acquire();
    projectile.visible = true;

    // Get cannon world position and direction
    const cannonWorldPos = new THREE.Vector3();
    state.tankCannon.getWorldPosition(cannonWorldPos);
    projectile.position.copy(cannonWorldPos);

    // Use turret rotation for firing direction (more accurate)
    const direction = new THREE.Vector3(0, 0, 1);
    direction.applyQuaternion(state.tankTurret.quaternion);
    direction.applyQuaternion(state.tankBody.quaternion);

    projectile.userData.velocity = direction.multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED);
    projectile.userData.distanceTraveled = 0;
    projectile.userData.creationTime = Date.now();
    projectile.userData.isEnemyProjectile = false;

    state.projectiles.push(projectile);

    // Larger muzzle flash for better feedback
    createExplosion(cannonWorldPos, VECTOR_GREEN, 0.5);
    shakeCamera(0.4, 200); // More noticeable shake when firing

    // Cannon recoil animation
    state.tankCannon.rotation.x = -0.15;
    setTimeout(() => { state.tankCannon.rotation.x = 0; }, 150);
}

export function updateProjectiles(gameOver) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const projectile = state.projectiles[i];
        
        projectile.position.add(projectile.userData.velocity);
        projectile.userData.distanceTraveled += projectile.userData.velocity.length();

        if (projectile.position.y < 0) {
            createExplosion(projectile.position, projectile.userData.isEnemyProjectile ? 0xff0000 : VECTOR_GREEN, 0.5);
            projectilePool.release(projectile);
            state.projectiles.splice(i, 1);
            continue;
        }

        if (projectile.userData.distanceTraveled > GAME_PARAMS.PROJECTILE_MAX_DISTANCE) {
            projectilePool.release(projectile);
            state.projectiles.splice(i, 1);
            continue;
        }

        if (projectile.userData.isEnemyProjectile) {
            if (checkCollision(projectile, state.tankBody, 1.5)) {
                if (!state.playerInvulnerable) {
                    playSound('hit');
                    state.lives--;
                    
                    // Authentic Battlezone: One hit = one life lost
                    if (state.lives <= 0) {
                        gameOver();
                    } else {
                        // Brief invulnerability after hit
                        state.setPlayerInvulnerable(true);
                        setTimeout(() => { state.setPlayerInvulnerable(false); }, 1500);
                        
                        // Strong visual feedback for hit
                        shakeCamera(1.2, 500);
                        createExplosion(state.tankBody.position, 0xff4444, 2.0);
                    }
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
                    enemyTank.takeDamage(1); // One hit destroys tank in authentic Battle Zone
                    projectilePool.release(projectile);
                    state.projectiles.splice(i, 1);
                    createExplosion(projectile.position, VECTOR_GREEN, 1.2);
                    shakeCamera(0.5, 250); // Satisfying hit feedback
                    break;
                }
            }
        }
    }
}
