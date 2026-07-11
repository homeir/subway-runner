import * as THREE from "three";
import { APP_VERSION } from "./version.js?v=0.2.1";

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
const newRecordBadge = document.querySelector("#newRecordBadge");
const hitFlash = document.querySelector("#hitFlash");

// On-screen touch buttons
const btnLeft = document.querySelector("#btnLeft");
const btnRight = document.querySelector("#btnRight");
const btnJump = document.querySelector("#btnJump");
const btnSlide = document.querySelector("#btnSlide");

versionBadge.textContent = `v${APP_VERSION}`;

// ============================================================
// Scene / Camera / Renderer
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141c33);
scene.fog = new THREE.Fog(0x141c33, 45, 130);

// 第一人称：相机就是玩家的眼睛，人眼高度约 1.65 米
const CAMERA_HEIGHT = 1.65;
const CAMERA_SLIDE_HEIGHT = 0.85;
const BASE_FOV = 75;

const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 250);
// Camera at z=0, looking toward -Z (Three.js default). Track extends in -Z.
camera.position.set(0, CAMERA_HEIGHT, 0);
camera.rotation.order = "YXZ";
camera.rotation.x = -0.05;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// ============================================================
// Lighting
// 用少量灯光照亮整个隧道（chunk 里不再放点光源，性能更好）
// ============================================================
const hemi = new THREE.HemisphereLight(0xaac4ff, 0x3a3448, 1.35);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0dd, 1.6);
sun.position.set(6, 18, -6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -5;
sun.shadow.camera.near = 3;
sun.shadow.camera.far = 55;
sun.shadow.bias = -0.0008;
scene.add(sun);
scene.add(sun.target);

// 从隧道深处打来的补光，让远处不是死黑一片
const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
fill.position.set(-4, 6, -30);
scene.add(fill);

// 跟随玩家的暖色点光
const camLight = new THREE.PointLight(0xffe8cc, 1.2, 22, 1.6);
camLight.position.set(0, 2.5, -1);
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
const MENU_SPEED = 5; // 开始界面背后场景慢速滚动
const JUMP_VELOCITY = 7.6;
const GRAVITY = -22;
const FAST_FALL_VELOCITY = -16; // 空中下滑 = 快速下坠
const JUMP_BUFFER_TIME = 0.15; // 落地前一瞬间按跳也算数
const SLIDE_DURATION = 0.7;
const LANE_LERP_SPEED = 12;
const CHUNK_LENGTH = 30;
const VISIBLE_CHUNKS = 5;
const COIN_SPACING = 3.5;
const COIN_VALUE = 10;
const COIN_Y = 0.9; // 腰部高度，不挡视线
const TUNNEL_HEIGHT = 4.6;
const BEST_SCORE_KEY = "subway-runner.best";

// 玩家碰撞体：站立高 1.7 米，滑铲时只有 0.8 米
const PLAYER_STAND_HEIGHT = 1.7;
const PLAYER_SLIDE_HEIGHT = 0.8;

// ============================================================
// Game State
// phase: menu(开始界面) -> running(游戏中) -> dying(撞击瞬间) -> over(结算)
// ============================================================
const state = {
  phase: "menu",
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
  jumpBuffer: 0,
  slideOnLand: false,
  cameraShake: 0,
  best: parseInt(localStorage.getItem(BEST_SCORE_KEY) || "0", 10),
};

bestScore.textContent = state.best;

// ============================================================
// Materials（全部共享，回收 chunk 时不会泄漏内存）
// ============================================================
const railMat = new THREE.MeshStandardMaterial({ color: 0xc8c8d2, metalness: 0.85, roughness: 0.3 });
const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x7a5c40, roughness: 0.85 });
const groundMat = new THREE.MeshStandardMaterial({ color: 0x333a52, roughness: 0.9 });
const gravelMat = new THREE.MeshStandardMaterial({ color: 0x424866, roughness: 0.9 });
const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a5470, roughness: 0.75 });
const wallTrimMat = new THREE.MeshStandardMaterial({ color: 0x5c6a8c, roughness: 0.6, metalness: 0.2 });
const ceilingMat = new THREE.MeshStandardMaterial({
  color: 0x46506e,
  roughness: 0.8,
  emissive: 0x1a2238, // 底面朝下照不到光，给点自发光避免死黑
  emissiveIntensity: 0.7,
});
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x565e7c, metalness: 0.3, roughness: 0.6 });
const stripMat = new THREE.MeshStandardMaterial({
  color: 0xfff4e0,
  emissive: 0xffe0b0,
  emissiveIntensity: 1.0,
});
const coinMat = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  metalness: 0.9,
  roughness: 0.15,
  emissive: 0xffaa00,
  emissiveIntensity: 0.7,
});
const barrierMat = new THREE.MeshStandardMaterial({
  color: 0xff5a2e,
  roughness: 0.5,
  emissive: 0xd42a00,
  emissiveIntensity: 0.35,
});
const barrierStripeMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.4,
  emissive: 0xccccdd,
  emissiveIntensity: 0.25,
});
const lowBarrierMat = new THREE.MeshStandardMaterial({
  color: 0xffd21e,
  roughness: 0.45,
  emissive: 0xdd9900,
  emissiveIntensity: 0.4,
});
const postMat = new THREE.MeshStandardMaterial({ color: 0x8890a8, metalness: 0.5, roughness: 0.4 });
const trainMats = [
  new THREE.MeshStandardMaterial({ color: 0x2a8fff, metalness: 0.35, roughness: 0.35, emissive: 0x00224f, emissiveIntensity: 0.35 }),
  new THREE.MeshStandardMaterial({ color: 0xff4466, metalness: 0.35, roughness: 0.35, emissive: 0x4f0011, emissiveIntensity: 0.35 }),
  new THREE.MeshStandardMaterial({ color: 0x22cc88, metalness: 0.35, roughness: 0.35, emissive: 0x004f22, emissiveIntensity: 0.35 }),
];
const trainFaceMat = new THREE.MeshStandardMaterial({ color: 0x1a2030, metalness: 0.4, roughness: 0.3 });
const trainLightMat = new THREE.MeshStandardMaterial({ color: 0xfff8dd, emissive: 0xffee99, emissiveIntensity: 1.4 });

