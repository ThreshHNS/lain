export class PluginRegistry {
  constructor() {
    this.nodeFactories = new Map();
    this.materialFactories = new Map();
  }

  registerNodeType(typeName, factory) {
    this.nodeFactories.set(typeName, factory);
  }

  registerMaterialType(typeName, factory) {
    this.materialFactories.set(typeName, factory);
  }

  getNodeFactory(typeName) {
    return this.nodeFactories.get(typeName) || null;
  }

  getMaterialFactory(typeName) {
    return this.materialFactories.get(typeName) || null;
  }
}

