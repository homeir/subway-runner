import * as THREE from "three";
import { APP_VERSION } from "./version.js";

// ============================================================
// DOM
// ============================================================
const canvas = document.querySelector("#scene");
const startLayer = document.querySelector("#startLayer");
const startButton = document.querySelector("#startButton");
const gameoverLayer = document.querySelector("#gameoverLayer");
const restartButton = document.querySelector("#restartButton");
const versionBadge = document.querySelector("#versionBadge");
const distanceValue = document.querySelector("#distanceValue");
const coinValue = document.querySelector("#coinValue");
const scoreValue = document.querySelector("#scoreValue");
const speedValue = document.querySelector("#speedValue");
const speedBadge = document.querySelector("#speedBadge");
const touchZone = document.querySelector("#touchZone");
const finalDistance = document.querySelector("#finalDistance");
const finalCoins = document.querySelector("#finalCoins");
const finalScore = document.querySelector("#finalScore");
const bestScore = document.querySelector("#bestScore");

versionBadge.textContent = `v${APP_VERSION}`;

// ============================================================
// Scene / Camera / Renderer
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e1a);
scene.fog = new THREE.Fog(0x0a0e1a, 30, 90);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 4.5, 0);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ============================================================
// Lighting
// ============================================================
const hemi = new THREE.HemisphereLight(0x88aaff, 0x2a1a0a, 0.7);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffeecc, 1.2);
sun.position.set(10, 25, -5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -15;
sun.shadow.camera.right = 15;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -5;
sun.shadow.camera.near = 5;
sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0008;
scene.add(sun);
scene.add(sun.target);

// ============================================================
// Constants
// ============================================================
const LANE_WIDTH = 2.2;
const LANE_COUNT = 3;
const TRACK_WIDTH = LANE_WIDTH * LANE_COUNT;
const LANE_X = [-LANE_WIDTH, 0, LANE_WIDTH]; // left, center, right
const START_SPEED = 12;
const MAX_SPEED = 35;
const SPEED_ACCEL = 0.35; // per second
const JUMP_VELOCITY = 9.5;
const GRAVITY = -22;
const SLIDE_DURATION = 0.7;
const LANE_LERP_SPEED = 14;
const CHUNK_LENGTH = 30;
const VISIBLE_CHUNKS = 4;
const COIN_SPACING = 3.5;
const BEST_SCORE_KEY = "subway-runner.best";

// ============================================================
// Game State
// ============================================================
const state = {
  running: false,
  speed: START_SPEED,
  distance: 0,
  coins: 0,
  score: 0,
  lane: 1, // 0=left, 1=center, 2=right
  playerY: 0,
  playerVelY: 0,
  jumping: false,
  sliding: false,
  slideTimer: 0,
  cameraShake: 0,
  worldZ: 0, // how far we've traveled
  best: parseInt(localStorage.getItem(BEST_SCORE_KEY) || "0", 10),
};

bestScore.textContent = state.best;

// ============================================================
// Materials & Geometries (reusable)
// ============================================================
const railMat = new THREE.MeshStandardMaterial({ color: 0x8a8a90, metalness: 0.8, roughness: 0.3 });
const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 });
const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1f30, roughness: 0.95 });
const gravelMat = new THREE.MeshStandardMaterial({ color: 0x2a2838, roughness: 1.0 });
const wallMat = new THREE.MeshStandardMaterial({ color: 0x202535, roughness: 0.8 });
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x353848, metalness: 0.3, roughness: 0.7 });
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.15, emissive: 0x665500, emissiveIntensity: 0.3 });
const obstacleBarrierMat = new THREE.MeshStandardMaterial({ color: 0xff6b35, roughness: 0.6, emissive: 0x331100, emissiveIntensity: 0.2 });
const obstacleTrainMat = new THREE.MeshStandardMaterial({ color: 0x2a6fff, metalness: 0.4, roughness: 0.4 });
const obstacleTrainMat2 = new THREE.MeshStandardMaterial({ color: 0xff3b5c, metalness: 0.4, roughness: 0.4 });
const obstacleLowMat = new THREE.MeshStandardMaterial({ color: 0xffdd00, roughness: 0.5, emissive: 0x332200, emissiveIntensity: 0.2 });