// 墙上霓虹广告牌的颜色
const AD_COLORS = [0x00d4ff, 0xff6b35, 0xffd700, 0x7cffb2, 0xff4d88, 0xbb88ff];
const adMats = AD_COLORS.map(
  (c) =>
    new THREE.MeshStandardMaterial({
      color: c,
      emissive: c,
      emissiveIntensity: 1.1,
      roughness: 0.4,
    }),
);

// ============================================================
// Geometries（同样全部共享）
// ============================================================
const railGeo = new THREE.BoxGeometry(0.12, 0.12, CHUNK_LENGTH);
const sleeperGeo = new THREE.BoxGeometry(TRACK_WIDTH * 0.8, 0.1, 0.4);
const gravelGeo = new THREE.BoxGeometry(TRACK_WIDTH + 0.5, 0.2, CHUNK_LENGTH);
const groundGeo = new THREE.BoxGeometry(50, 0.3, CHUNK_LENGTH);
const wallGeo = new THREE.BoxGeometry(0.4, 5.2, CHUNK_LENGTH);
const wallTrimGeo = new THREE.BoxGeometry(0.5, 0.25, CHUNK_LENGTH);
const pillarGeo = new THREE.BoxGeometry(0.45, TUNNEL_HEIGHT, 0.45);
const ceilingGeo = new THREE.BoxGeometry(TRACK_WIDTH + 4, 0.25, CHUNK_LENGTH);
const stripGeo = new THREE.BoxGeometry(3.4, 0.05, 0.5);
const adGeo = new THREE.BoxGeometry(0.08, 1.3, 2.6);
const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.07, 24);
const barrierGeo = new THREE.BoxGeometry(1.8, 1.0, 0.3);
const barrierStripeGeo = new THREE.BoxGeometry(1.84, 0.22, 0.32);
const lowBeamGeo = new THREE.BoxGeometry(1.9, 0.55, 0.3);
const postGeo = new THREE.BoxGeometry(0.12, 1.75, 0.12);
const trainGeo = new THREE.BoxGeometry(2.0, 2.6, 9);
const trainFaceGeo = new THREE.BoxGeometry(1.7, 1.2, 0.1);
const trainLightGeo = new THREE.BoxGeometry(0.3, 0.3, 0.1);

