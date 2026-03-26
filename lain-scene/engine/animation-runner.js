function valueToBabylon(value) {
  if (value == null) {
    return value;
  }
  if (typeof value === 'number') {
    return value;
  }
  if ('a' in value) {
    return new BABYLON.Color4(value.r, value.g, value.b, value.a);
  }
  if ('r' in value) {
    return new BABYLON.Color3(value.r, value.g, value.b);
  }
  return new BABYLON.Vector3(value.x, value.y, value.z);
}

function inferAnimationType(firstValue) {
  if (typeof firstValue === 'number') {
    return BABYLON.Animation.ANIMATIONTYPE_FLOAT;
  }
  if ('a' in firstValue) {
    return BABYLON.Animation.ANIMATIONTYPE_COLOR4;
  }
  if ('r' in firstValue) {
    return BABYLON.Animation.ANIMATIONTYPE_COLOR3;
  }
  return BABYLON.Animation.ANIMATIONTYPE_VECTOR3;
}

export function createAnimationRuntime(scene, document, entityRecords) {
  const clips = new Map();

  Object.entries(document.animations || {}).forEach(([id, clip]) => {
    const targetRecord = entityRecords.get(clip.targetRef);
    if (!targetRecord || !targetRecord.node || !clip.keyframes.length) {
      return;
    }
    const animation = new BABYLON.Animation(
      id,
      clip.property,
      30,
      inferAnimationType(clip.keyframes[0].value),
      clip.loop ? BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE : BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
    );
    animation.setKeys(clip.keyframes.map(frame => ({
      frame: frame.frame,
      value: valueToBabylon(frame.value),
    })));
    clips.set(id, {
      id,
      clip,
      animation,
      target: targetRecord.node,
    });
  });

  return {
    play(id) {
      const clipRecord = clips.get(id);
      if (!clipRecord) {
        return false;
      }
      clipRecord.target.animations = [clipRecord.animation];
      const lastFrame = clipRecord.clip.keyframes[clipRecord.clip.keyframes.length - 1]?.frame || 30;
      scene.beginAnimation(clipRecord.target, 0, lastFrame, clipRecord.clip.loop);
      return true;
    },
    list() {
      return [...clips.keys()];
    },
  };
}