const railGeo = new THREE.BoxGeometry(0.12, 0.12, CHUNK_LENGTH);
const sleeperGeo = new THREE.BoxGeometry(TRACK_WIDTH * 0.75, 0.1, 0.4);
const gravelGeo = new THREE.BoxGeometry(TRACK_WIDTH + 0.5, 0.2, CHUNK_LENGTH);
const groundGeo = new THREE.BoxGeometry(40, 0.3, CHUNK_LENGTH);
const wallGeo = new THREE.BoxGeometry(0.5, 4, CHUNK_LENGTH);
const pillarGeo = new THREE.BoxGeometry(0.6, 6, 0.6);
const ceilingGeo = new THREE.BoxGeometry(TRACK_WIDTH + 4, 0.3, CHUNK_LENGTH);
const coinGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16);
const barrierGeo = new THREE.BoxGeometry(1.8, 1.4, 0.35);
const lowBarrierGeo = new THREE.BoxGeometry(1.8, 0.7, 0.35);
const trainGeo = new THREE.BoxGeometry(1.8, 2.4, 8);

// ============================================================
// Chunk System
// ============================================================
const chunks = [];
let nextChunkZ = 0;

function createChunk(zStart) {
  const group = new THREE.Group();
  group.position.z = zStart;
  scene.add(group);

  // Gravel bed
  const gravel = new THREE.Mesh(gravelGeo, gravelMat);
  gravel.position.set(0, -0.1, CHUNK_LENGTH / 2);
  gravel.receiveShadow = true;
  group.add(gravel);

  // Ground (extends wider)
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, -0.3, CHUNK_LENGTH / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // Rails (2 per lane = 6 total, but we do 2 continuous rails per lane edges)
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const x = LANE_X[lane];
    const railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(x - 0.55, 0.06, CHUNK_LENGTH / 2);
    group.add(railL);
    const railR = new THREE.Mesh(railGeo, railMat);
    railR.position.set(x + 0.55, 0.06, CHUNK_LENGTH / 2);
    group.add(railR);
  }

  // Sleepers
  const sleeperCount = Math.floor(CHUNK_LENGTH / 0.7);
  for (let i = 0; i < sleeperCount; i++) {
    const sleeper = new THREE.Mesh(sleeperGeo, sleeperMat);
    sleeper.position.set(0, 0, i * 0.7 + 0.35);
    sleeper.receiveShadow = true;
    group.add(sleeper);
  }

  // Side walls (tunnel feel)
  const wallL = new THREE.Mesh(wallGeo, wallMat);
  wallL.position.set(-TRACK_WIDTH / 2 - 0.25, 2, CHUNK_LENGTH / 2);
  wallL.receiveShadow = true;
  group.add(wallL);

  const wallR = new THREE.Mesh(wallGeo, wallMat);
  wallR.position.set(TRACK_WIDTH / 2 + 0.25, 2, CHUNK_LENGTH / 2);
  wallR.receiveShadow = true;
  group.add(wallR);

  // Pillars every ~5 units
  for (let i = 0; i < Math.floor(CHUNK_LENGTH / 5); i++) {
    const pL = new THREE.Mesh(pillarGeo, pillarMat);
    pL.position.set(-TRACK_WIDTH / 2 - 0.6, 3, i * 5 + 2.5);
    pL.castShadow = true;
    group.add(pL);
    const pR = new THREE.Mesh(pillarGeo, pillarMat);
    pR.position.set(TRACK_WIDTH / 2 + 0.6, 3, i * 5 + 2.5);
    pR.castShadow = true;
    group.add(pR);
  }

  // Ceiling (tunnel)
  const ceiling = new THREE.Mesh(ceilingGeo, wallMat);
  ceiling.position.set(0, 4.2, CHUNK_LENGTH / 2);
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // Ceiling lights
  for (let i = 0; i < 3; i++) {
    const lightZ = i * (CHUNK_LENGTH / 3) + CHUNK_LENGTH / 6;
    const stripGeo = new THREE.BoxGeometry(TRACK_WIDTH, 0.05, 0.3);
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xaaeeff,
      emissiveIntensity: 0.8,
    });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 4.05, lightZ);
    group.add(strip);
  }

  // Obstacles & coins
  const obstacles = [];
  const coins = [];
  generateChunkContent(group, zStart, obstacles, coins);

  return { group, zStart, obstacles, coins };
}

