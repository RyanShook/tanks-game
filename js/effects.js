import * as THREE from 'three';
import { playSound } from './sound.js';
import { ObjectPool } from './utils.js';

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
}

export function createExplosion(position, color, size = 1) {
    if (!explosionPool) return;
    playSound('explosion');
    
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

export function createEnhancedExplosion(position, color, size = 1) {
    if (!explosionPool) return;
    playSound('explosion');
    
    const explosion = explosionPool.acquire();
    explosion.visible = true;
    explosion.position.copy(position);
    
    explosion.children.forEach(p => p.material.color.set(color));

    const startTime = Date.now();
    const duration = 400;
    
    function animateExplosion() {
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
        
        requestAnimationFrame(animateExplosion);
    }
    
    animateExplosion();
}
