class AppContext {
    constructor(options = {}) {
        this.registry = options.registry || LEVEL_PACK_REGISTRY;
        this.progress = options.progress || new ProgressStore(options.progressOptions);
        this.catalog = options.catalog || new LevelCatalogService({
            registry: this.registry
        });
        this.router = options.router || new AppRouter({ catalog: this.catalog });
    }

    getActivePackId() {
        const available = this.catalog.listPacks().map(pack => pack.id);
        return this.progress.getActivePackId(
            this.catalog.getDefaultPackId(),
            available
        );
    }

    setActivePackId(packId) {
        const pack = this.catalog.getPack(packId);
        this.progress.setActivePackId(pack.id);
        return pack.id;
    }

    getResumeRoute(packId = null) {
        const resolvedPackId = packId || this.getActivePackId();
        const pack = this.catalog.getPack(resolvedPackId);
        const level = this.progress.getResumeLevel(pack);
        return this.router.createLevelRoute({
            packId: pack.id,
            levelId: level.packLevelId || level.id,
            mode: 'progression'
        });
    }

    complete(route) {
        const normalized = this.router.normalizeLevelRoute(route);
        const pack = this.catalog.getPack(normalized.packId);
        return this.progress.completeLevel(
            pack,
            normalized.levelId,
            normalized.mode
        );
    }

    resetProgress() {
        this.progress.reset();
    }
}

const APP_CONTEXT = new AppContext({ registry: LEVEL_PACK_REGISTRY });
