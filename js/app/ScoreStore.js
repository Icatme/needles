class ScoreStore {
    constructor(options = {}) {
        this.storage = options.storage === undefined
            ? ScoreStore.getDefaultStorage()
            : options.storage;
        this.storageKey = options.storageKey || 'needle_game_scores';
        this.maxRecentRuns = Number.isInteger(options.maxRecentRuns)
            ? Math.max(1, options.maxRecentRuns)
            : 20;
        this.clock = typeof options.clock === 'function'
            ? options.clock
            : () => new Date();
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
            version: 1,
            packs: {},
            recentRuns: []
        };
    }

    loadState() {
        if (!this.storage) return this.createEmptyState();
        try {
            const saved = this.storage.getItem(this.storageKey);
            return this.normalizeState(saved ? JSON.parse(saved) : null);
        } catch (error) {
            console.warn('无法读取本机分数:', error);
            return this.createEmptyState();
        }
    }

    normalizeState(value) {
        const state = this.createEmptyState();
        if (!value || typeof value !== 'object') return state;

        Object.entries(value.packs || {}).forEach(([packId, packValue]) => {
            const bestByLevel = {};
            Object.entries(packValue?.bestByLevel || {}).forEach(([
                levelId,
                recordValue
            ]) => {
                const record = this.normalizeRecord(recordValue);
                if (record && record.packId === packId && record.levelId === levelId) {
                    bestByLevel[levelId] = record;
                }
            });
            state.packs[packId] = { bestByLevel };
        });

        state.recentRuns = (Array.isArray(value.recentRuns)
            ? value.recentRuns
            : [])
            .map(record => this.normalizeRecord(record))
            .filter(Boolean)
            .slice(0, this.maxRecentRuns);
        return state;
    }

    normalizeRecord(value) {
        if (!value || typeof value !== 'object') return null;
        if (typeof value.packId !== 'string' || typeof value.levelId !== 'string') {
            return null;
        }
        if (typeof value.contractId !== 'string' || value.contractId.length === 0) {
            return null;
        }
        if (!Number.isFinite(value.score) || value.score < 0) return null;

        return {
            packId: value.packId,
            packVersion: typeof value.packVersion === 'string'
                ? value.packVersion
                : 'legacy',
            levelId: value.levelId,
            contractId: value.contractId,
            levelOrder: Number.isFinite(value.levelOrder)
                ? Math.max(1, Math.floor(value.levelOrder))
                : null,
            levelName: typeof value.levelName === 'string' ? value.levelName : '',
            score: Math.max(0, Math.round(value.score)),
            elapsedMs: Math.max(0, Number(value.elapsedMs) || 0),
            maxCombo: Math.max(0, Math.floor(Number(value.maxCombo) || 0)),
            breakdown: ScoreStore.normalizeCounters(value.breakdown),
            precisionCounts: ScoreStore.normalizeCounters(value.precisionCounts),
            completedAt: ScoreStore.normalizeDate(value.completedAt)
        };
    }

    recordRun(run = {}) {
        const rejection = this.validateRun(run);
        if (rejection) {
            return Object.freeze({
                accepted: false,
                reason: rejection,
                isPersonalBest: false,
                record: null,
                best: null
            });
        }

        const record = this.normalizeRecord({
            packId: run.packId,
            packVersion: run.packVersion,
            levelId: run.levelId,
            contractId: run.contractId,
            levelOrder: run.levelOrder,
            levelName: run.levelName,
            score: run.score.score,
            elapsedMs: run.score.elapsedMs,
            maxCombo: run.score.maxCombo,
            breakdown: run.score.breakdown,
            precisionCounts: run.score.precisionCounts,
            completedAt: this.nowIso()
        });
        const pack = this.ensurePack(record.packId);
        const stored = pack.bestByLevel[record.levelId] || null;
        const previous = stored?.contractId === record.contractId ? stored : null;
        const isPersonalBest = !previous || ScoreStore.isBetter(record, previous);

        if (isPersonalBest) {
            pack.bestByLevel[record.levelId] = record;
        }
        this.state.recentRuns.unshift(record);
        this.state.recentRuns = this.state.recentRuns.slice(0, this.maxRecentRuns);
        this.persist();

        return Object.freeze({
            accepted: true,
            reason: null,
            isPersonalBest,
            record: ScoreStore.clone(record),
            best: ScoreStore.clone(
                isPersonalBest ? record : previous
            )
        });
    }

    validateRun(run) {
        if (run.mode !== 'progression') return 'mode';
        if (!run.success) return 'incomplete';
        if (!run.scoreEligible) return 'disabled';
        if (typeof run.packId !== 'string' || typeof run.levelId !== 'string') {
            return 'identity';
        }
        if (typeof run.contractId !== 'string' || run.contractId.length === 0) {
            return 'contract';
        }
        if (!run.score || run.score.status !== 'completed') return 'score-status';
        if (!Number.isFinite(run.score.score) || run.score.score < 0) return 'score';
        return null;
    }

    getBest(packId, levelId, contractId = null) {
        const record = this.state.packs[packId]?.bestByLevel?.[levelId] || null;
        if (contractId && record?.contractId !== contractId) return null;
        return record ? ScoreStore.clone(record) : null;
    }

    listBest(packId, options = {}) {
        const offset = Math.max(0, Math.floor(Number(options.offset) || 0));
        const limit = Number.isFinite(options.limit)
            ? Math.max(0, Math.floor(options.limit))
            : Infinity;
        const contractIds = options.contractIds
            && typeof options.contractIds.has === 'function'
            ? options.contractIds
            : null;
        return Object.values(this.state.packs[packId]?.bestByLevel || {})
            .filter(record => !contractIds || contractIds.has(record.contractId))
            .sort((left, right) => {
                const dateDelta = Date.parse(right.completedAt)
                    - Date.parse(left.completedAt);
                if (dateDelta !== 0) return dateDelta;
                return (left.levelOrder || Infinity) - (right.levelOrder || Infinity);
            })
            .slice(offset, offset + limit)
            .map(record => ScoreStore.clone(record));
    }

    countBest(packId, options = {}) {
        return this.listBest(packId, {
            contractIds: options.contractIds
        }).length;
    }

    clearPack(packId) {
        delete this.state.packs[packId];
        this.state.recentRuns = this.state.recentRuns.filter(
            record => record.packId !== packId
        );
        this.persist();
    }

    reset() {
        this.state = this.createEmptyState();
        if (!this.storage) return;
        try {
            this.storage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('无法清除本机分数:', error);
        }
    }

    snapshot() {
        return ScoreStore.clone(this.state);
    }

    ensurePack(packId) {
        if (!this.state.packs[packId]) {
            this.state.packs[packId] = { bestByLevel: {} };
        }
        return this.state.packs[packId];
    }

    nowIso() {
        const value = this.clock();
        return ScoreStore.normalizeDate(
            value instanceof Date ? value.toISOString() : value
        );
    }

    persist() {
        if (!this.storage) return;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('无法保存本机分数:', error);
        }
    }

    static isBetter(candidate, current) {
        if (candidate.score !== current.score) {
            return candidate.score > current.score;
        }
        if (candidate.elapsedMs !== current.elapsedMs) {
            return candidate.elapsedMs < current.elapsedMs;
        }
        return candidate.maxCombo > current.maxCombo;
    }

    static contractId(level = {}) {
        const packId = level.packId || 'standalone';
        const packVersion = level.packVersion || 'legacy';
        const levelId = level.packLevelId || level.levelId || level.id || 'unknown';
        const scoringProfile = level.scoring?.profileId || 'score-v1';
        return `${packId}@${packVersion}:${levelId}:${scoringProfile}`;
    }

    static normalizeCounters(value) {
        const result = {};
        Object.entries(value && typeof value === 'object' ? value : {})
            .forEach(([key, count]) => {
                if (Number.isFinite(count)) {
                    result[key] = Math.max(0, Math.round(count));
                }
            });
        return result;
    }

    static normalizeDate(value) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime())
            ? new Date(0).toISOString()
            : parsed.toISOString();
    }

    static clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
}
