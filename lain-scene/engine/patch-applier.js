function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function decodePointerToken(token) {
  return token.replaceAll('~1', '/').replaceAll('~0', '~');
}

function pointerSegments(path) {
  if (!path || path === '/') {
    return [];
  }
  return path.split('/').slice(1).map(decodePointerToken);
}

function getContainer(root, segments) {
  let current = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    current = current[segment];
  }
  return current;
}

function getValue(root, path) {
  return pointerSegments(path).reduce((current, segment) => current?.[segment], root);
}

function setValue(root, path, value, op) {
  const segments = pointerSegments(path);
  const last = segments.at(-1);
  const container = segments.length > 1 ? getContainer(root, segments) : root;
  if (Array.isArray(container)) {
    const index = last === '-' ? container.length : Number(last);
    if (op === 'add') {
      container.splice(index, 0, value);
    } else {
      container[index] = value;
    }
    return;
  }
  container[last] = value;
}

function removeValue(root, path) {
  const segments = pointerSegments(path);
  const last = segments.at(-1);
  const container = segments.length > 1 ? getContainer(root, segments) : root;
  if (Array.isArray(container)) {
    container.splice(Number(last), 1);
    return;
  }
  delete container[last];
}

export function applyJsonPatch(document, patch) {
  const nextDocument = clone(document);
  patch.forEach(operation => {
    if (operation.op === 'add' || operation.op === 'replace') {
      setValue(nextDocument, operation.path, clone(operation.value), operation.op);
      return;
    }
    if (operation.op === 'remove') {
      removeValue(nextDocument, operation.path);
      return;
    }
    if (operation.op === 'copy') {
      setValue(nextDocument, operation.path, clone(getValue(nextDocument, operation.from)), 'replace');
      return;
    }
    if (operation.op === 'move') {
      const value = clone(getValue(nextDocument, operation.from));
      removeValue(nextDocument, operation.from);
      setValue(nextDocument, operation.path, value, 'replace');
      return;
    }
    throw new Error(`Unsupported patch operation ${operation.op}.`);
  });
  return nextDocument;
}

