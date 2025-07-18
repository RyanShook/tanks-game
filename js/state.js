export let scene, camera, renderer;
export let tankBody, tankTurret, tankCannon;
export let enemyTanks = [];
// Removed enemySpaceships - not authentic to Battle Zone
export let obstacles = [];
export let projectiles = [];
export let projectilePool, explosionPool;
export let score = 0;
export let lives = 3;
export let lastBonusLifeScore = 0;
export let isGameOver = false;
export let playerInvulnerable = false;
export let radarContext;
export let currentWave = 1;
export let enemiesRemaining = 0;
export const keyboardState = {};
export let handleKeyDown, handleKeyUp;
export let labelRenderer;
// Removed healthLabel - not needed in authentic Battle Zone
export let gameOverScreen;

export function setScene(s) { scene = s; }
export function setCamera(c) { camera = c; }
export function setRenderer(r) { renderer = r; }
export function setTankBody(t) { tankBody = t; }
export function setTankTurret(t) { tankTurret = t; }
export function setTankCannon(c) { tankCannon = c; }
// Removed setPlayerHealth - not needed in authentic Battle Zone
export function setGameOver(g) { isGameOver = g; }
export function setPlayerInvulnerable(i) { playerInvulnerable = i; }
export function setRadarContext(c) { radarContext = c; }
export function setCurrentWave(w) { currentWave = w; }
export function setEnemiesRemaining(e) { enemiesRemaining = e; }
export function setLabelRenderer(l) { labelRenderer = l; }
// Removed setHealthLabel - not needed in authentic Battle Zone
export function setGameOverScreen(g) { gameOverScreen = g; }
export function setExplosionPool(e) { explosionPool = e; }
export function setProjectilePool(p) { projectilePool = p; }
export function setScore(s) { 
    score = s; 
    // Check for bonus life every 15,000 points
    if (Math.floor(score / 15000) > Math.floor(lastBonusLifeScore / 15000)) {
        lives++;
        lastBonusLifeScore = score;
    }
}
export function setLives(l) { lives = l; }
export function setLastBonusLifeScore(s) { lastBonusLifeScore = s; }
export function setHandleKeyDown(h) { handleKeyDown = h; }
export function setHandleKeyUp(h) { handleKeyUp = h; }
