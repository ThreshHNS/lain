const params = new URLSearchParams(window.location.search);
const FALLBACK_TARGET_IMAGE = './assets/ui/target-placeholder.svg';
const ALLOWED_MODES = new Set(['awp', 'slasher']);
const ATTACK_CODES = new Set(['Space', 'Enter', 'NumpadEnter']);
const BACK_CODES = new Set(['Escape', 'BrowserBack', 'Backspace']);
const DIRECTION_CODES = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

function resolveMode(input) {
  return ALLOWED_MODES.has(input) ? input : 'awp';
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

const rawMode = params.get('mode');
const mode = resolveMode(rawMode || 'awp');
const modeWasInvalid =
  params.get('invalidModeFallback') === '1' || (Boolean(rawMode) && rawMode !== mode);
const embeddedScene = params.get('embedded') === '1';
const previewScene = params.get('preview') === '1';
const staticScene = params.get('still') === '1';
const targetImage = params.get('targetImage') || FALLBACK_TARGET_IMAGE;
const awpMusic = params.get('awpMusic') || createToneObjectUrl(220);
const slasherMusic = params.get('slasherMusic') || createToneObjectUrl(145);

const body = document.body;
const modeChip = document.getElementById('mode-chip');
const scoreLabel = document.getElementById('score');
const hintLabel = document.getElementById('hint');
const weaponOverlay = document.getElementById('weapon-overlay');
const bgm = document.getElementById('bgm');
const canvas = document.getElementById('renderCanvas');
let lastPostedPayload = '';

const engine = new BABYLON.Engine(canvas, true, {
  adaptToDeviceRatio: true,
  preserveDrawingBuffer: true,
  stencil: true,
});

const state = {
  assetState: 'booting',
  audioState: 'idle',
  audioUnlockCount: 0,
  dpadState: 'idle',
  frameP95: 0,
  frameSamples: [],
  invalidModeFallback: modeWasInvalid,
  lastAction: 'boot',
  movementState: 'idle',
  respawnAt: 0,
  score: 0,
  shotCooldown: 0,
  slashTimer: 0,
  targetAlive: true,
  targetState: 'alive',
  weaponState: 'idle',
};

function snapshotState() {
  return {
    assetState: state.assetState,
    audioState: state.audioState,
    audioUnlockCount: state.audioUnlockCount,
    dpadState: state.dpadState,
    frameP95: state.frameP95,
    invalidModeFallback: state.invalidModeFallback,
    lastAction: state.lastAction,
    mode,
    movementState: state.movementState,
    score: state.score,
    staticScene,
    targetAlive: state.targetAlive,
    targetState: state.targetState,
    weaponState: state.weaponState,
  };
}

function syncDomState() {
  body.dataset.assetState = state.assetState;
  body.dataset.audioState = state.audioState;
  body.dataset.dpadState = state.dpadState;
  body.dataset.embedded = String(embeddedScene);
  body.dataset.lastAction = state.lastAction;
  body.dataset.mode = mode;
  body.dataset.movementState = state.movementState;
  body.dataset.preview = String(previewScene);
  body.dataset.score = String(state.score);
  body.dataset.staticScene = String(staticScene);
  body.dataset.targetState = state.targetState;
  body.dataset.weaponState = state.weaponState;
  body.dataset.invalidModeFallback = String(state.invalidModeFallback);
  body.dataset.frameP95 = String(state.frameP95);

  modeChip.textContent = mode === 'slasher' ? 'mode: slasher' : 'mode: awp';
  hintLabel.textContent =
    mode === 'slasher'
      ? embeddedScene
        ? 'touch + hold to move // tap slash'
        : 'hold enter / click / touch to move + slash'
      : 'tap to shoot';
  scoreLabel.textContent = `score: ${state.score}`;
  weaponOverlay.dataset.state = state.weaponState;
  weaponOverlay.style.display = mode === 'awp' ? 'block' : 'none';

  if (window.ReactNativeWebView?.postMessage) {
    const payload = JSON.stringify({ state: snapshotState(), type: 'scene-state' });
    if (payload !== lastPostedPayload) {
      lastPostedPayload = payload;
      window.ReactNativeWebView.postMessage(payload);
    }
  }
}

syncDomState();

const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color4(0.12, 0.15, 0.2, 1);

const camera = new BABYLON.UniversalCamera('camera', new BABYLON.Vector3(0, 1.6, -7), scene);
camera.attachControl(canvas, true);
camera.inertia = 0.2;
camera.speed = 0.2;
camera.angularSensibility = 5000;
camera.keysUp = [87];
camera.keysDown = [83];
camera.keysLeft = [65];
camera.keysRight = [68];

const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
light.intensity = 0.95;

const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 24, height: 24 }, scene);
const groundMat = new BABYLON.StandardMaterial('ground-mat', scene);
groundMat.diffuseColor = mode === 'slasher'
  ? new BABYLON.Color3(0.18, 0.09, 0.11)
  : new BABYLON.Color3(0.33, 0.35, 0.28);
ground.material = groundMat;

