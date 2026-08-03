class PackRegistry {
    constructor() {
        this.packs = new Map();
        this.defaultPackId = null;
        this.loadErrors = [];
    }

    clear() {
        this.packs.clear();
        this.defaultPackId = null;
        this.loadErrors = [];
    }

    register(pack) {
        if (!pack?.id) throw new Error('Cannot register a pack without id');
        if (this.packs.has(pack.id)) throw new Error(`Pack ${pack.id} is already registered`);
        this.packs.set(pack.id, pack);
        if (!this.defaultPackId) this.defaultPackId = pack.id;
        return pack;
    }

    setDefault(packId) {
        if (!this.packs.has(packId)) throw new Error(`Default pack ${packId} is not registered`);
        this.defaultPackId = packId;
    }

    addLoadError(error) {
        this.loadErrors.push(Object.freeze({ ...error }));
    }

    get(packId) {
        return this.packs.get(packId) || null;
    }

    resolveId(packId) {
        return this.packs.has(packId) ? packId : this.defaultPackId;
    }

    getDefault() {
        return this.get(this.defaultPackId);
    }

    getAll() {
        return [...this.packs.values()];
    }

    get size() {
        return this.packs.size;
    }
}

const LEVEL_PACK_REGISTRY = new PackRegistry();
