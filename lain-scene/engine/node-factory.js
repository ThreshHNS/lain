function toVector3(vector) {
  return new BABYLON.Vector3(vector.x, vector.y, vector.z);
}

function applyTransform(target, entity) {
  if (target.position) {
    target.position.copyFrom(toVector3(entity.position));
  }
  if (target.rotation) {
    target.rotation.copyFrom(toVector3(entity.rotation));
  }
  if (target.scaling) {
    target.scaling.copyFrom(toVector3(entity.scale));
  } else if (typeof target.width === 'number' && typeof target.height === 'number') {
    target.width = entity.scale.x;
    target.height = entity.scale.y;
  }
  if ('isVisible' in target) {
    target.isVisible = entity.visible !== false;
  } else if ('visible' in target) {
    target.visible = entity.visible !== false;
  }
}

function createMesh(scene, entity) {
  const options = {};
  if (entity.width != null) options.width = entity.width;
  if (entity.height != null) options.height = entity.height;
  if (entity.depth != null) options.depth = entity.depth;
  if (entity.diameter != null) options.diameter = entity.diameter;
  if (entity.diameterTop != null) options.diameterTop = entity.diameterTop;
  if (entity.diameterBottom != null) options.diameterBottom = entity.diameterBottom;
  if (entity.tessellation != null) options.tessellation = entity.tessellation;

  switch (entity.shape) {
    case 'ground':
      return BABYLON.MeshBuilder.CreateGround(entity.id, {
        width: options.width || 10,
        height: options.height || 10,
      }, scene);
    case 'plane':
      return BABYLON.MeshBuilder.CreatePlane(entity.id, {
        width: options.width || 1,
        height: options.height || 1,
      }, scene);
    case 'sphere':
      return BABYLON.MeshBuilder.CreateSphere(entity.id, {
        diameter: options.diameter || options.width || 1,
        segments: options.tessellation || 16,
      }, scene);
    case 'cylinder':
      return BABYLON.MeshBuilder.CreateCylinder(entity.id, {
        height: options.height || 1,
        diameter: options.diameter || 1,
        diameterTop: options.diameterTop,
        diameterBottom: options.diameterBottom,
        tessellation: options.tessellation || 16,
      }, scene);
    case 'box':
    default:
      return BABYLON.MeshBuilder.CreateBox(entity.id, {
        width: options.width || 1,
        height: options.height || 1,
        depth: options.depth || 1,
      }, scene);
  }
}

function createLight(scene, entity) {
  const color = new BABYLON.Color3(entity.color.r, entity.color.g, entity.color.b);
  switch (entity.lightType) {
    case 'point':
      return new BABYLON.PointLight(entity.id, toVector3(entity.position), scene);
    case 'directional': {
      const light = new BABYLON.DirectionalLight(entity.id, toVector3(entity.direction || { x: 0, y: -1, z: 0 }), scene);
      light.position = toVector3(entity.position);
      light.diffuse = color;
      return light;
    }
    case 'spot': {
      const light = new BABYLON.SpotLight(
        entity.id,
        toVector3(entity.position),
        toVector3(entity.direction || { x: 0, y: -1, z: 0 }),
        entity.angle || 0.8,
        2,
        scene
      );
      light.diffuse = color;
      return light;
    }
    case 'hemispheric':
    default: {
      const light = new BABYLON.HemisphericLight(entity.id, toVector3(entity.direction || { x: 0, y: 1, z: 0 }), scene);
      light.diffuse = color;
      return light;
    }
  }
}

function createSprite(scene, entity) {
  const manager = new BABYLON.SpriteManager(
    `${entity.id}-manager`,
    entity.texture,
    1,
    {
      width: entity.cellWidth,
      height: entity.cellHeight,
    },
    scene
  );
  const sprite = new BABYLON.Sprite(entity.id, manager);
  sprite.position = toVector3(entity.position);
  sprite.width = entity.scale.x || 1;
  sprite.height = entity.scale.y || 1;
  sprite.isVisible = entity.visible !== false;
  return {
    kind: 'sprite',
    node: sprite,
    manager,
    animationNames: Object.keys(entity.animations || {}),
    sync(nextEntity) {
      sprite.position = toVector3(nextEntity.position);
      sprite.width = nextEntity.scale.x || 1;
      sprite.height = nextEntity.scale.y || 1;
      sprite.isVisible = nextEntity.visible !== false;
    },
    dispose() {
      sprite.dispose();
      manager.dispose();
    },
  };
}

