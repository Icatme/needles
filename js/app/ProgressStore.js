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
            version: 2,
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

        if (value.version === 2) {
            return {
                version: 2,
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
            version: 2,
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
            record = this.normalizePackRecord(pack, record);
            this.state.packs[pack.id] = record;
        }

        return JSON.parse(JSON.stringify(record));
    }

    migrateNumericProgress(pack, legacyOrder) {
        const maxOrder = this.clampOrder(pack, legacyOrder || 1);
        const completedLevelIds = pack.levels
            .filter(level => level.order < maxOrder)
            .map(level => this.levelId(level));

        return {
            packVersion: pack.version || 'legacy',
            completedLevelIds,
            maxUnlockedOrder: maxOrder
        };
    }

    normalizePackRecord(pack, record) {
        const validIds = new Set(pack.levels.map(level => this.levelId(level)));
        const completedLevelIds = [...new Set(record.completedLevelIds || [])]
            .filter(levelId => validIds.has(levelId));
        const derivedOrder = completedLevelIds.reduce((maximum, levelId) => {
            const level = pack.levels.find(candidate => this.levelId(candidate) === levelId);
            return Math.max(maximum, level ? level.order + 1 : 1);
        }, 1);
        const requestedOrder = Number.isFinite(record.maxUnlockedOrder)
            ? record.maxUnlockedOrder
            : derivedOrder;

        return {
            packVersion: pack.version || record.packVersion || 'legacy',
            completedLevelIds,
            maxUnlockedOrder: this.clampOrder(
                pack,
                Math.max(requestedOrder, derivedOrder)
            )
        };
    }

    getResumeLevel(pack) {
        const progress = this.getPackProgress(pack);
        return pack.levels.find(level => level.order === progress.maxUnlockedOrder)
            || pack.levels.at(-1);
    }

    isUnlocked(pack, levelRef) {
        const level = this.resolveLevel(pack, levelRef);
        if (!level) return false;
        return level.order <= this.getPackProgress(pack).maxUnlockedOrder;
    }

    completeLevel(pack, levelRef, mode = 'progression') {
        const level = this.resolveLevel(pack, levelRef);
        if (!level) throw new Error(`Unknown level ${levelRef} in pack ${pack.id}`);
        if (mode !== 'progression') return this.getPackProgress(pack);

        const record = this.getPackProgress(pack);
        const completed = new Set(record.completedLevelIds);
        completed.add(this.levelId(level));
        const next = pack.levels.find(candidate => candidate.order > level.order);
        record.completedLevelIds = [...completed];
        record.maxUnlockedOrder = this.clampOrder(
            pack,
            Math.max(record.maxUnlockedOrder, next?.order || level.order)
        );
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

    clampOrder(pack, value) {
        const orders = pack.levels.map(level => level.order);
        const minimum = Math.min(...orders);
        const maximum = Math.max(...orders);
        const parsed = Math.floor(Number(value) || minimum);
        return Math.max(minimum, Math.min(parsed, maximum));
    }
}