// ============================================================
// Speed particles（速度感粒子：两侧向后飞的光点）
// ============================================================
const PARTICLE_COUNT = 160;
const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  particlePositions[i * 3 + 0] = (Math.random() - 0.5) * 9;
  particlePositions[i * 3 + 1] = 0.3 + Math.random() * (TUNNEL_HEIGHT - 0.6);
  particlePositions[i * 3 + 2] = -Math.random() * 70;
}
const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
const particleMat = new THREE.PointsMaterial({
  color: 0xaaccff,
  size: 0.05,
  transparent: true,
  opacity: 0.35,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// ============================================================
// Chunk System
//
// Track extends in -Z direction (camera looks -Z by default).
// Each chunk is a Group whose position.z defines its world-space offset.
// Inside the group, all mesh positions are LOCAL coordinates:
//   z ranges from 0 (near edge, closest to camera) to -CHUNK_LENGTH (far edge).
//
// As the player "runs forward", chunks move toward +Z (toward camera).
// When a chunk's position.z exceeds 5 (past the camera), it gets recycled.
// ============================================================
const chunks = [];

function createChunk(zStart) {
  const group = new THREE.Group();
  group.position.z = zStart;
  scene.add(group);

  // --- All mesh positions below are LOCAL (relative to group) ---
  // Chunk spans from z=0 (near) to z=-CHUNK_LENGTH (far)
  const centerZ = -CHUNK_LENGTH / 2;

  // Gravel bed
  const gravel = new THREE.Mesh(gravelGeo, gravelMat);
  gravel.position.set(0, -0.1, centerZ);
  gravel.receiveShadow = true;
  group.add(gravel);

  // Ground
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(0, -0.3, centerZ);
  ground.receiveShadow = true;
  group.add(ground);

  // Rails - 3 lanes
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const x = LANE_X[lane];
    const railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(x - 0.55, 0.06, centerZ);
    railL.castShadow = true;
    group.add(railL);
    const railR = new THREE.Mesh(railGeo, railMat);
    railR.position.set(x + 0.55, 0.06, centerZ);
    railR.castShadow = true;
    group.add(railR);
  }

  // Sleepers (railroad ties)
  const sleeperCount = Math.floor(CHUNK_LENGTH / 0.7);
  for (let i = 0; i < sleeperCount; i++) {
    const sleeper = new THREE.Mesh(sleeperGeo, sleeperMat);
    sleeper.position.set(0, 0, -(i * 0.7 + 0.35)); // local z: 0 to -CHUNK_LENGTH
    sleeper.receiveShadow = true;
    group.add(sleeper);
  }

  // Side walls
  const wallL = new THREE.Mesh(wallGeo, wallMat);
  wallL.position.set(-TRACK_WIDTH / 2 - 0.2, 2.6, centerZ);
  wallL.receiveShadow = true;
  group.add(wallL);

  const wallR = new THREE.Mesh(wallGeo, wallMat);
  wallR.position.set(TRACK_WIDTH / 2 + 0.2, 2.6, centerZ);
  wallR.receiveShadow = true;
  group.add(wallR);

  // 墙面装饰线条（增加层次感）
  const trimL = new THREE.Mesh(wallTrimGeo, wallTrimMat);
  trimL.position.set(-TRACK_WIDTH / 2 - 0.2, 1.4, centerZ);
  group.add(trimL);
  const trimR = new THREE.Mesh(wallTrimGeo, wallTrimMat);
  trimR.position.set(TRACK_WIDTH / 2 + 0.2, 1.4, centerZ);
  group.add(trimR);

  // Pillars
  for (let i = 0; i < Math.floor(CHUNK_LENGTH / 6); i++) {
    const pz = -(i * 6 + 3);
    const pL = new THREE.Mesh(pillarGeo, pillarMat);
    pL.position.set(-TRACK_WIDTH / 2 - 0.55, TUNNEL_HEIGHT / 2, pz);
    pL.castShadow = true;
    group.add(pL);
    const pR = new THREE.Mesh(pillarGeo, pillarMat);
    pR.position.set(TRACK_WIDTH / 2 + 0.55, TUNNEL_HEIGHT / 2, pz);
    pR.castShadow = true;
    group.add(pR);
  }

  // Ceiling（比玩家头顶高很多，隧道才显得开阔）
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.position.set(0, TUNNEL_HEIGHT, centerZ);
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // Ceiling light strips（共享材质，亮度适中不过曝）
  for (let i = 0; i < 4; i++) {
    const lightZ = -(i * (CHUNK_LENGTH / 4) + CHUNK_LENGTH / 8);
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.set(0, TUNNEL_HEIGHT - 0.12, lightZ);
    group.add(strip);
  }

  // 墙上的霓虹广告牌（随机颜色、随机位置、左右两侧都可能有）
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      if (Math.random() < 0.55) {
        const ad = new THREE.Mesh(adGeo, adMats[Math.floor(Math.random() * adMats.length)]);
        ad.position.set(side * (TRACK_WIDTH / 2 + 0.13), 2.0 + Math.random() * 1.3, -(i * 7.5 + 2 + Math.random() * 4));
        group.add(ad);
      }
    }
  }

  // Obstacles & coins
  const obstacles = [];
  const coins = [];
  generateChunkContent(group, zStart, obstacles, coins);

  return { group, zStart, obstacles, coins };
}

