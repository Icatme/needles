class PackLoader {
    constructor(options = {}) {
        this.registry = options.registry || LEVEL_PACK_REGISTRY;
        this.validator = options.validator || new PackValidator();
        this.resolver = options.resolver || new LevelResolver();
        this.fetchJson = options.fetchJson || PackLoader.fetchJson;
    }

    async loadIndex(indexUrl = 'packs/index.json', onProgress = null) {
        this.registry.clear();
        this.report(onProgress, { phase: 'index', completed: 0, total: 1 });

        const index = await this.fetchJson(indexUrl);
        this.validator.validateIndex(index);
        const total = index.packs.length;
        const loaded = [];
        const errors = [];

        for (let position = 0; position < index.packs.length; position++) {
            const entry = index.packs[position];
            try {
                const pack = await this.loadPack(indexUrl, entry);
                this.registry.register(pack);
                loaded.push(pack);
            } catch (error) {
                const failure = Object.freeze({
                    packId: entry.id,
                    message: error.message,
                    details: [...(error.details || [])]
                });
                errors.push(failure);
                this.registry.addLoadError(failure);
                console.error(`无法加载关卡包 ${entry.id}:`, error);
            }

            this.report(onProgress, {
                phase: 'packs',
                completed: position + 1,
                total,
                packId: entry.id
            });
        }

        if (this.registry.size === 0) {
            throw new PackValidationError('No valid level packs could be loaded', errors);
        }

        const defaultId = this.registry.get(index.defaultPackId)
            ? index.defaultPackId
            : this.registry.getAll()[0].id;
        this.registry.setDefault(defaultId);

        return Object.freeze({
            defaultPackId: defaultId,
            loadedPacks: Object.freeze([...loaded]),
            errors: Object.freeze([...errors])
        });
    }

    async loadPack(indexUrl, entry) {
        const manifestUrl = PackLoader.resolveUrl(indexUrl, entry.manifest);
        const manifest = await this.fetchJson(manifestUrl);
        const presetsUrl = PackLoader.resolveUrl(
            manifestUrl,
            manifest.resources?.presets || ''
        );
        const levelsUrl = PackLoader.resolveUrl(
            manifestUrl,
            manifest.resources?.levels || ''
        );
        const [presets, levelList] = await Promise.all([
            this.fetchJson(presetsUrl),
            this.fetchJson(levelsUrl)
        ]);

        this.validator.validateBundle(entry, manifest, presets, levelList);
        return this.resolver.resolvePack(manifest, presets, levelList);
    }

    report(callback, state) {
        if (typeof callback === 'function') callback(Object.freeze({ ...state }));
    }

    static async fetchJson(url) {
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} while loading ${url}`);
        }
        try {
            return await response.json();
        } catch (error) {
            throw new Error(`Invalid JSON in ${url}: ${error.message}`);
        }
    }

    static resolveUrl(baseUrl, relativeUrl) {
        if (typeof relativeUrl !== 'string' || relativeUrl.length === 0) {
            throw new Error(`Cannot resolve an empty resource URL from ${baseUrl}`);
        }

        try {
            const documentBase = typeof document !== 'undefined'
                ? document.baseURI
                : 'https://needles.local/';
            return new URL(relativeUrl, new URL(baseUrl, documentBase)).toString();
        } catch (error) {
            throw new Error(`Cannot resolve ${relativeUrl} from ${baseUrl}`);
        }
    }
}
