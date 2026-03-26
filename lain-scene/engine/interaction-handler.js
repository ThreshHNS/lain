export function createInteractionRuntime(document, runtime) {
  const disposers = [];
  const timers = [];

  function onScenePointer(pointerInfo) {
    if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERDOWN) {
      return;
    }
    const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
    Object.values(document.interactions || {}).forEach(interaction => {
      if (interaction.trigger !== 'pointer-down') {
        return;
      }
      if (interaction.targetRef && pickedMesh && pickedMesh.name !== interaction.targetRef) {
        return;
      }
      runtime.runAction(interaction.action, interaction.params || {}, interaction.targetRef || null);
    });
  }

  const pointerObserver = runtime.scene.onPointerObservable.add(onScenePointer);
  disposers.push(() => runtime.scene.onPointerObservable.remove(pointerObserver));

  Object.values(document.interactions || {}).forEach(interaction => {
    if (interaction.trigger === 'timer') {
      const intervalMs = Number(interaction.params?.intervalMs || 1000);
      const timer = window.setInterval(() => {
        runtime.runAction(interaction.action, interaction.params || {}, interaction.targetRef || null);
      }, intervalMs);
      timers.push(timer);
    }
  });

  return {
    dispose() {
      disposers.forEach(dispose => dispose());
      timers.forEach(timer => window.clearInterval(timer));
    },
  };
}

