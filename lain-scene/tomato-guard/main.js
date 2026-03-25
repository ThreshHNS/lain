const params = new URLSearchParams(window.location.search);
const ATTACK_CODES = new Set(['Space', 'Enter', 'NumpadEnter']);
const MOVE_CODES = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
const embeddedScene = params.get('embedded') === '1';
const previewScene = params.get('preview') === '1';
const staticScene = params.get('still') === '1';
const touchScene =
  embeddedScene ||
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
  'ontouchstart' in window;
const DEFAULT_TOMATO_GUARD_MUSIC_FILE = '$uicideboy$ - 1000 Blunts.mp3';

function resolveSharedAudioUrl(fileName) {
  return new URL(`../assets/audio/${encodeURIComponent(fileName)}`, window.location.href).toString();
}

function createToneObjectUrl(frequency) {
  const sampleRate = 22050;
  const durationSeconds = 1.2;
  const samples = Math.floor(sampleRate * durationSeconds);
  const pcm = new Int16Array(samples);

  for (let index = 0; index < samples; index += 1) {
    const envelope = Math.min(index / 1000, (samples - index) / 1000, 1);
    const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate);
    pcm[index] = sample * envelope * 0x2fff;
  }

  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcm.length * 2, true);

  for (let index = 0; index < pcm.length; index += 1) {
    view.setInt16(44 + index * 2, pcm[index], true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

const body = document.body;
const canvas = document.getElementById('renderCanvas');
const hudEl = document.getElementById('hud');
const legendEl = document.getElementById('legend');
const damageEl = document.getElementById('damage');
const reggaeEl = document.getElementById('reggae');
const stolenBannerEl = document.getElementById('stolenBanner');
const bgm = document.getElementById('bgm');

body.dataset.embedded = String(embeddedScene);
body.dataset.preview = String(previewScene);
body.dataset.touch = String(touchScene);

if (touchScene) {
  legendEl.innerHTML = 'DRAG MOVE<br>TAP ATTACK<br>HOLD BLOCK';
}

let assetState = 'booting';
let audioState = 'idle';
let audioUnlockCount = 0;
let frameP95 = 0;
let lastAction = 'boot';
let lastPostedPayload = '';
const frameSamples = [];

function snapshotState() {
  return {
    assetState,
    audioState,
    audioUnlockCount,
    enemyCount: horrors.length,
    frameP95,
    kills: stopped,
    lastAction,
    mode: 'tomato-guard',
    playerHp: guardHP,
    staticScene,
    targetState: horrors.length > 0 ? 'alive' : 'missing',
  };
}

function syncDebugState() {
  body.dataset.assetState = assetState;
  body.dataset.audioState = audioState;
  body.dataset.embedded = String(embeddedScene);
  body.dataset.frameP95 = String(frameP95);
  body.dataset.kills = String(stopped);
  body.dataset.lastAction = lastAction;
  body.dataset.mode = 'tomato-guard';
  body.dataset.playerHp = String(guardHP);
  body.dataset.preview = String(previewScene);
  body.dataset.staticScene = String(staticScene);
  body.dataset.targetState = horrors.length > 0 ? 'alive' : 'missing';

  if (window.ReactNativeWebView?.postMessage) {
    const payload = JSON.stringify({ state: snapshotState(), type: 'scene-state' });
    if (payload !== lastPostedPayload) {
      lastPostedPayload = payload;
      window.ReactNativeWebView.postMessage(payload);
    }
  }
}

function setAssetState(next) {
  assetState = next;
  syncDebugState();
}

function recordFrame(deltaMs) {
  frameSamples.push(deltaMs);
  if (frameSamples.length > 120) {
    frameSamples.shift();
  }

  if (frameSamples.length < 20) {
    return;
  }

  const sorted = frameSamples.slice().sort((left, right) => left - right);
  frameP95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

bgm.loop = true;
bgm.volume = 0.18;
bgm.src = params.get('tomatoGuardMusic') || resolveSharedAudioUrl(DEFAULT_TOMATO_GUARD_MUSIC_FILE);
bgm.addEventListener('canplaythrough', () => {
  audioState = 'ready';
  syncDebugState();
});
bgm.addEventListener('play', () => {
  audioState = 'playing';
  syncDebugState();
});
bgm.addEventListener('pause', () => {
  if (audioState !== 'error') {
    audioState = 'paused';
    syncDebugState();
  }
});
bgm.addEventListener('error', () => {
  audioState = 'error';
  lastAction = 'audio-error';
  syncDebugState();
});

function unlockAudio() {
  audioUnlockCount += 1;
  if (!bgm.paused) {
    syncDebugState();
    return;
  }

  bgm.play().catch(() => {
    audioState = 'blocked';
    syncDebugState();
  });
  syncDebugState();
}

document.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('keydown', event => {
  if (ATTACK_CODES.has(event.code) || MOVE_CODES.has(event.code) || event.code.startsWith('Shift')) {
    unlockAudio();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    bgm.pause();
  }
});

const engine = new BABYLON.Engine(canvas, false, {
  antialias: false,
  adaptToDeviceRatio: true,
  preserveDrawingBuffer: true,
  stencil: true,
});
engine.setHardwareScalingLevel(4);

const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(1, 1, 1, 1);
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
scene.fogDensity = 0.032;
scene.fogColor = new BABYLON.Color3(1, 1, 1);
scene.ambientColor = new BABYLON.Color3(0.21, 0.215, 0.22);

const playerRoot = new BABYLON.TransformNode('player-root', scene);
playerRoot.position.set(8.8, 0, 0);

const cameraOffset = new BABYLON.Vector3(0, 15.5, -16.5);
const cameraTarget = new BABYLON.Vector3(8.8, 1.1, 0);
const camera = new BABYLON.FreeCamera('camera', playerRoot.position.add(cameraOffset), scene);
camera.setTarget(cameraTarget);
camera.minZ = 0.1;
camera.maxZ = 60;

const moon = new BABYLON.HemisphericLight('moon', new BABYLON.Vector3(0.1, 1, -0.2), scene);
moon.intensity = 0.54;
moon.diffuse = new BABYLON.Color3(0.92, 0.94, 0.96);
moon.groundColor = new BABYLON.Color3(0.15, 0.15, 0.16);

const backGlow = new BABYLON.PointLight('backGlow', new BABYLON.Vector3(-15, 4, 0), scene);
backGlow.intensity = 0.58;
backGlow.diffuse = new BABYLON.Color3(0.84, 0.9, 0.96);
backGlow.range = 20;

const guardLamp = new BABYLON.PointLight('guardLamp', new BABYLON.Vector3(8.8, 2.4, 0), scene);
guardLamp.intensity = 1.82;
guardLamp.diffuse = new BABYLON.Color3(1, 0.94, 0.87);
guardLamp.range = 16;

const pipeline = new BABYLON.DefaultRenderingPipeline('pipeline', false, scene, [camera]);
pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.42;
pipeline.bloomWeight = 0.32;
pipeline.bloomKernel = 18;
pipeline.bloomScale = 0.45;
pipeline.chromaticAberrationEnabled = true;
pipeline.chromaticAberration.aberrationAmount = 1.1;
pipeline.grainEnabled = true;
pipeline.grain.intensity = 10;
pipeline.grain.animated = true;

function c(r, g, b) {
  return new BABYLON.Color3(r, g, b);
}

function mat(name, rgb, emissive) {
  const material = new BABYLON.StandardMaterial(name, scene);
  material.diffuseColor = c(rgb[0], rgb[1], rgb[2]);
  material.specularColor = c(0.03, 0.03, 0.03);
  material.specularPower = 4;
  material.emissiveColor = emissive ? c(emissive[0], emissive[1], emissive[2]) : c(0, 0, 0);
  return material;
}

const mats = {
  ground: mat('ground', [0.12, 0.16, 0.17]),
  field: mat('field', [0.16, 0.19, 0.14]),
  soil: mat('soil', [0.29, 0.18, 0.12]),
  edge: mat('edge', [0.38, 0.28, 0.18]),
  fence: mat('fence', [0.27, 0.29, 0.32]),
  attack: mat('attack', [1, 0.7, 0.15], [0.42, 0.12, 0.02]),
};
mats.attack.alpha = 0.34;

BABYLON.MeshBuilder.CreateGround('ground', { width: 40, height: 28 }, scene).material = mats.ground;
const field = BABYLON.MeshBuilder.CreateGround('field', { width: 32, height: 22 }, scene);
field.position.y = 0.02;
field.material = mats.field;

function fenceLine(axis, fixed, from, to, step) {
  for (let value = from; value <= to; value += step) {
    const post = BABYLON.MeshBuilder.CreateBox(
      `post_${axis}_${fixed}_${value}`,
      { width: 0.24, depth: 0.24, height: 1.4 },
      scene,
    );
    if (axis === 'x') {
      post.position.set(fixed, 0.7, value);
    } else {
      post.position.set(value, 0.7, fixed);
    }
    post.material = mats.fence;
  }
}

fenceLine('z', -11.2, -16, 16, 1.9);
fenceLine('z', 11.2, -16, 16, 1.9);
fenceLine('x', -16.2, -9, 9, 1.8);
fenceLine('x', 16.2, -9, -2.6, 1.8);
fenceLine('x', 16.2, 2.6, 9, 1.8);

const tomatoSpots = [];
const tomatoScaleVariants = [3.0, 3.64, 4.28, 5.0];

function shuffle(list) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = list[index];
    list[index] = list[swapIndex];
    list[swapIndex] = temp;
  }
  return list;
}

function registerTomatoSpot(x, z, scale, rotationY) {
  tomatoSpots.push({
    x,
    y: 1.12,
    z,
    scale,
    rotationY,
    seed: Math.random() * Math.PI * 2,
    mesh: null,
  });
}

function createPatch(index, z) {
  const bed = BABYLON.MeshBuilder.CreateBox(`bed_${index}`, { width: 24.8, depth: 6.2, height: 0.34 }, scene);
  bed.position.set(0, 0.18, z);
  bed.material = mats.soil;

  const rim = BABYLON.MeshBuilder.CreateBox(`rim_${index}`, { width: 25.2, depth: 6.6, height: 0.08 }, scene);
  rim.position.set(0, 0.04, z);
  rim.material = mats.edge;

  const rowOffsets = [-1.84, 1.84];
  const columns = [-8.8, -2.9, 2.9, 8.8];
  const scaleBag = shuffle([0, 1, 2, 3, 1, 2, 3, 0]);
  let plantIndex = 0;

  for (let row = 0; row < rowOffsets.length; row += 1) {
    for (let col = 0; col < columns.length; col += 1) {
      const x = columns[col] + (Math.random() - 0.5) * 0.32;
      const rowBias = row === 0 ? -0.1 : 0.1;
      const plantZ = z + rowOffsets[row] + rowBias + (Math.random() - 0.5) * 0.22;
      const scaleVariant = tomatoScaleVariants[scaleBag[plantIndex % scaleBag.length]];
      const scale = scaleVariant + (Math.random() - 0.5) * 0.12;
      const rotationY = Math.PI / 2 + (Math.random() - 0.5) * 0.28;
      registerTomatoSpot(x, plantZ, scale, rotationY);
      plantIndex += 1;
    }
  }
}

createPatch(0, -6.4);
createPatch(1, 0);
createPatch(2, 6.4);

BABYLON.SceneLoader.ImportMesh(
  '',
  '../assets/models/',
  'tomato_plant.glb',
  scene,
  meshes => {
    const sourceMesh = meshes.find(mesh => mesh.getTotalVertices && mesh.getTotalVertices() > 0);
    if (!sourceMesh) {
      setAssetState('fallback-ready');
      return;
    }

    meshes.forEach(mesh => {
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = false;
    });

    sourceMesh.isVisible = false;
    sourceMesh.position.set(0, -200, 0);
    sourceMesh.rotation.y = 0;
    sourceMesh.scaling.setAll(1);

    if (sourceMesh.material) {
      sourceMesh.material = sourceMesh.material.clone('tomatoPlantMaterial');
      sourceMesh.material.backFaceCulling = false;
      if ('fogEnabled' in sourceMesh.material) {
        sourceMesh.material.fogEnabled = false;
      }
      if ('albedoColor' in sourceMesh.material) {
        sourceMesh.material.albedoColor = c(0.22, 0.5, 0.16);
        sourceMesh.material.emissiveColor = c(0.08, 0.16, 0.05);
        sourceMesh.material.metallic = 0;
        sourceMesh.material.roughness = 1;
      }
      if ('diffuseColor' in sourceMesh.material) {
        sourceMesh.material.diffuseColor = c(0.22, 0.5, 0.16);
        sourceMesh.material.emissiveColor = c(0.08, 0.16, 0.05);
      }
      if ('specularColor' in sourceMesh.material) {
        sourceMesh.material.specularColor = c(0.03, 0.03, 0.03);
      }
      sourceMesh.material.freeze();
    }

    tomatoSpots.forEach((spot, index) => {
      const mesh = sourceMesh.createInstance(`tomatoPlant_${index}`);
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = false;
      mesh.position.set(spot.x, spot.y, spot.z);
      mesh.rotation.y = spot.rotationY;
      mesh.scaling.setAll(spot.scale);
      spot.mesh = mesh;
    });

    setAssetState('ready');
  },
  null,
  () => {
    setAssetState('fallback-ready');
  },
);

window.setTimeout(() => {
  if (assetState === 'booting') {
    setAssetState('fallback-ready');
  }
}, 3000);

const playerSprite = PSXSprite(scene, {
  name: 'jmyh_player',
  texture: '../assets/sprites/jmyh.png',
  cellW: 507,
  cellH: 576,
  cols: 9,
  rows: 1,
  width: 4.8,
  height: 3.9,
  pos: [playerRoot.position.x, 2.15, playerRoot.position.z],
  anims: {
    sit: [0, 3],
    walk: [4, 6],
    attack: [7, 8],
  },
});

const attackWave = BABYLON.MeshBuilder.CreateTorus(
  'attackWave',
  { diameter: 6.2, thickness: 0.12, tessellation: 18 },
  scene,
);
attackWave.rotation.x = Math.PI / 2;
attackWave.position.y = 0.1;
attackWave.material = mats.attack;
attackWave.isVisible = false;

const horrors = [];
const keys = {};
const maxHorrors = 1;
const horrorSpawnDelay = 1000;
let stopped = 0;
let guardHP = 6;
let horrorTimer = 0;
let swingTimer = 0;
let swingCooldown = 0;
let damageFlash = 0;
let playerFacing = 0;
let playerAnim = 'sit';
let isRespawning = false;
let respawnTimer = 0;
let mouseBlock = false;
let isBlocking = false;
let reggaeTimer = 0;
let reggaeDuration = 1;
let reggaeStrength = 0;
let hudSignalTimer = 1.8;
let hudOpacity = 1;

function setPlayerAnim(next) {
  if (playerAnim === next) {
    return;
  }

  playerAnim = next;
  if (next === 'walk') {
    playerSprite.play('walk', 8);
  } else if (next === 'attack') {
    playerSprite.play('attack', 7);
  } else {
    playerSprite.play('sit', 2);
  }
}

setPlayerAnim('sit');

window.addEventListener('keydown', event => {
  keys[event.code] = true;
  if (ATTACK_CODES.has(event.code)) {
    event.preventDefault();
    swat();
  }
});
window.addEventListener('keyup', event => {
  keys[event.code] = false;
});
window.addEventListener('blur', () => {
  Object.keys(keys).forEach(code => {
    keys[code] = false;
  });
  mouseBlock = false;
  isBlocking = false;
});

canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerdown', event => {
  if (event.button === 2) {
    mouseBlock = true;
  }
});
window.addEventListener('pointerup', event => {
  if (event.button === 2) {
    mouseBlock = false;
  }
});

