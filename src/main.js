import * as THREE from "three";
import { APP_VERSION } from "./version.js?v=0.6.0";
import { QUESTIONS } from "./questions.js?v=0.6.0";

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

// 左右两侧的大按钮（蹲 / 跳）
const btnSlide = document.querySelector("#btnSlide");
const btnJump = document.querySelector("#btnJump");

// 复活答题界面
const quizLayer = document.querySelector("#quizLayer");
const quizProgress = document.querySelector("#quizProgress");
const quizSubject = document.querySelector("#quizSubject");
const quizDots = document.querySelector("#quizDots");
const quizQuestion = document.querySelector("#quizQuestion");
const quizAnswers = document.querySelector("#quizAnswers");
const quizFeedback = document.querySelector("#quizFeedback");

versionBadge.textContent = `v${APP_VERSION}`;

// ============================================================
// Scene / Camera / Renderer
// 白天的城市场景，第三人称视角（相机在小人身后上方）
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec9f0);
scene.fog = new THREE.Fog(0xbfd9ee, 50, 150);

const BASE_FOV = 68;
const CAMERA_HEIGHT = 3.0; // 相机在小人身后上方
const PLAYER_Z = -4.3; // 小人在相机前方 4.3 米处（所有碰撞都以这里为准）

const camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, CAMERA_HEIGHT, 0);
camera.rotation.order = "YXZ";
camera.rotation.x = -0.33;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// ============================================================
// Lighting（白天阳光）
// ============================================================
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x9a8f78, 1.15);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2dd, 2.0);
sun.position.set(10, 24, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -16;
sun.shadow.camera.right = 16;
sun.shadow.camera.top = 20;
sun.shadow.camera.bottom = -16;
sun.shadow.camera.near = 3;
sun.shadow.camera.far = 70;
sun.shadow.bias = -0.0008;
scene.add(sun);
scene.add(sun.target);

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
const VISIBLE_CHUNKS = 6;
const COIN_SPACING = 3.5;
const COIN_VALUE = 10;
const COIN_Y = 0.9; // 金币离脚下表面的高度
const BEST_SCORE_KEY = "subway-runner.best";

// 列车：可以从尾部的斜坡跑上车顶
const TRAIN_LEN = 13;
const ROOF_H = 2.6; // 车顶高度
const RAMP_LEN = 4.2; // 斜坡水平长度

// 玩家碰撞体：站立高 1.7 米，滑铲时只有 0.8 米
const PLAYER_STAND_HEIGHT = 1.7;
const PLAYER_SLIDE_HEIGHT = 0.8;

// ============================================================
// Game State
// phase: menu(开始界面) -> running(游戏中) -> dying(撞击瞬间) -> over(结算)
// playerY = 小人脚下离地面(y=0)的高度，站在车顶上时是 ROOF_H
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
  falling: false,
  sliding: false,
  slideTimer: 0,
  jumpBuffer: 0,
  slideOnLand: false,
  cameraShake: 0,
  invincible: 0, // 复活后的无敌剩余时间（秒）
  revivesUsed: 0,
  best: parseInt(localStorage.getItem(BEST_SCORE_KEY) || "0", 10),
};

bestScore.textContent = state.best;

// ============================================================
// Materials（全部共享，回收 chunk 时不会泄漏内存）
// ============================================================
// 铁轨路基
const ballastMat = new THREE.MeshStandardMaterial({ color: 0xb08a5e, roughness: 0.95 });
const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.85 });
const railMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.85, roughness: 0.3 });
const sideWallMat = new THREE.MeshStandardMaterial({ color: 0xcfd4da, roughness: 0.8 });
const sideGroundMat = new THREE.MeshStandardMaterial({ color: 0x9aa792, roughness: 0.95 });
const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, metalness: 0.4, roughness: 0.5 });

// 楼房（随机配色）
const BUILDING_COLORS = [0xc75b45, 0xd9a066, 0x8fb2c9, 0xb0654f, 0xd8c9a3, 0x7d9a6a];
const buildingMats = BUILDING_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
const buildingWinMat = new THREE.MeshStandardMaterial({ color: 0x33475e, roughness: 0.4, metalness: 0.3 });

// 列车配色（车身 + 车顶 + 前脸警示条）
const TRAIN_LIVERIES = [
  { body: 0xc9ced6, roof: 0xe8ebef }, // 银灰
  { body: 0x6fae72, roof: 0xdfe8df }, // 绿
  { body: 0xc94f42, roof: 0xeadfdd }, // 红
  { body: 0x4f7fc9, roof: 0xdde4ee }, // 蓝
];
const trainBodyMats = TRAIN_LIVERIES.map((l) => new THREE.MeshStandardMaterial({ color: l.body, metalness: 0.25, roughness: 0.45 }));
const trainRoofMats = TRAIN_LIVERIES.map((l) => new THREE.MeshStandardMaterial({ color: l.roof, metalness: 0.2, roughness: 0.5 }));
const trainGlassMat = new THREE.MeshStandardMaterial({ color: 0x263646, metalness: 0.5, roughness: 0.25 });
const trainUnderMat = new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.8 });
const trainLampMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 1.0 });
const trainWarnRedMat = new THREE.MeshStandardMaterial({ color: 0xd83a30, roughness: 0.5 });
const trainWarnWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
const rampMat = new THREE.MeshStandardMaterial({ color: 0xb5793f, roughness: 0.8 });
const rampStripeMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.8 });

// 金币和小障碍
const coinMat = new THREE.MeshStandardMaterial({
  color: 0xffd700,
  metalness: 0.9,
  roughness: 0.15,
  emissive: 0xffaa00,
  emissiveIntensity: 0.55,
});
const barrierMat = new THREE.MeshStandardMaterial({ color: 0xff5a2e, roughness: 0.5 });
const barrierStripeMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 });
const lowBarrierMat = new THREE.MeshStandardMaterial({ color: 0xffc61e, roughness: 0.45 });
const postMat = new THREE.MeshStandardMaterial({ color: 0x8890a8, metalness: 0.5, roughness: 0.4 });

