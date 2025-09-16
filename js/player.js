/**
 * PLAYER TANK SYSTEM
 * 
 * Handles player tank creation, movement, and controls
 * Implements authentic 1980 Battle Zone dual-joystick style movement
 * 
 * Key Features:
 * - Wireframe tank construction (body, turret, cannon)
 * - Dual-tread movement like the arcade cabinet (Q/A left, W/S right)
 * - First-person camera fixed to tank body
 * - Turret locked forward to mimic periscope targeting
 * - Collision detection and boundary enforcement
 */

import * as THREE from 'three';
import { GAME_PARAMS, VECTOR_GREEN } from './constants.js';
import * as state from './state.js';
import { checkTerrainCollision } from './enemy.js';

/**
 * Create wireframe tank body geometry
 * @param {number} width - Tank body width
 * @param {number} height - Tank body height  
 * @param {number} depth - Tank body depth
 * @returns {THREE.LineSegments} Wireframe tank body
 */
function createTankBody(width, height, depth) {
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

/**
 * Create wireframe turret geometry
 * @param {number} radius - Turret radius
 * @param {number} height - Turret height
 * @returns {THREE.LineSegments} Wireframe turret
 */
function createTurret(radius, height) {
    const points = [];
    const segments = 6; // Hexagonal turret for authentic Battle Zone look
    
    for (let i = 0; i < segments; i++) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i+1) / segments) * Math.PI * 2;
        
        // Bottom ring
        points.push(
            new THREE.Vector3(Math.cos(angle1)*radius, 0, Math.sin(angle1)*radius),
            new THREE.Vector3(Math.cos(angle2)*radius, 0, Math.sin(angle2)*radius)
        );
        
        // Top ring
        points.push(
            new THREE.Vector3(Math.cos(angle1)*radius, height, Math.sin(angle1)*radius),
            new THREE.Vector3(Math.cos(angle2)*radius, height, Math.sin(angle2)*radius)
        );
        
        // Vertical lines connecting rings
        points.push(
            new THREE.Vector3(Math.cos(angle1)*radius, 0, Math.sin(angle1)*radius),
            new THREE.Vector3(Math.cos(angle1)*radius, height, Math.sin(angle1)*radius)
        );
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: VECTOR_GREEN }));
}

/**
 * Create wireframe cannon geometry
 * @param {number} radius - Cannon radius
 * @param {number} length - Cannon length
 * @returns {THREE.LineSegments} Wireframe cannon
 */
function createCannon(radius, length) {
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

/**
 * Create the complete player tank system
 * Assembles body, turret, cannon and sets up first-person camera
 */
let leftTrackVelocity = 0;
let rightTrackVelocity = 0;

export function createPlayer() {
    leftTrackVelocity = 0;
    rightTrackVelocity = 0;
    // === TANK GEOMETRY CREATION ===
    const bodyWidth = 2, bodyHeight = 1, bodyDepth = 3;
    const tankBody = createTankBody(bodyWidth, bodyHeight, bodyDepth);
    tankBody.position.y = 0.5; // Lift off ground slightly
    state.scene.add(tankBody);
    state.setTankBody(tankBody);

    // Turret sits on top of tank body
    const tankTurret = createTurret(0.6, 0.8);
    tankTurret.position.y = bodyHeight;
    tankBody.add(tankTurret); // Child of body for movement
    state.setTankTurret(tankTurret);

    // Cannon attached to turret for independent rotation
    const tankCannon = createCannon(0.15, 2);
    tankCannon.position.y = 0.1;
    tankTurret.add(tankCannon); // Child of turret for aiming
    state.setTankCannon(tankCannon);

    // === AUTHENTIC BATTLE ZONE CAMERA SETUP ===
    // Camera fixed to tank body (not turret) for authentic fixed forward view
    // Turret can rotate independently while camera stays forward-facing
    tankBody.add(state.camera);
    state.camera.position.set(0, 2.0, -1.0); // Above tank body, first-person perspective
    state.camera.lookAt(0, 2.0, -10); // Always looking forward

    // === FIRST-PERSON VIEW ===
    // Hide player tank components - you can't see yourself in first-person
    tankBody.visible = false;
    tankTurret.visible = false;
    tankCannon.visible = false;
}

function updateTrackVelocity(current, input) {
    const target = input * GAME_PARAMS.TRACK_MAX_SPEED;
    if (input !== 0) {
        if (current < target) {
            current = Math.min(current + GAME_PARAMS.TRACK_ACCELERATION, target);
        } else if (current > target) {
            current = Math.max(current - GAME_PARAMS.TRACK_ACCELERATION, target);
        }
    } else {
        if (current > 0) {
            current = Math.max(0, current - GAME_PARAMS.TRACK_DECELERATION);
        } else if (current < 0) {
            current = Math.min(0, current + GAME_PARAMS.TRACK_DECELERATION);
        }
    }
    return current;
}

export function resetTracks() {
    leftTrackVelocity = 0;
    rightTrackVelocity = 0;
}

/**
 * Handle player tank movement and controls
 * Implements authentic Battle Zone dual-joystick style controls
 * Q/A control the left tread, W/S control the right tread
 * Arrow keys also map to the right tread for accessibility
 */
export function handleMovement() {
    if (state.isGameOver) return;

    // Store position for collision reversion
    const previousPosition = state.tankBody.position.clone();

    const leftInput = (state.keyboardState['KeyQ'] ? 1 : 0) - (state.keyboardState['KeyA'] ? 1 : 0);
    const rightInput = ((state.keyboardState['KeyW'] ? 1 : 0) + (state.keyboardState['ArrowUp'] ? 1 : 0))
        - ((state.keyboardState['KeyS'] ? 1 : 0) + (state.keyboardState['ArrowDown'] ? 1 : 0));

    leftTrackVelocity = updateTrackVelocity(leftTrackVelocity, leftInput);
    rightTrackVelocity = updateTrackVelocity(rightTrackVelocity, rightInput);

    const forwardSpeed = (leftTrackVelocity + rightTrackVelocity) * 0.5;
    const turnSpeed = (rightTrackVelocity - leftTrackVelocity) * GAME_PARAMS.TRACK_TURN_FACTOR;

    if (turnSpeed !== 0) {
        state.tankBody.rotation.y -= turnSpeed;
    }

    if (forwardSpeed !== 0) {
        state.tankBody.translateZ(-forwardSpeed);
    }

    // Turret stays locked forward like the original periscope view
    if (state.tankTurret) {
        state.tankTurret.rotation.y *= 0.6;
    }

    // === COLLISION DETECTION ===
    // Check for obstacles and revert movement if collision detected
    if (checkTerrainCollision(state.tankBody.position, 2)) {
        state.tankBody.position.copy(previousPosition);
    }

    // === WORLD BOUNDARIES ===
    // Keep player within authentic Battle Zone battlefield bounds
    const maxDistance = GAME_PARAMS.WORLD_BOUNDS * 0.7;
    state.tankBody.position.x = THREE.MathUtils.clamp(state.tankBody.position.x, -maxDistance, maxDistance);
    state.tankBody.position.z = THREE.MathUtils.clamp(state.tankBody.position.z, -maxDistance, maxDistance);
    
    // Hard boundary enforcement - stop at edges
    if (Math.abs(state.tankBody.position.x) >= maxDistance || Math.abs(state.tankBody.position.z) >= maxDistance) {
        state.tankBody.position.copy(previousPosition);
    }
}
