const params = new URLSearchParams(window.location.search);
const ATTACK_CODES = new Set(['Space', 'Enter', 'NumpadEnter']);
const embeddedScene = params.get('embedded') === '1';
const previewScene = params.get('preview') === '1';
const staticScene = params.get('still') === '1';
const touchScene =
  embeddedScene ||
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
  'ontouchstart' in window;

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
const damageEl = document.getElementById('damage');
const reggaeEl = document.getElementById('reggae');
const stolenBannerEl = document.getElementById('stolenBanner');
const attackButton = document.getElementById('attack-button');
const dpadButtons = Array.from(document.querySelectorAll('[data-key]'));
const bgm = document.getElementById('bgm');

body.dataset.embedded = String(embeddedScene);
body.dataset.preview = String(previewScene);
body.dataset.touch = String(touchScene);

let assetState = 'booting';
let audioState = 'idle';
let audioUnlockCount = 0;
let frameP95 = 0;
let lastAction = 'boot';
let lastPostedPayload = '';
const frameSamples = [];

let stopped = 0;
let stolen = 0;
const harvestReward = 120;
let savedHarvestValue = 0;
let guardHP = 5;

function snapshotState() {
  return {
    assetState,
    audioState,
    audioUnlockCount,
    frameP95,
    kills: stopped,
    lastAction,
    mode: 'tomato-grid',
    playerHp: guardHP,
    savedHarvestValue,
    selection: selection ? selection.id : 'A1',
    staticScene,
    targetState: enemy ? 'alive' : 'missing',
    threatCell: enemy ? enemy.cell.id : 'none',
  };
}

function syncDebugState() {
  body.dataset.assetState = assetState;
  body.dataset.audioState = audioState;
  body.dataset.embedded = String(embeddedScene);
  body.dataset.frameP95 = String(frameP95);
  body.dataset.kills = String(stopped);
  body.dataset.lastAction = lastAction;
  body.dataset.mode = 'tomato-grid';
  body.dataset.playerHp = String(guardHP);
  body.dataset.preview = String(previewScene);
  body.dataset.savedHarvestValue = String(savedHarvestValue);
  body.dataset.selection = selection ? selection.id : 'A1';
  body.dataset.staticScene = String(staticScene);
  body.dataset.targetState = enemy ? 'alive' : 'missing';
  body.dataset.threatCell = enemy ? enemy.cell.id : 'none';

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
bgm.src = params.get('tomatoGridMusic') || createToneObjectUrl(182);
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
  if (ATTACK_CODES.has(event.code) || event.code.startsWith('Arrow') || /^Key[WASD]$/.test(event.code)) {
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
scene.clearColor = new BABYLON.Color4(0.94, 0.94, 0.96, 1);
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
scene.fogDensity = 0.022;
scene.fogColor = new BABYLON.Color3(0.94, 0.94, 0.96);
scene.ambientColor = new BABYLON.Color3(0.18, 0.19, 0.2);

const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 18, -18), scene);
camera.setTarget(new BABYLON.Vector3(0, 0.8, 0));
camera.minZ = 0.1;
camera.maxZ = 60;

const moon = new BABYLON.HemisphericLight('moon', new BABYLON.Vector3(0.1, 1, -0.2), scene);
moon.intensity = 0.62;
moon.diffuse = new BABYLON.Color3(0.92, 0.94, 0.96);
moon.groundColor = new BABYLON.Color3(0.12, 0.12, 0.13);

const arenaLamp = new BABYLON.PointLight('arenaLamp', new BABYLON.Vector3(0, 4.5, 0), scene);
arenaLamp.intensity = 1.8;
arenaLamp.diffuse = new BABYLON.Color3(0.96, 0.88, 0.74);
arenaLamp.range = 22;

const pipeline = new BABYLON.DefaultRenderingPipeline('pipeline', false, scene, [camera]);
pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.42;
pipeline.bloomWeight = 0.28;
pipeline.bloomKernel = 18;
pipeline.bloomScale = 0.45;
pipeline.chromaticAberrationEnabled = true;
pipeline.chromaticAberration.aberrationAmount = 1.05;
pipeline.grainEnabled = true;
pipeline.grain.intensity = 9;
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
  ground: mat('ground', [0.12, 0.15, 0.18]),
  board: mat('board', [0.18, 0.2, 0.16]),
  cell: mat('cell', [0.24, 0.22, 0.18]),
  center: mat('center', [0.18, 0.28, 0.24], [0.03, 0.08, 0.06]),
  selected: mat('selected', [0.42, 0.3, 0.18], [0.16, 0.08, 0.03]),
  threat: mat('threat', [0.4, 0.12, 0.1], [0.18, 0.04, 0.02]),
  strike: mat('strike', [1, 0.74, 0.18], [0.34, 0.18, 0.04]),
};
mats.strike.alpha = 0.42;

