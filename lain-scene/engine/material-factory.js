function toColor3(color) {
  if (!color) {
    return null;
  }
  return new BABYLON.Color3(color.r, color.g, color.b);
}

function createTexture(scene, url) {
  if (!url) {
    return null;
  }
  const texture = new BABYLON.Texture(url, scene);
  texture.hasAlpha = true;
  return texture;
}

export function createMaterial(scene, materialDef, pluginRegistry) {
  const pluginFactory = pluginRegistry.getMaterialFactory(materialDef.type);
  if (pluginFactory) {
    return pluginFactory(scene, materialDef);
  }

  let material;
  if (materialDef.type === 'pbr') {
    material = new BABYLON.PBRMaterial(materialDef.id, scene);
    if (materialDef.diffuseColor) {
      material.albedoColor = toColor3(materialDef.diffuseColor);
    }
    if (materialDef.metallic != null) {
      material.metallic = materialDef.metallic;
    }
    if (materialDef.roughness != null) {
      material.roughness = materialDef.roughness;
    }
    if (materialDef.texture) {
      material.albedoTexture = createTexture(scene, materialDef.texture);
    }
  } else if (materialDef.type === 'shader') {
    material = new BABYLON.StandardMaterial(materialDef.id, scene);
    material.emissiveColor = new BABYLON.Color3(0.8, 0.2, 0.2);
  } else {
    material = new BABYLON.StandardMaterial(materialDef.id, scene);
    if (materialDef.diffuseColor) {
      material.diffuseColor = toColor3(materialDef.diffuseColor);
    }
    if (materialDef.emissiveColor) {
      material.emissiveColor = toColor3(materialDef.emissiveColor);
    }
    if (materialDef.texture) {
      material.diffuseTexture = createTexture(scene, materialDef.texture);
    }
  }

  material.alpha = materialDef.alpha == null ? 1 : materialDef.alpha;
  return material;
}

