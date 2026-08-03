class LevelManager {
    constructor(packId = null, options = {}) {
        if (packId && typeof packId === 'object') {
            options = packId;
            packId = options.packId || null;
        }

        if (typeof APP_CONTEXT === 'undefined') {
            throw new Error('LevelManager requires APP_CONTEXT');
        }

        this.context = options.context || APP_CONTEXT;
        this.mode = options.mode === 'test' ? 'test' : 'progression';
        this.testMode = this.mode === 'test';
        this.activePackId = this.context.catalog.getPack(
            packId || this.context.getActivePackId()
        ).id;
        this.currentLevel = 1;
        this.currentConfig = null;
        this.refreshProgress();
    }

    refreshProgress() {
        const pack = this.getActivePack();
        const resume = this.context.progress.getResumeLevel(pack);
        this.maxUnlockedLevel = resume.order;
        return this.maxUnlockedLevel;
    }

    setMode(mode) {
        this.mode = mode === 'test' ? 'test' : 'progression';
        this.testMode = this.mode === 'test';
    }

    setActivePack(packId, persist = true) {
        const pack = this.context.catalog.getPack(packId);
        this.activePackId = pack.id;
        if (persist) this.context.setActivePackId(pack.id);
        this.currentLevel = pack.levels[0].order;
        this.currentConfig = null;
        this.refreshProgress();
        return pack;
    }

    getActivePack() {
        return this.context.catalog.getPack(this.activePackId);
    }

    getPacks() {
        return this.context.catalog.listPacks().map(pack => ({
            ...pack,
            chapters: this.context.catalog
                .listChapters(pack.id)
                .map(chapter => chapter.title),
            chapterDescriptors: this.context.catalog.listChapters(pack.id)
        }));
    }

    getLevelDefinitions() {
        return this.context.catalog.listLevels(this.activePackId);
    }

    getLevelConfig(levelRef) {
        return this.context.catalog.getLevelConfig(
            this.activePackId,
            levelRef
        );
    }

    startLevel(levelRef) {
        this.currentConfig = this.getLevelConfig(levelRef);
        this.currentLevel = this.currentConfig.order;
        return this.currentConfig;
    }

    completeLevel() {
        if (!this.currentConfig) return;
        this.context.complete({
            packId: this.activePackId,
            levelId: this.currentConfig.packLevelId,
            mode: this.mode
        });
        this.refreshProgress();
    }

    getCurrentConfig() {
        return this.currentConfig;
    }

    hasNextLevel() {
        if (!this.currentConfig) {
            return this.currentLevel < this.getLevelCount();
        }
        return Boolean(this.context.catalog.getNextLevel(
            this.activePackId,
            this.currentConfig.packLevelId
        ));
    }

    getNextLevel() {
        const reference = this.currentConfig?.packLevelId || this.currentLevel;
        const next = this.context.catalog.getNextLevel(
            this.activePackId,
            reference
        );
        return next ? next.order : null;
    }

    getNextLevelRoute() {
        const route = this.getCurrentRoute();
        return route ? this.context.router.nextLevelRoute(route) : null;
    }

    getCurrentRoute() {
        if (!this.currentConfig) return null;
        return this.context.router.createLevelRoute({
            packId: this.activePackId,
            levelId: this.currentConfig.packLevelId,
            mode: this.mode
        });
    }

    getLevelCount() {
        return this.getLevelDefinitions().length;
    }

    clampLevel(levelRef) {
        const level = this.context.catalog.getLevel(
            this.activePackId,
            levelRef
        );
        return level.order;
    }

    isUnlocked(levelRef) {
        return this.context.progress.isUnlocked(
            this.getActivePack(),
            levelRef
        );
    }

    resetProgress() {
        this.context.resetProgress();
        this.currentConfig = null;
        this.currentLevel = this.getActivePack().levels[0].order;
        this.refreshProgress();
    }
}