const gestureInput = window.PSXGestures
  ? PSXGestures(canvas, {
      moveRadius: 92,
      onTap: () => {
        hudSignalTimer = Math.max(hudSignalTimer, 1.2);
        swat();
      },
    })
  : {
      getMoveVector() {
        return { active: false, x: 0, y: 0 };
      },
      isHolding() {
        return false;
      },
    };

function triggerReggae(strength, duration) {
  reggaeStrength = Math.max(reggaeStrength, strength);
  reggaeDuration = Math.max(1, duration || 280);
  reggaeTimer = reggaeDuration;
}

function clearHorrors() {
  while (horrors.length > 0) {
    const horror = horrors.pop();
    horror.psx.dispose();
  }
}

function spawnHorror(options = {}) {
  if (horrors.length >= maxHorrors) {
    return null;
  }

  const fixedPosition = options.fixedPosition || null;
  let x = 0;
  let z = 0;

  if (fixedPosition) {
    x = fixedPosition[0];
    z = fixedPosition[1];
  } else {
    const edge = Math.floor(Math.random() * 3);
    if (edge === 0) {
      x = Math.random() * 8 - 14;
      z = -12.8;
    } else if (edge === 1) {
      x = Math.random() * 8 - 14;
      z = 12.8;
    } else {
      x = -18;
      z = Math.random() * 18 - 9;
    }
  }

  const sprite = PSXSprite(scene, {
    name: `andrey_${Date.now()}`,
    texture: '../assets/sprites/andrey_livan_enemy.png',
    cellW: 260,
    cellH: 576,
    cols: 8,
    rows: 1,
    width: 5.2,
    height: 4.3,
    pos: [x, 2.15, z],
    anims: {
      walk: [1, 2],
      attack: [3, 7],
      pain: [0, 0],
      death: [0, 0],
    },
  });
  sprite.play('walk', 6);

  const horror = {
    attackCD: 0,
    hitTimer: 0,
    hp: options.hp || 3,
    psx: sprite,
    seed: Math.random() * Math.PI * 2,
    speed: 3.6 + Math.random() * 0.5,
  };
  horrors.push(horror);
  lastAction = 'spawn';
  syncDebugState();
  return horror;
}