function generateChunkContent(group, zStart, obstacles, coins) {
  // Safe zone for first chunk (nearest to camera, zStart ~0)
  // Local z from 0 to -CHUNK_LENGTH
  if (zStart > -5) {
    for (let z = -5; z > -CHUNK_LENGTH; z -= COIN_SPACING) {
      const coin = createCoin(0, COIN_Y, z); // local z
      group.add(coin.mesh);
      coins.push(coin);
    }
    return;
  }

  // For non-safe chunks, generate 3 sections
  // Local z ranges from 0 (near) to -CHUNK_LENGTH (far)
  const sections = 3;
  const sectionLen = CHUNK_LENGTH / sections;

  for (let s = 0; s < sections; s++) {
    // Local z center of this section
    const sectionZ = -(s * sectionLen + sectionLen / 2);
    const roll = Math.random();

    if (roll < 0.35) {
      // Barrier (jump over)
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const obstacle = createBarrier(LANE_X[lane], sectionZ);
      group.add(obstacle.mesh);
      obstacles.push(obstacle);

      const coinLane = (lane + 1 + Math.floor(Math.random() * 2)) % LANE_COUNT;
      for (let z = 0; z < 3; z++) {
        const coinZ = sectionZ + z * COIN_SPACING;
        const coin = createCoin(LANE_X[coinLane], COIN_Y, coinZ);
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
        const coinZ = sectionZ + z * COIN_SPACING;
        const coin = createCoin(LANE_X[lane], COIN_Y, coinZ);
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
        const coinZ = sectionZ + z * COIN_SPACING;
        const coin = createCoin(LANE_X[cl], COIN_Y, coinZ);
        group.add(coin.mesh);
        coins.push(coin);
      }
    } else {
      // Coin arch
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        for (let z = 0; z < 2; z++) {
          const coinZ = sectionZ + z * COIN_SPACING;
          const coin = createCoin(LANE_X[lane], COIN_Y, coinZ);
          group.add(coin.mesh);
          coins.push(coin);
        }
      }
    }
  }
}

// ============================================================
// Obstacle Factory
// All positions are LOCAL coordinates within a chunk group.
//
// 碰撞体说明（y 轴范围）:
//   barrier:    0 ~ 1.0   -> 必须跳过
//   low beam:   1.15~1.75 -> 站立(1.7)会撞头, 滑铲(0.8)能钻过, 跳跃也会撞
//   train:      0 ~ 2.6   -> 只能换道
// ============================================================
function createBarrier(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(barrierGeo, barrierMat);
  body.position.y = 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // 白色警示条纹
  const stripe = new THREE.Mesh(barrierStripeGeo, barrierStripeMat);
  stripe.position.y = 0.72;
  g.add(stripe);
  g.position.set(x, 0, z);
  return { mesh: g, type: "barrier", w: 1.8, h: 1.0, d: 0.3, yBottom: 0, yTop: 1.0 };
}

