const params = new URLSearchParams(window.location.search);
const ATTACK_CODES = new Set(['Space', 'Enter', 'NumpadEnter']);
const embeddedScene = params.get('embedded') === '1';
const previewScene = params.get('preview') === '1';
const staticScene = params.get('still') === '1';
const DEFAULT_SLASHER_MUSIC_FILE = 'Xxxtentacion - #ImSippinTeaInYoHood.mp3';

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
const hudElement = document.getElementById('hud');
const hintElement = document.getElementById('hint');
const scanlinesElement = document.getElementById('scanlines');
const glitchFlashElement = document.getElementById('glitchFlash');
const damageFlashElement = document.getElementById('dmgFlash');
const hitFlashElement = document.getElementById('hitFlash');
const attackButton = document.getElementById('attack-button');
const dpadButtons = Array.from(document.querySelectorAll('[data-key]'));
const bgm = document.getElementById('bgm');
let audioState = 'idle';
let audioUnlockCount = 0;
let frameP95 = 0;
let lastAction = 'boot';
let lastPostedPayload = '';
const frameSamples = [];

const generatedMusicUrl = params.get('slasherMusic') || resolveSharedAudioUrl(DEFAULT_SLASHER_MUSIC_FILE);
const enableTouchControls =
  embeddedScene ||
  window.matchMedia('(pointer: coarse)').matches ||
  'ontouchstart' in window;

document.body.dataset.touch = String(enableTouchControls);
document.body.dataset.embedded = String(embeddedScene);
document.body.dataset.preview = String(previewScene);

hintElement.textContent =
  embeddedScene || enableTouchControls
    ? 'touch + hold to move // tap slash'
    : 'wasd / d-pad to move, tap / click / space to slash';

bgm.loop = true;
bgm.volume = 0.22;
bgm.src = generatedMusicUrl;
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

function snapshotState() {
  return {
    audioState,
    audioUnlockCount,
    enemyCount: enemies.length,
    frameP95,
    isAttacking,
    kills,
    lastAction,
    mode: 'slasher',
    playerHp,
    staticScene,
    targetState: kills > 0 ? 'dead' : enemies.some(enemy => !enemy.dead) ? 'alive' : 'missing',
  };
}

function syncDebugState() {
  body.dataset.assetState = 'ready';
  body.dataset.audioState = audioState;
  body.dataset.embedded = String(embeddedScene);
  body.dataset.kills = String(kills);
  body.dataset.lastAction = lastAction;
  body.dataset.mode = 'slasher';
  body.dataset.preview = String(previewScene);
  body.dataset.staticScene = String(staticScene);
  body.dataset.targetState = kills > 0 ? 'dead' : enemies.some(enemy => !enemy.dead) ? 'alive' : 'missing';
  body.dataset.frameP95 = String(frameP95);

  if (window.ReactNativeWebView?.postMessage) {
    const payload = JSON.stringify({ state: snapshotState(), type: 'scene-state' });
    if (payload !== lastPostedPayload) {
      lastPostedPayload = payload;
      window.ReactNativeWebView.postMessage(payload);
    }
  }
}

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

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    bgm.pause();
  }
});

const engine = new BABYLON.Engine(canvas, false, {
  antialias: false,
  preserveDrawingBuffer: true,
  stencil: true,
});
engine.setHardwareScalingLevel(3);

const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.01, 0.005, 0.02, 1);
scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
scene.fogDensity = 0.07;
scene.fogColor = new BABYLON.Color3(0.015, 0.005, 0.03);
scene.ambientColor = new BABYLON.Color3(0.02, 0.01, 0.03);

const player = PSXSprite(scene, {
  anims: { walk: [0, 3], attack: [4, 6], pain: [7, 7], death: [8, 8] },
  cellH: 91,
  cellW: 83,
  cols: 9,
  height: 2.1,
  name: 'player',
  pos: [0, 1.05, 0],
  rows: 8,
  texture: './assets/sprites/eretic.png',
  width: 1.8,
});
player.play('walk', 8);

let playerFacing = 0;
let playerHp = 100;
let kills = 0;
let isAttacking = false;
let attackTimer = 0;