// 小人的材质
const skinMat = new THREE.MeshStandardMaterial({ color: 0xffd6b3, roughness: 0.7 });
const hoodieMat = new THREE.MeshStandardMaterial({ color: 0x2e6fd8, roughness: 0.7 });
const jeansMat = new THREE.MeshStandardMaterial({ color: 0x3a5aa8, roughness: 0.75 });
const capMat = new THREE.MeshStandardMaterial({ color: 0xd83a30, roughness: 0.6 });
const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6 });
const packMat = new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.6 });

// ============================================================
// Geometries（同样全部共享）
// ============================================================
// 路基
const ballastGeo = new THREE.BoxGeometry(11, 0.25, CHUNK_LENGTH);
const sleeperGeo = new THREE.BoxGeometry(TRACK_WIDTH + 2.6, 0.1, 0.5);
const railGeo = new THREE.BoxGeometry(0.13, 0.14, CHUNK_LENGTH);
const sideWallGeo = new THREE.BoxGeometry(0.35, 1.0, CHUNK_LENGTH);
const sideGroundGeo = new THREE.BoxGeometry(14, 0.2, CHUNK_LENGTH);
const poleGeo = new THREE.BoxGeometry(0.16, 5.4, 0.16);
const crossbarGeo = new THREE.BoxGeometry(11.4, 0.12, 0.12);
const buildingWinGeo = new THREE.BoxGeometry(0.12, 1, 1); // 会按楼的大小缩放

// 列车
const trainBodyGeo = new THREE.BoxGeometry(2.0, 2.2, TRAIN_LEN);
const trainRoofGeo = new THREE.BoxGeometry(1.8, 0.25, TRAIN_LEN);
const trainUnderGeo = new THREE.BoxGeometry(1.6, 0.4, TRAIN_LEN * 0.88);
const trainGlassGeo = new THREE.BoxGeometry(1.6, 0.9, 0.12);
const trainSideWinGeo = new THREE.BoxGeometry(0.06, 0.6, TRAIN_LEN * 0.82);
const trainLampGeo = new THREE.BoxGeometry(0.28, 0.28, 0.1);
const trainWarnGeo = new THREE.BoxGeometry(1.9, 0.5, 0.1);
const trainWarnStripeGeo = new THREE.BoxGeometry(1.92, 0.16, 0.12);
const RAMP_SLOPE_LEN = Math.hypot(RAMP_LEN, ROOF_H) + 0.4;
const rampGeo = new THREE.BoxGeometry(1.7, 0.14, RAMP_SLOPE_LEN);
const rampStripeGeo = new THREE.BoxGeometry(1.72, 0.15, 0.35);

// 金币和小障碍
const coinGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.07, 24);
const barrierGeo = new THREE.BoxGeometry(1.8, 1.0, 0.3);
const barrierStripeGeo = new THREE.BoxGeometry(1.84, 0.22, 0.32);
const lowBeamGeo = new THREE.BoxGeometry(1.9, 0.55, 0.3);
const postGeo = new THREE.BoxGeometry(0.12, 1.75, 0.12);

// ============================================================
// Speed particles（速度感粒子）
// ============================================================
const PARTICLE_COUNT = 120;
const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  particlePositions[i * 3 + 0] = (Math.random() - 0.5) * 10;
  particlePositions[i * 3 + 1] = 0.3 + Math.random() * 4.5;
  particlePositions[i * 3 + 2] = -Math.random() * 70;
}
const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
const particleMat = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.05,
  transparent: true,
  opacity: 0.25,
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
// ============================================================
const chunks = [];

function createChunk(zStart) {
  const group = new THREE.Group();
  group.position.z = zStart;
  scene.add(group);

  const centerZ = -CHUNK_LENGTH / 2;

  // —— 铁轨路基 ——
  const ballast = new THREE.Mesh(ballastGeo, ballastMat);
  ballast.position.set(0, -0.125, centerZ);
  ballast.receiveShadow = true;
  group.add(ballast);

  // 枕木
  for (let i = 0; i < Math.floor(CHUNK_LENGTH / 1.2); i++) {
    const sleeper = new THREE.Mesh(sleeperGeo, sleeperMat);
    sleeper.position.set(0, 0.02, -(i * 1.2 + 0.6));
    sleeper.receiveShadow = true;
    group.add(sleeper);
  }

  // 三条车道各有一对铁轨
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(LANE_X[lane] + side * 0.7, 0.1, centerZ);
      rail.castShadow = true;
      group.add(rail);
    }
  }

  // —— 两侧环境 ——
  for (const side of [-1, 1]) {
    // 边上的草地/地面
    const sg = new THREE.Mesh(sideGroundGeo, sideGroundMat);
    sg.position.set(side * 12.5, -0.1, centerZ);
    sg.receiveShadow = true;
    group.add(sg);

    // 矮墙
    const wall = new THREE.Mesh(sideWallGeo, sideWallMat);
    wall.position.set(side * 5.8, 0.5, centerZ);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    // 电线杆 + 横梁
    for (const pz of [-7.5, -22.5]) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(side * 5.4, 2.7, pz);
      pole.castShadow = true;
      group.add(pole);
    }

    // 楼房（随机高度/颜色）
    for (const bz of [-7.5, -22.5]) {
      const h = 7 + Math.random() * 9;
      const mat = buildingMats[Math.floor(Math.random() * buildingMats.length)];
      const bGeo = new THREE.BoxGeometry(6, h, 8);
      const b = new THREE.Mesh(bGeo, mat);
      b.position.set(side * (10.8 + Math.random() * 2), h / 2 - 0.1, bz + (Math.random() - 0.5) * 3);
      b.castShadow = true;
      group.add(b);
      // 一整面深色窗户
      const win = new THREE.Mesh(buildingWinGeo, buildingWinMat);
      win.scale.set(1, h * 0.55, 5.6);
      win.position.set(b.position.x - side * 3.02, h * 0.45, b.position.z);
      group.add(win);
      // 楼的 geometry 不共享，回收时要释放
      group.userData.disposables = group.userData.disposables || [];
      group.userData.disposables.push(bGeo);
    }
  }

  // 横跨铁轨的电线横梁
  for (const pz of [-7.5, -22.5]) {
    const bar = new THREE.Mesh(crossbarGeo, poleMat);
    bar.position.set(0, 5.3, pz);
    group.add(bar);
  }

  // Obstacles & coins
  const obstacles = [];
  const coins = [];
  generateChunkContent(group, zStart, obstacles, coins);

  return { group, zStart, obstacles, coins };
}

