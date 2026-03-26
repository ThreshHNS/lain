import { createMaterial } from './material-factory.js';
import { createNodeRecord, applyMaterialToRecord, linkParent } from './node-factory.js';
import { createAnimationRuntime } from './animation-runner.js';
import { createInteractionRuntime } from './interaction-handler.js';
import { createStateMachineRuntime } from './state-machine.js';
import { applyJsonPatch } from './patch-applier.js';
import { PluginRegistry } from './plugin-registry.js';

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toColor4(color) {
  return new BABYLON.Color4(color.r, color.g, color.b, color.a == null ? 1 : color.a);
}

function toVector3(vector) {
  return new BABYLON.Vector3(vector.x, vector.y, vector.z);
}

export class SceneDSLRuntime {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = options;
    this.pluginRegistry = new PluginRegistry();
    this.engine = options.engine || new BABYLON.Engine(canvas, true, {
      adaptToDeviceRatio: true,
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.scene = null;
    this.document = null;
    this.materials = new Map();
    this.entityRecords = new Map();
    this.audio = new Map();
    this.animationRuntime = null;
    this.interactionRuntime = null;
    this.stateMachineRuntime = null;
    this.lastError = null;
    this.ready = false;
    this._renderLoopBound = () => {
      if (this.scene) {
        this.scene.render();
      }
    };
    this.engine.runRenderLoop(this._renderLoopBound);
    window.addEventListener('resize', () => this.engine.resize());
  }

  registerNodeType(typeName, factory) {
    this.pluginRegistry.registerNodeType(typeName, factory);
  }

  registerMaterialType(typeName, factory) {
    this.pluginRegistry.registerMaterialType(typeName, factory);
  }

  async loadScene(document) {
    this.disposeScene();
    this.document = deepClone(document);
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = toColor4(document.environment?.clearColor || { r: 0.02, g: 0.02, b: 0.04, a: 1 });

    this.configureEnvironment(document.environment || {});
    this.createMaterials();
    await this.createEntities();
    this.applyHierarchy();
    this.bindMaterials();
    this.createAudio();
    this.animationRuntime = createAnimationRuntime(this.scene, this.document, this.entityRecords);
    this.stateMachineRuntime = createStateMachineRuntime(this.document, this);
    this.interactionRuntime = createInteractionRuntime(this.document, this);

    this.ready = true;
    this.lastError = null;
    return this.getSceneState();
  }

  configureEnvironment(environment) {
    const cameraDef = environment.camera || {
      type: 'arc-rotate',
      position: { x: 0, y: 4, z: -10 },
      target: { x: 0, y: 0, z: 0 },
      fov: 0.8,
    };

    if (cameraDef.type === 'free' || cameraDef.type === 'universal') {
      this.camera = new BABYLON.UniversalCamera('dsl-camera', toVector3(cameraDef.position), this.scene);
      this.camera.setTarget(toVector3(cameraDef.target || { x: 0, y: 0, z: 0 }));
      this.camera.speed = 0.3;
    } else {
      const alpha = -Math.PI / 2;
      const beta = Math.PI / 3;
      const radius = BABYLON.Vector3.Distance(toVector3(cameraDef.position), toVector3(cameraDef.target || { x: 0, y: 0, z: 0 }));
      this.camera = new BABYLON.ArcRotateCamera(
        'dsl-camera',
        alpha,
        beta,
        radius || 10,
        toVector3(cameraDef.target || { x: 0, y: 0, z: 0 }),
        this.scene
      );
      this.camera.setPosition(toVector3(cameraDef.position));
    }

    this.camera.fov = cameraDef.fov || 0.8;
    this.camera.attachControl(this.canvas, true);

    if (environment.fog) {
      const fogModes = {
        linear: BABYLON.Scene.FOGMODE_LINEAR,
        exp: BABYLON.Scene.FOGMODE_EXP,
        exp2: BABYLON.Scene.FOGMODE_EXP2,
      };
      this.scene.fogMode = fogModes[environment.fog.mode] || BABYLON.Scene.FOGMODE_EXP2;
      this.scene.fogColor = new BABYLON.Color3(environment.fog.color.r, environment.fog.color.g, environment.fog.color.b);
      this.scene.fogDensity = environment.fog.density || 0.02;
    }
  }

  createMaterials() {
    Object.entries(this.document.materials || {}).forEach(([id, materialDef]) => {
      this.materials.set(id, createMaterial(this.scene, materialDef, this.pluginRegistry));
    });
  }

  async createEntities() {
    for (const [id, entity] of Object.entries(this.document.entities || {})) {
      const record = await createNodeRecord(this.scene, entity, this.pluginRegistry);
      record.id = id;
      this.entityRecords.set(id, record);
    }
  }

  applyHierarchy() {
    Object.entries(this.document.entities || {}).forEach(([id, entity]) => {
      const record = this.entityRecords.get(id);
      if (!record) {
        return;
      }
      if (entity.parent) {
        linkParent(record, this.entityRecords.get(entity.parent));
      }
      if (record.kind === 'particle-system' && typeof record.sync === 'function') {
        record.sync(entity, this);
      }
    });
  }

  bindMaterials() {
    Object.entries(this.document.entities || {}).forEach(([id, entity]) => {
      if (!entity.materialRef) {
        return;
      }
      applyMaterialToRecord(this.entityRecords.get(id), this.materials.get(entity.materialRef));
    });
  }

  createAudio() {
    Object.entries(this.document.audio || {}).forEach(([id, audioDef]) => {
      const audio = new Audio(audioDef.url);
      audio.loop = Boolean(audioDef.loop);
      audio.autoplay = Boolean(audioDef.autoplay);
      audio.volume = audioDef.volume == null ? 1 : audioDef.volume;
      this.audio.set(id, audio);
    });
  }

  runAction(actionName, params = {}, targetRef = null) {
    switch (actionName) {
      case 'play-animation':
        if (params.animationId) {
          return this.animationRuntime?.play(params.animationId) || false;
        }
        return false;
      case 'play-audio':
        if (params.audioId && this.audio.has(params.audioId)) {
          const audio = this.audio.get(params.audioId);
          audio.currentTime = 0;
          audio.play().catch(() => {});
          return true;
        }
        return false;
      case 'toggle-visibility': {
        const id = params.entityId || targetRef;
        const record = this.entityRecords.get(id);
        if (!record) {
          return false;
        }
        if ('isVisible' in record.node) {
          record.node.isVisible = !record.node.isVisible;
        } else if ('visible' in record.node) {
          record.node.visible = !record.node.visible;
        }
        return true;
      }
      case 'set-position': {
        const id = params.entityId || targetRef;
        const record = this.entityRecords.get(id);
        if (!record?.node?.position) {
          return false;
        }
        record.node.position = toVector3(params.position || { x: 0, y: 0, z: 0 });
        return true;
      }
      case 'transition-state':
        if (params.machineId && params.event) {
          return this.stateMachineRuntime?.transition(params.machineId, params.event) || false;
        }
        return false;
      case 'emit-event':
        if (params.event) {
          return this.emitEvent(params.event, params.payload || {});
        }
        return false;
      default:
        return false;
    }
  }

  emitEvent(eventName, payload = {}) {
    let handled = false;
    if (this.stateMachineRuntime) {
      Object.keys(this.document.stateMachines || {}).forEach(machineId => {
        handled = this.stateMachineRuntime.transition(machineId, eventName) || handled;
      });
    }
    window.dispatchEvent(new CustomEvent(`dsl:${eventName}`, { detail: payload }));
    return handled;
  }

  async applyPatch(patch) {
    const nextDocument = applyJsonPatch(this.document, patch);
    const requiresReload = patch.some(operation => {
      return !(
        operation.path.startsWith('/entities/') ||
        operation.path.startsWith('/materials/')
      );
    });

    this.document = nextDocument;
    if (requiresReload) {
      await this.loadScene(nextDocument);
      return this.getSceneState();
    }

    patch.forEach(operation => this.applyPatchOperation(operation));
    return this.getSceneState();
  }

  applyPatchOperation(operation) {
    const segments = operation.path.split('/').slice(1);
    const root = segments[0];
    const id = segments[1];

    if (root === 'entities') {
      if (segments.length === 2 && operation.op === 'remove') {
        const record = this.entityRecords.get(id);
        record?.dispose?.();
        this.entityRecords.delete(id);
        return;
      }
      if (segments.length === 2 && (operation.op === 'add' || operation.op === 'replace')) {
        const existing = this.entityRecords.get(id);
        existing?.dispose?.();
        const entity = this.document.entities[id];
        Promise.resolve(createNodeRecord(this.scene, entity, this.pluginRegistry)).then(record => {
          record.id = id;
          this.entityRecords.set(id, record);
          this.applyHierarchy();
          this.bindMaterials();
        });
        return;
      }
      const record = this.entityRecords.get(id);
      const entity = this.document.entities[id];
      if (record && entity && typeof record.sync === 'function') {
        record.sync(entity, this);
      }
      return;
    }

    if (root === 'materials') {
      const materialDef = this.document.materials[id];
      if (!materialDef) {
        this.materials.get(id)?.dispose?.();
        this.materials.delete(id);
        return;
      }
      this.materials.get(id)?.dispose?.();
      this.materials.set(id, createMaterial(this.scene, materialDef, this.pluginRegistry));
      this.bindMaterials();
    }
  }

  getSceneState() {
    return {
      sceneId: this.document?.metadata?.id || null,
      title: this.document?.metadata?.title || null,
      ready: this.ready,
      entityCount: this.entityRecords.size,
      materialCount: this.materials.size,
      animationCount: this.animationRuntime?.list().length || 0,
      stateMachines: this.stateMachineRuntime?.getState() || {},
      cameraType: this.camera?.getClassName?.() || null,
      lastError: this.lastError ? String(this.lastError.message || this.lastError) : null,
    };
  }

  disposeScene() {
    this.ready = false;
    this.interactionRuntime?.dispose?.();
    this.interactionRuntime = null;
    this.stateMachineRuntime = null;
    this.animationRuntime = null;
    this.audio.forEach(audio => {
      audio.pause();
      audio.src = '';
    });
    this.audio.clear();
    this.entityRecords.forEach(record => record.dispose?.());
    this.entityRecords.clear();
    this.materials.forEach(material => material.dispose?.());
    this.materials.clear();
    this.scene?.dispose();
    this.scene = null;
  }

  dispose() {
    this.disposeScene();
    this.engine.stopRenderLoop(this._renderLoopBound);
    this.engine.dispose();
  }
}

