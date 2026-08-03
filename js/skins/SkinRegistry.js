class SkinRegistry {
    constructor() {
        this.skins = new Map();
        this.defaultSkinId = null;
    }

    register(definition) {
        const skin = this.normalize(definition);
        if (this.skins.has(skin.id)) {
            throw new Error(`Skin ${skin.id} is already registered`);
        }
        this.skins.set(skin.id, skin);
        if (!this.defaultSkinId) this.defaultSkinId = skin.id;
        return skin;
    }

    normalize(definition) {
        if (!definition || typeof definition !== 'object') {
            throw new Error('Skin definition must be an object');
        }
        if (!this.isId(definition.id)) {
            throw new Error('Skin id must be a stable lowercase identifier');
        }
        if (!Array.isArray(definition.presets) || definition.presets.length === 0) {
            throw new Error(`Skin ${definition.id} requires at least one visual preset`);
        }

        const presetIds = new Set();
        const presets = definition.presets.map((preset, index) => {
            if (!preset || typeof preset !== 'object') {
                throw new Error(`Skin ${definition.id} preset ${index} must be an object`);
            }
            const presetId = preset.id ?? index + 1;
            if (presetIds.has(presetId)) {
                throw new Error(`Skin ${definition.id} duplicates preset ${presetId}`);
            }
            if (preset.theme && preset.theme !== definition.id) {
                throw new Error(
                    `Skin ${definition.id} contains preset for ${preset.theme}`
                );
            }
            presetIds.add(presetId);
            return preset;
        });

        const familyOrder = Array.isArray(definition.familyOrder)
            ? [...definition.familyOrder]
            : [...new Set(presets.map(preset => preset.family).filter(Boolean))];
        const knownFamilies = new Set(
            presets.map(preset => preset.family).filter(Boolean)
        );
        familyOrder.forEach(family => {
            if (!knownFamilies.has(family)) {
                throw new Error(
                    `Skin ${definition.id} family ${family} has no preset`
                );
            }
        });

        return Object.freeze({
            id: definition.id,
            name: definition.name || definition.id,
            caption: definition.caption || '',
            version: definition.version || '1.0.0',
            uiThemeId: definition.uiThemeId || definition.id,
            backgroundThemeId: definition.backgroundThemeId || definition.id,
            familyOrder: Object.freeze(familyOrder),
            semanticFamilies: Object.freeze({
                ...(definition.semanticFamilies || {})
            }),
            presets: Object.freeze([...presets])
        });
    }

    setDefault(skinId) {
        if (!this.skins.has(skinId)) {
            throw new Error(`Default skin ${skinId} is not registered`);
        }
        this.defaultSkinId = skinId;
    }

    get(skinId) {
        return this.skins.get(skinId) || null;
    }

    resolveId(skinId) {
        return this.skins.has(skinId) ? skinId : this.defaultSkinId;
    }

    getDefault() {
        return this.get(this.defaultSkinId);
    }

    getAll() {
        return [...this.skins.values()];
    }

    getSummaries() {
        return this.getAll().map(skin => Object.freeze({
            id: skin.id,
            name: skin.name,
            caption: skin.caption,
            version: skin.version
        }));
    }

    getChannelThemeId(skinId, channel) {
        const skin = this.get(this.resolveId(skinId));
        if (!skin) return null;
        return channel === 'background'
            ? skin.backgroundThemeId
            : skin.uiThemeId;
    }

    isId(value) {
        return typeof value === 'string'
            && /^[a-z0-9][a-z0-9-]*$/.test(value);
    }

    get size() {
        return this.skins.size;
    }
}

const VISUAL_SKIN_REGISTRY = new SkinRegistry();