function createLowBarrier(x, z) {
  const g = new THREE.Group();
  // 悬空横梁：底部 1.15 米，站着过会撞头，必须滑铲
  const beam = new THREE.Mesh(lowBeamGeo, lowBarrierMat);
  beam.position.y = 1.45;
  beam.castShadow = true;
  g.add(beam);
  // 两侧支撑柱（只是装饰，不参与碰撞）
  const postL = new THREE.Mesh(postGeo, postMat);
  postL.position.set(-0.89, 0.875, 0);
  g.add(postL);
  const postR = new THREE.Mesh(postGeo, postMat);
  postR.position.set(0.89, 0.875, 0);
  g.add(postR);
  g.position.set(x, 0, z);
  return { mesh: g, type: "low", w: 1.8, h: 0.55, d: 0.3, yBottom: 1.15, yTop: 1.75 };
}

function createTrain(x, z) {
  const g = new THREE.Group();
  const mat = trainMats[Math.floor(Math.random() * trainMats.length)];
  const body = new THREE.Mesh(trainGeo, mat);
  body.position.y = 1.3;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  // 车头挡风玻璃
  const face = new THREE.Mesh(trainFaceGeo, trainFaceMat);
  face.position.set(0, 1.7, 4.51);
  g.add(face);
  // 车头大灯
  const lampL = new THREE.Mesh(trainLightGeo, trainLightMat);
  lampL.position.set(-0.6, 0.7, 4.51);
  g.add(lampL);
  const lampR = new THREE.Mesh(trainLightGeo, trainLightMat);
  lampR.position.set(0.6, 0.7, 4.51);
  g.add(lampR);
  g.position.set(x, 0, z);
  return { mesh: g, type: "train", w: 2.0, h: 2.6, d: 9, yBottom: 0, yTop: 2.6 };
}

function createCoin(x, y, z) {
  const mesh = new THREE.Mesh(coinGeo, coinMat);
  mesh.position.set(x, y, z);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = false;
  return { mesh, x, y, z, collected: false };
}

// ============================================================
// Player hands (immersion)
// 挂在 playerHolder 上，跟随车道/跳跃/滑铲移动
// ============================================================
const playerHolder = new THREE.Group();
scene.add(playerHolder);

const handGeo = new THREE.BoxGeometry(0.16, 0.22, 0.32);
const handMat = new THREE.MeshStandardMaterial({ color: 0xe8bd8f, roughness: 0.55 });
const HAND_Y = CAMERA_HEIGHT - 0.82; // 大部分藏在画面外，摆臂时探出来一点
const leftHand = new THREE.Mesh(handGeo, handMat);
leftHand.position.set(-0.35, HAND_Y, -0.95);
leftHand.rotation.x = -0.5;
playerHolder.add(leftHand);

const rightHand = new THREE.Mesh(handGeo, handMat);
rightHand.position.set(0.35, HAND_Y, -0.95);
rightHand.rotation.x = -0.5;
playerHolder.add(rightHand);

// ============================================================
// Init / Recycle chunks
// ============================================================
function disposeChunk(chunk) {
  scene.remove(chunk.group);
  // 所有 geometry / material 都是共享的，直接移除 group 即可，不会泄漏
}

function initChunks() {
  for (const chunk of chunks) {
    disposeChunk(chunk);
  }
  chunks.length = 0;

  // Chunks extend in -Z direction (ahead of camera at z=0)
  let z = 0;
  for (let i = 0; i < VISIBLE_CHUNKS; i++) {
    const chunk = createChunk(z);
    chunks.push(chunk);
    z -= CHUNK_LENGTH;
  }
}