const backdrop = BABYLON.MeshBuilder.CreatePlane('backdrop', { width: 30, height: 14 }, scene);
backdrop.position = new BABYLON.Vector3(0, 7, 8);
const backdropMat = new BABYLON.StandardMaterial('backdrop-mat', scene);
backdropMat.emissiveColor = mode === 'slasher'
  ? new BABYLON.Color3(0.18, 0.02, 0.03)
  : new BABYLON.Color3(0.4, 0.44, 0.5);
backdrop.material = backdropMat;

const target = BABYLON.MeshBuilder.CreatePlane('target', { width: 2.2, height: 3.2 }, scene);
target.position = mode === 'slasher'
  ? new BABYLON.Vector3(0, 1.6, staticScene ? 1.8 : 4)
  : new BABYLON.Vector3(0, 1.6, 5);
target.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;

function createSpriteMaterial(name, tint) {
  const material = new BABYLON.StandardMaterial(name, scene);
  material.emissiveColor = tint;
  material.backFaceCulling = false;
  material.useAlphaFromDiffuseTexture = true;
  return material;
}

const aliveMaterial = createSpriteMaterial('target-alive', new BABYLON.Color3(0.95, 0.95, 0.95));
const deadMaterial = createSpriteMaterial('target-dead', new BABYLON.Color3(0.6, 0.1, 0.1));
const slashMaterial = createSpriteMaterial('target-slash', new BABYLON.Color3(0.95, 0.65, 0.65));
const targetMaterials = [aliveMaterial, deadMaterial, slashMaterial];
target.material = aliveMaterial;

function applyTargetTexture(url, isFallback = false) {
  const texture = new BABYLON.Texture(
    url,
    scene,
    true,
    false,
    BABYLON.Texture.TRILINEAR_SAMPLINGMODE,
    () => {
      texture.hasAlpha = true;
      targetMaterials.forEach(material => {
        material.diffuseTexture = texture;
      });
      state.assetState = isFallback ? 'fallback-ready' : 'ready';
      syncDomState();
    },
    (_, message) => {
      state.lastAction = `asset-error:${message || 'unknown'}`;
      state.assetState = isFallback ? 'failed' : 'fallback';
      syncDomState();
      if (!isFallback) {
        applyTargetTexture(FALLBACK_TARGET_IMAGE, true);
      }
    },
  );
}

applyTargetTexture(targetImage);

const muzzleFlash = BABYLON.MeshBuilder.CreatePlane('flash', { width: 1.4, height: 0.5 }, scene);
muzzleFlash.parent = camera;
muzzleFlash.position = new BABYLON.Vector3(0.65, -0.35, 1.5);
const flashMat = new BABYLON.StandardMaterial('flash-mat', scene);
flashMat.emissiveColor = new BABYLON.Color3(1, 0.82, 0.35);
flashMat.alpha = 0;
muzzleFlash.material = flashMat;

const directionState = {
  down: false,
  left: false,
  right: false,
  up: false,
};

function getTargetScreenPosition() {
  const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const projected = BABYLON.Vector3.Project(
    target.getAbsolutePosition(),
    BABYLON.Matrix.IdentityReadOnly,
    scene.getTransformMatrix(),
    viewport,
  );

  return { x: projected.x, y: projected.y };
}

function canDamage() {
  return state.targetAlive && performance.now() >= state.respawnAt;
}

function setWeaponState(nextState) {
  state.weaponState = nextState;
  weaponOverlay.classList.toggle('firing', nextState === 'firing');
  weaponOverlay.classList.toggle('idle', nextState !== 'firing');
  syncDomState();
}

function setTargetDead(reason) {
  state.targetAlive = false;
  state.score += 1;
  state.respawnAt = performance.now() + (mode === 'slasher' ? 600 : 900);
  state.targetState = 'dead';
  state.lastAction = reason === 'slash' ? 'slash-hit' : 'shot-hit';
  target.material = reason === 'slash' ? slashMaterial : deadMaterial;
  target.rotation.z = reason === 'slash' ? 0.35 : -0.28;
  target.position.y = 1.1;
  syncDomState();
}

function respawnTarget() {
  state.targetAlive = true;
  state.targetState = 'alive';
  target.material = aliveMaterial;
  target.rotation.z = 0;
  target.position.y = 1.6;
  target.position.x = staticScene ? 0 : (Math.random() - 0.5) * (mode === 'slasher' ? 4 : 6);
  target.position.z = staticScene ? (mode === 'slasher' ? 1.8 : 5) : mode === 'slasher' ? 3.2 + Math.random() * 2 : 4 + Math.random() * 3;
  syncDomState();
}

function fireAwp() {
  if (performance.now() < state.shotCooldown) {
    return false;
  }

  state.lastAction = 'shot-fired';
  state.shotCooldown = performance.now() + 520;
  setWeaponState('firing');
  flashMat.alpha = 0.95;
  window.setTimeout(() => {
    setWeaponState('idle');
  }, 180);

  const pick = scene.pick(scene.pointerX, scene.pointerY, mesh => mesh === target);
  if (pick?.hit && canDamage()) {
    setTargetDead('shot');
    return true;
  }

  syncDomState();
  return false;
}

