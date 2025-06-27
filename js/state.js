export let scene, camera, renderer;
export let tankBody, tankTurret, tankCannon;
export let enemyTanks = [];
export let enemySpaceships = [];
export let obstacles = [];
export let projectiles = [];
export let projectilePool, explosionPool;
export let score = 0;
export let playerHealth;
export let playerHitCount = 0;
export let isGameOver = false;
export let playerInvulnerable = false;
export let radarContext;
export let currentWave = 1;
export let enemiesRemaining = 0;
export const keyboardState = {};
export let handleKeyDown, handleKeyUp;
export let labelRenderer;
export let healthLabel;
export let gameOverScreen;
export let activePowerUps = new Set();
export let powerUps = [];
export let lastPowerUpSpawn = 0;

export function setScene(s) { scene = s; }
export function setCamera(c) { camera = c; }
export function setRenderer(r) { renderer = r; }
export function setTankBody(t) { tankBody = t; }
export function setTankTurret(t) { tankTurret = t; }
export function setTankCannon(c) { tankCannon = c; }
export function setPlayerHealth(h) { playerHealth = h; }
export function setGameOver(g) { isGameOver = g; }
export function setPlayerInvulnerable(i) { playerInvulnerable = i; }
export function setRadarContext(c) { radarContext = c; }
export function setCurrentWave(w) { currentWave = w; }
export function setEnemiesRemaining(e) { enemiesRemaining = e; }
export function setLabelRenderer(l) { labelRenderer = l; }
export function setHealthLabel(h) { healthLabel = h; }
export function setGameOverScreen(g) { gameOverScreen = g; }
export function setPlayerHitCount(c) { playerHitCount = c; }
export function setLastPowerUpSpawn(t) { lastPowerUpSpawn = t; }
export function setExplosionPool(e) { explosionPool = e; }
export function setProjectilePool(p) { projectilePool = p; }
