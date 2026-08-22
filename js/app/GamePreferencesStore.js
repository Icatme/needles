class GamePreferencesStore {
    constructor(options = {}) {
        this.storage = options.storage === undefined
            ? GamePreferencesStore.getDefaultStorage()
            : options.storage;
        this.storageKey = options.storageKey || 'needle_game_preferences';
        this.state = this.loadState();
    }

    static getDefaultStorage() {
        try {
            return typeof localStorage !== 'undefined' ? localStorage : null;
        } catch (error) {
            return null;
        }
    }

    static defaults() {
        return {
            version: 1,
            scoringEnabled: true
        };
    }

    loadState() {
        const defaults = GamePreferencesStore.defaults();
        if (!this.storage) return defaults;

        try {
            const saved = this.storage.getItem(this.storageKey);
            return this.normalize(saved ? JSON.parse(saved) : null);
        } catch (error) {
            console.warn('无法读取游戏偏好:', error);
            return defaults;
        }
    }

    normalize(value) {
        const defaults = GamePreferencesStore.defaults();
        if (!value || typeof value !== 'object') return defaults;

        return {
            version: 1,
            scoringEnabled: typeof value.scoringEnabled === 'boolean'
                ? value.scoringEnabled
                : defaults.scoringEnabled
        };
    }

    isScoringEnabled() {
        return this.state.scoringEnabled;
    }

    setScoringEnabled(enabled) {
        this.state.scoringEnabled = Boolean(enabled);
        this.persist();
        return this.state.scoringEnabled;
    }

    toggleScoring() {
        return this.setScoringEnabled(!this.state.scoringEnabled);
    }

    snapshot() {
        return { ...this.state };
    }

    persist() {
        if (!this.storage) return;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('无法保存游戏偏好:', error);
        }
    }
}