function slash() {
  if (!canDamage()) {
    return false;
  }

  const distance = BABYLON.Vector3.Distance(camera.position, target.position);
  if (distance < 2.6) {
    setTargetDead('slash');
    return true;
  }

  state.lastAction = 'slash-whiff';
  syncDomState();
  return false;
}

function onAttackStart() {
  if (mode === 'awp') {
    fireAwp();
    return;
  }

  state.movementState = 'holding';
  state.lastAction = 'slash-start';
  syncDomState();
}

function onAttackEnd() {
  if (mode === 'slasher') {
    state.movementState = 'idle';
    state.lastAction = 'slash-stop';
    syncDomState();
  }
}

function updateDirectionalState(code, isPressed) {
  const direction = DIRECTION_CODES[code];
  if (!direction) {
    return;
  }

  directionState[direction] = isPressed;
  state.dpadState = isPressed ? direction : 'idle';
  syncDomState();
}

function updateAudioState(nextState) {
  state.audioState = nextState;
  syncDomState();
}

const musicUrl = mode === 'slasher' ? slasherMusic : awpMusic;
bgm.loop = true;
bgm.volume = 0.25;
bgm.src = musicUrl;

bgm.addEventListener('canplaythrough', () => updateAudioState('ready'));
bgm.addEventListener('play', () => updateAudioState('playing'));
bgm.addEventListener('pause', () => {
  if (state.audioState !== 'error') {
    updateAudioState('paused');
  }
});
bgm.addEventListener('error', () => {
  state.lastAction = 'audio-error';
  updateAudioState('error');
});

function unlockAudio() {
  state.audioUnlockCount += 1;
  bgm.play().catch(() => {
    updateAudioState('blocked');
  });
  syncDomState();
}

canvas.addEventListener('pointerdown', event => {
  event.preventDefault();
  unlockAudio();
  onAttackStart();
});
window.addEventListener('pointerup', onAttackEnd);
window.addEventListener('keydown', event => {
  if (ATTACK_CODES.has(event.code) && !event.repeat) {
    unlockAudio();
    onAttackStart();
  }

  if (ATTACK_CODES.has(event.code) && mode === 'slasher' && event.repeat) {
    state.movementState = 'holding';
    syncDomState();
  }

  if (BACK_CODES.has(event.code)) {
    state.lastAction = 'back';
    syncDomState();
  }

  updateDirectionalState(event.code, true);
});
window.addEventListener('keyup', event => {
  if (ATTACK_CODES.has(event.code)) {
    onAttackEnd();
  }
  updateDirectionalState(event.code, false);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    bgm.pause();
    state.lastAction = 'background';
  } else {
    state.lastAction = 'foreground';
  }
  syncDomState();
});

scene.onBeforeRenderObservable.add(() => {
  const delta = engine.getDeltaTime();
  flashMat.alpha = Math.max(0, flashMat.alpha - delta * 0.01);

  state.frameSamples.push(delta);
  if (state.frameSamples.length > 180) {
    state.frameSamples.shift();
  }
  if (state.frameSamples.length >= 30) {
    const sorted = [...state.frameSamples].sort((left, right) => left - right);
    state.frameP95 = Math.round(sorted[Math.floor(sorted.length * 0.95)]);
  }

  if (!state.targetAlive && performance.now() >= state.respawnAt) {
    respawnTarget();
  }

  const lateral = (directionState.right ? 1 : 0) - (directionState.left ? 1 : 0);
  const vertical = (directionState.up ? 1 : 0) - (directionState.down ? 1 : 0);
  if (lateral || vertical) {
    camera.position.x += lateral * delta * 0.0025;
    camera.position.z += vertical * delta * 0.0025;
    state.lastAction = 'dpad-move';
  }

  if (mode === 'slasher') {
    if (state.movementState === 'holding') {
      const dir = target.position.subtract(camera.position);
      dir.y = 0;
      dir.normalize();
      camera.position.addInPlace(dir.scale(delta * 0.004));
      camera.setTarget(target.position.clone().add(new BABYLON.Vector3(0, 0.8, 0)));

      state.slashTimer += delta;
      if (state.slashTimer > 180) {
        state.slashTimer = 0;
        slash();
      }
    } else {
      state.slashTimer = 0;
    }
  } else if (!staticScene) {
    target.position.x = Math.sin(performance.now() * 0.0013) * 2.8;
  }

  syncDomState();
});

respawnTarget();
setWeaponState('idle');
engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());

window.__lainTestApi = {
  fireAtTarget() {
    const { x, y } = getTargetScreenPosition();
    scene.pointerX = x;
    scene.pointerY = y;
    return fireAwp();
  },
  getState() {
    return JSON.parse(JSON.stringify(snapshotState()));
  },
  getTargetScreenPosition,
  holdSlash(duration = 500) {
    return new Promise(resolve => {
      onAttackStart();
      window.setTimeout(() => {
        onAttackEnd();
        resolve(snapshotState());
      }, duration);
    });
  },
  unlockAudio,
};