function generateChunkContent(group, zStart, obstacles, coins) {
  // 最靠近玩家的第一段是安全区，只放金币
  if (zStart > -5) {
    for (let z = -5; z > -CHUNK_LENGTH; z -= COIN_SPACING) {
      const coin = createCoin(0, COIN_Y, z);
      group.add(coin.mesh);
      coins.push(coin);
    }
    return;
  }

  const sections = 3;
  const sectionLen = CHUNK_LENGTH / sections;

  let s = 0;
  while (s < sections) {
    const sectionZ = -(s * sectionLen + sectionLen / 2);
    const roll = Math.random();

    if (roll < 0.15 && s === 0) {
      // 列车车队：斜坡列车 + 后面一列，车顶之间有缺口要跳过去！
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const gap = 5;
      const t1 = createTrain(LANE_X[lane], -8, true);
      group.add(t1.mesh);
      obstacles.push(t1);
      const t2 = createTrain(LANE_X[lane], -8 - TRAIN_LEN - gap, false);
      group.add(t2.mesh);
      obstacles.push(t2);

      // 两节车顶上都有金币，缺口上方一道金币弧线
      for (let i = 0; i < 3; i++) {
        const c1 = createCoin(LANE_X[lane], ROOF_H + COIN_Y, -8 + TRAIN_LEN / 2 - 2.5 - i * 3.5);
        group.add(c1.mesh);
        coins.push(c1);
        const c2 = createCoin(LANE_X[lane], ROOF_H + COIN_Y, -8 - TRAIN_LEN - gap + TRAIN_LEN / 2 - 2 - i * 3.5);
        group.add(c2.mesh);
        coins.push(c2);
      }
      // 缺口上方的弧线（跳跃时正好吃到）
      const gapCenter = -8 - TRAIN_LEN / 2 - gap / 2;
      for (let i = 0; i < 3; i++) {
        const arcY = ROOF_H + COIN_Y + [0.3, 0.7, 0.3][i];
        const arc = createCoin(LANE_X[lane], arcY, gapCenter + (i - 1) * 1.8);
        group.add(arc.mesh);
        coins.push(arc);
      }
      s += 3; // 车队占满整段
      continue;
    }

    if (roll < 0.4 && s < 2) {
      // 列车（60% 概率带斜坡可以跑上车顶）
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const hasRamp = Math.random() < 0.6;
      const obstacle = createTrain(LANE_X[lane], sectionZ, hasRamp);
      group.add(obstacle.mesh);
      obstacles.push(obstacle);

      if (hasRamp) {
        // 车顶上放一排金币，奖励爬上来的玩家
        for (let i = 0; i < 4; i++) {
          const coinZ = sectionZ + TRAIN_LEN / 2 - 2 - i * 3;
          const coin = createCoin(LANE_X[lane], ROOF_H + COIN_Y, coinZ);
          group.add(coin.mesh);
          coins.push(coin);
        }
      } else {
        // 没斜坡的列车：金币放旁边的车道
        const coinLane = (lane + 1 + Math.floor(Math.random() * 2)) % LANE_COUNT;
        for (let i = 0; i < 3; i++) {
          const coin = createCoin(LANE_X[coinLane], COIN_Y, sectionZ + i * COIN_SPACING);
          group.add(coin.mesh);
          coins.push(coin);
        }
      }
      s += 2; // 列车很长，占掉下一段
      continue;
    }

    if (roll < 0.6) {
      // 路障 (jump over)
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const obstacle = createBarrier(LANE_X[lane], sectionZ);
      group.add(obstacle.mesh);
      obstacles.push(obstacle);

      const coinLane = (lane + 1 + Math.floor(Math.random() * 2)) % LANE_COUNT;
      for (let z = 0; z < 3; z++) {
        const coin = createCoin(LANE_X[coinLane], COIN_Y, sectionZ + z * COIN_SPACING);
        group.add(coin.mesh);
        coins.push(coin);
      }
    } else if (roll < 0.75) {
      // 悬空横梁 (slide under)
      const lane = Math.floor(Math.random() * LANE_COUNT);
      const obstacle = createLowBarrier(LANE_X[lane], sectionZ);
      group.add(obstacle.mesh);
      obstacles.push(obstacle);

      for (let z = 0; z < 3; z++) {
        const coin = createCoin(LANE_X[lane], COIN_Y, sectionZ + z * COIN_SPACING);
        group.add(coin.mesh);
        coins.push(coin);
      }
    } else {
      // 金币阵
      for (let lane = 0; lane < LANE_COUNT; lane++) {
        for (let z = 0; z < 2; z++) {
          const coin = createCoin(LANE_X[lane], COIN_Y, sectionZ + z * COIN_SPACING);
          group.add(coin.mesh);
          coins.push(coin);
        }
      }
    }
    s += 1;
  }
}

// ============================================================
// Obstacle Factory
// All positions are LOCAL coordinates within a chunk group.
//
// 碰撞规则（y 轴）:
//   barrier:  0 ~ 1.0    -> 跳过
//   low beam: 1.15~1.75  -> 只能滑铲
//   train:    0 ~ ROOF_H -> 有斜坡就跑上去, 没斜坡只能换道;
//                           站上车顶后是安全的, 跑过车头会掉下来
// ============================================================
function createBarrier(x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(barrierGeo, barrierMat);
  body.position.y = 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const stripe = new THREE.Mesh(barrierStripeGeo, barrierStripeMat);
  stripe.position.y = 0.72;
  g.add(stripe);
  g.position.set(x, 0, z);
  return { mesh: g, type: "barrier", w: 1.8, d: 0.3, yBottom: 0, yTop: 1.0 };
}

