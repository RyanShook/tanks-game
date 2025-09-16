/**
 * BATTLE ZONE WORLD GENERATION
 * 
 * Creates the game world terrain and obstacles
 * 
 * Key Features:
 * - Authentic wireframe geometric terrain
 * - Procedural mountain ranges on horizon
 * - Pyramid and block obstacles for tactical cover
 * - Grid-based ground plane
 * - Original 1980 vector graphics aesthetic
 */

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
        { distance: GAME_PARAMS.MOUNTAIN_DISTANCE * 0.7, count: 12, size: 30 },
        { distance: GAME_PARAMS.MOUNTAIN_DISTANCE * 0.85, count: 16, size: 40 },
        { distance: GAME_PARAMS.MOUNTAIN_DISTANCE, count: 20, size: 50 }
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
    
    // Horizontal lines (along X-axis)
    for (let i = -divisions/2; i <= divisions/2; i++) {
        const z = i * step;
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-size/2, 0, z),
            new THREE.Vector3(size/2, 0, z)
        ]);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: color, linewidth: 1 }));
        group.add(line);
    }
    
    // Vertical lines (along Z-axis) for authentic Battlezone full grid
    for (let i = -divisions/2; i <= divisions/2; i++) {
        const x = i * step;
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x, 0, -size/2),
            new THREE.Vector3(x, 0, size/2)
        ]);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: color, linewidth: 1 }));
        group.add(line);
    }
    
    return group;
}

// Authentic Battlezone Pyramid Obstacle
function createBattlezonePyramid(position) {
    const size = 2 + Math.random() * 2;
    const height = size * 1.2;
    const geometry = new THREE.ConeGeometry(size, height, 4);
    geometry.rotateY(Math.PI / 4);
    const obstacle = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: VECTOR_GREEN })
    );
    obstacle.position.set(position.x, height / 2, position.z);
    obstacle.userData.isObstacle = true;
    return obstacle;
}

// Authentic Battlezone Rectangular Block Obstacle
function createBattlezoneBlock(position) {
    const width = 3 + Math.random() * 2;
    const height = 2 + Math.random() * 1;
    const depth = 3 + Math.random() * 2;
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const obstacle = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: VECTOR_GREEN })
    );
    obstacle.position.set(position.x, height / 2, position.z);
    obstacle.rotation.y = Math.random() * Math.PI * 2;
    obstacle.userData.isObstacle = true;
    return obstacle;
}

// Battlezone Volcano (distant decoration)
function createBattlezoneVolcano(position) {
    const baseSize = 40 + Math.random() * 20;
    const height = baseSize * 0.8;
    
    // Volcano base
    const baseGeometry = new THREE.ConeGeometry(baseSize, height, 8);
    const volcano = new THREE.LineSegments(
        new THREE.EdgesGeometry(baseGeometry),
        new THREE.LineBasicMaterial({ color: VECTOR_GREEN })
    );
    volcano.position.copy(position);
    volcano.position.y = height / 2;
    
    // Volcano crater
    const craterGeometry = new THREE.CylinderGeometry(baseSize * 0.3, baseSize * 0.2, height * 0.1, 8);
    const crater = new THREE.LineSegments(
        new THREE.EdgesGeometry(craterGeometry),
        new THREE.LineBasicMaterial({ color: VECTOR_GREEN })
    );
    crater.position.y = height * 0.45;
    volcano.add(crater);
    
    volcano.userData.isVolcano = true;
    return volcano;
}

export function createObstacles() {
    // Clear existing obstacles
    state.obstacles.length = 0;
    
    const numObstacles = GAME_PARAMS.NUM_OBSTACLES;
    const obstacleSpread = GAME_PARAMS.WORLD_BOUNDS * 0.6;
    
    for (let i = 0; i < numObstacles; i++) {
        const x = (Math.random() - 0.5) * obstacleSpread;
        const z = (Math.random() - 0.5) * obstacleSpread;
        
        // Keep obstacles away from spawn point
        if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;
        
        let obstacle;
        // 60% pyramids, 40% blocks (authentic Battlezone distribution)
        if (Math.random() < 0.6) {
            obstacle = createBattlezonePyramid(new THREE.Vector3(x, 0, z));
        } else {
            obstacle = createBattlezoneBlock(new THREE.Vector3(x, 0, z));
        }
        
        state.scene.add(obstacle);
        state.obstacles.push(obstacle);
    }
    
    // Add a few distant volcanoes for atmosphere
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const distance = GAME_PARAMS.MOUNTAIN_DISTANCE * 1.2;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        
        const volcano = createBattlezoneVolcano(new THREE.Vector3(x, 0, z));
        state.scene.add(volcano);
    }
}
