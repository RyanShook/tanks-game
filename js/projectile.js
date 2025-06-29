import * as THREE from 'three';
import { GAME_PARAMS, VECTOR_GREEN } from './constants.js';
import * as state from './state.js';
import { playSound } from './sound.js';
import { ObjectPool, checkCollision } from './utils.js';
import { createExplosion, shakeCamera } from './effects.js';

export let projectilePool;

export function initProjectiles(scene) {
    projectilePool = new ObjectPool(() => {
        const projectileGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
        const projectile = new THREE.LineSegments(
            new THREE.EdgesGeometry(projectileGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_GREEN })
        );
        projectile.visible = false;
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

    const cannonWorldPos = new THREE.Vector3();
    state.tankCannon.getWorldPosition(cannonWorldPos);
    projectile.position.copy(cannonWorldPos);

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(state.tankBody.quaternion);

    projectile.userData.velocity = direction.multiplyScalar(GAME_PARAMS.PROJECTILE_SPEED);
    projectile.userData.distanceTraveled = 0;
    projectile.userData.creationTime = Date.now();
    projectile.userData.isEnemyProjectile = false;

    state.projectiles.push(projectile);

    createExplosion(cannonWorldPos, VECTOR_GREEN, 0.3);
    shakeCamera(0.3, 150); // Light shake when firing

    state.tankCannon.rotation.x = -0.1;
    setTimeout(() => { state.tankCannon.rotation.x = 0; }, 100);
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
                    state.setPlayerHealth(state.playerHealth - 20);
                    state.setPlayerHitCount(state.playerHitCount + 1);
                    
                    if (state.playerHealth <= 0 || state.playerHitCount >= GAME_PARAMS.MAX_HITS) {
                        gameOver();
                    } else {
                        state.setPlayerInvulnerable(true);
                        setTimeout(() => { state.setPlayerInvulnerable(false); }, 1000);
                    }
                }
                projectilePool.release(projectile);
                state.projectiles.splice(i, 1);
                createExplosion(projectile.position, 0xff0000);
            }
        } else {
            for (const enemyTank of state.enemyTanks) {
                if (!enemyTank.isDestroyed && checkCollision(projectile, enemyTank.body, 1.5)) {
                    playSound('hit');
                    enemyTank.takeDamage(34);
                    projectilePool.release(projectile);
                    state.projectiles.splice(i, 1);
                    createExplosion(projectile.position, VECTOR_GREEN);
                    break;
                }
            }
            
            for (const spaceship of state.enemySpaceships) {
                if (!spaceship.isDestroyed && checkCollision(projectile, spaceship.mesh, 2)) {
                    playSound('hit');
                    spaceship.takeDamage(34);
                    projectilePool.release(projectile);
                    state.projectiles.splice(i, 1);
                    createExplosion(projectile.position, VECTOR_GREEN);
                    break;
                }
            }
        }
    }
}
