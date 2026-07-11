import * as THREE from "three";
import { APP_VERSION } from "./version.js?v=0.1.1";

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
scene.background = new THREE.Color(0x1a2540);
scene.fog = new THREE.Fog(0x1a2540, 50, 130);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250);
camera.position.set(0, 3.8, 0);
camera.rotation.order = "YXZ";
camera.rotation.x = -0.08;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// ============================================================
// Lighting — brighter
// ============================================================
const hemi = new THREE.HemisphereLight(0xbbddff, 0x4a3a2a, 1.2);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0dd, 2.0);
sun.position.set(8, 20, -3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -15;
sun.shadow.camera.right = 15;
sun.shadow.camera.top = 25;
sun.shadow.camera.bottom = -5;
sun.shadow.camera.near = 3;
sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0008;
scene.add(sun);
scene.add(sun.target);

// Extra ambient point light near camera so nearby objects are visible
const camLight = new THREE.PointLight(0xffffff, 1.5, 25, 1.5);
camLight.position.set(0, 3.5, 0);
scene.add(camLight);

// ============================================================
// Constants
// ============================================================
const LANE_WIDTH = 2.2;
const LANE_COUNT = 3;
const TRACK_WIDTH = LANE_WIDTH * LANE_COUNT;
const LANE_X = [-LANE_WIDTH, 0, LANE_WIDTH];
const START_SPEED = 10;
const MAX_SPEED = 30;
const SPEED_ACCEL = 0.3;
const JUMP_VELOCITY = 9.0;
const GRAVITY = -20;
const SLIDE_DURATION = 0.65;
const LANE_LERP_SPEED = 12;
const CHUNK_LENGTH = 30;
const VISIBLE_CHUNKS = 5;
const COIN_SPACING = 3.5;
const COIN_VALUE = 10;
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
  lane: 1,
  playerY: 0,
  playerVelY: 0,
  jumping: false,
  sliding: false,
  slideTimer: 0,
  cameraShake: 0,
  best: parseInt(localStorage.getItem(BEST_SCORE_KEY) || "0", 10),
};

bestScore.textContent = state.best;

// ============================================================
// Materials — brighter colors
// ============================================================
const railMat = new THREE.MeshStandardMaterial({ color: 0xb0b0b8, metalness: 0.8, roughness: 0.25 });
const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x6a5038, roughness: 0.85 });
const groundMat = new THREE.MeshStandardMaterial({ color: 0x2a3050, roughness: 0.9 });
const gravelMat = new THREE.MeshStandardMaterial({ color: 0x3a3850, roughness: 0.9 });
const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a4055, roughness: 0.7 });
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x484860, metalness: 0.3, roughness: 0.6 });
const coinMat = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  metalness: 0.9,
  roughness: 0.1,
  emissive: 0xffaa00,
  emissiveIntensity: 0.8,
});
const obstacleBarrierMat = new THREE.MeshStandardMaterial({
  color: 0xff6b35,
  roughness: 0.5,
  emissive: 0xff3300,
  emissiveIntensity: 0.4,
});
const obstacleTrainMat = new THREE.MeshStandardMaterial({ color: 0x2a8fff, metalness: 0.3, roughness: 0.35, emissive: 0x002266, emissiveIntensity: 0.3 });
const obstacleTrainMat2 = new THREE.MeshStandardMaterial({ color: 0xff4466, metalness: 0.3, roughness: 0.35, emissive: 0x660011, emissiveIntensity: 0.3 });
const obstacleLowMat = new THREE.MeshStandardMaterial({
  color: 0xffee00,
  roughness: 0.4,
  emissive: 0xffcc00,
  emissiveIntensity: 0.5,
});

// ============================================================
// Geometries
// ============================================================
const railGeo = new THREE.BoxGeometry(0.12, 0.12, CHUNK_LENGTH);
const sleeperGeo = new THREE.BoxGeometry(TRACK_WIDTH * 0.75, 0.1, 0.4);
const gravelGeo = new THREE.BoxGeometry(TRACK_WIDTH + 0.5, 0.2, CHUNK_LENGTH);
const groundGeo = new THREE.BoxGeometry(50, 0.3, CHUNK_LENGTH);
const wallGeo = new THREE.BoxGeometry(0.4, 4.5, CHUNK_LENGTH);
const pillarGeo = new THREE.BoxGeometry(0.5, 5.5, 0.5);
const ceilingGeo = new THREE.BoxGeometry(TRACK_WIDTH + 4, 0.25, CHUNK_LENGTH);
// Bigger coins: radius 0.42, height 0.08
const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20);
const barrierGeo = new THREE.BoxGeometry(1.8, 1.2, 0.35);
const lowBarrierGeo = new THREE.BoxGeometry(1.8, 0.6, 0.35);
const trainGeo = new THREE.BoxGeometry(1.8, 2.2, 8);