function generateChunkContent(group, zStart, obstacles, coins) {
  // Don't generate obstacles for the first chunk (safe zone)
  if (zStart < 5) {
    // Just coins in center lane
    for (let z = 5; z < CHUNK_LENGTH; z += COIN_SPACING) {
      const coin = createCoin(0, 1.2, zStart + z);
      group.add(coin.mesh);
      coins.push(coin);
    }
    return;
  }

  // Each chunk gets 2-3 obstacle sections
  const sections = 3;
  const sectionLen = CHUNK_LENGTH / sections;

  for (let s = 0; s < sections; s++) {
    const sectionZ = zStart + s * sectionLen + sectionLen / 2;
    const roll = Math.random();

    if (roll < 0.35) {
      // Barrier across one lane (jump over)
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const obstacle = createBarrier(LANE_X[lane], sectionZ);
      group.add(obstacle.mesh);
      obstacles.push(obstacle);

      // Coins in a different lane
      const coinLane = (lane + 1 + Math.floor(Math.random() * 2)) % LANE_COUNT;
      for (let z = 0; z < 3; z++) {
        const coin = createCoin(LANE_X[coinLane], 1.2, sectionZ - sectionLen / 2 + z * COIN_SPACING);
        group.add(coin.mesh);
        coins.push(coin);
      }
    } else if (roll < 0.55) {
      // Low barrier (slide under)
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const obstacle = createLowBarrier(LANE_X[lane], sectionZ);
      group.add(obstacle.mesh);
      obstacles.push(obstacle);

      // Coins line leading to it (slide path)
      for (let z = 0; z < 3; z++) {
        const coin = createCoin(LANE_X[lane], 1.2, sectionZ - sectionLen / 2 + z * COIN_SPACING);
        group.add(coin.mesh);
        coins.push(coin);
      }
    } else if (roll < 0.75) {
      // Train in one lane (must switch)
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const obstacle = createTrain(LANE_X[lane], sectionZ);
      group.add(obstacle.mesh);
      obstacles.push(obstacle);

      // Coins in adjacent lanes
      const coinLane1 = (lane + 1) % LANE_COUNT;
      const coinLane2 = (lane + 2) % LANE_COUNT;
      for (let z = 0; z < 4; z++) {
        const cl = z % 2 === 0 ? coinLane1 : coinLane2;
        const coin = createCoin(LANE_X[cl], 1.2, sectionZ - sectionLen / 2 + z * COIN_SPACING);
        group.add(coin.mesh);
        coins.push(coin);
      }
    } else {
      // Coin arch across all lanes
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        for (let z = 0; z < 2; z++) {
          const coin = createCoin(LANE_X[lane], 1.2, sectionZ - 1 + z * COIN_SPACING);
          group.add(coin.mesh);
          coins.push(coin);
        }
      }
    }
  }
}

// ============================================================
// Obstacle Factory
// ============================================================
function createBarrier(x, z) {
  const mesh = new THREE.Mesh(barrierGeo, obstacleBarrierMat);
  mesh.position.set(x, 0.7, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, type: "barrier", lane: getLaneFromX(x), z, w: 1.8, h: 1.4, d: 0.35, collected: false };
}

function createLowBarrier(x, z) {
  const mesh = new THREE.Mesh(lowBarrierGeo, obstacleLowMat);
  mesh.position.set(x, 2.3, z);
  mesh.castShadow = true;
  return { mesh, type: "low", lane: getLaneFromX(x), z, w: 1.8, h: 0.7, d: 0.35, collected: false, elevated: true };
}

