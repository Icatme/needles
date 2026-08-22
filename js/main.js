class DailyChallengeStore {
    constructor(options = {}) {
        this.storage = options.storage === undefined
            ? DailyChallengeStore.getDefaultStorage()
            : options.storage;
        this.storageKey = options.storageKey || 'needle_game_daily_challenges';
        this.historyLimit = Number.isInteger(options.historyLimit)
            ? Math.max(1, options.historyLimit)
            : 90;
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
            bestByChallenge: {},
            history: []
        };
    }

    loadState() {
        if (!this.storage) return this.createEmptyState();
        try {
            const saved = this.storage.getItem(this.storageKey);
            return this.normalizeState(saved ? JSON.parse(saved) : null);
        } catch (error) {
            console.warn('无法读取每日挑战记录:', error);
            return this.createEmptyState();
        }
    }

    normalizeState(value) {
        const state = this.createEmptyState();
        if (!value || typeof value !== 'object') return state;
        Object.entries(value.bestByChallenge || {}).forEach(([id, recordValue]) => {
            const record = this.normalizeRecord(recordValue);
            if (record && record.challengeId === id) {
                state.bestByChallenge[id] = record;
            }
        });
        state.history = (Array.isArray(value.history) ? value.history : [])
            .map(record => this.normalizeRecord(record))
            .filter(Boolean)
            .slice(0, this.historyLimit);
        return state;
    }

    normalizeRecord(value) {
        if (!value || typeof value !== 'object') return null;
        if (typeof value.challengeId !== 'string') return null;
        if (typeof value.dateKey !== 'string') return null;
        if (typeof value.packId !== 'string' || typeof value.levelId !== 'string') {
            return null;
        }
        if (!Number.isFinite(value.score) || value.score < 0) return null;
        if (typeof value.replayDigest !== 'string') return null;
        if (typeof value.verificationDigest !== 'string') return null;

        return {
            challengeId: value.challengeId,
            dateKey: value.dateKey,
            packId: value.packId,
            levelId: value.levelId,
            levelOrder: Number.isFinite(value.levelOrder)
                ? Math.max(1, Math.floor(value.levelOrder))
                : null,
            levelName: typeof value.levelName === 'string' ? value.levelName : '',
            score: Math.max(0, Math.round(value.score)),
            elapsedMs: Math.max(0, Number(value.elapsedMs) || 0),
            maxCombo: Math.max(0, Math.floor(Number(value.maxCombo) || 0)),
            profileId: typeof value.profileId === 'string' ? value.profileId : null,
            replayDigest: value.replayDigest,
            verificationDigest: value.verificationDigest,
            completedAt: DailyChallengeStore.normalizeDate(value.completedAt)
        };
    }

    recordVerified(input = {}) {
        if (!input.verification?.verified) {
            return Object.freeze({
                accepted: false,
                reason: input.verification?.reason || 'unverified',
                isDailyBest: false,
                record: null,
                best: this.getBest(input.challenge?.id)
            });
        }
        const challenge = input.challenge || {};
        const score = input.verification.score || {};
        const record = this.normalizeRecord({
            challengeId: challenge.id,
            dateKey: challenge.dateKey,
            packId: challenge.packId,
            levelId: challenge.levelId,
            levelOrder: challenge.levelOrder,
            levelName: challenge.levelName,
            score: score.score,
            elapsedMs: score.elapsedMs,
            maxCombo: score.maxCombo,
            profileId: input.verification.profileId,
            replayDigest: input.verification.replayDigest,
            verificationDigest: input.verification.verificationDigest,
            completedAt: this.nowIso()
        });
        if (!record) {
            return Object.freeze({
                accepted: false,
                reason: 'record',
                isDailyBest: false,
                record: null,
                best: null
            });
        }

        const previous = this.state.bestByChallenge[record.challengeId] || null;
        const isDailyBest = !previous || DailyChallengeStore.isBetter(record, previous);
        if (isDailyBest) {
            this.state.bestByChallenge[record.challengeId] = record;
        }
        this.state.history.unshift(record);
        this.state.history = this.state.history.slice(0, this.historyLimit);
        this.persist();
        return Object.freeze({
            accepted: true,
            reason: null,
            isDailyBest,
            record: DailyChallengeStore.clone(record),
            best: DailyChallengeStore.clone(isDailyBest ? record : previous)
        });
    }

    getBest(challengeId) {
        if (!challengeId) return null;
        const record = this.state.bestByChallenge[challengeId] || null;
        return record ? DailyChallengeStore.clone(record) : null;
    }

    listRecent(limit = 7) {
        return this.state.history
            .slice(0, Math.max(0, Math.floor(Number(limit) || 0)))
            .map(record => DailyChallengeStore.clone(record));
    }

    reset() {
        this.state = this.createEmptyState();
        if (!this.storage) return;
        try {
            this.storage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('无法清除每日挑战记录:', error);
        }
    }

    persist() {
        if (!this.storage) return;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('无法保存每日挑战记录:', error);
        }
    }

    nowIso() {
        const value = this.clock();
        return DailyChallengeStore.normalizeDate(
            value instanceof Date ? value.toISOString() : value
        );
    }

    static isBetter(candidate, current) {
        if (candidate.score !== current.score) return candidate.score > current.score;
        if (candidate.elapsedMs !== current.elapsedMs) {
            return candidate.elapsedMs < current.elapsedMs;
        }
        return candidate.maxCombo > current.maxCombo;
    }

    static normalizeDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? new Date(0).toISOString()
            : date.toISOString();
    }

    static clone(value) {
        if (!value) return null;
        return JSON.parse(JSON.stringify(value));
    }
}