BABYLON.MeshBuilder.CreateGround('ground', { width: 26, height: 26 }, scene).material = mats.ground;
const board = BABYLON.MeshBuilder.CreateBox('board', { width: 16.8, depth: 16.8, height: 0.5 }, scene);
board.position.y = 0.14;
board.material = mats.board;

const cells = [];
const cellMap = {};
const tomatoSpots = [];
const tomatoScaleVariants = [3.0, 3.64, 4.28, 5.0];
const spacing = 5.1;

function cellId(row, col) {
  return String.fromCharCode(65 + col) + (row + 1);
}

function shuffle(list) {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = list[index];
    list[index] = list[swapIndex];
    list[swapIndex] = temp;
  }
  return list;
}

function registerTomatoCluster(cell) {
  const offsets = shuffle([
    [-1.16, -1.1],
    [0, -1.16],
    [1.12, -1.02],
    [-1.22, 0.18],
    [0.18, 0.08],
    [1.06, 0.94],
  ]);
  const scales = shuffle([0, 1, 2, 3, 1, 2]);
  const count = (cell.row + cell.col) % 2 === 0 ? 5 : 6;
  for (let index = 0; index < count; index += 1) {
    tomatoSpots.push({
      x: cell.x + offsets[index][0] + (Math.random() - 0.5) * 0.12,
      y: 1.12,
      z: cell.z + offsets[index][1] + (Math.random() - 0.5) * 0.12,
      scale: tomatoScaleVariants[scales[index]] + (Math.random() - 0.5) * 0.12,
      rotationY: Math.PI / 2 + (Math.random() - 0.5) * 0.28,
      seed: Math.random() * Math.PI * 2,
      mesh: null,
    });
  }
}

