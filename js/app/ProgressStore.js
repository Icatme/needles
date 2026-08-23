class ProgressStore {
    constructor(options = {}) {
        this.storage = options.storage === undefined
            ? ProgressStore.getDefaultStorage()
            : options.storage;
        this.storageKey = options.storageKey
            || (typeof CONSTANTS !== 'undefined'
                ? CONSTANTS.STORAGE_KEY
                : 'needle_game_progress');
        this.legacyPackKey = options.legacyPackKey || 'needle_game_level_pack';
        this.state = this.loadState();
    }

    static getDefaultStorage() {
        try {
            return typeof localStorage !== 'undefined' ? localStorage : null;
        } catch (error) {
            return null;
        }
    }

    createEmptyState() {
        return {
            version: 3,
            activePackId: null,
            packs: {},
            legacyMaxLevel: null
        };
    }

    loadState() {
        const empty = this.createEmptyState();
        if (!this.storage) return empty;

        let parsed = null;
        try {
            const saved = this.storage.getItem(this.storageKey);
            parsed = saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.warn('无法读取游戏进度:', error);
        }

        const state = this.normalizeState(parsed);
        if (!state.activePackId) {
            try {
                state.activePackId = this.storage.getItem(this.legacyPackKey) || null;
            } catch (error) {
                console.warn('无法读取旧版关卡包选择:', error);
            }
        }
        return state;
    }

    normalizeState(value) {
        if (!value || typeof value !== 'object') return this.createEmptyState();

        if (value.version === 2 || value.version === 3) {
            return {
                version: 3,
                activePackId: typeof value.activePackId === 'string'
                    ? value.activePackId
                    : null,
                packs: value.packs && typeof value.packs === 'object'
                    ? JSON.parse(JSON.stringify(value.packs))
                    : {},
                legacyMaxLevel: Number.isFinite(value.legacyMaxLevel)
                    ? value.legacyMaxLevel
                    : null
            };
        }

        return {
            version: 3,
            activePackId: null,
            packs: value.packs && typeof value.packs === 'object'
                ? JSON.parse(JSON.stringify(value.packs))
                : {},
            legacyMaxLevel: Number.isFinite(value.maxLevel)
                ? Math.floor(value.maxLevel)
                : null
        };
    }

    getActivePackId(defaultPackId, availablePackIds = []) {
        const ids = new Set(availablePackIds);
        return ids.has(this.state.activePackId)
            ? this.state.activePackId
            : defaultPackId;
    }

    setActivePackId(packId) {
        this.state.activePackId = packId;
        this.persist();
        return packId;
    }

    getPackProgress(pack) {
        if (!pack?.id || !Array.isArray(pack.levels) || pack.levels.length === 0) {
            throw new Error('ProgressStore requires a resolved non-empty pack');
        }

        let record = this.state.packs[pack.id];
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
            const legacyOrder = Number.isFinite(record)
                ? Math.floor(record)
                : this.state.legacyMaxLevel;
            record = this.migrateNumericProgress(pack, legacyOrder);
            this.state.packs[pack.id] = record;
            this.persist();
        } else {
            const storedRecord = record;
            record = this.normalizePackRecord(pack, storedRecord);
            this.state.packs[pack.id] = record;
            if (JSON.stringify(record) !== JSON.stringify(storedRecord)) {
                this.persist();
            }
        }

        return JSON.parse(JSON.stringify(record));
    }

    migrateNumericProgress(pack, legacyOrder) {
        const levels = this.orderedLevels(pack);
        const requestedPosition = Math.floor(Number(legacyOrder) || 1);
        const resumeIndex = Math.max(
            0,
            Math.min(requestedPosition - 1, levels.length - 1)
        );

        const completedLevelIds = levels
            .slice(0, resumeIndex)
            .map(level => this.levelId(level));

        return {
            packVersion: pack.version || 'legacy',
            completedLevelIds,
            resumeLevelId: this.levelId(levels[resumeIndex])
        };
    }

    normalizePackRecord(pack, record) {
        const levels = this.orderedLevels(pack);
        const validIds = new Set(levels.map(level => this.levelId(level)));
        let completedLevelIds = [...new Set(record.completedLevelIds || [])]
            .filter(levelId => validIds.has(levelId));
        let completed = new Set(completedLevelIds);

        let resumeLevel = typeof record.resumeLevelId === 'string'
            ? levels.find(level => this.levelId(level) === record.resumeLevelId)
            : null;

        if (!resumeLevel && completedLevelIds.length === 0
            && Number.isFinite(record.maxUnlockedOrder)) {
            const migrated = this.migrateNumericProgress(
                pack,
                record.maxUnlockedOrder
            );
            completedLevelIds = migrated.completedLevelIds;
            completed = new Set(completedLevelIds);
            resumeLevel = levels.find(level => (
                this.levelId(level) === migrated.resumeLevelId
            ));
        }

        if (!resumeLevel) {
            resumeLevel = levels.find(level => !completed.has(this.levelId(level)))
                || levels.at(-1);
        } else if (completed.has(this.levelId(resumeLevel))) {
            const resumeIndex = levels.indexOf(resumeLevel);
            resumeLevel = levels.slice(resumeIndex + 1)
                .find(level => !completed.has(this.levelId(level)))
                || levels.find(level => !completed.has(this.levelId(level)))
                || levels.at(-1);
        }

        return {
            packVersion: pack.version || record.packVersion || 'legacy',
            completedLevelIds,
            resumeLevelId: this.levelId(resumeLevel)
        };
    }

    getResumeLevel(pack) {
        const progress = this.getPackProgress(pack);
        return pack.levels.find(level => (
            this.levelId(level) === progress.resumeLevelId
        ));
    }

    isUnlocked(pack, levelRef) {
        const level = this.resolveLevel(pack, levelRef);
        if (!level) return false;

        const levels = this.orderedLevels(pack);
        const progress = this.getPackProgress(pack);
        const completed = new Set(progress.completedLevelIds);
        const levelId = this.levelId(level);
        if (completed.has(levelId)) return true;

        const resumeIndex = levels.findIndex(candidate => (
            this.levelId(candidate) === progress.resumeLevelId
        ));
        const levelIndex = levels.findIndex(candidate => (
            this.levelId(candidate) === levelId
        ));
        return levelIndex >= 0 && levelIndex <= resumeIndex;
    }

    completeLevel(pack, levelRef, mode = 'progression') {
        const level = this.resolveLevel(pack, levelRef);
        if (!level) throw new Error(`Unknown level ${levelRef} in pack ${pack.id}`);
        if (mode !== 'progression') return this.getPackProgress(pack);

        const record = this.getPackProgress(pack);
        const completed = new Set(record.completedLevelIds);
        completed.add(this.levelId(level));
        const levels = this.orderedLevels(pack);
        const levelIndex = levels.findIndex(candidate => (
            this.levelId(candidate) === this.levelId(level)
        ));
        const resumeIndex = levels.findIndex(candidate => (
            this.levelId(candidate) === record.resumeLevelId
        ));
        let nextIndex = levelIndex + 1;
        while (nextIndex < levels.length
            && completed.has(this.levelId(levels[nextIndex]))) {
            nextIndex += 1;
        }
        const unlockedIndex = Math.max(
            resumeIndex,
            Math.min(nextIndex, levels.length - 1)
        );
        record.completedLevelIds = [...completed];
        record.resumeLevelId = this.levelId(levels[unlockedIndex]);
        record.packVersion = pack.version || record.packVersion;
        this.state.packs[pack.id] = record;
        this.persist();
        return JSON.parse(JSON.stringify(record));
    }

    reset() {
        this.state = this.createEmptyState();
        if (this.storage) {
            try {
                this.storage.removeItem(this.storageKey);
                this.storage.removeItem(this.legacyPackKey);
            } catch (error) {
                console.warn('无法清除游戏进度:', error);
            }
        }
    }

    snapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }

    persist() {
        if (!this.storage) return;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.state));
            if (this.state.activePackId) {
                this.storage.setItem(this.legacyPackKey, this.state.activePackId);
            }
        } catch (error) {
            console.warn('无法保存游戏进度:', error);
        }
    }

    resolveLevel(pack, levelRef) {
        if (levelRef && typeof levelRef === 'object') return levelRef;
        return pack.levels.find(level => (
            this.levelId(level) === levelRef
            || level.id === levelRef
            || level.order === Number(levelRef)
        )) || null;
    }

    levelId(level) {
        return level.packLevelId || String(level.id);
    }

    orderedLevels(pack) {
        return [...pack.levels].sort((left, right) => left.order - right.order);
    }
}