// 世界向玩家移动 dist 米（跑动 = 世界后移），菜单和游戏共用
function moveWorld(dist) {
  for (const chunk of chunks) {
    chunk.group.position.z += dist;
  }

  // Recycle chunks that passed the camera
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk.group.position.z > 5) {
      disposeChunk(chunk);
      chunks.splice(i, 1);
      // Find the furthest chunk (most negative z) and create new one beyond it
      let minZ = Infinity;
      for (const c of chunks) {
        if (c.group.position.z < minZ) minZ = c.group.position.z;
      }
      const newChunk = createChunk(minZ - CHUNK_LENGTH);
      chunks.push(newChunk);
    }
  }
}

// 金币旋转 + 上下浮动
function animateCoins(dt, time) {
  for (const chunk of chunks) {
    for (const coin of chunk.coins) {
      if (!coin.collected) {
        coin.mesh.rotation.z += dt * 4;
        coin.mesh.position.y = coin.y + Math.sin(time * 2.5 + coin.z) * 0.08;
      }
    }
  }
}

// 速度粒子向后飞，飞过相机就绕回远处
function animateParticles(dt, speed) {
  const pos = particleGeo.attributes.position;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let z = pos.getZ(i) + speed * dt * 1.5;
    if (z > 1) z -= 70;
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  // 速度越快粒子越亮，增强速度感
  particleMat.opacity = 0.2 + ((speed - START_SPEED) / (MAX_SPEED - START_SPEED)) * 0.55;
}

// ============================================================
// Game Logic
// ============================================================
function startGame() {
  state.phase = "running";
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
  state.jumpBuffer = 0;
  state.slideOnLand = false;
  state.cameraShake = 0;

  // Reset player position
  playerHolder.position.set(0, 0, 0);

  initChunks();
  startLayer.classList.add("hidden");
  gameoverLayer.classList.add("hidden");
  hitFlash.classList.remove("show");

  updateHUD();
}

// 撞击瞬间：镜头震动 + 红闪，稍后再弹出结算界面
function hitObstacle() {
  state.phase = "dying";
  state.cameraShake = 0.45;
  hitFlash.classList.add("show");
  setTimeout(showGameOver, 700);
}

function showGameOver() {
  state.phase = "over";
  hitFlash.classList.remove("show");

  finalDistance.textContent = Math.floor(state.distance) + "m";
  finalCoins.textContent = state.coins;
  finalScore.textContent = Math.floor(state.score);

  const score = Math.floor(state.score);
  if (score > state.best) {
    state.best = score;
    localStorage.setItem(BEST_SCORE_KEY, state.best);
    newRecordBadge.classList.remove("hidden");
  } else {
    newRecordBadge.classList.add("hidden");
  }
  bestScore.textContent = state.best;

  gameoverLayer.classList.remove("hidden");
}