const playerSpeed = 3.2;
const attackRange = 2.8;
const attackDuration = 400;

const playerLight = new BABYLON.PointLight('player-light', new BABYLON.Vector3(0, 2.5, 0), scene);
playerLight.diffuse = new BABYLON.Color3(0.9, 0.08, 0.03);
playerLight.specular = new BABYLON.Color3(0.6, 0.05, 0.02);
playerLight.intensity = 2.8;
playerLight.range = 10;

const camera = new BABYLON.ArcRotateCamera(
  'camera',
  -Math.PI / 2,
  Math.PI / 3.2,
  9,
  new BABYLON.Vector3(0, 1, 0),
  scene,
);
camera.lowerRadiusLimit = 4;
camera.upperRadiusLimit = 14;
camera.lowerBetaLimit = 0.3;
camera.upperBetaLimit = Math.PI / 2.1;
camera.minZ = 0.1;
camera.maxZ = 40;
camera.wheelPrecision = 30;

if (!enableTouchControls) {
  camera.attachControl(canvas, true);
}

const ambient = new BABYLON.HemisphericLight('ambient-light', new BABYLON.Vector3(0, 1, 0), scene);
ambient.intensity = 0.04;
ambient.groundColor = new BABYLON.Color3(0.03, 0.0, 0.05);
ambient.diffuse = new BABYLON.Color3(0.05, 0.02, 0.08);

function createPsxMaterial(name, red, green, blue) {
  const material = new BABYLON.StandardMaterial(name, scene);
  material.diffuseColor = new BABYLON.Color3(red, green, blue);
  material.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);
  material.specularPower = 2;
  return material;
}

const arenaSize = 60;
const floor = BABYLON.MeshBuilder.CreateGround(
  'floor',
  { height: arenaSize, subdivisions: 2, width: arenaSize },
  scene,
);
floor.material = createPsxMaterial('floor-material', 0.03, 0.015, 0.04);

const gridMaterial = new BABYLON.StandardMaterial('floor-grid-material', scene);
gridMaterial.wireframe = true;
gridMaterial.emissiveColor = new BABYLON.Color3(0.06, 0.02, 0.1);

const floorGrid = BABYLON.MeshBuilder.CreateGround(
  'floor-grid',
  { height: arenaSize, subdivisions: 30, width: arenaSize },
  scene,
);
floorGrid.material = gridMaterial;
floorGrid.position.y = 0.01;

const pillarMaterial = createPsxMaterial('pillar-material', 0.11, 0.03, 0.15);
const pillarPositions = [
  [-16, -16],
  [16, -16],
  [-16, 16],
  [16, 16],
  [0, -22],
  [0, 22],
  [-22, 0],
  [22, 0],
];

pillarPositions.forEach(([x, z], index) => {
  const pillar = BABYLON.MeshBuilder.CreateBox(
    `pillar-${index}`,
    { depth: 2.8, height: 5.5, width: 2.8 },
    scene,
  );
  pillar.position = new BABYLON.Vector3(x, 2.75, z);
  pillar.material = pillarMaterial;
});

const enemyTypes = {
  dog: {
    anims: { walk: [0, 3], attack: [4, 5], pain: [6, 6], death: [7, 7] },
    atkCD: 800,
    atkDist: 1.8,
    atkDmg: 8,
    atkFps: 14,
    cellH: 96,
    cellW: 120,
    cols: 8,
    height: 1.4,
    hp: 2,
    rows: 8,
    speed: 3.2,
    texture: './assets/sprites/young_dog_grid.png',
    walkFps: 10,
    width: 1.8,
    yPos: 0.7,
  },
  eretic: {
    anims: { walk: [0, 3], attack: [4, 6], pain: [7, 7], death: [8, 8] },
    atkCD: 1100,
    atkDist: 2.2,
    atkDmg: 10,
    atkFps: 10,
    cellH: 91,
    cellW: 83,
    cols: 9,
    height: 1.8,
    hp: 3,
    rows: 8,
    speed: 2.0,
    texture: './assets/sprites/eretic.png',
    walkFps: 8,
    width: 1.5,
    yPos: 1.0,
  },
};

const keys = {};
const enemies = [];

