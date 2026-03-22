(function () {
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pointerDistance(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function PSXGestures(surface, options) {
    options = options || {};

    var pointers = Object.create(null);
    var primaryId = null;
    var lookId = null;
    var holdTimer = 0;
    var holdActive = false;
    var moveActive = false;
    var moveX = 0;
    var moveY = 0;
    var lookDX = 0;
    var lookDY = 0;
    var zoomDelta = 0;
    var pinchBaseline = 0;

    var deadZone = options.deadZone == null ? 16 : options.deadZone;
    var moveRadius = options.moveRadius == null ? 96 : options.moveRadius;
    var tapMaxMs = options.tapMaxMs == null ? 220 : options.tapMaxMs;
    var holdDelayMs = options.holdDelayMs == null ? 260 : options.holdDelayMs;

    if (surface && surface.style) {
      surface.style.touchAction = 'none';
    }

    function activePointerIds() {
      return Object.keys(pointers);
    }

    function activePointerCount() {
      return activePointerIds().length;
    }

    function getPrimaryPointer() {
      return primaryId != null ? pointers[primaryId] : null;
    }

    function getLookPointer() {
      return lookId != null ? pointers[lookId] : null;
    }

    function getTwoPointers() {
      var ids = activePointerIds();
      if (ids.length < 2) return null;
      return [pointers[ids[0]], pointers[ids[1]]];
    }

    function clearHoldTimer() {
      if (!holdTimer) return;
      clearTimeout(holdTimer);
      holdTimer = 0;
    }

    function resetMove() {
      moveActive = false;
      moveX = 0;
      moveY = 0;
    }

    function endHold(pointer) {
      if (!holdActive) return;
      holdActive = false;
      if (options.onHoldEnd) options.onHoldEnd(pointer || null);
    }

    function startHoldTimer(pointer) {
      clearHoldTimer();
      holdTimer = setTimeout(function () {
        var primary = getPrimaryPointer();
        if (!primary || primary.id !== pointer.id) return;
        if (moveActive || activePointerCount() > 1) return;
        holdActive = true;
        if (options.onHoldStart) options.onHoldStart(primary);
      }, holdDelayMs);
    }

    function refreshPinchBaseline() {
      var pair = getTwoPointers();
      pinchBaseline = pair ? pointerDistance(pair[0], pair[1]) : 0;
    }

    function promoteRemainingPointer() {
      if (primaryId != null) return;
      var ids = activePointerIds();
      for (var i = 0; i < ids.length; i++) {
        var pointer = pointers[ids[i]];
        if (!pointer || pointer.button === 2) continue;
        primaryId = pointer.id;
        pointer.startX = pointer.x;
        pointer.startY = pointer.y;
        pointer.startTime = Date.now();
        if (activePointerCount() === 1) startHoldTimer(pointer);
        return;
      }
    }

    function setMoveFromPointer(pointer) {
      var dx = pointer.x - pointer.startX;
      var dy = pointer.y - pointer.startY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > deadZone) {
        moveActive = true;
        clearHoldTimer();
      }
      if (!moveActive) return;
      moveX = clamp(dx / moveRadius, -1, 1);
      moveY = clamp(dy / moveRadius, -1, 1);
    }

    function onPointerDown(event) {
      if (event.button === 1) return;

      var pointer = {
        id: event.pointerId,
        button: event.button,
        type: event.pointerType,
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        startTime: Date.now()
      };
      pointers[event.pointerId] = pointer;

      if (primaryId == null && event.button !== 2) {
        primaryId = event.pointerId;
        startHoldTimer(pointer);
      } else if (lookId == null) {
        lookId = event.pointerId;
        refreshPinchBaseline();
      }

      if (surface.setPointerCapture) {
        try { surface.setPointerCapture(event.pointerId); } catch (err) {}
      }

      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
    }

    function onPointerMove(event) {
      var pointer = pointers[event.pointerId];
      if (!pointer) return;

      var deltaX = event.clientX - pointer.x;
      var deltaY = event.clientY - pointer.y;
      pointer.lastX = pointer.x;
      pointer.lastY = pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;

      if (event.pointerId === primaryId) {
        if (options.primaryLook) {
          clearHoldTimer();
          lookDX += deltaX;
          lookDY += deltaY;
        } else {
          setMoveFromPointer(pointer);
        }
      }

      if (event.pointerId === lookId) {
        lookDX += deltaX;
        lookDY += deltaY;
      }

      if (activePointerCount() > 1) {
        clearHoldTimer();
      }

      var pair = getTwoPointers();
      if (pair && pinchBaseline > 0) {
        var nextDistance = pointerDistance(pair[0], pair[1]);
        var pinchChange = nextDistance - pinchBaseline;
        pinchBaseline = nextDistance;
        zoomDelta += pinchChange;
      }

      if (event.pointerType === 'touch') {
        event.preventDefault();
      }
    }

    function onPointerUp(event) {
      var pointer = pointers[event.pointerId];
      if (!pointer) return;

      var duration = Date.now() - pointer.startTime;
      var dx = pointer.x - pointer.startX;
      var dy = pointer.y - pointer.startY;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (event.pointerId === primaryId) {
        clearHoldTimer();
        if (!moveActive && !holdActive && pointer.button !== 2 && dist < deadZone && duration <= tapMaxMs) {
          if (options.onTap) options.onTap(pointer);
        }
        endHold(pointer);
        resetMove();
        primaryId = null;
      }

      if (event.pointerId === lookId) {
        lookId = null;
      }

      delete pointers[event.pointerId];
      promoteRemainingPointer();
      refreshPinchBaseline();

      if (surface.releasePointerCapture) {
        try { surface.releasePointerCapture(event.pointerId); } catch (err) {}
      }
    }

    function onWheel(event) {
      zoomDelta += event.deltaY;
      if (options.preventWheelDefault !== false) {
        event.preventDefault();
      }
    }

    function onContextMenu(event) {
      if (options.preventContextMenu === false) return;
      event.preventDefault();
    }

    surface.addEventListener('pointerdown', onPointerDown);
    surface.addEventListener('pointermove', onPointerMove);
    surface.addEventListener('pointerup', onPointerUp);
    surface.addEventListener('pointercancel', onPointerUp);
    surface.addEventListener('wheel', onWheel, { passive: false });
    surface.addEventListener('contextmenu', onContextMenu);

    return {
      getMoveVector: function () {
        return { x: moveX, y: moveY, active: moveActive };
      },
      consumeLookDelta: function () {
        var delta = { x: lookDX, y: lookDY };
        lookDX = 0;
        lookDY = 0;
        return delta;
      },
      consumeZoomDelta: function () {
        var delta = zoomDelta;
        zoomDelta = 0;
        return delta;
      },
      isHolding: function () {
        return holdActive;
      },
      hasLookPointer: function () {
        return !!getLookPointer();
      },
      dispose: function () {
        clearHoldTimer();
        endHold(null);
        resetMove();
        pointers = Object.create(null);
        primaryId = null;
        lookId = null;
        pinchBaseline = 0;
        lookDX = 0;
        lookDY = 0;
        zoomDelta = 0;
        surface.removeEventListener('pointerdown', onPointerDown);
        surface.removeEventListener('pointermove', onPointerMove);
        surface.removeEventListener('pointerup', onPointerUp);
        surface.removeEventListener('pointercancel', onPointerUp);
        surface.removeEventListener('wheel', onWheel);
        surface.removeEventListener('contextmenu', onContextMenu);
      }
    };
  }

  window.PSXGestures = PSXGestures;
})();