function updatePlayer(dt) {
  // Speed increase
  state.speed = Math.min(MAX_SPEED, state.speed + SPEED_ACCEL * dt);
  state.distance += state.speed * dt;
  state.score += state.speed * dt * 0.5;

  moveWorld(state.speed * dt);

  // Lane movement (smooth lerp)
  const targetX = LANE_X[state.lane];
  const currentX = playerHolder.position.x;
  playerHolder.position.x += (targetX - currentX) * Math.min(1, LANE_LERP_SPEED * dt);

  // Jump buffer: 落地前一小段时间内按的跳跃，落地后立即执行
  if (state.jumpBuffer > 0) {
    state.jumpBuffer -= dt;
    if (!state.jumping && !state.sliding) {
      state.jumpBuffer = 0;
      doJump();
    }
  }

  // Jumping
  if (state.jumping) {
    state.playerVelY += GRAVITY * dt;
    state.playerY += state.playerVelY * dt;
    if (state.playerY <= 0) {
      state.playerY = 0;
      state.playerVelY = 0;
      state.jumping = false;
      // 空中按了下滑 -> 落地立刻滑铲
      if (state.slideOnLand) {
        state.slideOnLand = false;
        doSlide();
      }
    }
  }

  // Sliding
  if (state.sliding) {
    state.slideTimer -= dt;
    if (state.slideTimer <= 0) {
      state.sliding = false;
    }
  }

  playerHolder.position.y = state.playerY;

  // Camera follows player
  camera.position.x = playerHolder.position.x;
  camera.position.z = 0;

  // 滑铲时视角压低，其他时候平滑回到站立高度
  const targetCamY = (state.sliding ? CAMERA_SLIDE_HEIGHT : CAMERA_HEIGHT) + state.playerY;
  camera.position.y += (targetCamY - camera.position.y) * Math.min(1, 14 * dt);

  // 速度越快视野越广（FOV 变大），增强冲刺感
  const speedRatio = (state.speed - START_SPEED) / (MAX_SPEED - START_SPEED);
  camera.fov = BASE_FOV + speedRatio * 9;
  camera.updateProjectionMatrix();

  // Camera light follows player
  camLight.position.x = playerHolder.position.x;
  camLight.position.y = 2.5 + state.playerY;

  // Camera tilt during lane change
  const laneOffset = targetX - currentX;
  camera.rotation.z = -laneOffset * 0.05;

  // 滑铲时微微抬头，正常时回到默认角度
  const targetPitch = state.sliding ? 0.12 : -0.05;
  camera.rotation.x += (targetPitch - camera.rotation.x) * Math.min(1, 10 * dt);

  // Hands bob
  const bobTime = state.distance * 0.35;
  const bobAmount = state.jumping ? 0 : 0.09;
  leftHand.position.y = HAND_Y + Math.sin(bobTime) * bobAmount;
  rightHand.position.y = HAND_Y + Math.sin(bobTime + Math.PI) * bobAmount;

  if (state.sliding) {
    // 滑铲时双手前伸压低
    leftHand.position.y = CAMERA_SLIDE_HEIGHT - 0.6;
    rightHand.position.y = CAMERA_SLIDE_HEIGHT - 0.6;
    leftHand.rotation.x = -0.1;
    rightHand.rotation.x = -0.1;
  } else {
    leftHand.rotation.x = -0.5;
    rightHand.rotation.x = -0.5;
  }

  // Collisions & coin collection
  checkCollisions();
  collectCoins();

  updateHUD();
}

