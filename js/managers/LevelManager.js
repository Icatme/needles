const LEVEL_AUDIT_CACHE = new Map();

class LevelManager {
    constructor(packId = null) {
        this.packs = this.getPackCatalog();
        this.activePackId = this.resolvePackId(packId || this.loadActivePackId());
        this.difficultyManager = this.createDifficultyManager(this.activePackId);
        this.currentLevel = 1;
        this.maxUnlockedLevel = this.loadProgress();
        this.currentConfig = null;
        this.testMode = this.loadTestMode();
    }

    getPackCatalog() {
        if (typeof LEVEL_PACKS !== 'undefined') {
            return LEVEL_PACKS;
        }

        return {
            legacy: {
                id: 'legacy',
                name: '默认关卡',
                caption: '',
                difficultyModel: 'legacy-linear',
                chapters: ['第一章', '第二章', '第三章', '第四章', '第五章'],
                levels: LEVEL_DEFINITIONS
            }
        };
    }

    getDefaultPackId() {
        if (
            typeof DEFAULT_LEVEL_PACK_ID !== 'undefined'
            && this.packs[DEFAULT_LEVEL_PACK_ID]
        ) {
            return DEFAULT_LEVEL_PACK_ID;
        }
        return Object.keys(this.packs)[0];
    }

    getPackStorageKey() {
        return typeof LEVEL_PACK_STORAGE_KEY !== 'undefined'
            ? LEVEL_PACK_STORAGE_KEY
            : 'needle_game_level_pack';
    }

    resolvePackId(packId) {
        return this.packs[packId] ? packId : this.getDefaultPackId();
    }

    loadActivePackId() {
        try {
            const saved = localStorage.getItem(this.getPackStorageKey());
            if (saved && this.packs[saved]) return saved;
        } catch (error) {
            console.warn('无法读取关卡方案:', error);
        }
        return this.getDefaultPackId();
    }

    setActivePack(packId, persist = true) {
        const resolved = this.resolvePackId(packId);
        this.activePackId = resolved;
        this.difficultyManager = this.createDifficultyManager(resolved);
        this.currentLevel = 1;
        this.currentConfig = null;
        this.maxUnlockedLevel = this.loadProgress();

        if (persist) {
            try {
                localStorage.setItem(this.getPackStorageKey(), resolved);
            } catch (error) {
                console.warn('无法保存关卡方案:', error);
            }
        }

        return this.getActivePack();
    }

    getActivePack() {
        return this.packs[this.activePackId];
    }

    getPacks() {
        return Object.values(this.packs).map(pack => ({
            id: pack.id,
            name: pack.name,
            caption: pack.caption,
            chapters: [...(pack.chapters || [])],
            levelCount: pack.levels.length
        }));
    }

    getLevelDefinitions() {
        return this.getActivePack().levels;
    }

    createDifficultyManager(packId) {
        const pack = this.packs[packId];

        if (
            pack?.difficultyModel === 'nonlinear-v2'
            && typeof DifficultyModelV2 !== 'undefined'
        ) {
            return new DifficultyModelV2();
        }

        return new DifficultyManager();
    }

    loadProgress() {
        try {
            const saved = localStorage.getItem(CONSTANTS.STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                const packLevel = data.packs?.[this.activePackId];
                const legacyLevel = data.maxLevel;
                return this.clampLevel(packLevel ?? legacyLevel);
            }
        } catch (error) {
            console.warn('无法读取游戏进度:', error);
        }
        return 1;
    }

    saveProgress() {
        try {
            let data = {};
            const saved = localStorage.getItem(CONSTANTS.STORAGE_KEY);

            if (saved) {
                try {
                    data = JSON.parse(saved) || {};
                } catch (error) {
                    data = {};
                }
            }

            const packs = {
                ...(data.packs || {}),
                [this.activePackId]: this.maxUnlockedLevel
            };
            localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify({
                ...data,
                maxLevel: this.maxUnlockedLevel,
                packs
            }));
        } catch (error) {
            console.warn('无法保存游戏进度:', error);
        }
    }

    loadTestMode() {
        try {
            return typeof sessionStorage !== 'undefined'
                && sessionStorage.getItem('needle_game_test_mode') === '1';
        } catch (error) {
            return false;
        }
    }

    getLevelConfig(levelId) {
        const level = this.clampLevel(levelId);
        const definitions = this.getLevelDefinitions();
        const config = JSON.parse(JSON.stringify(definitions[level - 1]));
        const cacheKey = `${this.activePackId}:${level}`;
        let audit = LEVEL_AUDIT_CACHE.get(cacheKey);

        if (!audit) {
            audit = this.difficultyManager.validate(config);
            LEVEL_AUDIT_CACHE.set(cacheKey, audit);
        }

        if (!audit.valid) {
            throw new Error(`关卡 ${level} 配置无效：${audit.errors.join('；')}`);
        }

        config.packId = this.activePackId;
        config.difficulty = audit.analysis;
        return config;
    }

    startLevel(levelId) {
        this.currentLevel = this.clampLevel(levelId);
        this.currentConfig = this.getLevelConfig(this.currentLevel);
        return this.currentConfig;
    }

    completeLevel() {
        if (this.testMode || !this.hasNextLevel()) return;

        const unlockedLevel = this.currentLevel + 1;
        if (unlockedLevel > this.maxUnlockedLevel) {
            this.maxUnlockedLevel = unlockedLevel;
            this.saveProgress();
        }
    }

    getCurrentConfig() {
        return this.currentConfig;
    }

    hasNextLevel() {
        return this.currentLevel < this.getLevelDefinitions().length;
    }

    getNextLevel() {
        return this.hasNextLevel() ? this.currentLevel + 1 : null;
    }

    getLevelCount() {
        return this.getLevelDefinitions().length;
    }

    clampLevel(levelId) {
        const parsed = Math.floor(Number(levelId) || 1);
        const levelCount = this.getLevelDefinitions().length;
        return Math.max(1, Math.min(parsed, levelCount));
    }

    resetProgress() {
        this.maxUnlockedLevel = 1;
        this.currentLevel = 1;
        this.currentConfig = null;
        try {
            localStorage.removeItem(CONSTANTS.STORAGE_KEY);
        } catch (error) {
            console.warn('无法清除游戏进度:', error);
        }
    }
}