function createTrain(x, z) {
  const mats = [obstacleTrainMat, obstacleTrainMat2];
  const mat = mats[Math.floor(Math.random() * mats.length)];
  const mesh = new THREE.Mesh(trainGeo, mat);
  mesh.position.set(x, 1.2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, type: "train", lane: getLaneFromX(x), z, w: 1.8, h: 2.4, d: 8, collected: false };
}

function createCoin(x, y, z) {
  const mesh = new THREE.Mesh(coinGeo, coinMat);
  mesh.position.set(x, y, z);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = false;
  return { mesh, x, y, z, collected: false };
}

function getLaneFromX(x) {
  if (x < -0.5) return 0;
  if (x > 0.5) return 2;
  return 1;
}

// ============================================================
// Player (invisible, first-person camera is the player)
// ============================================================
const playerHolder = new THREE.Group();
scene.add(playerHolder);

// Simple hand model (visible at bottom of screen for immersion)
const handGeo = new THREE.BoxGeometry(0.3, 0.5, 0.6);
const handMat = new THREE.MeshStandardMaterial({ color: 0xcca070, roughness: 0.7 });
const leftHand = new THREE.Mesh(handGeo, handMat);
leftHand.position.set(-0.4, -1.5, -1.5);
leftHand.rotation.x = -0.5;
leftHand.castShadow = false;
playerHolder.add(leftHand);

const rightHand = new THREE.Mesh(handGeo, handMat);
rightHand.position.set(0.4, -1.5, -1.5);
rightHand.rotation.x = -0.5;
playerHolder.add(rightHand);

// ============================================================
// Initialize chunks
// ============================================================
function initChunks() {
  // Clear existing
  for (const chunk of chunks) {
    scene.remove(chunk.group);
  }
  chunks.length = 0;
  nextChunkZ = 0;

  for (let i = 0; i < VISIBLE_CHUNKS; i++) {
    const chunk = createChunk(nextChunkZ);
    chunks.push(chunk);
    nextChunkZ += CHUNK_LENGTH;
  }
}

function recycleChunks() {
  // Move world toward camera: decrease group.position.z by speed*dt
  // When a chunk goes behind camera, recycle it to the front
  for (const chunk of chunks) {
    chunk.group.position.z -= state.speed * (1 / 60); // approximate, real dt used in animate
  }

  // Find chunks that are behind camera
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk.group.position.z + CHUNK_LENGTH < -5) {
      // Recycle
      scene.remove(chunk.group);
      chunks.splice(i, 1);

      // Find the furthest chunk
      let maxZ = -Infinity;
      for (const c of chunks) {
        if (c.group.position.z > maxZ) maxZ = c.group.position.z;
      }

      const newChunk = createChunk(maxZ + CHUNK_LENGTH);
      chunks.push(newChunk);
    }
  }
}

// ============================================================
// Game Logic
// ============================================================
function startGame() {
  state.running = true;
  state.speed = START_SPEED;
  state.distance = 0;
  state.coins = 0;
  state.score = 0;
  state.lane = 1;
  state.playerY = 0;
  state.playerVelY = 0;
  state.jumping = false;
  state.sliding = false;
  state.slideTimer = 0;
  state.cameraShake = 0;

  initChunks();
  startLayer.classList.add("hidden");
  gameoverLayer.classList.add("hidden");
  touchZone.classList.add("active");

  updateHUD();
}

function gameOver() {
  state.running = false;
  touchZone.classList.remove("active");

  finalDistance.textContent = Math.floor(state.distance) + "m";
  finalCoins.textContent = state.coins;
  finalScore.textContent = Math.floor(state.score);

  if (state.score > state.best) {
    state.best = Math.floor(state.score);
    localStorage.setItem(BEST_SCORE_KEY, state.best);
    bestScore.textContent = state.best;
  }

  gameoverLayer.classList.remove("hidden");
}