let enemyUid = 0;
let spawnTimer = 0;
let glitchTimer = 0;
let glitchIntensity = 0;
let damageFade = 0;
let hitFlashTimer = 0;
let hitFlashStrength = 0;

const spawnInterval = 4000;
const spawnMin = 2;
const spawnMax = 3;
const maxAlive = 6;
const glitchDuration = 300;

function randomSpawnPosition() {
  const angle = Math.random() * Math.PI * 2;
  const distance = 12 + Math.random() * 8;
  const x = player.spr.position.x + Math.cos(angle) * distance;
  const z = player.spr.position.z + Math.sin(angle) * distance;

  return [Math.max(-27, Math.min(27, x)), Math.max(-27, Math.min(27, z))];
}

function spawnEnemy(x, z, forcedTypeName) {
  const typeName = forcedTypeName || (Math.random() < 0.5 ? 'eretic' : 'dog');
  const config = enemyTypes[typeName];
  const enemySprite = PSXSprite(scene, {
    anims: config.anims,
    cellH: config.cellH,
    cellW: config.cellW,
    cols: config.cols,
    height: config.height,
    name: `enemy-${enemyUid}`,
    pos: [x, config.yPos, z],
    rows: config.rows,
    texture: config.texture,
    width: config.width,
  });

  enemyUid += 1;
  enemySprite.play('walk', config.walkFps);

  enemies.push({
    atkCD: 0,
    config,
    dead: false,
    facingAngle: 0,
    fallTimer: -1,
    hp: config.hp,
    painTimer: 0,
    removeTimer: 0,
    sprite: enemySprite,
    state: 'walk',
  });
}

function spawnWave() {
  const aliveCount = enemies.reduce((count, enemy) => count + (enemy.dead ? 0 : 1), 0);

  if (aliveCount >= maxAlive) {
    return;
  }

  const nextCount = spawnMin + Math.floor(Math.random() * (spawnMax - spawnMin + 1));
  const count = Math.min(nextCount, maxAlive - aliveCount);

  for (let index = 0; index < count; index += 1) {
    const [spawnX, spawnZ] = randomSpawnPosition();
    spawnEnemy(spawnX, spawnZ);
  }
}

function triggerGlitch(intensity) {
  glitchTimer = glitchDuration;
  glitchIntensity = Math.max(glitchIntensity, intensity);
}

function triggerHitFlash(strength) {
  hitFlashTimer = 120;
  hitFlashStrength = strength;
}

function startAttack() {
  if (isAttacking) {
    return;
  }

  lastAction = 'slash-start';
  isAttacking = true;
  attackTimer = 0;
  player.play('attack', 14);

  let nearestEnemy = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  enemies.forEach(enemy => {
    if (enemy.dead) {
      return;
    }

    const deltaX = enemy.sprite.spr.position.x - player.spr.position.x;
    const deltaZ = enemy.sprite.spr.position.z - player.spr.position.z;
    const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestEnemy = enemy;
    }
  });

  if (nearestEnemy && nearestDistance < attackRange * 1.5) {
    playerFacing = Math.atan2(
      nearestEnemy.sprite.spr.position.z - player.spr.position.z,
      nearestEnemy.sprite.spr.position.x - player.spr.position.x,
    );
    player.setDir(playerFacing);
  }

  let didHit = false;

  enemies.forEach(enemy => {
    if (enemy.dead) {
      return;
    }

    const deltaX = enemy.sprite.spr.position.x - player.spr.position.x;
    const deltaZ = enemy.sprite.spr.position.z - player.spr.position.z;
    const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);

    if (distance >= attackRange) {
      return;
    }

    enemy.hp -= 1;
    didHit = true;

    if (distance > 0.1) {
      enemy.sprite.spr.position.x += (deltaX / distance) * 0.8;
      enemy.sprite.spr.position.z += (deltaZ / distance) * 0.8;
    }

    if (enemy.hp <= 0) {
      enemy.dead = true;
      enemy.state = 'dead';
      enemy.sprite.play('death', 6);
      enemy.fallTimer = 0;
      kills += 1;
      triggerGlitch(1.0);
      return;
    }

    enemy.sprite.play('pain', 8);
    enemy.painTimer = 300;
    enemy.state = 'pain';
    triggerGlitch(0.6);
  });

  lastAction = didHit ? 'slash-hit' : 'slash-whiff';
  triggerHitFlash(didHit ? 1.0 : 0.3);
  syncDebugState();
}