class ScoreReplayVerifier {
    verify(input = {}) {
        const replay = input.replay;
        const levelConfig = input.levelConfig;
        const claimedScore = input.score;
        if (!replay || typeof replay !== 'object') {
            return this.failure('missing-replay');
        }
        if (!levelConfig || typeof levelConfig !== 'object') {
            return this.failure('missing-level');
        }
        if (!claimedScore || typeof claimedScore !== 'object') {
            return this.failure('missing-score');
        }

        try {
            const replayDigest = ReplayProtocol.digest(replay);
            if (replay.digest !== replayDigest) {
                return this.failure('replay-digest');
            }
            const descriptor = ReplayProtocol.createLevelDescriptor(levelConfig);
            if (!ScoreReplayVerifier.equalCanonical(descriptor, replay.level)) {
                return this.failure('level-descriptor');
            }
            const replayedScore = this.replayScore(replay, levelConfig);
            const expected = ScoreReplayVerifier.scoreSummary(claimedScore);
            const actual = ScoreReplayVerifier.scoreSummary(replayedScore);
            if (!ScoreReplayVerifier.equalCanonical(expected, actual)) {
                return this.failure('score-mismatch', {
                    replayDigest,
                    expected,
                    actual
                });
            }

            const profileId = levelConfig.scoring?.profileId
                || claimedScore.profileId
                || null;
            const verificationDigest = ReplayProtocol.hashValue({
                replayDigest,
                profileId,
                score: actual
            });
            return Object.freeze({
                verified: true,
                reason: null,
                replayDigest,
                profileId,
                verificationDigest,
                score: actual
            });
        } catch (error) {
            return this.failure('verification-error', {
                detail: error.message
            });
        }
    }

    replayScore(replay, levelConfig) {
        const geometry = replay.geometry || {};
        const session = new GameSession(levelConfig, {
            impactAngle: Number.isFinite(geometry.impactAngle)
                ? geometry.impactAngle
                : undefined,
            geometry
        });
        const score = new ScoreSession(levelConfig, { enabled: true });
        let cursorMs = 0;

        (replay.commands || []).forEach((command, index) => {
            if (command.sequence !== index + 1) {
                throw new Error('Replay command sequence is not contiguous');
            }
            const atMs = Math.max(0, Number(command.atMs) || 0);
            if (atMs < cursorMs) {
                throw new Error('Replay command time moved backwards');
            }
            const deltaMs = atMs - cursorMs;
            session.advance(deltaMs);
            score.advance(deltaMs);
            cursorMs = atMs;

            let result;
            if (command.type === 'begin-shot') {
                result = session.beginShot();
                if (result.accepted && score.status === 'idle') score.start();
            } else if (command.type === 'resolve-impact') {
                result = session.resolveImpact();
                if (result.collided) {
                    score.fail();
                } else {
                    score.recordInsertion(result.placement);
                    if (result.completed) score.complete();
                }
            } else if (command.type === 'release-shot-lock') {
                result = session.releaseShotLock();
            } else {
                throw new Error(`Unsupported replay command ${command.type}`);
            }

            const actualOutcome = ReplayRecorder.summarizeOutcome(
                command.type,
                result
            );
            if (!ScoreReplayVerifier.equalCanonical(actualOutcome, command.expected)) {
                throw new Error(`Replay outcome diverged at command ${command.sequence}`);
            }
        });

        return score.getSnapshot();
    }