function createLowBarrier(x, z) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(lowBeamGeo, lowBarrierMat);
  beam.position.y = 1.45;
  beam.castShadow = true;
  g.add(beam);
  const postL = new THREE.Mesh(postGeo, postMat);
  postL.position.set(-0.89, 0.875, 0);
  g.add(postL);
  const postR = new THREE.Mesh(postGeo, postMat);
  postR.position.set(0.89, 0.875, 0);
  g.add(postR);
  g.position.set(x, 0, z);
  return { mesh: g, type: "low", w: 1.8, d: 0.3, yBottom: 1.15, yTop: 1.75 };
}

function createTrain(x, z, hasRamp) {
  const g = new THREE.Group();
  const livery = Math.floor(Math.random() * TRAIN_LIVERIES.length);

  // 车身
  const body = new THREE.Mesh(trainBodyGeo, trainBodyMats[livery]);
  body.position.y = 1.3;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // 车顶（浅色，顶面就是玩家跑的地方）
  const roofCap = new THREE.Mesh(trainRoofGeo, trainRoofMats[livery]);
  roofCap.position.y = 2.5;
  roofCap.receiveShadow = true;
  g.add(roofCap);

  // 底部转向架
  const under = new THREE.Mesh(trainUnderGeo, trainUnderMat);
  under.position.y = 0.2;
  g.add(under);

  // 车头（朝向玩家的一面）：挡风玻璃 + 大灯 + 红白警示条
  const front = TRAIN_LEN / 2 + 0.02;
  const glass = new THREE.Mesh(trainGlassGeo, trainGlassMat);
  glass.position.set(0, 1.85, front);
  g.add(glass);
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(trainLampGeo, trainLampMat);
    lamp.position.set(side * 0.6, 0.95, front);
    g.add(lamp);
  }
  const warn = new THREE.Mesh(trainWarnGeo, trainWarnRedMat);
  warn.position.set(0, 0.45, front);
  g.add(warn);
  const warnStripe = new THREE.Mesh(trainWarnStripeGeo, trainWarnWhiteMat);
  warnStripe.position.set(0, 0.45, front + 0.02);
  g.add(warnStripe);

  // 两侧车窗长条
  for (const side of [-1, 1]) {
    const win = new THREE.Mesh(trainSideWinGeo, trainGlassMat);
    win.position.set(side * 1.03, 1.7, 0);
    g.add(win);
  }

  // 斜坡（木板）搭在朝向玩家的一端：近端(+z)贴地，远端(-z)搭上车顶
  if (hasRamp) {
    const angle = Math.atan2(ROOF_H, RAMP_LEN);
    const ramp = new THREE.Mesh(rampGeo, rampMat);
    ramp.position.set(0, ROOF_H / 2 - 0.02, front + RAMP_LEN / 2);
    ramp.rotation.x = angle; // 正角度 = -z 那头翘起来搭在车顶
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    g.add(ramp);
    // 木板上的横条纹
    for (let i = 0; i < 3; i++) {
      const stripe = new THREE.Mesh(rampStripeGeo, rampStripeMat);
      stripe.position.set(0, ROOF_H / 2 - 0.02, front + RAMP_LEN / 2);
      stripe.rotation.x = angle;
      stripe.translateZ(-RAMP_SLOPE_LEN / 2 + 1.2 + i * 1.5);
      g.add(stripe);
    }
  }

  g.position.set(x, 0, z);
  return { mesh: g, type: "train", w: 2.0, d: TRAIN_LEN, hasRamp, yBottom: 0, yTop: ROOF_H };
}

function createCoin(x, y, z) {
  const mesh = new THREE.Mesh(coinGeo, coinMat);
  mesh.position.set(x, y, z);
  mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = false;
  return { mesh, x, y, z, collected: false };
}

// ============================================================
// Character（低多边形小人：棒球帽 + 连帽衫 + 黄书包）
// 挂在 playerHolder 上，面朝 -Z（奔跑方向），玩家看到的是背影
// ============================================================
const playerHolder = new THREE.Group();
playerHolder.position.set(0, 0, PLAYER_Z);
scene.add(playerHolder);

const charGroup = new THREE.Group();
playerHolder.add(charGroup);

function makePart(w, h, d, mat, x, y, z, translateY = 0) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (translateY !== 0) geo.translate(0, translateY, 0); // 移动旋转轴（比如让腿绕胯部转）
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

// 腿（旋转轴在胯部）+ 鞋
const legL = makePart(0.18, 0.75, 0.22, jeansMat, -0.14, 0.78, 0, -0.375);
const legR = makePart(0.18, 0.75, 0.22, jeansMat, 0.14, 0.78, 0, -0.375);
const shoeL = makePart(0.2, 0.14, 0.34, shoeMat, 0, -0.7, -0.05);
const shoeR = makePart(0.2, 0.14, 0.34, shoeMat, 0, -0.7, -0.05);
legL.add(shoeL);
legR.add(shoeR);
charGroup.add(legL, legR);

// 身体 + 书包
const torso = makePart(0.55, 0.62, 0.32, hoodieMat, 0, 1.09, 0);
charGroup.add(torso);
const pack = makePart(0.42, 0.46, 0.2, packMat, 0, 1.12, 0.27);
charGroup.add(pack);

// 手臂（旋转轴在肩膀）+ 手
const armL = makePart(0.15, 0.58, 0.18, hoodieMat, -0.37, 1.35, 0, -0.29);
const armR = makePart(0.15, 0.58, 0.18, hoodieMat, 0.37, 1.35, 0, -0.29);
const handL = makePart(0.15, 0.13, 0.18, skinMat, 0, -0.53, 0);
const handR = makePart(0.15, 0.13, 0.18, skinMat, 0, -0.53, 0);
armL.add(handL);
armR.add(handR);
charGroup.add(armL, armR);