function checkCollisions() {
  const playerX = playerHolder.position.x;
  const playerZ = 0; // Player is always at world z=0
  const playerHeight = state.sliding ? PLAYER_SLIDE_HEIGHT : PLAYER_STAND_HEIGHT;
  const playerYBottom = state.playerY;
  const playerYTop = playerYBottom + playerHeight;

  for (const chunk of chunks) {
    for (const obs of chunk.obstacles) {
      // World z = local z (mesh.position.z) + group offset (chunk.group.position.z)
      const worldZ = obs.mesh.position.z + chunk.group.position.z;
      const dz = Math.abs(worldZ - playerZ);

      if (dz < obs.d / 2 + 0.4) {
        const obsX = obs.mesh.position.x;
        const dx = Math.abs(obsX - playerX);

        if (dx < obs.w / 2 + 0.35) {
          // 每种障碍物有自己的 y 轴碰撞区间
          if (playerYTop > obs.yBottom && playerYBottom < obs.yTop) {
            hitObstacle();
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
  const playerYCenter = state.playerY + COIN_Y;

  for (const chunk of chunks) {
    for (const coin of chunk.coins) {
      if (coin.collected) continue;

      // World z = local z + group offset
      const worldZ = coin.mesh.position.z + chunk.group.position.z;
      const dz = Math.abs(worldZ - playerZ);
      const dx = Math.abs(coin.mesh.position.x - playerX);
      const dy = Math.abs(coin.mesh.position.y - playerYCenter);

      if (dz < 1.0 && dx < 0.9 && dy < 1.1) {
        coin.collected = true;
        coin.mesh.visible = false;
        state.coins++;
        state.score += COIN_VALUE;
      }
    }
  }
}

function doJump() {
  state.jumping = true;
  state.sliding = false;
  state.playerVelY = JUMP_VELOCITY;
}

function doSlide() {
  state.sliding = true;
  state.slideTimer = SLIDE_DURATION;
}

function jump() {
  if (state.phase !== "running") return;
  if (state.jumping) {
    // 空中按跳：记入缓冲，落地立即起跳（操作更跟手）
    state.jumpBuffer = JUMP_BUFFER_TIME;
    return;
  }
  if (state.sliding) {
    // 滑铲中按跳：直接起跳打断滑铲
    state.sliding = false;
  }
  doJump();
}

function slide() {
  if (state.phase !== "running") return;
  if (state.jumping) {
    // 空中按下滑 -> 快速下坠，落地自动接滑铲
    state.playerVelY = Math.min(state.playerVelY, FAST_FALL_VELOCITY);
    state.slideOnLand = true;
    return;
  }
  if (state.sliding) return;
  doSlide();
}

function moveLeft() {
  if (state.phase !== "running") return;
  if (state.lane > 0) state.lane--;
}

function moveRight() {
  if (state.phase !== "running") return;
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
// 统一用 Pointer 事件：鼠标和触屏共用同一套滑动/点击逻辑
// - 滑动超过阈值立刻触发（不用等手指抬起，更跟手）
// - 快速点按 = 跳跃
// ============================================================
function setupInput() {
  // --- Keyboard ---
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
        if (state.phase === "menu" || state.phase === "over") {
          startGame();
        }
        break;
    }
  });

  // --- On-screen buttons (primary for iPad/touch) ---
  function bindBtn(el, action) {
    if (!el) return;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      action();
    });
    // 阻止后续合成 click 再触发一次
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  bindBtn(btnLeft, moveLeft);
  bindBtn(btnRight, moveRight);
  bindBtn(btnJump, jump);
  bindBtn(btnSlide, slide);

  // --- Swipe / tap（鼠标和触屏统一处理） ---
  const SWIPE_THRESHOLD = 26; // px，滑动判定距离
  const TAP_TIME = 300; // ms，快速点按判定
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let pointerActive = false;
  let swipeConsumed = false;

  touchZone.addEventListener("pointerdown", (e) => {
    startX = e.clientX;
    startY = e.clientY;
    startTime = performance.now();
    pointerActive = true;
    swipeConsumed = false;
  });

  touchZone.addEventListener("pointermove", (e) => {
    if (!pointerActive || swipeConsumed) return;
    if (state.phase !== "running") return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) return;

    // 滑动达到阈值 -> 立刻执行，不等抬起
    swipeConsumed = true;
    if (absX > absY) {
      if (dx > 0) moveRight();
      else moveLeft();
    } else {
      if (dy > 0) slide();
      else jump();
    }
  });

  touchZone.addEventListener("pointerup", (e) => {
    if (!pointerActive) return;
    pointerActive = false;
    if (swipeConsumed) return;
    if (state.phase !== "running") return;

    // 短促点按 = 跳跃
    if (performance.now() - startTime < TAP_TIME) {
      jump();
    }
  });

  touchZone.addEventListener("pointercancel", () => {
    pointerActive = false;
  });

  // --- Start / Restart buttons ---
  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);

  // Prevent iOS zoom / scroll gestures
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());
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
window.addEventListener("orientationchange", () => setTimeout(resize, 100));

// ============================================================
// Animation Loop
// ============================================================
let lastTime = performance.now();
let elapsed = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  elapsed += dt;

  if (state.phase === "running") {
    updatePlayer(dt);
    animateParticles(dt, state.speed);
  } else if (state.phase === "menu" || state.phase === "over") {
    // 开始/结算界面背后：场景慢速滚动，画面是活的
    moveWorld(MENU_SPEED * dt);
    animateParticles(dt, MENU_SPEED);
  }

  animateCoins(dt, elapsed);

  // Camera shake（撞击反馈）
  if (state.cameraShake > 0) {
    camera.position.x += (Math.random() - 0.5) * state.cameraShake;
    camera.position.y += (Math.random() - 0.5) * state.cameraShake;
    state.cameraShake = Math.max(0, state.cameraShake - dt * 1.2);
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

// 调试用：在控制台里可以直接查看游戏状态，例如 __game.state.speed
window.__game = { state, camera, chunks, startGame };
