import * as THREE from 'three';
import { GAME_PARAMS, VECTOR_GREEN } from './constants.js';
import * as state from './state.js';
import { checkCollision } from './utils.js';
import { fireProjectile } from './projectile.js';
import { checkTerrainCollision } from './enemy.js';

export function createTankBody(width, height, depth) {
    const shape = [
        [-width/2, 0, -depth/2], [width/2, 0, -depth/2], [width/2, 0, depth/2], [-width/2, 0, depth/2],
        [-width/3, height, -depth/3], [width/3, height, -depth/3], [width/3, height, depth/3], [-width/3, height, depth/3],
    ];
    const indices = [
        [0,1],[1,2],[2,3],[3,0],
        [4,5],[5,6],[6,7],[7,4],
        [0,4],[1,5],[2,6],[3,7],
        [0,1],[1,5],[5,4],[4,0],
        [3,2],[2,6],[6,7],[7,3],
    ];
    const points = [];
    indices.forEach(([a,b]) => {
        points.push(new THREE.Vector3(...shape[a]), new THREE.Vector3(...shape[b]));
    });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: VECTOR_GREEN }));
}

export function createTurret(radius, height) {
    const points = [];
    const segments = 6;
    for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i+1) / segments) * Math.PI * 2;
        points.push(
            new THREE.Vector3(Math.cos(angle1)*radius, 0, Math.sin(angle1)*radius),
            new THREE.Vector3(Math.cos(angle2)*radius, 0, Math.sin(angle2)*radius)
        );
        points.push(
            new THREE.Vector3(Math.cos(angle1)*radius, height, Math.sin(angle1)*radius),
            new THREE.Vector3(Math.cos(angle2)*radius, height, Math.sin(angle2)*radius)
        );
        points.push(
            new THREE.Vector3(Math.cos(angle1)*radius, 0, Math.sin(angle1)*radius),
            new THREE.Vector3(Math.cos(angle1)*radius, height, Math.sin(angle1)*radius)
        );
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: VECTOR_GREEN }));
}

export function createCannon(radius, length) {
    const w = radius, l = length, h = radius * 0.6;
    const shape = [
        [0, -h, -w], [l, -h, -w], [l, h, -w], [0, h, -w],
        [0, -h, w],  [l, -h, w],  [l, h, w],  [0, h, w],
    ];
    const indices = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
    const points = [];
    indices.forEach(([a,b]) => {
        points.push(new THREE.Vector3(...shape[a]), new THREE.Vector3(...shape[b]));
    });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const cannon = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: VECTOR_GREEN }));
    cannon.rotation.z = Math.PI / 2;
    return cannon;
}

export function createPlayer() {
    const bodyWidth = 2, bodyHeight = 1, bodyDepth = 3;
    const tankBody = createTankBody(bodyWidth, bodyHeight, bodyDepth);
    tankBody.position.y = 0.5;
    state.scene.add(tankBody);
    state.setTankBody(tankBody);

    const tankTurret = createTurret(0.6, 0.8);
    tankTurret.position.y = bodyHeight;
    tankBody.add(tankTurret);
    state.setTankTurret(tankTurret);

    const tankCannon = createCannon(0.15, 2);
    tankCannon.position.y = 0.1;
    tankTurret.add(tankCannon);
    state.setTankCannon(tankCannon);

    // Attach camera to turret for first-person view
    tankTurret.add(state.camera);
    state.camera.position.set(0, 0.3, -0.5); // Inside turret, first-person view
    state.camera.lookAt(0, 0, -10); // Look forward

    // Hide player tank - you can't see yourself in first-person
    tankBody.visible = false;
    tankTurret.visible = false;
    tankCannon.visible = false;
}

export function handleMovement() {
    if (state.isGameOver) return;

    const previousPosition = state.tankBody.position.clone();

    // Tank body movement - improved responsiveness
    if (state.keyboardState['KeyW']) {
        state.tankBody.translateZ(-GAME_PARAMS.MOVE_SPEED);
    }
    if (state.keyboardState['KeyS']) {
        state.tankBody.translateZ(GAME_PARAMS.MOVE_SPEED * 0.7); // Slower reverse like real tanks
    }
    if (state.keyboardState['KeyA']) {
        state.tankBody.rotation.y += GAME_PARAMS.ROTATION_SPEED;
    }
    if (state.keyboardState['KeyD']) {
        state.tankBody.rotation.y -= GAME_PARAMS.ROTATION_SPEED;
    }

    // Turret rotation with arrow keys for better control
    if (state.keyboardState['ArrowLeft']) {
        state.tankTurret.rotation.y += GAME_PARAMS.TURRET_ROTATION_SPEED;
    }
    if (state.keyboardState['ArrowRight']) {
        state.tankTurret.rotation.y -= GAME_PARAMS.TURRET_ROTATION_SPEED;
    }

    // Check terrain collision and revert if needed
    if (checkTerrainCollision(state.tankBody.position, 2)) {
        state.tankBody.position.copy(previousPosition);
    }

    // Keep player within authentic Battle Zone bounds
    const maxDistance = GAME_PARAMS.WORLD_BOUNDS * 0.8;
    state.tankBody.position.x = THREE.MathUtils.clamp(state.tankBody.position.x, -maxDistance, maxDistance);
    state.tankBody.position.z = THREE.MathUtils.clamp(state.tankBody.position.z, -maxDistance, maxDistance);
}

