export const VECTOR_GREEN = 0x00ff00;

export const GAME_PARAMS = {
    // Player settings
    MOVE_SPEED: 0.1,
    ROTATION_SPEED: 0.03,
    MAX_HEALTH: 100,
    MAX_HITS: 3,
    
    // Projectile settings
    PROJECTILE_SPEED: 4.0,
    PROJECTILE_MAX_DISTANCE: 150,
    
    // Enemy settings
    ENEMY_SPEED: 0.05,
    ENEMY_TURN_SPEED: 0.02,
    ENEMY_SHOT_INTERVAL: 3000,
    ENEMY_IDEAL_DISTANCE: 20,
    
    // World settings
    GRID_SIZE: 200,
    GRID_DIVISIONS: 20,
    MOUNTAIN_DISTANCE: 140, // 70% of grid size
    NUM_MOUNTAINS: 16,
    NUM_OBSTACLES: 25,
    WORLD_BOUNDS: 90,
    
    // Scoring
    TANK_SCORE: 1000,
    SAUCER_SCORE: 1500,
    FIGHTER_SCORE: 2000,
    WAVE_BONUS: 500,
    BONUS_LIFE_SCORE: 15000,

    // Power-up settings
    POWERUP_TYPES: {
        SPEED_BOOST: {
            duration: 10000,
            effect: () => {
                GAME_PARAMS.MOVE_SPEED *= 1.5;
                GAME_PARAMS.ROTATION_SPEED *= 1.5;
            },
            reset: () => {
                GAME_PARAMS.MOVE_SPEED = 0.1;
                GAME_PARAMS.ROTATION_SPEED = 0.03;
            }
        },
        RAPID_FIRE: {
            duration: 8000,
            effect: () => {
                GAME_PARAMS.ENEMY_SHOT_INTERVAL = 1500;
            },
            reset: () => {
                GAME_PARAMS.ENEMY_SHOT_INTERVAL = 3000;
            }
        },
        SHIELD: {
            duration: 5000,
            effect: (state) => {
                state.setPlayerInvulnerable(true);
            },
            reset: (state) => {
                state.setPlayerInvulnerable(false);
            }
        }
    },
    POWERUP_SPAWN_INTERVAL: 15000,
    POWERUP_DURATION: 10000
};