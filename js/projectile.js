import * as THREE from 'three';
import { GAME_PARAMS, VECTOR_GREEN } from './constants.js';
import * as state from './state.js';
import { playSound } from './sound.js';
import { ObjectPool, checkCollision } from './utils.js';

export let projectilePool, explosionPool;

export function initProjectiles() {
    projectilePool = new ObjectPool(() => {
        const projectileGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
        const projectile = new THREE.LineSegments(
            new THREE.EdgesGeometry(projectileGeometry),
            new THREE.LineBasicMaterial({ color: VECTOR_GREEN })
        );
        projectile.visible = false;
        state.scene.add(projectile);
        return projectile;
    });

    explosionPool = new ObjectPool(() => {
        const particles = new THREE.Group();
        for (let i = 0; i < 8; i++) {
            const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const particle = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                new THREE.LineBasicMaterial({ color: VECTOR_GREEN })
            );
            particles.add(particle);
        }
        particles.visible = false;
        state.scene.add(particles);
        return particles;
    });
}

export function fireProjectile() {
    if (state.isGameOver) return;

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

    const muzzleFlash = explosionPool.acquire();
    muzzleFlash.visible = true;
    muzzleFlash.position.copy(cannonWorldPos);
    muzzleFlash.scale.set(0.3, 0.3, 0.3);

    state.tankCannon.rotation.x = -0.1;
    setTimeout(() => { state.tankCannon.rotation.x = 0; }, 100);

    setTimeout(() => { explosionPool.release(muzzleFlash); }, 100);
}

export function updateProjectiles() {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const projectile = state.projectiles[i];
        
        projectile.userData.velocity.y -= GAME_PARAMS.PROJECTILE_GRAVITY;
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
                        // gameOver();
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

export function createExplosion(position, color, size = 1) {
    playSound('explosion');
    
    const explosion = explosionPool.acquire();
    explosion.visible = true;
    explosion.position.copy(position);
    
    const lines = [];
    const numLines = 8;
    
    for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2;
        const line = new THREE.Vector3(Math.cos(angle) * size, Math.sin(angle) * size, 0);
        lines.push(line);
    }
    
    explosion.children.forEach((particle, i) => {
        const lineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), lines[i % lines.length]]);
        particle.geometry = lineGeom;
    });
    
    const startTime = Date.now();
    const duration = 300;
    
    function animateExplosion() {
        const elapsed = Date.now() - startTime;
        if (elapsed > duration) {
            explosionPool.release(explosion);
            return;
        }
        
        const progress = elapsed / duration;
        explosion.children.forEach((particle, i) => {
            particle.scale.setScalar(1 + progress * 2);
            particle.rotation.z = progress * Math.PI * 2;
        });
        
        requestAnimationFrame(animateExplosion);
    }
    
    animateExplosion();
}