function finishRespawn() {
  guardHP = 6;
  playerRoot.position.set(8.8, 0, 0);
  playerFacing = 0;
  swingTimer = 0;
  swingCooldown = 0;
  damageFlash = 0;
  horrorTimer = 0;
  isRespawning = false;
  respawnTimer = 0;
  stolenBannerEl.classList.remove('active');
  clearHorrors();
  setPlayerAnim('sit');
  lastAction = 'respawn-finish';
}

function startRespawn() {
  if (isRespawning) {
    return;
  }

  isRespawning = true;
  respawnTimer = 2000;
  guardHP = 0;
  swingTimer = 0;
  swingCooldown = 0;
  damageFlash = 0.8;
  triggerReggae(1, 700);
  stolenBannerEl.classList.add('active');
  setPlayerAnim('sit');
  hudSignalTimer = Math.max(hudSignalTimer, 2.2);
  Object.keys(keys).forEach(code => {
    keys[code] = false;
  });
  lastAction = 'respawn-start';
}

function swat() {
  if (isRespawning || isBlocking || swingCooldown > 0) {
    return false;
  }

  swingCooldown = 360;
  swingTimer = 150;
  setPlayerAnim('attack');
  hudSignalTimer = Math.max(hudSignalTimer, 1.3);

  let hit = false;
  for (let index = horrors.length - 1; index >= 0; index -= 1) {
    const horror = horrors[index];
    const dx = horror.psx.spr.position.x - playerRoot.position.x;
    const dz = horror.psx.spr.position.z - playerRoot.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= 3.4) {
      horror.hp -= 1;
      horror.hitTimer = 260;
      horror.psx.play('pain', 10);
      if (dist > 0.1) {
        horror.psx.spr.position.x += (dx / dist) * 1.1;
        horror.psx.spr.position.z += (dz / dist) * 1.1;
      }
      if (horror.hp <= 0) {
        horror.psx.dispose();
        horrors.splice(index, 1);
        stopped += 1;
        horrorTimer = horrorSpawnDelay;
      }
      hit = true;
    }
  }

  if (hit) {
    pipeline.chromaticAberration.aberrationAmount = 4.5;
    pipeline.bloomWeight = 0.8;
    triggerReggae(0.95, 260);
    lastAction = 'slash-hit';
  } else {
    lastAction = 'slash-whiff';
  }
  syncDebugState();
  return hit;
}