    failure(reason, details = {}) {
        return Object.freeze({
            verified: false,
            reason,
            replayDigest: details.replayDigest || null,
            profileId: null,
            verificationDigest: null,
            score: details.actual || null,
            expected: details.expected || null,
            detail: details.detail || null
        });
    }

    static scoreSummary(snapshot = {}) {
        return ReplayProtocol.canonicalize({
            status: snapshot.status || null,
            score: Math.max(0, Math.round(Number(snapshot.score) || 0)),
            elapsedMs: Math.max(0, Number(snapshot.elapsedMs) || 0),
            insertedCount: Math.max(0, Math.floor(Number(snapshot.insertedCount) || 0)),
            maxCombo: Math.max(0, Math.floor(Number(snapshot.maxCombo) || 0)),
            comboBreaks: Math.max(0, Math.floor(Number(snapshot.comboBreaks) || 0)),
            breakdown: snapshot.breakdown || {},
            precisionCounts: snapshot.precisionCounts || {}
        });
    }

    static equalCanonical(left, right) {
        return JSON.stringify(ReplayProtocol.canonicalize(left))
            === JSON.stringify(ReplayProtocol.canonicalize(right));
    }
}

class DailyChallengeService {
    constructor(context, options = {}) {
        this.context = context;
        this.store = options.store || new DailyChallengeStore(options.storeOptions);
        this.verifier = options.verifier || new ScoreReplayVerifier();
        this.activeStorage = options.activeStorage === undefined
            ? DailyChallengeService.getSessionStorage()
            : options.activeStorage;
        this.activeKey = options.activeKey || 'needle_game_daily_active';
        this.active = this.loadActive();
        this.installRouterHooks();
    }

    static getSessionStorage() {
        try {
            return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
        } catch (error) {
            return null;
        }
    }

    getToday(packId = null, date = new Date()) {
        const resolvedPackId = packId || this.context.getActivePackId();
        const pack = this.context.catalog.getPack(resolvedPackId);
        const levels = this.context.catalog.listLevels(pack.id);
        if (levels.length === 0) {
            throw new Error(`Pack ${pack.id} has no daily challenge levels`);
        }
        const dateKey = DailyChallengeService.utcDateKey(date);
        const digest = ReplayProtocol.hashValue({
            schema: 'needles-daily-v1',
            dateKey,
            packId: pack.id,
            packVersion: pack.version || null
        });
        const seed = [...String(digest)].reduce(
            (total, character) => (
                (total * 33 + character.charCodeAt(0)) >>> 0
            ),
            5381
        );
        const level = levels[seed % levels.length];
        return Object.freeze({
            schema: 'needles-daily-v1',
            id: `daily:${dateKey}:${pack.id}:${level.packLevelId || level.id}`,
            dateKey,
            packId: pack.id,
            packVersion: pack.version || null,
            levelId: level.packLevelId || level.id,
            levelOrder: level.order,
            levelName: level.name,
            seedDigest: digest
        });
    }

    start(scene, packId = null) {
        const challenge = this.getToday(packId);
        this.active = challenge;
        this.persistActive();
        this.context.router.startLevel(scene, {
            packId: challenge.packId,
            levelId: challenge.levelId,
            mode: 'test'
        });
        return challenge;
    }

    matchRoute(route) {
        const active = this.active || this.loadActive();
        if (!active || !route) return null;
        const matches = route.mode === 'test'
            && route.packId === active.packId
            && route.levelId === active.levelId;
        return matches ? Object.freeze({ ...active }) : null;
    }

    recordVerifiedRun(input = {}) {
        const verification = this.verifier.verify({
            replay: input.replay,
            levelConfig: input.levelConfig,
            score: input.score
        });
        const stored = this.store.recordVerified({
            challenge: input.challenge,
            verification
        });
        return Object.freeze({
            accepted: stored.accepted,
            verified: verification.verified,
            reason: stored.reason || verification.reason,
            isDailyBest: stored.isDailyBest,
            record: stored.record,
            best: stored.best,
            verification
        });
    }

    getBest(challenge = null) {
        const target = challenge || this.getToday();
        return this.store.getBest(target.id);
    }

    listRecent(limit = 7) {
        return this.store.listRecent(limit);
    }

