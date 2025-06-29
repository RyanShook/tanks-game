import * as THREE from 'three';
import { playSound } from './sound.js';
import { ObjectPool } from './utils.js';
import * as state from './state.js';

let explosionPool;

export function initEffects(scene) {
    explosionPool = new ObjectPool(() => {
        const particles = new THREE.Group();
        for (let i = 0; i < 8; i++) {
            const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
            const particle = new THREE.LineSegments(
                new THREE.EdgesGeometry(geometry),
                new THREE.LineBasicMaterial({ color: 0x00ff00 })
            );
            particles.add(particle);
        }
        particles.visible = false;
        scene.add(particles);
        return particles;
    });
    
    // Set the explosion pool in state for access by other modules
    state.setExplosionPool(explosionPool);
}

export function createExplosion(position, color, size = 1) {
    if (!explosionPool) return;
    playSound('explosion');
    
    // Add camera shake based on explosion size
    shakeCamera(size * 0.6, 200 + size * 100);
    
    const explosion = explosionPool.acquire();
    explosion.visible = true;
    explosion.position.copy(position);
    
    explosion.children.forEach(p => p.material.color.set(color));

    const startTime = Date.now();
    const duration = 300;
    
    function animateExplosion() {
        const elapsed = Date.now() - startTime;
        if (elapsed > duration) {
            explosionPool.release(explosion);
            return;
        }
        
        const progress = elapsed / duration;
        explosion.children.forEach((particle) => {
            const scale = 1 + progress * 2 * size;
            particle.scale.setScalar(scale);
            particle.rotation.z = progress * Math.PI * 2;
        });
        
        requestAnimationFrame(animateExplosion);
    }
    
    animateExplosion();
}

// Camera shake system
let cameraShake = {
    intensity: 0,
    duration: 0,
    elapsed: 0,
    originalPosition: new THREE.Vector3()
};

export function shakeCamera(intensity = 0.5, duration = 300) {
    if (cameraShake.intensity < intensity) {
        cameraShake.intensity = intensity;
        cameraShake.duration = duration;
        cameraShake.elapsed = 0;
        
        // Store the camera's original position relative to its parent
        if (state.camera.parent) {
            cameraShake.originalPosition.copy(state.camera.position);
        }
    }
}

export function updateCameraShake() {
    if (cameraShake.intensity <= 0) return;
    
    cameraShake.elapsed += 16; // Assume ~60fps
    const progress = cameraShake.elapsed / cameraShake.duration;
    
    if (progress >= 1) {
        // Shake finished, reset camera position
        cameraShake.intensity = 0;
        if (state.camera.parent) {
            state.camera.position.copy(cameraShake.originalPosition);
        }
        return;
    }
    
    // Apply shake with decreasing intensity
    const currentIntensity = cameraShake.intensity * (1 - progress);
    const shakeX = (Math.random() - 0.5) * currentIntensity;
    const shakeY = (Math.random() - 0.5) * currentIntensity;
    const shakeZ = (Math.random() - 0.5) * currentIntensity;
    
    if (state.camera.parent) {
        state.camera.position.copy(cameraShake.originalPosition);
        state.camera.position.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
    }
}

export function createEnhancedExplosion(position, color, size = 1) {
    if (!explosionPool) return;
    playSound('explosion');
    
    // Add stronger camera shake for enhanced explosions
    shakeCamera(size * 0.8, 300 + size * 150);
    
    const explosion = explosionPool.acquire();
    explosion.visible = true;
    explosion.position.copy(position);
    
    explosion.children.forEach(p => p.material.color.set(color));

    const startTime = Date.now();
    const duration = 400;
    
    function animateEnhancedExplosion() {
        const elapsed = Date.now() - startTime;
        if (elapsed > duration) {
            explosionPool.release(explosion);
            return;
        }
        
        const progress = elapsed / duration;
        const scale = 1 + progress * 3;
        const rotation = progress * Math.PI * 4;
        
        explosion.children.forEach((particle, i) => {
            particle.scale.setScalar(scale * size);
            particle.rotation.z = rotation + (i * 0.5);
            particle.material.opacity = 1 - progress;
        });
        
        explosion.rotation.y = rotation * 0.5;
        
        requestAnimationFrame(animateEnhancedExplosion);
    }
    
    animateEnhancedExplosion();
}
