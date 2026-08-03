class LevelCatalogService {
    constructor(options = {}) {
        this.registry = options.registry || LEVEL_PACK_REGISTRY;
        this.auditCache = new Map();
        this.difficultyManagers = new Map();
    }

    listPacks() {
        return this.registry.getAll().map(pack => Object.freeze({
            id: pack.id,
            version: pack.version,
            name: pack.name,
            caption: pack.caption,
            levelCount: pack.levels.length,
            chapterCount: this.listChapters(pack.id).length
        }));
    }

    getPack(packId = null) {
        const resolved = this.registry.resolveId(packId);
        const pack = this.registry.get(resolved);
        if (!pack) throw new Error(`Unknown level pack ${packId}`);
        return pack;
    }

    getDefaultPackId() {
        return this.registry.defaultPackId;
    }

    listChapters(packId = null) {
        const pack = this.getPack(packId);
        if (Array.isArray(pack.chapterDescriptors)) {
            return pack.chapterDescriptors.map(chapter => Object.freeze({ ...chapter }));
        }
        return (pack.chapters || []).map((chapter, index) => Object.freeze(
            typeof chapter === 'string'
                ? { id: `chapter-${index + 1}`, order: index + 1, title: chapter }
                : { ...chapter }
        ));
    }

    listLevels(packId = null, chapterId = null) {
        const pack = this.getPack(packId);
        const levels = chapterId
            ? pack.levels.filter(level => level.chapterId === chapterId)
            : pack.levels;
        return [...levels].sort((a, b) => a.order - b.order);
    }

    getLevel(packId, levelRef) {
        const pack = this.getPack(packId);
        const level = pack.levels.find(candidate => (
            candidate.packLevelId === levelRef
            || candidate.id === levelRef
            || candidate.order === Number(levelRef)
        ));
        if (!level) throw new Error(`Unknown level ${levelRef} in pack ${pack.id}`);
        return level;
    }

    getLevelConfig(packId, levelRef) {
        const pack = this.getPack(packId);
        const level = this.getLevel(pack.id, levelRef);
        const identity = level.packLevelId || `${pack.id}-${level.order}`;
        const cacheKey = `${pack.id}@${pack.version || 'legacy'}:${identity}`;
        let audit = this.auditCache.get(cacheKey);

        if (!audit) {
            audit = this.getDifficultyManager(pack).validate(level);
            this.auditCache.set(cacheKey, audit);
        }
        if (!audit.valid) {
            throw new Error(
                `关卡 ${identity} 配置无效：${audit.errors.join('；')}`
            );
        }

        const config = JSON.parse(JSON.stringify(level));
        config.packId = pack.id;
        config.packVersion = pack.version || 'legacy';
        config.packLevelId = identity;
        config.difficulty = audit.analysis;
        return config;
    }

    getNextLevel(packId, levelRef) {
        const pack = this.getPack(packId);
        const current = this.getLevel(pack.id, levelRef);
        return [...pack.levels]
            .sort((a, b) => a.order - b.order)
            .find(level => level.order > current.order) || null;
    }

    getPreviousLevel(packId, levelRef) {
        const pack = this.getPack(packId);
        const current = this.getLevel(pack.id, levelRef);
        return [...pack.levels]
            .sort((a, b) => b.order - a.order)
            .find(level => level.order < current.order) || null;
    }

    getChapterForLevel(packId, levelRef) {
        const level = this.getLevel(packId, levelRef);
        return this.listChapters(packId)
            .find(chapter => chapter.id === level.chapterId) || null;
    }

    getDifficultyManager(pack) {
        if (this.difficultyManagers.has(pack.id)) {
            return this.difficultyManagers.get(pack.id);
        }

        const manager = pack.difficultyModel === 'nonlinear-v2'
            && typeof DifficultyModelV2 !== 'undefined'
            ? new DifficultyModelV2()
            : new DifficultyManager();
        this.difficultyManagers.set(pack.id, manager);
        return manager;
    }
}
