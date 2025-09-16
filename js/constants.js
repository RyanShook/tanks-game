/**
 * AUTHENTIC BATTLE ZONE CONSTANTS
 * 
 * Game configuration and parameters for the 1980 arcade recreation
 * 
 * Key Features:
 * - Authentic movement speeds and physics parameters
 * - Original arcade color scheme (green vector graphics)
 * - Scoring system and enemy values
 * - Weapon and projectile configurations
 * - World boundaries and environmental settings
 */

// Authentic 1980 Battlezone Colors
export const VECTOR_GREEN = 0x00ff00;
export const VECTOR_RED = 0xff0000;
export const VECTOR_YELLOW = 0xffff00;

// Authentic Battlezone Game Parameters
export const GAME_PARAMS = {
    // Player Tank Settings - dual track controls like the arcade cabinet
    TRACK_MAX_SPEED: 0.35,
    TRACK_ACCELERATION: 0.012,
    TRACK_DECELERATION: 0.02,
    TRACK_TURN_FACTOR: 0.015,

    // Lives System (Authentic Battlezone)
    STARTING_LIVES: 3,
    BONUS_LIFE_SCORE: 15000,
    
    // Projectile Settings - Authentic Battlezone physics
    PROJECTILE_SPEED: 2.0,
    PROJECTILE_MAX_DISTANCE: 300,
    PROJECTILE_GRAVITY: 0.0,
    FIRE_COOLDOWN: 100,
    
    // Enemy Settings - Authentic 1980 Battle Zone speeds
    TANK_SPEED: 0.04,
    
    TANK_SHOT_INTERVAL: 3000,
    
    // World Settings - Authentic Battle Zone contained battlefield
    WORLD_BOUNDS: 400,
    GRID_SIZE: 600,
    GRID_DIVISIONS: 60,
    MOUNTAIN_DISTANCE: 350,
    NUM_MOUNTAINS: 32,
    NUM_OBSTACLES: 20,
    
    // Authentic Battlezone Scoring
    TANK_SCORE: 1000,
    MISSILE_SCORE: 2000,
    SUPERTANK_SCORE: 3000,
    UFO_SCORE: 5000,
    
    // Enemy Spawn Rates (wave-dependent)
    TANK_SPAWN_CHANCE: 1.0,
    MISSILE_SPAWN_CHANCE: 0.3,
    SUPERTANK_SPAWN_CHANCE: 0.1,
    UFO_SPAWN_CHANCE: 0.05,
};
