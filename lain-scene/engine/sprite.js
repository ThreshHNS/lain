(function () {
  function PSXSprite(scene, config) {
    var columns = config.cols || 1;
    var rows = config.rows || 1;
    var animations = config.anims || {};

    var manager = new BABYLON.SpriteManager(
      config.name + '_manager',
      config.texture,
      1,
      { width: config.cellW, height: config.cellH },
      scene,
    );

    var sprite = new BABYLON.Sprite(config.name, manager);
    sprite.width = config.width || 1;
    sprite.height = config.height || 1;

    if (config.pos) {
      sprite.position.x = config.pos[0];
      sprite.position.y = config.pos[1];
      sprite.position.z = config.pos[2];
    }

    var currentAnimation = null;
    var currentFps = 8;
    var frame = 0;
    var tick = 0;
    var row = 0;
    var facingAngle = 0;
    var playing = false;

    function play(animationName, fps) {
      var animation = animations[animationName];
      if (!animation) {
        return;
      }

      if (
        currentAnimation &&
        currentAnimation[0] === animation[0] &&
        currentAnimation[1] === animation[1]
      ) {
        if (fps) {
          currentFps = fps;
        }
        return;
      }

      currentAnimation = animation;
      currentFps = fps || 8;
      frame = 0;
      tick = 0;
      playing = true;
    }

    function stop() {
      playing = false;
    }

    function setDir(angle) {
      facingAngle = angle;
    }

    function update(deltaMs, camera) {
      if (rows > 1 && camera) {
        var cameraPosition = camera.position;
        var toCamera = Math.atan2(
          cameraPosition.z - sprite.position.z,
          cameraPosition.x - sprite.position.x,
        );
        var relative = toCamera - facingAngle;

        while (relative > Math.PI) {
          relative -= 2 * Math.PI;
        }
        while (relative < -Math.PI) {
          relative += 2 * Math.PI;
        }

        row = ((Math.round((relative / (Math.PI * 2)) * 8)) % 8 + 8) % 8;
      }

      if (playing && currentAnimation) {
        tick += deltaMs;
        var frameMs = 1000 / currentFps;
        if (tick >= frameMs) {
          tick = 0;
          var count = currentAnimation[1] - currentAnimation[0] + 1;
          frame = (frame + 1) % count;
        }
      }

      var column = currentAnimation ? currentAnimation[0] + frame : 0;
      sprite.cellIndex = row * columns + column;
    }

    function dispose() {
      sprite.dispose();
      manager.dispose();
    }

    return {
      dispose: dispose,
      manager: manager,
      play: play,
      setDir: setDir,
      sprite: sprite,
      spr: sprite,
      stop: stop,
      update: update,
    };
  }

  window.PSXSprite = PSXSprite;
})();