function updatePlayer(dt) {
  if (!state.running) return;

  // Speed increase
  state.speed = Math.min(MAX_SPEED, state.speed + SPEED_ACCEL * dt);
  state.distance += state.speed * dt;
  state.score += state.speed * dt * 0.5;

  // Move chunks toward player
  const moveDist = state.speed * dt;
  for (const chunk of chunks) {
    chunk.group.position.z -= moveDist;
  }

  // Recycle chunks
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk.group.position.z + CHUNK_LENGTH < -5) {
      scene.remove(chunk.group);
      chunks.splice(i, 1);
      let maxZ = -Infinity;
      for (const c of chunks) {
        if (c.group.position.z > maxZ) maxZ = c.group.position.z;
      }
      const newChunk = createChunk(maxZ + CHUNK_LENGTH);
      chunks.push(newChunk);
    }
  }

  // Lane movement (smooth lerp)
  const targetX = LANE_X[state.lane];
  const currentX = playerHolder.position.x;
  playerHolder.position.x += (targetX - currentX) * Math.min(1, LANE_LERP_SPEED * dt);

  // Jumping
  if (state.jumping) {
    state.playerVelY += GRAVITY * dt;
    state.playerY += state.playerVelY * dt;
    if (state.playerY <= 0) {
      state.playerY = 0;
      state.playerVelY = 0;
      state.jumping = false;
    }
  }

  // Sliding
  if (state.sliding) {
    state.slideTimer -= dt;
    if (state.slideTimer <= 0) {
      state.sliding = false;
    }
  }

  // Camera position
  const camY = 4.5 + state.playerY;
  camera.position.x = playerHolder.position.x;
  camera.position.y = camY;
  camera.position.z = 0;

  // Camera shake on near misses
  if (state.cameraShake > 0) {
    camera.position.x += (Math.random() - 0.5) * state.cameraShake;
    camera.position.y += (Math.random() - 0.5) * state.cameraShake;
    state.cameraShake = Math.max(0, state.cameraShake - dt * 3);
  }

  // Camera tilt during lane change
  const laneOffset = targetX - currentX;
  camera.rotation.z = -laneOffset * 0.04;

  // Slide camera lower
  if (state.sliding) {
    camera.position.y = 2.5;
    camera.rotation.x = 0.15;
  } else {
    camera.rotation.x += (0 - camera.rotation.x) * Math.min(1, 10 * dt);
  }

  // Player hands bob
  const bobTime = state.distance * 0.3;
  const bobAmount = state.jumping ? 0 : 0.05;
  leftHand.position.y = -1.5 + Math.sin(bobTime) * bobAmount;
  rightHand.position.y = -1.5 + Math.sin(bobTime + Math.PI) * bobAmount;

  // Update hands position for slide
  if (state.sliding) {
    leftHand.position.y = -2.2;
    rightHand.position.y = -2.2;
    leftHand.rotation.x = -0.2;
    rightHand.rotation.x = -0.2;
  } else {
    leftHand.rotation.x = -0.5;
    rightHand.rotation.x = -0.5;
  }

  // Collision detection
  checkCollisions();

  // Coin collection
  collectCoins();

  // Animate coins (spin)
  for (const chunk of chunks) {
    for (const coin of chunk.coins) {
      if (!coin.collected) {
        coin.mesh.rotation.z += dt * 4;
        coin.mesh.position.y = coin.y + Math.sin(state.distance * 0.5 + coin.z) * 0.08;
      }
    }
  }

  updateHUD();
}

