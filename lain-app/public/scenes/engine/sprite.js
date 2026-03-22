/**
 * PSXSprite — unified sprite utility for Babylon.js scenes.
 *
 * Usage:
 *   const s = PSXSprite(scene, { name, texture, cellW, cellH, cols, rows, width, height, pos, anims });
 *   s.play('walk', 8);
 *   scene.registerBeforeRender(() => s.update(engine.getDeltaTime(), camera));
 *   s.dispose();
 */
(function () {
  function PSXSprite(scene, cfg) {
    var cols = cfg.cols || 1;
    var rows = cfg.rows || 1;
    var anims = cfg.anims || {};

    var manager = new BABYLON.SpriteManager(
      cfg.name + '_mgr',
      cfg.texture,
      1,
      { width: cfg.cellW, height: cfg.cellH },
      scene
    );

    var spr = new BABYLON.Sprite(cfg.name, manager);
    spr.width = cfg.width || 1;
    spr.height = cfg.height || 1;
    if (cfg.pos) {
      spr.position.x = cfg.pos[0];
      spr.position.y = cfg.pos[1];
      spr.position.z = cfg.pos[2];
    }

    // animation state
    var curAnim = null;   // [fromCol, toCol]
    var curFps = 8;
    var frame = 0;
    var tick = 0;
    var row = 0;
    var facingAngle = 0;
    var playing = false;

    function play(animName, fps) {
      var a = anims[animName];
      if (!a) return;
      if (curAnim && curAnim[0] === a[0] && curAnim[1] === a[1]) {
        if (fps) curFps = fps;
        return;
      }
      curAnim = a;
      curFps = fps || 8;
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

    function update(dt, camera) {
      // direction row
      if (rows > 1 && camera) {
        var cp = camera.position;
        var toCam = Math.atan2(
          cp.z - spr.position.z,
          cp.x - spr.position.x
        );
        var rel = toCam - facingAngle;
        while (rel > Math.PI) rel -= 2 * Math.PI;
        while (rel < -Math.PI) rel += 2 * Math.PI;
        row = ((Math.round(rel / (Math.PI * 2) * 8)) % 8 + 8) % 8;
      }

      // frame animation
      if (playing && curAnim) {
        tick += dt;
        var frameMs = 1000 / curFps;
        if (tick >= frameMs) {
          tick = 0;
          var count = curAnim[1] - curAnim[0] + 1;
          frame = (frame + 1) % count;
        }
      }

      // compute cellIndex
      var col = curAnim ? curAnim[0] + frame : 0;
      spr.cellIndex = row * cols + col;
    }

    function dispose() {
      spr.dispose();
      manager.dispose();
    }

    return {
      spr: spr,
      manager: manager,
      play: play,
      stop: stop,
      setDir: setDir,
      update: update,
      dispose: dispose
    };
  }

  window.PSXSprite = PSXSprite;
})();
