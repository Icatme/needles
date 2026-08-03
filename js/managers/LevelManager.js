const LEVEL_AUDIT_CACHE = new Map();

class LevelManager {
    constructor() {
        this.difficultyManager = new DifficultyManager();
        this.currentLevel = 1;
        this.maxUnlockedLevel = this.loadProgress();
        this.currentConfig = null;
    }

    loadProgress() {
        try {
            const saved = localStorage.getItem(CONSTANTS.STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                return this.clampLevel(data.maxLevel);
            }
        } catch (error) {
            console.warn('无法读取游戏进度:', error);
        }
        return 1;
    }

    saveProgress() {
        try {
            localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify({
                maxLevel: this.maxUnlockedLevel
            }));
        } catch (error) {
            console.warn('无法保存游戏进度:', error);
        }
    }

    getLevelConfig(levelId) {
        const level = this.clampLevel(levelId);
        const config = JSON.parse(JSON.stringify(LEVEL_DEFINITIONS[level - 1]));
        let audit = LEVEL_AUDIT_CACHE.get(level);

        if (!audit) {
            audit = this.difficultyManager.validate(config);
            LEVEL_AUDIT_CACHE.set(level, audit);
        }

        if (!audit.valid) {
            throw new Error(`关卡 ${level} 配置无效：${audit.errors.join('；')}`);
        }

        config.difficulty = audit.analysis;
        return config;
    }

    startLevel(levelId) {
        this.currentLevel = this.clampLevel(levelId);
        this.currentConfig = this.getLevelConfig(this.currentLevel);
        return this.currentConfig;
    }

    completeLevel() {
        if (!this.hasNextLevel()) return;

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
        return this.currentLevel < LEVEL_DEFINITIONS.length;
    }

    getNextLevel() {
        return this.hasNextLevel() ? this.currentLevel + 1 : null;
    }

    getLevelCount() {
        return LEVEL_DEFINITIONS.length;
    }

    clampLevel(levelId) {
        const parsed = Math.floor(Number(levelId) || 1);
        return Math.max(1, Math.min(parsed, LEVEL_DEFINITIONS.length));
    }

    resetProgress() {
        this.maxUnlockedLevel = 1;
        this.currentLevel = 1;
        try {
            localStorage.removeItem(CONSTANTS.STORAGE_KEY);
        } catch (error) {
            console.warn('无法清除游戏进度:', error);
        }
    }
}