function checkCollisions() {
  const playerLane = state.lane;
  const playerX = playerHolder.position.x;
  const playerZ = 0;
  const playerHeight = state.sliding ? 0.8 : 1.7;
  const playerYBottom = state.playerY;
  const playerYTop = playerYBottom + playerHeight;

  for (const chunk of chunks) {
    for (const obs of chunk.obstacles) {
      if (obs.collected) continue;

      const worldZ = obs.mesh.position.z + chunk.group.position.z;
      const dz = Math.abs(worldZ - playerZ);

      if (dz < obs.d / 2 + 0.4) {
        const obsX = obs.mesh.position.x;
        const dx = Math.abs(obsX - playerX);

        if (dx < obs.w / 2 + 0.35) {
          const obsYBottom = obs.elevated ? 1.8 : 0;
          const obsYTop = obs.elevated ? 2.7 : obs.h;

          // Check vertical overlap
          if (playerYTop > obsYBottom && playerYBottom < obsYTop) {
            // Collision!
            gameOver();
            return;
          }
        }
      }
    }
  }
}

function collectCoins() {
  const playerX = playerHolder.position.x;
  const playerZ = 0;

  for (const chunk of chunks) {
    for (const coin of chunk.coins) {
      if (coin.collected) continue;

      const worldZ = coin.mesh.position.z + chunk.group.position.z;
      const dz = Math.abs(worldZ - playerZ);
      const dx = Math.abs(coin.mesh.position.x - playerX);
      const dy = Math.abs(coin.mesh.position.y - (camera.position.y - 3));

      if (dz < 0.7 && dx < 0.7 && dy < 1.0) {
        coin.collected = true;
        coin.mesh.visible = false;
        state.coins++;
        state.score += 10;
      }
    }
  }
}

function jump() {
  if (!state.running) return;
  if (state.jumping || state.sliding) return;
  state.jumping = true;
  state.playerVelY = JUMP_VELOCITY;
}

function slide() {
  if (!state.running) return;
  if (state.sliding) return;
  if (state.jumping) {
    // Fast-fall into slide
    state.playerY = 0;
    state.playerVelY = 0;
    state.jumping = false;
  }
  state.sliding = true;
  state.slideTimer = SLIDE_DURATION;
}

function moveLeft() {
  if (!state.running) return;
  if (state.lane > 0) state.lane--;
}

function moveRight() {
  if (!state.running) return;
  if (state.lane < LANE_COUNT - 1) state.lane++;
}

function updateHUD() {
  distanceValue.textContent = Math.floor(state.distance) + "m";
  coinValue.textContent = state.coins;
  scoreValue.textContent = Math.floor(state.score);
  speedValue.textContent = (state.speed / START_SPEED).toFixed(1) + "x";

  if (state.speed > START_SPEED * 1.5) {
    speedBadge.classList.add("boost");
  } else {
    speedBadge.classList.remove("boost");
  }
}

// ============================================================
// Input
// ============================================================
function setupInput() {
  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case "KeyA":
      case "ArrowLeft":
        moveLeft();
        break;
      case "KeyD":
      case "ArrowRight":
        moveRight();
        break;
      case "KeyW":
      case "ArrowUp":
      case "Space":
        e.preventDefault();
        jump();
        break;
      case "KeyS":
      case "ArrowDown":
        e.preventDefault();
        slide();
        break;
      case "Enter":
        if (!state.running) {
          if (!gameoverLayer.classList.contains("hidden")) {
            startGame();
          } else if (!startLayer.classList.contains("hidden")) {
            startGame();
          }
        }
        break;
    }
  });

  // Touch swipe
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  touchZone.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
  }, { passive: true });

  touchZone.addEventListener("touchend", (e) => {
    if (!state.running) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const dt = Date.now() - touchStartTime;

    if (dt > 500) return; // too slow, ignore

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 30;

    if (absX < threshold && absY < threshold) {
      // Tap = jump
      jump();
    } else if (absX > absY) {
      if (dx > 0) moveRight();
      else moveLeft();
    } else {
      if (dy > 0) slide();
      else jump();
    }
  }, { passive: true });

  // Buttons
  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);
}

// ============================================================
// Resize
// ============================================================
function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener("resize", resize);

// ============================================================
// Animation Loop
// ============================================================
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (state.running) {
    updatePlayer(dt);
  }

  renderer.render(scene, camera);
}

// ============================================================
// Init
// ============================================================
initChunks();
setupInput();
resize();
animate(performance.now());