// 头 + 棒球帽（帽檐朝前）
const head = makePart(0.44, 0.42, 0.44, skinMat, 0, 1.62, 0);
charGroup.add(head);
const cap = makePart(0.48, 0.13, 0.48, capMat, 0, 1.87, 0);
const brim = makePart(0.44, 0.05, 0.24, capMat, 0, 1.82, -0.33);
charGroup.add(cap, brim);

// 小人的跑步/跳跃/滑铲动画
function animateCharacter(runT) {
  if (state.sliding) {
    // 滑铲：整个人向后仰，腿伸直往前
    charGroup.rotation.x = 1.15;
    charGroup.position.y = 0.35;
    charGroup.position.z = 0.3;
    legL.rotation.x = -0.15;
    legR.rotation.x = 0.15;
    armL.rotation.x = -2.6;
    armR.rotation.x = -2.6;
    return;
  }
  charGroup.rotation.x = 0;
  charGroup.position.z = 0;

  if (state.jumping || state.falling) {
    // 空中：前腿抬起后腿蹬直，手臂上摆
    charGroup.position.y = 0;
    legL.rotation.x = -1.1;
    legR.rotation.x = 0.5;
    armL.rotation.x = 0.6;
    armR.rotation.x = -2.4;
    return;
  }

  // 跑步循环：腿和手臂交替摆动
  const swing = Math.sin(runT);
  legL.rotation.x = swing * 1.0;
  legR.rotation.x = -swing * 1.0;
  armL.rotation.x = -swing * 0.85;
  armR.rotation.x = swing * 0.85;
  charGroup.position.y = Math.abs(Math.cos(runT)) * 0.07; // 跑步的上下颠动
}

// ============================================================
// Init / Recycle chunks
// ============================================================
function disposeChunk(chunk) {
  scene.remove(chunk.group);
  // 楼房的 geometry 是每栋随机的，需要手动释放
  const disposables = chunk.group.userData.disposables;
  if (disposables) for (const geo of disposables) geo.dispose();
}