function updateTouchButtonState(key, pressed) {
  dpadButtons.forEach(button => {
    if (button.dataset.key === key) {
      button.dataset.active = String(pressed);
    }
  });
}

function setDirectionalKey(key, pressed) {
  keys[key] = pressed;
  updateTouchButtonState(key, pressed);
}

function bindHoldButton(button, key) {
  const release = () => setDirectionalKey(key, false);

  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    unlockAudio();
    setDirectionalKey(key, true);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}

dpadButtons.forEach(button => {
  bindHoldButton(button, button.dataset.key);
});

attackButton.addEventListener('pointerdown', event => {
  event.preventDefault();
  unlockAudio();
  attackButton.dataset.active = 'true';
  startAttack();
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(eventName => {
  attackButton.addEventListener(eventName, () => {
    attackButton.dataset.active = 'false';
  });
});

window.addEventListener('keydown', event => {
  if (ATTACK_CODES.has(event.code)) {
    if (!event.repeat) {
      unlockAudio();
      startAttack();
    }
    event.preventDefault();
    return;
  }

  keys[event.code] = true;
  if (event.code === 'KeyW' || event.code === 'KeyA' || event.code === 'KeyS' || event.code === 'KeyD') {
    lastAction = 'move-input';
    syncDebugState();
  }
});

window.addEventListener('keyup', event => {
  keys[event.code] = false;
  updateTouchButtonState(event.code, false);
});

canvas.addEventListener('pointerdown', event => {
  if (enableTouchControls && event.pointerType === 'touch') {
    return;
  }

  unlockAudio();
  startAttack();
});

const pipeline = new BABYLON.DefaultRenderingPipeline('pipeline', false, scene, [camera]);
pipeline.bloomEnabled = true;
pipeline.bloomThreshold = 0.3;
pipeline.bloomWeight = 0.4;
pipeline.bloomKernel = 16;
pipeline.bloomScale = 0.3;
pipeline.chromaticAberrationEnabled = true;
pipeline.chromaticAberration.aberrationAmount = 1;
pipeline.grainEnabled = true;
pipeline.grain.intensity = 25;
pipeline.grain.animated = true;

if (staticScene) {
  spawnEnemy(2.2, 0, 'dog');
} else {
  spawnWave();
}

let elapsedSeconds = 0;

scene.registerBeforeRender(() => {
  const deltaMs = engine.getDeltaTime();
  const deltaSeconds = deltaMs * 0.001;
  elapsedSeconds += deltaSeconds;

  const forward = new BABYLON.Vector3(
    player.spr.position.x - camera.position.x,
    0,
    player.spr.position.z - camera.position.z,
  );

  if (forward.length() > 0.001) {
    forward.normalize();
  }

  const right = BABYLON.Vector3.Cross(BABYLON.Axis.Y, forward);
  if (right.length() > 0.001) {
    right.normalize();
  }

  let moveX = 0;
  let moveZ = 0;

  if (keys.KeyW) {
    moveX += forward.x;
    moveZ += forward.z;
  }
  if (keys.KeyS) {
    moveX -= forward.x;
    moveZ -= forward.z;
  }
  if (keys.KeyA) {
    moveX -= right.x;
    moveZ -= right.z;
  }
  if (keys.KeyD) {
    moveX += right.x;
    moveZ += right.z;
  }

  const moveLength = Math.sqrt(moveX * moveX + moveZ * moveZ);

  if (moveLength > 0.01 && !isAttacking) {
    moveX /= moveLength;
    moveZ /= moveLength;
    player.spr.position.x += moveX * playerSpeed * deltaSeconds;
    player.spr.position.z += moveZ * playerSpeed * deltaSeconds;
    player.spr.position.x = Math.max(-28, Math.min(28, player.spr.position.x));
    player.spr.position.z = Math.max(-28, Math.min(28, player.spr.position.z));
    playerFacing = Math.atan2(moveZ, moveX);
    player.setDir(playerFacing);
    player.play('walk', 8);
  } else if (!isAttacking) {
    player.stop();
  }

  if (isAttacking) {
    attackTimer += deltaMs;
    if (attackTimer >= attackDuration) {
      isAttacking = false;
      player.play('walk', 8);
    }
  }

  player.update(deltaMs, camera);

  camera.target.x = player.spr.position.x;
  camera.target.y = 1.0;
  camera.target.z = player.spr.position.z;

  playerLight.position.x = player.spr.position.x;
  playerLight.position.y = 2.2;
  playerLight.position.z = player.spr.position.z;
  playerLight.intensity =
    2.4 + Math.sin(elapsedSeconds * 8) * 0.3 + Math.sin(elapsedSeconds * 13) * 0.15;
  playerLight.range = 9 + Math.sin(elapsedSeconds * 3) * 1.5;

  spawnTimer += deltaMs;
  if (!staticScene && spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnWave();
  }

  for (let index = enemies.length - 1; index >= 0; index -= 1) {
    const enemy = enemies[index];

    if (enemy.dead) {
      if (enemy.fallTimer >= 0 && enemy.fallTimer < 1000) {
        enemy.fallTimer += deltaMs;
        const fallProgress = Math.min(1, enemy.fallTimer / 700);
        enemy.sprite.spr.position.y = enemy.config.yPos - fallProgress * (enemy.config.yPos * 0.8);
        enemy.sprite.spr.height = enemy.config.height * (1 - fallProgress * 0.65);
      }

      enemy.removeTimer += deltaMs;
      if (enemy.removeTimer > 3500) {
        enemy.sprite.dispose();
        enemies.splice(index, 1);
        continue;
      }

      enemy.sprite.update(deltaMs, camera);
      continue;
    }

    if (staticScene) {
      enemy.sprite.update(deltaMs, camera);
      continue;
    }

    const deltaX = player.spr.position.x - enemy.sprite.spr.position.x;
    const deltaZ = player.spr.position.z - enemy.sprite.spr.position.z;
    const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
    const targetAngle = Math.atan2(deltaZ, deltaX);

    let angleDifference = targetAngle - enemy.facingAngle;
    while (angleDifference > Math.PI) {
      angleDifference -= 2 * Math.PI;
    }
    while (angleDifference < -Math.PI) {
      angleDifference += 2 * Math.PI;
    }

    enemy.facingAngle += angleDifference * Math.min(1, 4 * deltaSeconds);
    enemy.sprite.setDir(enemy.facingAngle);

    if (enemy.state === 'pain') {
      enemy.painTimer -= deltaMs;
      if (enemy.painTimer <= 0) {
        enemy.state = 'walk';
        enemy.sprite.play('walk', enemy.config.walkFps);
      }

      enemy.sprite.update(deltaMs, camera);
      continue;
    }

    if (distance > enemy.config.atkDist) {
      if (enemy.state !== 'walk') {
        enemy.state = 'walk';
        enemy.sprite.play('walk', enemy.config.walkFps);
      }

      enemy.sprite.spr.position.x += (deltaX / distance) * enemy.config.speed * deltaSeconds;
      enemy.sprite.spr.position.z += (deltaZ / distance) * enemy.config.speed * deltaSeconds;
    } else {
      if (enemy.state !== 'attack') {
        enemy.state = 'attack';
        enemy.sprite.play('attack', enemy.config.atkFps);
      }

      enemy.atkCD -= deltaMs;
      if (enemy.atkCD <= 0) {
        enemy.atkCD = enemy.config.atkCD;
        playerHp = Math.max(0, playerHp - enemy.config.atkDmg);
        damageFade = 0.55;
        triggerGlitch(0.4);
      }
    }

    enemy.sprite.update(deltaMs, camera);
  }

  if (glitchTimer > 0) {
    glitchTimer -= deltaMs;
    const glitchProgress = Math.max(0, glitchTimer / glitchDuration);
    const glitchStrength = glitchProgress * glitchIntensity;

    pipeline.chromaticAberration.aberrationAmount = 1 + glitchStrength * 50;
    pipeline.grain.intensity = 25 + glitchStrength * 100;
    pipeline.bloomWeight = 0.4 + glitchStrength * 2.0;

    const jitter = glitchStrength > 0.2 ? (Math.random() - 0.5) * 10 : 0;
    scanlinesElement.style.transform = `translateX(${jitter}px) translateY(${jitter * 0.5}px)`;

    const flashAlpha = glitchProgress > 0.5 ? (glitchProgress - 0.5) * 2 : 0;
    glitchFlashElement.style.background = `rgba(160, 20, 255, ${(flashAlpha * 0.4 * glitchIntensity).toFixed(3)})`;

    if (glitchTimer <= 0) {
      glitchIntensity = 0;
      pipeline.chromaticAberration.aberrationAmount = 1;
      pipeline.grain.intensity = 25;
      pipeline.bloomWeight = 0.4;
      glitchFlashElement.style.background = 'transparent';
      scanlinesElement.style.transform = '';
    }
  }

  if (hitFlashTimer > 0) {
    hitFlashTimer -= deltaMs;
    const hitProgress = Math.max(0, hitFlashTimer / 120);
    hitFlashElement.style.background = `rgba(255, 255, 255, ${(hitProgress * 0.15 * hitFlashStrength).toFixed(3)})`;

    if (hitFlashTimer <= 0) {
      hitFlashElement.style.background = 'transparent';
    }
  }

  if (damageFade > 0) {
    damageFade = Math.max(0, damageFade - 1.5 * deltaSeconds);
    damageFlashElement.style.background = `rgba(180, 0, 0, ${damageFade.toFixed(3)})`;
  }

  frameSamples.push(deltaMs);
  if (frameSamples.length > 180) {
    frameSamples.shift();
  }
  if (frameSamples.length >= 30) {
    const sorted = [...frameSamples].sort((left, right) => left - right);
    frameP95 = Math.round(sorted[Math.floor(sorted.length * 0.95)]);
  }

  hudElement.textContent = `HP ${playerHp} // KILLS ${kills} // FPS ${Math.round(engine.getFps())}`;
  syncDebugState();
});

engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());

window.__lainTestApi = {
  getState() {
    return {
      ...snapshotState(),
      frame: Math.round(engine.getFps()),
      playerPosition: {
        x: Number(player.spr.position.x.toFixed(3)),
        y: Number(player.spr.position.y.toFixed(3)),
        z: Number(player.spr.position.z.toFixed(3)),
      },
    };
  },
  snapPlayerNearEnemy() {
    const enemy = enemies.find(candidate => !candidate.dead);
    if (!enemy) {
      return snapshotState();
    }

    player.spr.position.x = enemy.sprite.spr.position.x - 1.2;
    player.spr.position.z = enemy.sprite.spr.position.z;
    playerFacing = Math.atan2(
      enemy.sprite.spr.position.z - player.spr.position.z,
      enemy.sprite.spr.position.x - player.spr.position.x,
    );
    player.setDir(playerFacing);
    syncDebugState();
    return snapshotState();
  },
  setKey(code, pressed) {
    keys[code] = pressed;
    syncDebugState();
  },
  holdAttack(duration = 800) {
    return new Promise(resolve => {
      window.__lainTestApi.snapPlayerNearEnemy();
      startAttack();
      const intervalId = window.setInterval(() => {
        if (!enemies.some(enemy => !enemy.dead)) {
          window.clearInterval(intervalId);
          return;
        }
        startAttack();
      }, 220);
      window.setTimeout(() => {
        window.clearInterval(intervalId);
        resolve(snapshotState());
      }, duration);
    });
  },
  holdSlash(duration = 800) {
    return new Promise(resolve => {
      window.__lainTestApi.snapPlayerNearEnemy();
      startAttack();
      const intervalId = window.setInterval(() => {
        if (!enemies.some(enemy => !enemy.dead)) {
          window.clearInterval(intervalId);
          return;
        }
        startAttack();
      }, 220);
      window.setTimeout(() => {
        window.clearInterval(intervalId);
        resolve(snapshotState());
      }, duration);
    });
  },
  startAttack,
  unlockAudio,
};

syncDebugState();
