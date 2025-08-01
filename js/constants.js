// Authentic 1980 Battlezone Colors
export const VECTOR_GREEN = 0x00ff00;
export const VECTOR_RED = 0xff0000;
export const VECTOR_YELLOW = 0xffff00;

// Authentic Battlezone Game Parameters
export const GAME_PARAMS = {
    // Player Tank Settings - Authentic 1980 Battle Zone deliberate controls
    MOVE_SPEED: 0.08,
    ROTATION_SPEED: 0.025,
    TURRET_ROTATION_SPEED: 0.03,
    
    // Lives System (Authentic Battlezone)
    STARTING_LIVES: 3,
    BONUS_LIFE_SCORE: 15000,
    
    // Projectile Settings - Authentic Battlezone physics
    PROJECTILE_SPEED: 1.2,
    PROJECTILE_MAX_DISTANCE: 200,
    PROJECTILE_GRAVITY: 0.001,
    FIRE_COOLDOWN: 400,
    
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