function initChunks() {
  for (const chunk of chunks) {
    disposeChunk(chunk);
  }
  chunks.length = 0;

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

  // 注意: group.position.z 是这段场景的【近端】，远端在 z - CHUNK_LENGTH。
  // 必须等整段都跑到身后才回收，否则眼前的场景会突然消失。
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    if (chunk.group.position.z - CHUNK_LENGTH > 5) {
      disposeChunk(chunk);
      chunks.splice(i, 1);
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

// 速度粒子向后飞
function animateParticles(dt, speed) {
  const pos = particleGeo.attributes.position;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let z = pos.getZ(i) + speed * dt * 1.5;
    if (z > 1) z -= 70;
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  particleMat.opacity = 0.1 + ((speed - START_SPEED) / (MAX_SPEED - START_SPEED)) * 0.35;
}

// ============================================================
// 地面高度：玩家脚下是铁轨(0)还是车顶(ROOF_H)？
// 斜坡区域内高度线性上升，跑上去就自然爬升
// ============================================================
function surfaceHeightAt(px) {
  let h = 0;
  for (const chunk of chunks) {
    for (const obs of chunk.obstacles) {
      if (obs.type !== "train") continue;
      if (Math.abs(obs.mesh.position.x - px) > obs.w / 2 + 0.3) continue;

      const zNear = obs.mesh.position.z + chunk.group.position.z + obs.d / 2;
      const zFar = zNear - obs.d;

      if (PLAYER_Z <= zNear && PLAYER_Z >= zFar) {
        h = Math.max(h, ROOF_H); // 站在车顶上
      } else if (obs.hasRamp && PLAYER_Z > zNear && PLAYER_Z <= zNear + RAMP_LEN) {
        const t = 1 - (PLAYER_Z - zNear) / RAMP_LEN; // 0=坡底 1=坡顶
        h = Math.max(h, ROOF_H * t);
      }
    }
  }
  return h;
}

// ============================================================
// 音效（WebAudio 现场合成，不需要任何素材文件）
// 每个音 = 频率从 freq 滑向 freq2 + 音量渐弱的小包络
// ============================================================
let audioCtx = null;

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function tone(freq, freq2, dur, type, vol, delay = 0) {
  if (!audioCtx || audioCtx.state !== "running") return;
  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const sfx = {
  coin() {
    tone(1568, 1568, 0.07, "square", 0.07);
    tone(2093, 2093, 0.09, "square", 0.06, 0.06); // 叮-叮 两声
  },
  jump() {
    tone(280, 620, 0.2, "sine", 0.18); // 往上滑的"嗖"
  },
  slide() {
    tone(500, 180, 0.18, "sawtooth", 0.09); // 往下擦的"唰"
  },
  land() {
    tone(150, 90, 0.08, "sine", 0.12); // 落地"咚"
  },
  crash() {
    tone(220, 45, 0.45, "sawtooth", 0.28);
    tone(160, 40, 0.5, "square", 0.18, 0.03); // 低沉的撞击声
  },
};

// ============================================================
// Game Logic
// ============================================================
function startGame() {
  ensureAudio(); // 必须在用户点击里初始化，否则 iOS 不出声
  requestGyro(); // 同理，陀螺仪权限也要在用户手势里申请
  gyroNeutral = null; // 重新校准"水平"角度（这一刻怎么拿就是水平）
  state.phase = "running";
  state.speed = START_SPEED;
  state.distance = 0;
  state.coins = 0;
  state.score = 0;
  state.lane = 1;
  state.playerY = 0;
  state.playerVelY = 0;
  state.jumping = false;
  state.falling = false;
  state.sliding = false;
  state.slideTimer = 0;
  state.jumpBuffer = 0;
  state.slideOnLand = false;
  state.cameraShake = 0;
  state.invincible = 0;
  state.revivesUsed = 0;

  playerHolder.position.set(0, 0, PLAYER_Z);

  initChunks();
  startLayer.classList.add("hidden");
  gameoverLayer.classList.add("hidden");
  quizLayer.classList.add("hidden");
  hitFlash.classList.remove("show");

  updateHUD();
}

// 撞击瞬间：镜头震动 + 红闪，稍后进入答题复活环节
function hitObstacle() {
  if (state.invincible > 0) return; // 复活后的短暂无敌
  state.phase = "dying";
  state.cameraShake = 0.45;
  sfx.crash();
  hitFlash.classList.add("show");
  setTimeout(showQuizOffer, 700);
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

// ============================================================
// 复活答题：答对 5 题中的 3 题就能原地复活
// 题库在 src/questions.js（上海小学三年级 语文/数学/英语）
// ============================================================
const QUIZ_TOTAL = 5;
const QUIZ_PASS = 3;
let quiz = null; // { list, idx, correct, wrong }
const usedQuestions = new Set(); // 本次打开游戏已出过的题，尽量不重复

function showQuizOffer() {
  state.phase = "quiz";
  hitFlash.classList.remove("show");
  quizProgress.textContent = "📚 答题复活";
  quizSubject.textContent = "";
  quizDots.textContent = "";
  quizQuestion.innerHTML = `答对 <b>${QUIZ_TOTAL}</b> 题中的 <b>${QUIZ_PASS}</b> 题，就能原地复活继续跑！`;
  quizFeedback.textContent = "";
  quizFeedback.className = "quiz-feedback";
  quizAnswers.innerHTML = "";

  const btnGo = document.createElement("button");
  btnGo.className = "quiz-btn quiz-btn-primary";
  btnGo.textContent = "开始答题";
  btnGo.addEventListener("click", startQuiz);
  const btnNo = document.createElement("button");
  btnNo.className = "quiz-btn";
  btnNo.textContent = "结束本局";
  btnNo.addEventListener("click", () => {
    quizLayer.classList.add("hidden");
    showGameOver();
  });
  quizAnswers.append(btnGo, btnNo);
  quizLayer.classList.remove("hidden");
}

// 随机抽 5 题，优先抽没出过的
function pickQuestions() {
  let poolIdx = QUESTIONS.map((_, i) => i).filter((i) => !usedQuestions.has(i));
  if (poolIdx.length < QUIZ_TOTAL) {
    usedQuestions.clear(); // 题都出过一轮了，重新开始
    poolIdx = QUESTIONS.map((_, i) => i);
  }
  const picked = [];
  while (picked.length < QUIZ_TOTAL) {
    const k = Math.floor(Math.random() * poolIdx.length);
    const qi = poolIdx.splice(k, 1)[0];
    usedQuestions.add(qi);
    picked.push(QUESTIONS[qi]);
  }
  return picked;
}

function startQuiz() {
  quiz = { list: pickQuestions(), idx: 0, correct: 0, wrong: 0 };
  renderQuestion();
}

function renderDots() {
  let dots = "";
  for (let i = 0; i < QUIZ_TOTAL; i++) {
    if (i < quiz.answers?.length) dots += quiz.answers[i] ? "🟢" : "🔴";
    else dots += "⚪";
  }
  quizDots.textContent = dots;
}

function renderQuestion() {
  const q = quiz.list[quiz.idx];
  quizProgress.textContent = `第 ${quiz.idx + 1} / ${QUIZ_TOTAL} 题`;
  quizSubject.textContent = q.sub;
  renderDots();
  quizQuestion.textContent = q.q;
  quizFeedback.textContent = "";
  quizFeedback.className = "quiz-feedback";
  quizAnswers.innerHTML = "";

  if (q.type === "choice") {
    const labels = ["A", "B", "C", "D"];
    q.options.forEach((opt, i) => {
      const btn = document.createElement("button");
      btn.className = "quiz-btn quiz-option";
      btn.textContent = `${labels[i]}. ${opt}`;
      btn.addEventListener("click", () => submitAnswer(i === q.answer, `${labels[q.answer]}. ${q.options[q.answer]}`));
      quizAnswers.appendChild(btn);
    });
  } else if (q.type === "judge") {
    for (const val of [true, false]) {
      const btn = document.createElement("button");
      btn.className = "quiz-btn quiz-option quiz-judge";
      btn.textContent = val ? "✓ 对" : "✗ 错";
      btn.addEventListener("click", () => submitAnswer(val === q.answer, q.answer ? "对" : "错"));
      quizAnswers.appendChild(btn);
    }
  } else {
    // 填空题
    const input = document.createElement("input");
    input.className = "quiz-input";
    input.placeholder = "在这里输入答案";
    input.autocomplete = "off";
    const btn = document.createElement("button");
    btn.className = "quiz-btn quiz-btn-primary";
    btn.textContent = "确定";
    const doSubmit = () => {
      const v = normalizeAnswer(input.value);
      if (!v) return;
      const ok = q.answer.some((a) => normalizeAnswer(a) === v);
      submitAnswer(ok, q.answer[0]);
    };
    btn.addEventListener("click", doSubmit);
    input.addEventListener("keydown", (e) => {
      e.stopPropagation(); // 别让全局按键处理抢走输入
      if (e.key === "Enter") doSubmit();
    });
    quizAnswers.append(input, btn);
    setTimeout(() => input.focus(), 50);
  }
}

function normalizeAnswer(s) {
  return String(s).trim().toLowerCase().replace(/\s+/g, "");
}

function submitAnswer(ok, correctText) {
  if (!quiz.answers) quiz.answers = [];
  quiz.answers.push(ok);
  if (ok) {
    quiz.correct++;
    quizFeedback.textContent = "✓ 答对啦！";
    quizFeedback.className = "quiz-feedback ok";
    sfx.coin();
  } else {
    quiz.wrong++;
    quizFeedback.textContent = `✗ 正确答案：${correctText}`;
    quizFeedback.className = "quiz-feedback bad";
    tone(200, 120, 0.25, "square", 0.12);
  }
  renderDots();
  for (const el of quizAnswers.querySelectorAll("button, input")) el.disabled = true;

  setTimeout(() => {
    if (quiz.correct >= QUIZ_PASS) return finishQuiz(true); // 提前达标
    if (quiz.wrong > QUIZ_TOTAL - QUIZ_PASS) return finishQuiz(false); // 已经不可能达标
    quiz.idx++;
    renderQuestion();
  }, ok ? 900 : 2000);
}

function finishQuiz(pass) {
  quizProgress.textContent = pass ? "🎉 通过！" : "😢 没通过";
  quizSubject.textContent = "";
  quizQuestion.textContent = pass
    ? `答对 ${quiz.correct} 题，复活成功，继续跑！`
    : `答对 ${quiz.correct} 题，差一点点，下次加油！`;
  quizAnswers.innerHTML = "";
  quizFeedback.textContent = "";
  quizFeedback.className = "quiz-feedback";
  if (pass) sfx.jump();

  setTimeout(() => {
    quizLayer.classList.add("hidden");
    if (pass) revive();
    else showGameOver();
  }, 1400);
}

function revive() {
  clearObstaclesAhead(35); // 面前的障碍全部清掉，不能复活即死
  state.speed = Math.max(START_SPEED, state.speed * 0.6); // 降点速，缓一缓
  state.invincible = 2.5; // 短暂无敌（小人闪烁）
  state.revivesUsed++;
  state.playerY = 0;
  state.playerVelY = 0;
  state.jumping = false;
  state.falling = false;
  state.sliding = false;
  state.jumpBuffer = 0;
  state.slideOnLand = false;
  hitFlash.classList.remove("show");
  state.phase = "running";
}

function clearObstaclesAhead(dist) {
  for (const chunk of chunks) {
    for (let i = chunk.obstacles.length - 1; i >= 0; i--) {
      const obs = chunk.obstacles[i];
      const worldZ = obs.mesh.position.z + chunk.group.position.z;
      const zNear = worldZ + obs.d / 2;
      const zFar = worldZ - obs.d / 2;
      if (zNear > PLAYER_Z - dist && zFar < PLAYER_Z + 8) {
        chunk.group.remove(obs.mesh);
        chunk.obstacles.splice(i, 1);
      }
    }
  }
}

function updatePlayer(dt) {
  // Speed increase
  state.speed = Math.min(MAX_SPEED, state.speed + SPEED_ACCEL * dt);
  state.distance += state.speed * dt;
  state.score += state.speed * dt * 0.5;

  moveWorld(state.speed * dt);

  // 复活后的无敌时间：倒计时 + 小人闪烁
  if (state.invincible > 0) {
    state.invincible -= dt;
    charGroup.visible = Math.floor(performance.now() / 120) % 2 === 0;
    if (state.invincible <= 0) charGroup.visible = true;
  }

  // 陀螺仪：按当前倾斜角选车道
  applyGyroLane();

  // Lane movement (smooth lerp)
  const targetX = LANE_X[state.lane];
  const currentX = playerHolder.position.x;
  playerHolder.position.x += (targetX - currentX) * Math.min(1, LANE_LERP_SPEED * dt);

  // 脚下表面高度（铁轨 0 / 斜坡渐变 / 车顶 ROOF_H）
  const surface = surfaceHeightAt(playerHolder.position.x);

  // Jump buffer: 落地前一小段时间内按的跳跃，落地后立即执行
  if (state.jumpBuffer > 0) {
    state.jumpBuffer -= dt;
    if (!state.jumping && !state.falling && !state.sliding) {
      state.jumpBuffer = 0;
      doJump();
    }
  }

  // —— 垂直方向物理 ——
  if (state.jumping) {
    state.playerVelY += GRAVITY * dt;
    state.playerY += state.playerVelY * dt;
    if (state.playerY <= surface && state.playerVelY <= 0) {
      state.playerY = surface;
      state.playerVelY = 0;
      state.jumping = false;
      sfx.land();
      if (state.slideOnLand) {
        state.slideOnLand = false;
        doSlide();
      }
    }
  } else if (state.playerY > surface + 0.02) {
    // 脚下悬空（跑过车头/换道离开车顶）-> 掉下去
    state.falling = true;
    state.playerVelY += GRAVITY * dt;
    state.playerY += state.playerVelY * dt;
    if (state.playerY <= surface) {
      state.playerY = surface;
      state.playerVelY = 0;
      state.falling = false;
      sfx.land();
    }
  } else {
    // 表面一帧内突然抬升太多 = 一堵墙怼在脸上（高速时防止穿过车头判定）。
    // 阈值要大于斜坡的最大合法爬升（满速+低帧率时一帧约 0.93m），否则会误判
    if (surface > state.playerY + 1.2) {
      if (state.invincible <= 0) {
        hitObstacle();
        return;
      }
      // 无敌期间直接弹上表面，不判撞
    }
    // 贴着表面跑（斜坡上表面在升高，跟着爬上去）
    state.playerY = surface;
    state.playerVelY = 0;
    state.falling = false;
  }

  // Sliding
  if (state.sliding) {
    state.slideTimer -= dt;
    if (state.slideTimer <= 0) {
      state.sliding = false;
    }
  }

  playerHolder.position.y = state.playerY;

  // —— 第三人称相机跟随 ——
  camera.position.x = playerHolder.position.x * 0.72;
  const targetCamY = CAMERA_HEIGHT + state.playerY * 0.8;
  camera.position.y += (targetCamY - camera.position.y) * Math.min(1, 8 * dt);
  camera.position.z = 0;

  // 速度越快视野越广，增强冲刺感
  const speedRatio = (state.speed - START_SPEED) / (MAX_SPEED - START_SPEED);
  camera.fov = BASE_FOV + speedRatio * 8;
  camera.updateProjectionMatrix();

  // 阳光跟着玩家（保证影子一直在身边渲染）
  sun.position.set(playerHolder.position.x + 10, 24, 8);
  sun.target.position.set(playerHolder.position.x, 0, PLAYER_Z);

  // Camera tilt during lane change
  const laneOffset = targetX - currentX;
  camera.rotation.z = -laneOffset * 0.04;
  camera.rotation.x = -0.33;

  // 小人朝换道方向微微倾斜
  charGroup.rotation.z = laneOffset * 0.12;

  // 小人动画
  animateCharacter(state.distance * 0.6);

  // Collisions & coin collection
  checkCollisions();
  collectCoins();

  updateHUD();
}

function checkCollisions() {
  const playerX = playerHolder.position.x;
  const playerHeight = state.sliding ? PLAYER_SLIDE_HEIGHT : PLAYER_STAND_HEIGHT;
  const playerYBottom = state.playerY;
  const playerYTop = playerYBottom + playerHeight;

  for (const chunk of chunks) {
    for (const obs of chunk.obstacles) {
      const obsX = obs.mesh.position.x;
      const dx = Math.abs(obsX - playerX);
      if (dx >= obs.w / 2 + 0.3) continue;

      const worldZ = obs.mesh.position.z + chunk.group.position.z;

      if (obs.type === "train") {
        // 撞车头/车侧：人在车顶以下且和车身重叠
        const zNear = worldZ + obs.d / 2;
        const zFar = worldZ - obs.d / 2;
        if (PLAYER_Z < zNear + 0.3 && PLAYER_Z > zFar - 0.3 && playerYBottom < ROOF_H - 0.4) {
          hitObstacle();
          return;
        }
      } else {
        const dz = Math.abs(worldZ - PLAYER_Z);
        if (dz < obs.d / 2 + 0.4) {
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
  const playerYCenter = state.playerY + COIN_Y;

  for (const chunk of chunks) {
    for (const coin of chunk.coins) {
      if (coin.collected) continue;

      const worldZ = coin.mesh.position.z + chunk.group.position.z;
      const dz = Math.abs(worldZ - PLAYER_Z);
      const dx = Math.abs(coin.mesh.position.x - playerX);
      const dy = Math.abs(coin.mesh.position.y - playerYCenter);

      if (dz < 1.0 && dx < 0.9 && dy < 1.1) {
        coin.collected = true;
        coin.mesh.visible = false;
        state.coins++;
        state.score += COIN_VALUE;
        sfx.coin();
      }
    }
  }
}

function doJump() {
  state.jumping = true;
  state.falling = false;
  state.sliding = false;
  state.playerVelY = JUMP_VELOCITY;
  sfx.jump();
}

function doSlide() {
  state.sliding = true;
  state.slideTimer = SLIDE_DURATION;
  sfx.slide();
}

function jump() {
  if (state.phase !== "running") return;
  if (state.jumping || state.falling) {
    state.jumpBuffer = JUMP_BUFFER_TIME;
    return;
  }
  if (state.sliding) {
    state.sliding = false;
  }
  doJump();
}

function slide() {
  if (state.phase !== "running") return;
  if (state.jumping || state.falling) {
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
// 陀螺仪换道（iPad 左右倾斜）
//
// 把 iPad 当方向盘：向左倾斜 = 左车道，放平 = 中间，向右 = 右车道。
// 开始游戏那一刻的角度会被记为"水平"（校准），所以怎么舒服怎么拿。
// 带回滞：进入侧车道要倾斜 >12°，回中间只要 <7°，避免在边界抖动。
// ============================================================
const TILT_ENTER = 12; // 倾斜超过这个角度 -> 进侧车道
const TILT_EXIT = 7; // 回正到这个角度以内 -> 回中间车道
let gyroActive = false; // 是否收到过有效的陀螺仪数据
let gyroPermissionAsked = false;
let gyroRoll = 0; // 当前左右倾斜角（度）
let gyroNeutral = null; // 校准的"水平"角度，null = 等待下一个事件时校准

function onDeviceOrientation(e) {
  if (e.beta === null || e.gamma === null) return;
  // 屏幕方向不同，"左右倾斜"对应的轴不同
  const angle = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
  let roll;
  if (angle === 90) roll = e.beta;
  else if (angle === -90 || angle === 270) roll = -e.beta;
  else if (angle === 180) roll = -e.gamma;
  else roll = e.gamma;

  gyroActive = true;
  gyroRoll = roll;
  if (gyroNeutral === null) gyroNeutral = roll; // 校准
}

async function requestGyro() {
  if (gyroPermissionAsked) return;
  gyroPermissionAsked = true;
  try {
    // iOS 13+ 必须在用户手势里申请权限
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== "granted") return;
    }
    window.addEventListener("deviceorientation", onDeviceOrientation);
  } catch {
    // 不支持就算了，还有滑动/按键/按钮
  }
}

// 每帧根据倾斜角选车道（在 updatePlayer 里调用）
function applyGyroLane() {
  if (!gyroActive || gyroNeutral === null) return;
  const rel = gyroRoll - gyroNeutral;
  if (state.lane !== 0 && rel < -TILT_ENTER) state.lane = 0;
  else if (state.lane !== 2 && rel > TILT_ENTER) state.lane = 2;
  else if (state.lane !== 1 && Math.abs(rel) < TILT_EXIT) state.lane = 1;
}

// ============================================================
// Input
// 统一用 Pointer 事件：鼠标和触屏共用同一套滑动/点击逻辑
// ============================================================
function setupInput() {
  // --- Keyboard ---
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (state.phase === "quiz") return; // 答题时不拦截键盘（填空要打字）
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

  // --- 左右两侧大按钮：左手拇指 = 蹲，右手拇指 = 跳 ---
  function bindBtn(el, action) {
    if (!el) return;
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      action();
    });
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }
  bindBtn(btnSlide, slide);
  bindBtn(btnJump, jump);

  // --- Swipe / tap（鼠标和触屏统一处理） ---
  const SWIPE_THRESHOLD = 26;
  const TAP_TIME = 300;
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
    // 开始/结算界面背后：场景慢速滚动，小人原地小跑
    moveWorld(MENU_SPEED * dt);
    animateParticles(dt, MENU_SPEED);
    animateCharacter(elapsed * 7);
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
window.__game = { state, camera, chunks, startGame, charGroup };