// ============================================================
// Chunk System
// ============================================================
const chunks = [];

function createChunk(zStart) {
  const group = new THREE.Group();
  group.position.z = zStart;
  scene.add(group);

  // Gravel bed
  const gravel = new THREE.Mesh(gravelGeo, gravelMat);
  gravel.position.set(0, -0.1, CHUNK_LENGTH / 2);
  gravel.receiveShadow = true;
  group.add(gravel);

  // Ground
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, -0.3, CHUNK_LENGTH / 2);
  ground.receiveShadow = true;
  group.add(ground);

  // Rails
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const x = LANE_X[lane];
    const railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(x - 0.55, 0.06, CHUNK_LENGTH / 2);
    railL.castShadow = true;
    group.add(railL);
    const railR = new THREE.Mesh(railGeo, railMat);
    railR.position.set(x + 0.55, 0.06, CHUNK_LENGTH / 2);
    railR.castShadow = true;
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

  // Side walls
  const wallL = new THREE.Mesh(wallGeo, wallMat);
  wallL.position.set(-TRACK_WIDTH / 2 - 0.2, 2.25, CHUNK_LENGTH / 2);
  wallL.receiveShadow = true;
  group.add(wallL);

  const wallR = new THREE.Mesh(wallGeo, wallMat);
  wallR.position.set(TRACK_WIDTH / 2 + 0.2, 2.25, CHUNK_LENGTH / 2);
  wallR.receiveShadow = true;
  group.add(wallR);

  // Pillars
  for (let i = 0; i < Math.floor(CHUNK_LENGTH / 5); i++) {
    const pL = new THREE.Mesh(pillarGeo, pillarMat);
    pL.position.set(-TRACK_WIDTH / 2 - 0.55, 2.75, i * 5 + 2.5);
    pL.castShadow = true;
    group.add(pL);
    const pR = new THREE.Mesh(pillarGeo, pillarMat);
    pR.position.set(TRACK_WIDTH / 2 + 0.55, 2.75, i * 5 + 2.5);
    pR.castShadow = true;
    group.add(pR);
  }

  // Ceiling
  const ceiling = new THREE.Mesh(ceilingGeo, wallMat);
  ceiling.position.set(0, 4.5, CHUNK_LENGTH / 2);
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // Ceiling light strips — bright emissive
  for (let i = 0; i < 4; i++) {
    const lightZ = i * (CHUNK_LENGTH / 4) + CHUNK_LENGTH / 8;
    const stripGeo = new THREE.BoxGeometry(TRACK_WIDTH, 0.06, 0.35);
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xbbddff,
      emissiveIntensity: 2.0,
    });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, 4.35, lightZ);
    group.add(strip);

    // Add actual point light for first strip in each chunk (for real illumination)
    if (i < 2) {
      const pl = new THREE.PointLight(0xccddff, 0.6, 12, 1.5);
      pl.position.set(0, 4.0, lightZ);
      group.add(pl);
    }
  }

  // Obstacles & coins
  const obstacles = [];
  const coins = [];
  generateChunkContent(group, zStart, obstacles, coins);

  return { group, zStart, obstacles, coins };
}