    clearActive() {
        this.active = null;
        if (!this.activeStorage) return;
        try {
            this.activeStorage.removeItem(this.activeKey);
        } catch (error) {
            console.warn('无法清除每日挑战会话:', error);
        }
    }

    loadActive() {
        if (!this.activeStorage) return null;
        try {
            const saved = this.activeStorage.getItem(this.activeKey);
            const parsed = saved ? JSON.parse(saved) : null;
            return parsed && typeof parsed.id === 'string' ? parsed : null;
        } catch (error) {
            return null;
        }
    }

    persistActive() {
        if (!this.activeStorage || !this.active) return;
        try {
            this.activeStorage.setItem(this.activeKey, JSON.stringify(this.active));
        } catch (error) {
            console.warn('无法保存每日挑战会话:', error);
        }
    }

    installRouterHooks() {
        const router = this.context?.router;
        if (!router || router.__dailyHooksInstalled) return;
        const originalMenu = router.startMenu.bind(router);
        const originalBrowser = router.startLevelBrowser.bind(router);
        router.startMenu = scene => {
            this.clearActive();
            return originalMenu(scene);
        };
        router.startLevelBrowser = (scene, options = {}) => {
            this.clearActive();
            return originalBrowser(scene, options);
        };
        router.__dailyHooksInstalled = true;
    }

    static utcDateKey(date = new Date()) {
        const value = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(value.getTime())) {
            throw new Error('Daily challenge date is invalid');
        }
        return value.toISOString().slice(0, 10);
    }
}

class DailyChallengeOverlay {
    constructor(scene, challenge) {
        this.scene = scene;
        this.challenge = challenge;
        this.layout = LayoutManager.getSceneLayout('game');
        const ui = SceneUI.getPalette();
        this.text = this.scene.add.text(
            CONSTANTS.WIDTH / 2,
            this.layout.hud.progressY + 30,
            `DAILY · ${challenge.dateKey} · #${String(challenge.levelOrder).padStart(2, '0')}`,
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '10px',
                color: ui.TEXT_ACCENT,
                letterSpacing: 0.8
            }
        );
        this.text.setOrigin(0.5, 0);
        this.text.setDepth(105);
    }

    update(scoreSnapshot) {
        if (!this.text || !scoreSnapshot) return;
        this.text.setAlpha(scoreSnapshot.status === 'failed' ? 0.55 : 1);
    }

    destroy() {
        if (this.text?.active) this.text.destroy();
        this.text = null;
    }
}

const DAILY_CHALLENGES = new DailyChallengeService(APP_CONTEXT);

// 在 Phaser 创建渲染器前选择显示模板并应用逻辑画布尺寸。
LayoutManager.bootstrap();
HiDPIRenderer.install();

const scaleBounds = LayoutManager.getScaleBounds();

// Phaser 游戏配置
const config = {
    type: Phaser.AUTO,
    width: HiDPIRenderer.getBackingWidth(),
    height: HiDPIRenderer.getBackingHeight(),
    parent: 'game-container',
    backgroundColor: CONSTANTS.UI.BACKGROUND,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        autoRound: true,
        min: scaleBounds.min,
        max: scaleBounds.max
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [
        BootScene,
        ScoringMenuScene,
        PlaytestLevelSelectScene,
        ScoringGameScene,
        ScoringGameOverScene
    ],
    input: {
        touch: true,
        mouse: true
    },
    render: {
        antialias: true,
        pixelArt: false
    }
};

// 初始化游戏
let game;

document.addEventListener('DOMContentLoaded', () => {
    game = new Phaser.Game(config);

    // 防止移动端页面滚动和缩放
    document.addEventListener('touchmove', (event) => {
        event.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturestart', (event) => {
        event.preventDefault();
    });

    document.addEventListener('gesturechange', (event) => {
        event.preventDefault();
    });

    document.addEventListener('gestureend', (event) => {
        event.preventDefault();
    });
});

let resizeTimer = null;

function handleViewportChange() {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
        const change = LayoutManager.inspectViewportChange();

        // 逻辑画布尺寸跨模板变化时，完整重建 Phaser，避免运行时相机和纹理残留旧尺寸。
        if (change.changed) {
            window.location.reload();
            return;
        }

        requestAnimationFrame(() => {
            if (game?.scale) game.scale.refresh();
        });
    }, 140);
}

window.addEventListener('resize', handleViewportChange);
window.addEventListener('orientationchange', handleViewportChange);
