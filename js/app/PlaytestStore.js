class PlaytestStore {
    constructor(options = {}) {
        this.storage = options.storage === undefined
            ? PlaytestStore.getDefaultStorage()
            : options.storage;
        this.storageKey = options.storageKey || 'needle_game_playtests_v1';
        this.maxAttempts = Number.isInteger(options.maxAttempts)
            && options.maxAttempts > 0
            ? options.maxAttempts
            : 250;
        this.clock = options.clock || (() => new Date());
        this.state = this.loadState();
    }

    static schema() {
        return 'needles.playtest-log/v1';
    }

    static exportSchema() {
        return 'needles.playtest-export/v1';
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
            schema: PlaytestStore.schema(),
            sequence: 0,
            attempts: []
        };
    }

    loadState() {
        if (!this.storage) return this.createEmptyState();
        try {
            const saved = this.storage.getItem(this.storageKey);
            return this.normalizeState(saved ? JSON.parse(saved) : null);
        } catch (error) {
            console.warn('无法读取本地试玩记录:', error);
            return this.createEmptyState();
        }
    }

    normalizeState(value) {
        if (
            !value
            || typeof value !== 'object'
            || value.schema !== PlaytestStore.schema()
        ) {
            return this.createEmptyState();
        }

        const attempts = Array.isArray(value.attempts)
            ? value.attempts
                .filter(attempt => attempt && typeof attempt === 'object')
                .slice(-this.maxAttempts)
                .map(attempt => JSON.parse(JSON.stringify(attempt)))
            : [];
        return {
            schema: PlaytestStore.schema(),
            sequence: Math.max(
                Number.isInteger(value.sequence) ? value.sequence : 0,
                attempts.length
            ),
            attempts
        };
    }

    addAttempt(attempt) {
        if (!attempt || typeof attempt !== 'object') {
            throw new Error('PlaytestStore requires an attempt object');
        }
        if (!attempt.packId || !attempt.levelId || !attempt.result) {
            throw new Error('Playtest attempt identity and result are required');
        }

        const recordedAt = this.toIsoString(this.clock());
        const sequence = ++this.state.sequence;
        const stored = PlaytestStore.deepFreeze({
            ...JSON.parse(JSON.stringify(attempt)),
            id: `${attempt.packId}:${attempt.levelId}:${sequence}`,
            recordedAt,
            mode: 'test'
        });
        this.state.attempts.push(stored);
        if (this.state.attempts.length > this.maxAttempts) {
            this.state.attempts.splice(
                0,
                this.state.attempts.length - this.maxAttempts
            );
        }
        this.persist();
        return stored;
    }

    list() {
        return this.state.attempts.map(attempt => (
            JSON.parse(JSON.stringify(attempt))
        ));
    }

    count() {
        return this.state.attempts.length;
    }

    clear() {
        this.state = this.createEmptyState();
        if (!this.storage) return;
        try {
            this.storage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('无法清除本地试玩记录:', error);
        }
    }

    exportBundle() {
        return PlaytestStore.deepFreeze({
            schema: PlaytestStore.exportSchema(),
            exportedAt: this.toIsoString(this.clock()),
            attemptCount: this.state.attempts.length,
            attempts: this.list()
        });
    }

    persist() {
        if (!this.storage) return;
        try {
            this.storage.setItem(
                this.storageKey,
                JSON.stringify(this.state)
            );
        } catch (error) {
            console.warn('无法保存本地试玩记录:', error);
        }
    }

    toIsoString(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return new Date(0).toISOString();
        return date.toISOString();
    }

    static deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
            return value;
        }
        Object.values(value).forEach(item => PlaytestStore.deepFreeze(item));
        return Object.freeze(value);
    }
}

const PLAYTEST_STORE = new PlaytestStore();