function generateChunkContent(group, zStart, obstacles, coins) {
  // Safe zone for first chunk
  if (zStart < 5) {
    // Coins in center lane, lower height for visibility
    for (let z = 5; z < CHUNK_LENGTH; z += COIN_SPACING) {
      const coin = createCoin(0, 1.5, zStart + z);
      group.add(coin.mesh);
      coins.push(coin);
    }
    return;
  }

  const sections = 3;
  const sectionLen = CHUNK_LENGTH / sections;

  for (let s = 0; s < sections; s++) {
    const sectionZ = zStart + s * sectionLen + sectionLen / 2;
    const roll = Math.random();

    if (roll < 0.35) {
      // Barrier (jump over)
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const obstacle = createBarrier(LANE_X[lane], sectionZ);
      group.add(obstacle.mesh);
      obstacles.push(obstacle);

      const coinLane = (lane + 1 + Math.floor(Math.random() * 2)) % LANE_COUNT;
      for (let z = 0; z < 3; z++) {
        const coin = createCoin(LANE_X[coinLane], 1.5, sectionZ - sectionLen / 2 + z * COIN_SPACING);
        group.add(coin.mesh);
        coins.push(coin);
      }
    } else if (roll < 0.55) {
      // Low barrier (slide under)
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const obstacle = createLowBarrier(LANE_X[lane], sectionZ);
      group.add(obstacle.mesh);
      obstacles.push(obstacle);

      for (let z = 0; z < 3; z++) {
        const coin = createCoin(LANE_X[lane], 1.5, sectionZ - sectionLen / 2 + z * COIN_SPACING);
        group.add(coin.mesh);
        coins.push(coin);
      }
    } else if (roll < 0.75) {
      // Train (must switch lane)
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const obstacle = createTrain(LANE_X[lane], sectionZ);
      group.add(obstacle.mesh);
      obstacles.push(obstacle);

      const coinLane1 = (lane + 1) % LANE_COUNT;
      const coinLane2 = (lane + 2) % LANE_COUNT;
      for (let z = 0; z < 4; z++) {
        const cl = z % 2 === 0 ? coinLane1 : coinLane2;
        const coin = createCoin(LANE_X[cl], 1.5, sectionZ - sectionLen / 2 + z * COIN_SPACING);
        group.add(coin.mesh);
        coins.push(coin);
      }
    } else {
      // Coin arch
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        for (let z = 0; z < 2; z++) {
          const coin = createCoin(LANE_X[lane], 1.5, sectionZ - 1 + z * COIN_SPACING);
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
  mesh.position.set(x, 0.6, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, type: "barrier", lane: getLaneFromX(x), z, w: 1.8, h: 1.2, d: 0.35, collected: false };
}

function createLowBarrier(x, z) {
  const mesh = new THREE.Mesh(lowBarrierGeo, obstacleLowMat);
  mesh.position.set(x, 2.4, z);
  mesh.castShadow = true;
  return { mesh, type: "low", lane: getLaneFromX(x), z, w: 1.8, h: 0.6, d: 0.35, collected: false, elevated: true };
}

function createTrain(x, z) {
  const mats = [obstacleTrainMat, obstacleTrainMat2];
  const mat = mats[Math.floor(Math.random() * mats.length)];
  const mesh = new THREE.Mesh(trainGeo, mat);
  mesh.position.set(x, 1.1, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { mesh, type: "train", lane: getLaneFromX(x), z, w: 1.8, h: 2.2, d: 8, collected: false };
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
// Player hands (immersion)
// ============================================================
const playerHolder = new THREE.Group();
scene.add(playerHolder);

const handGeo = new THREE.BoxGeometry(0.35, 0.55, 0.65);
const handMat = new THREE.MeshStandardMaterial({ color: 0xddb080, roughness: 0.6 });
const leftHand = new THREE.Mesh(handGeo, handMat);
leftHand.position.set(-0.45, -1.6, -1.5);
leftHand.rotation.x = -0.5;
playerHolder.add(leftHand);

const rightHand = new THREE.Mesh(handGeo, handMat);
rightHand.position.set(0.45, -1.6, -1.5);
rightHand.rotation.x = -0.5;
playerHolder.add(rightHand);

// ============================================================
// Init / Recycle chunks
// ============================================================
function initChunks() {
  for (const chunk of chunks) {
    scene.remove(chunk.group);
  }
  chunks.length = 0;

  let z = 0;
  for (let i = 0; i < VISIBLE_CHUNKS; i++) {
    const chunk = createChunk(z);
    chunks.push(chunk);
    z += CHUNK_LENGTH;
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

  updateHUD();
}

function gameOver() {
  state.running = false;

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

  // Camera follows player
  camera.position.x = playerHolder.position.x;
  camera.position.y = 3.8 + state.playerY;
  camera.position.z = 0;

  // Camera light follows camera
  camLight.position.x = playerHolder.position.x;
  camLight.position.y = 3.5 + state.playerY;

  // Camera shake
  if (state.cameraShake > 0) {
    camera.position.x += (Math.random() - 0.5) * state.cameraShake;
    camera.position.y += (Math.random() - 0.5) * state.cameraShake;
    state.cameraShake = Math.max(0, state.cameraShake - dt * 3);
  }

  // Camera tilt during lane change
  const laneOffset = targetX - currentX;
  camera.rotation.z = -laneOffset * 0.04;

  // Slide camera
  if (state.sliding) {
    camera.position.y = 2.2;
    camera.rotation.x = 0.2;
  } else {
    camera.rotation.x += (-0.08 - camera.rotation.x) * Math.min(1, 10 * dt);
  }

  // Hands bob
  const bobTime = state.distance * 0.3;
  const bobAmount = state.jumping ? 0 : 0.05;
  leftHand.position.y = -1.6 + Math.sin(bobTime) * bobAmount;
  rightHand.position.y = -1.6 + Math.sin(bobTime + Math.PI) * bobAmount;

  if (state.sliding) {
    leftHand.position.y = -2.3;
    rightHand.position.y = -2.3;
    leftHand.rotation.x = -0.2;
    rightHand.rotation.x = -0.2;
  } else {
    leftHand.rotation.x = -0.5;
    rightHand.rotation.x = -0.5;
  }

  // Collisions
  checkCollisions();

  // Coin collection
  collectCoins();

  // Animate coins
  for (const chunk of chunks) {
    for (const coin of chunk.coins) {
      if (!coin.collected) {
        coin.mesh.rotation.z += dt * 5;
        coin.mesh.position.y = coin.y + Math.sin(state.distance * 0.4 + coin.z) * 0.1;
      }
    }
  }

  updateHUD();
}

function checkCollisions() {
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
          const obsYBottom = obs.elevated ? 1.9 : 0;
          const obsYTop = obs.elevated ? 2.7 : obs.h;

          if (playerYTop > obsYBottom && playerYBottom < obsYTop) {
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
  // Coin is at y=1.5, player center is at camera.y - 1.5 roughly
  const playerYCenter = state.playerY + 1.5;

  for (const chunk of chunks) {
    for (const coin of chunk.coins) {
      if (coin.collected) continue;

      const worldZ = coin.mesh.position.z + chunk.group.position.z;
      const dz = Math.abs(worldZ - playerZ);
      const dx = Math.abs(coin.mesh.position.x - playerX);
      const dy = Math.abs(coin.mesh.position.y - playerYCenter);

      if (dz < 0.9 && dx < 0.9 && dy < 1.2) {
        coin.collected = true;
        coin.mesh.visible = false;
        state.coins++;
        state.score += COIN_VALUE;
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
        e.preventDefault();
        moveLeft();
        break;
      case "KeyD":
      case "ArrowRight":
        e.preventDefault();
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
          startGame();
        }
        break;
    }
  });

  // Touch — much more forgiving for iPad
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let touchActive = false;

  touchZone.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      touchActive = true;
    }
  }, { passive: true });

  // Prevent default on touchmove so iPad doesn't scroll/zoom
  touchZone.addEventListener("touchmove", (e) => {
    if (touchActive) {
      e.preventDefault();
    }
  }, { passive: false });

  touchZone.addEventListener("touchend", (e) => {
    if (!touchActive) return;
    touchActive = false;
    if (!state.running) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const dt = Date.now() - touchStartTime;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Lower threshold for swipes, higher timeout
    const SWIPE_THRESHOLD = 25; // px — easy to trigger
    const TAP_TIMEOUT = 800; // ms — generous

    if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) {
      // Tap = jump
      jump();
      return;
    }

    // If movement too slow, still try to register
    if (dt > TAP_TIMEOUT && absX < 15 && absY < 15) {
      jump();
      return;
    }

    // Horizontal takes priority only if clearly more horizontal
    if (absX > absY * 1.2) {
      if (dx > 0) moveRight();
      else moveLeft();
    } else {
      // Vertical or diagonal
      if (dy > 0) slide();
      else jump();
    }
  }, { passive: true });

  // Buttons
  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);

  // Prevent double-tap zoom on iOS
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());
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