export async function createNodeRecord(scene, entity, pluginRegistry) {
  if (entity.type === 'sprite') {
    return createSprite(scene, entity);
  }

  if (entity.type === 'custom') {
    const factory = pluginRegistry.getNodeFactory(entity.typeName);
    if (!factory) {
      throw new Error(`No custom node factory registered for ${entity.typeName}.`);
    }
    const customNode = await factory(scene, entity);
    applyTransform(customNode, entity);
    return {
      kind: 'node',
      node: customNode,
      sync(nextEntity) {
        applyTransform(customNode, nextEntity);
      },
      dispose() {
        customNode.dispose?.();
      },
    };
  }

  if (entity.type === 'group') {
    const node = new BABYLON.TransformNode(entity.id, scene);
    applyTransform(node, entity);
    return {
      kind: 'node',
      node,
      sync(nextEntity) {
        applyTransform(node, nextEntity);
      },
      dispose() {
        node.dispose();
      },
    };
  }

  if (entity.type === 'light') {
    const light = createLight(scene, entity);
    light.intensity = entity.intensity == null ? 1 : entity.intensity;
    if (entity.range != null) {
      light.range = entity.range;
    }
    return {
      kind: 'light',
      node: light,
      sync(nextEntity) {
        light.position = toVector3(nextEntity.position);
        if (light.direction && nextEntity.direction) {
          light.direction = toVector3(nextEntity.direction);
        }
        light.intensity = nextEntity.intensity == null ? 1 : nextEntity.intensity;
      },
      dispose() {
        light.dispose();
      },
    };
  }

  if (entity.type === 'particle-system') {
    const system = new BABYLON.ParticleSystem(entity.id, entity.capacity || 200, scene);
    if (entity.texture) {
      system.particleTexture = new BABYLON.Texture(entity.texture, scene);
    }
    system.emitRate = entity.emitRate || 10;
    system.minSize = entity.minSize || 0.1;
    system.maxSize = entity.maxSize || 0.4;
    system.minLifeTime = entity.minLifeTime || 0.2;
    system.maxLifeTime = entity.maxLifeTime || 1.0;
    system.start();
    return {
      kind: 'particle-system',
      node: system,
      sync(nextEntity, runtime) {
        if (nextEntity.emitter) {
          const emitterRecord = runtime.entityRecords.get(nextEntity.emitter);
          system.emitter = emitterRecord ? emitterRecord.node : null;
        }
        system.emitRate = nextEntity.emitRate || 10;
      },
      dispose() {
        system.dispose();
      },
    };
  }

  if (entity.type === 'imported-model') {
    const anchor = new BABYLON.TransformNode(entity.id, scene);
    applyTransform(anchor, entity);
    try {
      const result = await BABYLON.SceneLoader.ImportMeshAsync('', '', entity.url, scene);
      result.meshes.forEach(mesh => {
        if (mesh !== anchor) {
          mesh.parent = anchor;
        }
      });
    } catch (error) {
      console.warn('Imported model failed to load', entity.url, error);
    }
    return {
      kind: 'node',
      node: anchor,
      sync(nextEntity) {
        applyTransform(anchor, nextEntity);
      },
      dispose() {
        anchor.dispose(false, true);
      },
    };
  }

  const mesh = createMesh(scene, entity);
  applyTransform(mesh, entity);
  return {
    kind: 'node',
    node: mesh,
    sync(nextEntity) {
      applyTransform(mesh, nextEntity);
    },
    dispose() {
      mesh.dispose(false, true);
    },
  };
}

export function applyMaterialToRecord(record, material) {
  if (!record || !material) {
    return;
  }
  if (record.kind === 'node' && 'material' in record.node) {
    record.node.material = material;
  }
}

export function linkParent(record, parentRecord) {
  if (!record || !parentRecord) {
    return;
  }
  if (record.kind === 'sprite') {
    return;
  }
  if ('parent' in record.node) {
    record.node.parent = parentRecord.node;
  }
}

