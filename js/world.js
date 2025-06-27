import * as THREE from 'three';
import { GAME_PARAMS, VECTOR_GREEN } from './constants.js';
import * as state from './state.js';

function createWireframePyramid(size, height, position) {
    const geometry = new THREE.CylinderGeometry(0, size, height, 4, 1);
    geometry.rotateY(Math.PI / 4);
    const edges = new THREE.EdgesGeometry(geometry);
    const pyramid = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: VECTOR_GREEN }));
    pyramid.position.copy(position);
    pyramid.position.y = height / 2 - 0.5;
    return pyramid;
}

function createBattlezoneMountain(size, position) {
    return createWireframePyramid(size, size * 1.2, position);
}

export function createMountainRange() {
    state.scene.children.forEach(child => {
        if (child.userData.isMountain) {
            state.scene.remove(child);
        }
    });
    
    const mountainRings = [
        { distance: GAME_PARAMS.MOUNTAIN_DISTANCE * 0.6, count: 8, size: 15 },
        { distance: GAME_PARAMS.MOUNTAIN_DISTANCE * 0.8, count: 12, size: 20 },
        { distance: GAME_PARAMS.MOUNTAIN_DISTANCE, count: 16, size: 25 }
    ];
    
    mountainRings.forEach(ring => {
        const angleOffset = Math.random() * Math.PI;
        for (let i = 0; i < ring.count; i++) {
            const angle = angleOffset + (i / ring.count) * Math.PI * 2;
            const x = Math.cos(angle) * ring.distance;
            const z = Math.sin(angle) * ring.distance;
            
            const mountain = createBattlezoneMountain(
                ring.size + (Math.random() - 0.5) * 2,
                new THREE.Vector3(x, 0, z)
            );
            
            mountain.userData.isMountain = true;
            state.scene.add(mountain);
        }
    });
}

export function createHorizontalGrid(size, divisions, color) {
    const group = new THREE.Group();
    const step = size / divisions;
    for (let i = -divisions/2; i <= divisions/2; i++) {
        const z = i * step;
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-size/2, 0, z),
            new THREE.Vector3(size/2, 0, z)
        ]);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: color, linewidth: 1 }));
        group.add(line);
    }
    return group;
}

function createMapObstacle(position) {
    const size = 1 + Math.random() * 1.5;
    const geometry = new THREE.TetrahedronGeometry(size);
    const obstacle = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: 0x00ff00 })
    );
    obstacle.position.set(position.x, size * 0.5 - 0.5, position.z);
    obstacle.rotation.y = Math.random() * Math.PI * 2;
    return obstacle;
}

export function createObstacles() {
    const numObstacles = GAME_PARAMS.NUM_OBSTACLES;
    const obstacleSpread = GAME_PARAMS.GRID_SIZE * 0.4;
    for (let i = 0; i < numObstacles; i++) {
        const x = (Math.random() - 0.5) * obstacleSpread;
        const z = (Math.random() - 0.5) * obstacleSpread;
        if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
        const obstacle = createMapObstacle(new THREE.Vector3(x, 0, z));
        state.scene.add(obstacle);
        state.obstacles.push(obstacle);
    }
}
