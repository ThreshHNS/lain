export function createStateMachineRuntime(document, runtime) {
  const machines = new Map();

  Object.entries(document.stateMachines || {}).forEach(([id, definition]) => {
    machines.set(id, {
      definition,
      currentState: definition.initialState,
    });
  });

  function runActionByName(actionName, params) {
    runtime.runAction(actionName, params || {});
  }

  function enterState(machineId, nextState) {
    const machine = machines.get(machineId);
    if (!machine) {
      return;
    }
    machine.currentState = nextState;
    const stateDef = machine.definition.states[nextState];
    (stateDef?.onEnter || []).forEach(actionName => runActionByName(actionName));
  }

  return {
    getState() {
      const snapshot = {};
      machines.forEach((machine, id) => {
        snapshot[id] = machine.currentState;
      });
      return snapshot;
    },
    transition(machineId, eventName) {
      const machine = machines.get(machineId);
      if (!machine) {
        return false;
      }
      const stateDef = machine.definition.states[machine.currentState];
      const match = (machine.definition.transitions || []).find(transition =>
        transition.event === eventName && transition.fromState === machine.currentState
      );
      if (!match) {
        return false;
      }
      (stateDef?.onExit || []).forEach(actionName => runActionByName(actionName));
      enterState(machineId, match.toState);
      return true;
    },
  };
}