function defeatThreatForTest() {
  let horror = horrors[0];
  if (!horror) {
    horror = spawnHorror({
      fixedPosition: [playerRoot.position.x + 1.6, playerRoot.position.z + 1.2],
      hp: 1,
    });
  }
  if (!horror) {
    return false;
  }

  horror.hp = 1;
  horror.attackCD = 1000;
  horror.psx.spr.position.x = playerRoot.position.x + 1.2;
  horror.psx.spr.position.z = playerRoot.position.z + 1.1;
  return swat();
}

if (staticScene) {
  spawnHorror({
    fixedPosition: [playerRoot.position.x + 4.8, playerRoot.position.z + 0.4],
    hp: 1,
  });
} else {
  spawnHorror();
}

window.__lainTestApi = {
  attack() {
    return swat();
  },
  defeatThreat() {
    return defeatThreatForTest();
  },
  getState() {
    return snapshotState();
  },
  spawnThreat() {
    return Boolean(
      spawnHorror({
        fixedPosition: [playerRoot.position.x + 2.2, playerRoot.position.z + 0.6],
        hp: 1,
      }),
    );
  },
  unlockAudio,
};

syncDebugState();

let time = 0;
scene.registerBeforeRender(() => {
  const deltaMs = engine.getDeltaTime();
  const deltaSeconds = deltaMs * 0.001;
  time += deltaSeconds;
  recordFrame(deltaMs);
  hudSignalTimer = Math.max(0, hudSignalTimer - deltaSeconds);

  if (isRespawning) {
    respawnTimer -= deltaMs;
    if (respawnTimer <= 0) {
      finishRespawn();
      if (staticScene) {
        spawnHorror({
          fixedPosition: [playerRoot.position.x + 4.8, playerRoot.position.z + 0.4],
          hp: 1,
        });
      }
    }
  } else if (!staticScene && horrors.length === 0) {
    horrorTimer -= deltaMs;
    if (horrorTimer <= 0) {
      horrorTimer = horrorSpawnDelay;
      spawnHorror();
    }
  }

  let moveX = 0;
  let moveZ = 0;
  const gestureMove = gestureInput.getMoveVector();
  isBlocking =
    !isRespawning &&
    !staticScene &&
    (mouseBlock || gestureInput.isHolding() || keys.ShiftLeft || keys.ShiftRight);

  if (!isRespawning && !staticScene) {
    if (keys.KeyW) {
      moveZ += 1;
    }
    if (keys.KeyS) {
      moveZ -= 1;
    }
    if (keys.KeyA) {
      moveX -= 1;
    }
    if (keys.KeyD) {
      moveX += 1;
    }
    if (gestureMove.active) {
      moveX += gestureMove.x;
      moveZ += -gestureMove.y;
      hudSignalTimer = Math.max(hudSignalTimer, 0.9);
    }
  }

  let moveLength = Math.sqrt(moveX * moveX + moveZ * moveZ);
  if (moveLength > 0.001) {
    moveX /= moveLength;
    moveZ /= moveLength;
    const moveSpeed = isBlocking ? 3.4 : 5.9;
    playerRoot.position.x = Math.max(-15.2, Math.min(15.2, playerRoot.position.x + moveX * moveSpeed * deltaSeconds));
    playerRoot.position.z = Math.max(-10.2, Math.min(10.2, playerRoot.position.z + moveZ * moveSpeed * deltaSeconds));
    playerFacing = Math.atan2(moveX, moveZ);
  }

  swingCooldown = Math.max(0, swingCooldown - deltaMs);
  swingTimer = Math.max(0, swingTimer - deltaMs);
  if (swingTimer > 0) {
    attackWave.isVisible = true;
    attackWave.position.x = playerRoot.position.x;
    attackWave.position.z = playerRoot.position.z;
    attackWave.scaling.setAll(1 + (1 - swingTimer / 150) * 0.18);
    mats.attack.alpha = 0.34 * (swingTimer / 150);
  } else {
    attackWave.isVisible = false;
    mats.attack.alpha = 0.34;
  }

  if (swingTimer <= 0) {
    if (isRespawning || isBlocking) {
      setPlayerAnim('sit');
    } else if (moveLength > 0.001) {
      setPlayerAnim('walk');
    } else {
      setPlayerAnim('sit');
    }
  }

  guardLamp.position.set(playerRoot.position.x, 2.4, playerRoot.position.z);
  guardLamp.intensity = 1.74 + Math.sin(time * 11) * 0.08;
  cameraTarget.x += (playerRoot.position.x - cameraTarget.x) * 0.12;
  cameraTarget.y += (1.1 - cameraTarget.y) * 0.12;
  cameraTarget.z += (playerRoot.position.z - cameraTarget.z) * 0.12;
  camera.position.x += (playerRoot.position.x + cameraOffset.x - camera.position.x) * 0.12;
  camera.position.y += (playerRoot.position.y + cameraOffset.y - camera.position.y) * 0.12;
  camera.position.z += (playerRoot.position.z + cameraOffset.z - camera.position.z) * 0.12;
  camera.setTarget(cameraTarget);

  playerSprite.spr.position.x = playerRoot.position.x;
  playerSprite.spr.position.y = 2.15 + Math.sin(time * 1.6) * 0.04;
  playerSprite.spr.position.z = playerRoot.position.z;
  playerSprite.setDir(playerFacing);
  playerSprite.update(deltaMs, camera);

  tomatoSpots.forEach(spot => {
    if (!spot.mesh) {
      return;
    }
    const sway = Math.sin(time * 1.15 + spot.seed) * 0.1;
    const bob = Math.sin(time * 1.9 + spot.seed) * 0.026;
    spot.mesh.rotation.y = spot.rotationY + sway;
    spot.mesh.position.y = spot.y + bob;
  });

  for (let index = horrors.length - 1; index >= 0; index -= 1) {
    const horror = horrors[index];
    const sprite = horror.psx.spr;
    sprite.position.y = 2.1 + Math.sin(time * 4 + horror.seed) * 0.09;

    if (isRespawning || staticScene) {
      horror.psx.play('walk', 4);
      horror.psx.setDir(Math.atan2(playerRoot.position.x - sprite.position.x, playerRoot.position.z - sprite.position.z));
      horror.psx.update(deltaMs, camera);
      continue;
    }

    if (horror.hitTimer > 0) {
      horror.hitTimer -= deltaMs;
      if (horror.hitTimer <= 0) {
        horror.psx.play('walk', 4);
      }
    } else {
      const dx = playerRoot.position.x - sprite.position.x;
      const dz = playerRoot.position.z - sprite.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 1.6) {
        sprite.position.x += (dx / dist) * horror.speed * deltaSeconds;
        sprite.position.z += (dz / dist) * horror.speed * deltaSeconds;
        horror.psx.play('walk', 4);
      } else {
        horror.attackCD -= deltaMs;
        horror.psx.play('attack', 8);
        if (horror.attackCD <= 0) {
          horror.attackCD = 800;
          if (isBlocking) {
            damageFlash = Math.max(damageFlash, 0.16);
            pipeline.chromaticAberration.aberrationAmount = 2.4;
            pipeline.bloomWeight = 0.58;
            hudSignalTimer = Math.max(hudSignalTimer, 1.1);
            triggerReggae(0.55, 180);
            horror.hitTimer = 220;
            horror.psx.play('pain', 10);
            if (dist > 0.1) {
              sprite.position.x -= (dx / dist) * 1.4;
              sprite.position.z -= (dz / dist) * 1.4;
            }
            lastAction = 'block';
          } else {
            guardHP -= 1;
            damageFlash = 0.55;
            pipeline.chromaticAberration.aberrationAmount = 5;
            pipeline.bloomWeight = 0.9;
            hudSignalTimer = Math.max(hudSignalTimer, 1.7);
            triggerReggae(1, 320);
            lastAction = 'player-hit';
            if (guardHP <= 0) {
              startRespawn();
            }
          }
        }
      }
      horror.psx.setDir(Math.atan2(dx, dz));
    }

    horror.psx.update(deltaMs, camera);
  }

  damageFlash = Math.max(0, damageFlash - deltaSeconds * 1.6);
  damageEl.style.background = `rgba(160,0,0,${damageFlash.toFixed(3)})`;
  if (reggaeTimer > 0) {
    reggaeTimer = Math.max(0, reggaeTimer - deltaMs);
    const progress = reggaeTimer / reggaeDuration;
    const alpha = 0.58 * progress * reggaeStrength;
    const stripeA = (0.42 * progress * reggaeStrength).toFixed(3);
    const stripeB = (0.34 * progress * reggaeStrength).toFixed(3);
    const stripeC = (0.38 * progress * reggaeStrength).toFixed(3);
    const shift = Math.sin(time * 20) * 24 * reggaeStrength;
    reggaeEl.style.opacity = alpha.toFixed(3);
    reggaeEl.style.transform = `translateX(${shift.toFixed(2)}px)`;
    reggaeEl.style.background =
      `linear-gradient(90deg,` +
      `rgba(255,36,36,${stripeA}) 0%,` +
      `rgba(255,230,64,${stripeB}) 38%,` +
      `rgba(40,255,110,${stripeC}) 70%,` +
      `rgba(255,36,36,${stripeA}) 100%)`;
    if (reggaeTimer <= 0) {
      reggaeStrength = 0;
      reggaeEl.style.opacity = '0';
      reggaeEl.style.transform = '';
      reggaeEl.style.background = 'transparent';
    }
  }

  pipeline.chromaticAberration.aberrationAmount +=
    (1.1 - pipeline.chromaticAberration.aberrationAmount) * 0.08;
  pipeline.bloomWeight += (0.48 - pipeline.bloomWeight) * 0.08;
  backGlow.intensity = 0.42 + Math.sin(time * 0.8) * 0.04;

  hudEl.textContent =
    `STOPPED ${stopped}` +
    ` // ANDREY ${horrors.length}` +
    ` // HP ${guardHP}` +
    (isBlocking ? ' // BLOCK' : '') +
    (isRespawning ? ` // RESPAWN ${Math.max(0, Math.ceil(respawnTimer / 1000))}` : '');
  const hudTargetOpacity =
    isRespawning || isBlocking || guardHP <= 3 || damageFlash > 0.05 || hudSignalTimer > 0 ? 1 : 0.16;
  hudOpacity += (hudTargetOpacity - hudOpacity) * Math.min(1, deltaSeconds * 7);
  hudEl.style.opacity = hudOpacity.toFixed(3);

  syncDebugState();
});

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
