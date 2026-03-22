const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') || 'awp';
const targetImage = params.get('targetImage') || './assets/ui/target-placeholder.svg';
const awpMusic = params.get('awpMusic') || '';
const slasherMusic = params.get('slasherMusic') || '';

const modeChip = document.getElementById('mode-chip');
const scoreLabel = document.getElementById('score');
const weaponOverlay = document.getElementById('weapon-overlay');
const bgm = document.getElementById('bgm');
const canvas = document.getElementById('renderCanvas');

modeChip.textContent = mode === 'slasher' ? 'mode: slasher' : 'mode: awp';
weaponOverlay.style.display = mode === 'awp' ? 'block' : 'none';

const engine = new BABYLON.Engine(canvas, true, {
  adaptToDeviceRatio: true,
  preserveDrawingBuffer: true,
  stencil: true,
});

const state = {
  score: 0,
  targetAlive: true,
  hitFlash: 0,
  forward: false,
  attackHold: false,
  slashTimer: 0,
  respawnAt: 0,
  shotCooldown: 0,
};

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
  ? new BABYLON.Vector3(0, 1.6, 4)
  : new BABYLON.Vector3(0, 1.6, 5);

const makeMaterial = (name, tint) => {
  const material = new BABYLON.StandardMaterial(name, scene);
  material.diffuseTexture = new BABYLON.Texture(targetImage, scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE, null, null, '#222');
  material.diffuseTexture.hasAlpha = true;
  material.useAlphaFromDiffuseTexture = true;
  material.emissiveColor = tint;
  material.backFaceCulling = false;
  return material;
};

const aliveMaterial = makeMaterial('target-alive', new BABYLON.Color3(0.95, 0.95, 0.95));
const deadMaterial = makeMaterial('target-dead', new BABYLON.Color3(0.6, 0.1, 0.1));
const slashMaterial = makeMaterial('target-slash', new BABYLON.Color3(0.95, 0.65, 0.65));
target.material = aliveMaterial;

target.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;

const muzzleFlash = BABYLON.MeshBuilder.CreatePlane('flash', { width: 1.4, height: 0.5 }, scene);
muzzleFlash.parent = camera;
muzzleFlash.position = new BABYLON.Vector3(0.65, -0.35, 1.5);
const flashMat = new BABYLON.StandardMaterial('flash-mat', scene);
flashMat.emissiveColor = new BABYLON.Color3(1, 0.82, 0.35);
flashMat.alpha = 0;
muzzleFlash.material = flashMat;

const canDamage = () => state.targetAlive && performance.now() >= state.respawnAt;

const setTargetDead = (reason) => {
  state.targetAlive = false;
  state.score += 1;
  state.hitFlash = 1;
  state.respawnAt = performance.now() + (mode === 'slasher' ? 600 : 900);
  target.material = reason === 'slash' ? slashMaterial : deadMaterial;
  target.rotation.z = reason === 'slash' ? 0.35 : -0.28;
  target.position.y = 1.1;
  scoreLabel.textContent = `score: ${state.score}`;
};

const respawnTarget = () => {
  state.targetAlive = true;
  target.material = aliveMaterial;
  target.rotation.z = 0;
  target.position.y = 1.6;
  target.position.x = (Math.random() - 0.5) * (mode === 'slasher' ? 4 : 6);
  target.position.z = mode === 'slasher' ? 3.2 + Math.random() * 2 : 4 + Math.random() * 3;
};

const fireAwp = () => {
  if (performance.now() < state.shotCooldown) {
    return;
  }

  state.shotCooldown = performance.now() + 520;
  weaponOverlay.classList.remove('idle');
  weaponOverlay.classList.add('firing');
  flashMat.alpha = 0.95;
  setTimeout(() => {
    weaponOverlay.classList.remove('firing');
    weaponOverlay.classList.add('idle');
  }, 180);

  const pick = scene.pick(scene.pointerX, scene.pointerY, mesh => mesh === target);
  if (pick?.hit && canDamage()) {
    setTargetDead('shot');
  }
};

const slash = () => {
  if (!canDamage()) {
    return;
  }

  const distance = BABYLON.Vector3.Distance(camera.position, target.position);
  if (distance < 2.6) {
    setTargetDead('slash');
  }
};

const onAttackStart = () => {
  if (mode === 'awp') {
    fireAwp();
    return;
  }

  state.attackHold = true;
  state.forward = true;
};

const onAttackEnd = () => {
  state.attackHold = false;
  if (mode === 'slasher') {
    state.forward = false;
  }
};

canvas.addEventListener('pointerdown', onAttackStart);
window.addEventListener('pointerup', onAttackEnd);
window.addEventListener('keydown', event => {
  if (event.code === 'Space') {
    onAttackStart();
  }
});
window.addEventListener('keyup', event => {
  if (event.code === 'Space') {
    onAttackEnd();
  }
});

const musicUrl = mode === 'slasher' ? slasherMusic : awpMusic;
bgm.volume = 0.45;
if (musicUrl) {
  bgm.src = musicUrl;
  const unlockAudio = () => {
    bgm.play().catch(() => {});
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
}

scene.onBeforeRenderObservable.add(() => {
  const delta = engine.getDeltaTime();
  flashMat.alpha = Math.max(0, flashMat.alpha - delta * 0.01);

  if (!state.targetAlive && performance.now() >= state.respawnAt) {
    respawnTarget();
  }

  if (mode === 'slasher') {
    if (state.forward) {
      const dir = target.position.subtract(camera.position);
      dir.y = 0;
      dir.normalize();
      camera.position.addInPlace(dir.scale(delta * 0.004));
      camera.setTarget(target.position.clone().add(new BABYLON.Vector3(0, 0.8, 0)));
    }

    if (state.attackHold) {
      state.slashTimer += delta;
      if (state.slashTimer > 180) {
        state.slashTimer = 0;
        slash();
      }
    } else {
      state.slashTimer = 0;
    }
  } else {
    target.position.x = Math.sin(performance.now() * 0.0013) * 2.8;
  }
});

respawnTarget();
engine.runRenderLoop(() => scene.render());
window.addEventListener('resize', () => engine.resize());