for (let row = 0; row < 3; row += 1) {
  for (let col = 0; col < 3; col += 1) {
    const x = (col - 1) * spacing;
    const z = (row - 1) * spacing;
    const tile = BABYLON.MeshBuilder.CreateBox(
      `tile_${row}_${col}`,
      { width: 4.4, depth: 4.4, height: 0.34 },
      scene,
    );
    tile.position.set(x, 0.46, z);
    const center = row === 1 && col === 1;
    tile.material = center ? mats.center : mats.cell;
    const cell = { row, col, x, z, id: cellId(row, col), center, tile };
    cells.push(cell);
    cellMap[`${row}_${col}`] = cell;
    if (!center) {
      registerTomatoCluster(cell);
    }
  }
}

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
    if (sourceMesh.material) {
      sourceMesh.material = sourceMesh.material.clone('gridTomatoMaterial');
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
    }

    tomatoSpots.forEach((spot, index) => {
      const mesh = sourceMesh.createInstance(`gridTomato_${index}`);
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

const selector = BABYLON.MeshBuilder.CreateGround('selector', { width: 4.6, height: 4.6 }, scene);
selector.position.y = 0.64;
selector.material = mats.selected;

const strike = BABYLON.MeshBuilder.CreateGround('strike', { width: 4.0, height: 4.0 }, scene);
strike.position.y = 0.66;
strike.material = mats.strike;
strike.isVisible = false;

const playerSprite = PSXSprite(scene, {
  name: 'jmyh_grid',
  texture: '../assets/sprites/jmyh.png',
  cellW: 507,
  cellH: 576,
  cols: 9,
  rows: 1,
  width: 5.0,
  height: 4.0,
  pos: [0, 2.15, 0],
  anims: {
    sit: [0, 3],
    walk: [4, 6],
    attack: [7, 8],
  },
});

let selection = cellMap['0_0'];
let playerFacing = Math.atan2(selection.x, selection.z);
let playerAnim = 'sit';
let attackTimer = 0;
let attackCooldown = 0;
let damageFlash = 0;
let reggaeTimer = 0;
let reggaeDuration = 1;
let reggaeStrength = 0;
let isRespawning = false;
let respawnTimer = 0;
let spawnTimer = 0;
let enemy = null;
let lastSpawnId = '';

function setPlayerAnim(next) {
  if (playerAnim === next) {
    return;
  }
  playerAnim = next;
  if (next === 'attack') {
    playerSprite.play('attack', 8);
  } else {
    playerSprite.play('sit', 2);
  }
}

function triggerReggae(strength, duration) {
  reggaeStrength = Math.max(reggaeStrength, strength);
  reggaeDuration = Math.max(1, duration || 280);
  reggaeTimer = reggaeDuration;
}

function removeEnemy() {
  if (!enemy) {
    return;
  }
  enemy.psx.dispose();
  enemy = null;
}

function startRespawn() {
  if (isRespawning) {
    return;
  }
  isRespawning = true;
  respawnTimer = 2000;
  triggerReggae(1, 700);
  damageFlash = 0.8;
  stolenBannerEl.classList.add('active');
  removeEnemy();
  lastAction = 'respawn-start';
}

function finishRespawn() {
  isRespawning = false;
  respawnTimer = 0;
  guardHP = 5;
  stopped = 0;
  stolen = 0;
  savedHarvestValue = 0;
  attackTimer = 0;
  attackCooldown = 0;
  damageFlash = 0;
  spawnTimer = 0;
  stolenBannerEl.classList.remove('active');
  setPlayerAnim('sit');
  lastAction = 'respawn-finish';
}

function chooseSpawnCell() {
  const options = cells.filter(cell => !cell.center && cell.id !== lastSpawnId);
  return options[Math.floor(Math.random() * options.length)];
}

function spawnEnemy(options = {}) {
  if (enemy || isRespawning) {
    return null;
  }
  const cell = options.cell || chooseSpawnCell();
  lastSpawnId = cell.id;
  const sprite = PSXSprite(scene, {
    name: `andrey_grid_${Date.now()}`,
    texture: '../assets/sprites/andrey_livan_enemy.png',
    cellW: 260,
    cellH: 576,
    cols: 8,
    rows: 1,
    width: 4.8,
    height: 4.0,
    pos: [cell.x, 2.05, cell.z],
    anims: {
      walk: [1, 2],
      attack: [3, 7],
      pain: [0, 0],
      death: [0, 0],
    },
  });
  sprite.play('walk', 5);
  enemy = { cell, psx: sprite, timer: options.timer || 2200, seed: Math.random() * Math.PI * 2 };
  lastAction = 'spawn';
  return enemy;
}

function refreshCells() {
  cells.forEach(cell => {
    if (cell.center) {
      cell.tile.material = mats.center;
    } else if (enemy && enemy.cell.id === cell.id) {
      cell.tile.material = mats.threat;
    } else if (selection.id === cell.id) {
      cell.tile.material = mats.selected;
    } else {
      cell.tile.material = mats.cell;
    }
  });
  selector.position.set(selection.x, 0.64, selection.z);
}

function setSelection(row, col) {
  const cell = cellMap[`${row}_${col}`];
  if (!cell || cell.center) {
    return;
  }
  selection = cell;
  playerFacing = Math.atan2(selection.x, selection.z);
  refreshCells();
}

function moveSelection(dx, dy) {
  let row = Math.max(0, Math.min(2, selection.row + dy));
  let col = Math.max(0, Math.min(2, selection.col + dx));
  if (row === 1 && col === 1) {
    const skipRow = Math.max(0, Math.min(2, row + dy));
    const skipCol = Math.max(0, Math.min(2, col + dx));
    if (skipRow === 1 && skipCol === 1) {
      return;
    }
    row = skipRow;
    col = skipCol;
  }
  setSelection(row, col);
  lastAction = 'move-selection';
  syncDebugState();
}

function attackSelected() {
  if (isRespawning || attackCooldown > 0) {
    return false;
  }
  attackCooldown = 340;
  attackTimer = 150;
  setPlayerAnim('attack');
  strike.position.set(selection.x, 0.66, selection.z);
  strike.scaling.setAll(1);
  strike.isVisible = true;

  if (enemy && enemy.cell.id === selection.id) {
    triggerReggae(0.9, 240);
    removeEnemy();
    stopped += 1;
    savedHarvestValue += harvestReward;
    spawnTimer = 1000;
    lastAction = 'slash-hit';
    syncDebugState();
    return true;
  }

  triggerReggae(0.45, 140);
  lastAction = 'slash-whiff';
  syncDebugState();
  return false;
}

function handleMoveCode(code) {
  if (code === 'KeyW' || code === 'ArrowUp') {
    moveSelection(0, 1);
  } else if (code === 'KeyS' || code === 'ArrowDown') {
    moveSelection(0, -1);
  } else if (code === 'KeyA' || code === 'ArrowLeft') {
    moveSelection(-1, 0);
  } else if (code === 'KeyD' || code === 'ArrowRight') {
    moveSelection(1, 0);
  }
}

window.addEventListener('keydown', event => {
  if (event.repeat) {
    return;
  }
  handleMoveCode(event.code);
  if (ATTACK_CODES.has(event.code)) {
    event.preventDefault();
    attackSelected();
  }
});

function bindTouchButton(button, onPress) {
  if (!button) {
    return;
  }
  const activate = event => {
    event.preventDefault();
    button.dataset.active = 'true';
    onPress();
  };
  const clear = () => {
    button.dataset.active = 'false';
  };
  button.addEventListener('pointerdown', activate);
  button.addEventListener('pointerup', clear);
  button.addEventListener('pointercancel', clear);
  button.addEventListener('pointerleave', clear);
}

dpadButtons.forEach(button => {
  bindTouchButton(button, () => handleMoveCode(button.dataset.key));
});
bindTouchButton(attackButton, () => attackSelected());

setPlayerAnim('sit');
refreshCells();
if (staticScene) {
  spawnEnemy({ cell: cellMap['0_0'], timer: 999999 });
} else {
  spawnEnemy();
}

window.__lainTestApi = {
  attackThreat() {
    if (!enemy) {
      return false;
    }
    setSelection(enemy.cell.row, enemy.cell.col);
    return attackSelected();
  },
  getState() {
    return snapshotState();
  },
  setSelection(cellId) {
    const cell = cells.find(entry => entry.id === cellId && !entry.center);
    if (!cell) {
      return false;
    }
    setSelection(cell.row, cell.col);
    return true;
  },
  spawnThreat(cellId) {
    if (enemy) {
      return false;
    }
    const cell = cells.find(entry => entry.id === cellId && !entry.center) || cellMap['0_0'];
    return Boolean(spawnEnemy({ cell, timer: 2200 }));
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

  if (isRespawning) {
    respawnTimer -= deltaMs;
    if (respawnTimer <= 0) {
      finishRespawn();
      if (staticScene) {
        spawnEnemy({ cell: cellMap['0_0'], timer: 999999 });
      }
    }
  } else if (!enemy && !staticScene) {
    spawnTimer -= deltaMs;
    if (spawnTimer <= 0) {
      spawnTimer = 1000;
      spawnEnemy();
    }
  }

  attackCooldown = Math.max(0, attackCooldown - deltaMs);
  attackTimer = Math.max(0, attackTimer - deltaMs);
  if (attackTimer > 0) {
    strike.scaling.setAll(1 + (1 - attackTimer / 150) * 0.18);
    mats.strike.alpha = 0.42 * (attackTimer / 150);
  } else {
    strike.isVisible = false;
    mats.strike.alpha = 0.42;
    setPlayerAnim('sit');
  }

  selector.position.y = 0.64 + Math.sin(time * 4.5) * 0.04;
  playerSprite.spr.position.set(0, 2.15 + Math.sin(time * 1.6) * 0.03, 0);
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

  if (enemy) {
    enemy.psx.spr.position.set(
      enemy.cell.x,
      2.05 + Math.sin(time * 4 + enemy.seed) * 0.08,
      enemy.cell.z,
    );
    enemy.psx.setDir(Math.atan2(-enemy.cell.x, -enemy.cell.z));
    if (enemy.timer < 700) {
      enemy.psx.play('attack', 8);
    } else {
      enemy.psx.play('walk', 5);
    }
    enemy.psx.update(deltaMs, camera);

    if (!staticScene) {
      enemy.timer -= deltaMs;
      if (enemy.timer <= 0) {
        stolen += 1;
        guardHP -= 1;
        damageFlash = 0.55;
        triggerReggae(1, 320);
        removeEnemy();
        lastAction = 'harvest-stolen';
        if (guardHP <= 0) {
          startRespawn();
        } else {
          spawnTimer = 1000;
        }
      }
    }
  }

  refreshCells();

  damageFlash = Math.max(0, damageFlash - deltaSeconds * 1.6);
  damageEl.style.background = `rgba(160,0,0,${damageFlash.toFixed(3)})`;
  if (reggaeTimer > 0) {
    reggaeTimer = Math.max(0, reggaeTimer - deltaMs);
    const progress = reggaeTimer / reggaeDuration;
    const alpha = 0.52 * progress * reggaeStrength;
    const stripeA = (0.4 * progress * reggaeStrength).toFixed(3);
    const stripeB = (0.3 * progress * reggaeStrength).toFixed(3);
    const stripeC = (0.34 * progress * reggaeStrength).toFixed(3);
    const shift = Math.sin(time * 20) * 18 * reggaeStrength;
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
    (1.05 - pipeline.chromaticAberration.aberrationAmount) * 0.08;
  pipeline.bloomWeight += (0.36 - pipeline.bloomWeight) * 0.08;
  arenaLamp.intensity = 1.75 + Math.sin(time * 1.2) * 0.04;

  hudEl.innerHTML =
    `STOPPED ${stopped}` +
    ` // STOLEN ${stolen}` +
    ` // HP ${guardHP}` +
    ` // TARGET ${selection.id}` +
    (enemy ? ` // THREAT ${enemy.cell.id}` : '') +
    (isRespawning ? ` // RESPAWN ${Math.max(0, Math.ceil(respawnTimer / 1000))}` : '') +
    `<br>ПОБИТО ВРАГОВ ${stopped} // СПАСЕНО УРОЖАЯ ₽${savedHarvestValue}`;

  syncDebugState();
});

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
