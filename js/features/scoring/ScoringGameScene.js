class BestRunStore {
    constructor(options = {}) {
        this.storage = options.storage === undefined
            ? BestRunStore.getDefaultStorage()
            : options.storage;
        this.storageKey = options.storageKey || 'needle_game_best_runs';
        this.maxTrajectoryEntries = Number.isInteger(options.maxTrajectoryEntries)
            ? Math.max(1, options.maxTrajectoryEntries)
            : 80;
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
            packs: {}
        };
    }

    loadState() {
        if (!this.storage) return this.createEmptyState();
        try {
            const saved = this.storage.getItem(this.storageKey);
            return this.normalizeState(saved ? JSON.parse(saved) : null);
        } catch (error) {
            console.warn('无法读取个人最佳轨迹:', error);
            return this.createEmptyState();
        }
    }

    normalizeState(value) {
        const state = this.createEmptyState();
        if (!value || typeof value !== 'object') return state;

        Object.entries(value.packs || {}).forEach(([packId, packValue]) => {
            const levels = {};
            Object.entries(packValue?.levels || {}).forEach(([levelId, recordValue]) => {
                const record = this.normalizeRecord(recordValue);
                if (record && record.packId === packId && record.levelId === levelId) {
                    levels[levelId] = record;
                }
            });
            state.packs[packId] = { levels };
        });
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

        const trajectory = (Array.isArray(value.trajectory) ? value.trajectory : [])
            .map((entry, index) => BestRunStore.normalizeTrajectoryEntry(entry, index))
            .filter(Boolean)
            .sort((left, right) => left.index - right.index)
            .slice(0, this.maxTrajectoryEntries);

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
            profileId: typeof value.profileId === 'string' ? value.profileId : null,
            trajectory,
            completedAt: BestRunStore.normalizeDate(value.completedAt)
        };
    }

    recordBest(input = {}) {
        if (!input.scoreRecord?.accepted || !input.scoreRecord.isPersonalBest) {
            return Object.freeze({ accepted: false, reason: 'not-best', record: null });
        }
        if (!input.score || input.score.status !== 'completed') {
            return Object.freeze({ accepted: false, reason: 'score-status', record: null });
        }
        if (typeof input.contractId !== 'string' || input.contractId.length === 0) {
            return Object.freeze({ accepted: false, reason: 'contract', record: null });
        }

        const record = this.normalizeRecord({
            packId: input.packId,
            packVersion: input.packVersion,
            levelId: input.levelId,
            contractId: input.contractId,
            levelOrder: input.levelOrder,
            levelName: input.levelName,
            score: input.score.score,
            elapsedMs: input.score.elapsedMs,
            maxCombo: input.score.maxCombo,
            profileId: input.score.profileId || input.profileId || null,
            trajectory: input.trajectory,
            completedAt: this.nowIso()
        });
        if (!record || record.trajectory.length === 0) {
            return Object.freeze({ accepted: false, reason: 'trajectory', record: null });
        }

        const pack = this.ensurePack(record.packId);
        pack.levels[record.levelId] = record;
        this.persist();
        return Object.freeze({
            accepted: true,
            reason: null,
            record: BestRunStore.clone(record)
        });
    }

    getBest(packId, levelId, contractId = null) {
        const record = this.state.packs[packId]?.levels?.[levelId] || null;
        if (contractId && record?.contractId !== contractId) return null;
        return record ? BestRunStore.clone(record) : null;
    }

    clearPack(packId) {
        delete this.state.packs[packId];
        this.persist();
    }

    reset() {
        this.state = this.createEmptyState();
        if (!this.storage) return;
        try {
            this.storage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('无法清除个人最佳轨迹:', error);
        }
    }

    snapshot() {
        return BestRunStore.clone(this.state);
    }

    ensurePack(packId) {
        if (!this.state.packs[packId]) {
            this.state.packs[packId] = { levels: {} };
        }
        return this.state.packs[packId];
    }

    persist() {
        if (!this.storage) return;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.state));
        } catch (error) {
            console.warn('无法保存个人最佳轨迹:', error);
        }
    }

    nowIso() {
        const value = this.clock();
        return BestRunStore.normalizeDate(
            value instanceof Date ? value.toISOString() : value
        );
    }

    static normalizeTrajectoryEntry(value, fallbackIndex = 0) {
        if (!value || typeof value !== 'object') return null;
        if (!Number.isFinite(value.atMs) || !Number.isFinite(value.wheelAngle)) {
            return null;
        }
        return {
            index: Number.isInteger(value.index)
                ? Math.max(0, value.index)
                : Math.max(0, fallbackIndex),
            atMs: Math.max(0, Number(value.atMs)),
            wheelAngle: BestRunStore.normalizeAngle(value.wheelAngle),
            precisionKind: ['clear', 'close', 'threaded'].includes(value.precisionKind)
                ? value.precisionKind
                : 'clear'
        };
    }

    static normalizeAngle(value) {
        const full = Math.PI * 2;
        return ((Number(value) % full) + full) % full;
    }

    static normalizeDate(value) {
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? new Date(0).toISOString()
            : date.toISOString();
    }

    static clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
}

class BestRunComparisonHUD {
    constructor(scene, bestRun) {
        this.scene = scene;
        this.bestRun = bestRun;
        this.layout = LayoutManager.getSceneLayout('game');
        this.lastDeltaMs = null;
        const ui = SceneUI.getPalette();
        this.text = this.scene.add.text(
            this.layout.hud.rightX,
            this.layout.hud.progressY + 12,
            'PB · 等待首个分段',
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '10px',
                color: ui.TEXT_MUTED,
                letterSpacing: 0.55
            }
        );
        this.text.setOrigin(1, 0);
        this.text.setDepth(104);
    }

    updateSplit(index, currentAtMs) {
        const target = this.bestRun?.trajectory?.find(entry => entry.index === index);
        if (!target || !Number.isFinite(currentAtMs)) return null;

        this.lastDeltaMs = Number(currentAtMs) - target.atMs;
        const ui = SceneUI.getPalette();
        const ahead = this.lastDeltaMs < -49;
        const behind = this.lastDeltaMs > 49;
        const sign = this.lastDeltaMs > 0 ? '+' : (this.lastDeltaMs < 0 ? '−' : '±');
        this.text.setText(
            `PB ${sign}${(Math.abs(this.lastDeltaMs) / 1000).toFixed(1)}s`
        );
        this.text.setColor(
            ahead
                ? ui.TEXT_SUCCESS
                : (behind ? ui.TEXT_ERROR : ui.TEXT_MUTED)
        );
        return this.lastDeltaMs;
    }

    getCompletionDelta(elapsedMs) {
        if (!Number.isFinite(this.bestRun?.elapsedMs)) return null;
        return Number(elapsedMs) - this.bestRun.elapsedMs;
    }

    destroy() {
        if (this.text?.active) this.text.destroy();
        this.text = null;
    }

    static formatDelta(deltaMs) {
        if (!Number.isFinite(deltaMs)) return '';
        const sign = deltaMs > 0 ? '+' : (deltaMs < 0 ? '−' : '±');
        return `${sign}${(Math.abs(deltaMs) / 1000).toFixed(1)}s`;
    }
}

class BestRunGhost {
    constructor(scene, wheel, bestRun) {
        this.scene = scene;
        this.wheel = wheel;
        this.trajectory = [...(bestRun?.trajectory || [])]
            .sort((left, right) => left.atMs - right.atMs);
        this.revealedCount = 0;
        this.graphics = this.scene.add.graphics();
        this.graphics.setDepth(10);
    }

    update(elapsedMs = 0) {
        while (
            this.revealedCount < this.trajectory.length
            && this.trajectory[this.revealedCount].atMs <= elapsedMs
        ) {
            this.revealedCount++;
        }
        this.draw();
    }

    draw() {
        if (!this.graphics || !this.wheel) return;
        const ui = SceneUI.getPalette();
        const exposedLength = CONSTANTS.NEEDLE.LENGTH - CONSTANTS.NEEDLE.INSERT_DEPTH;
        const innerRadius = this.wheel.radius - 3;
        const outerRadius = this.wheel.radius + exposedLength;
        const rotation = Number(this.wheel.rotation) || 0;

        this.graphics.clear();
        for (let index = 0; index < this.revealedCount; index++) {
            const entry = this.trajectory[index];
            const angle = entry.wheelAngle + rotation;
            const innerX = this.wheel.x + Math.cos(angle) * innerRadius;
            const innerY = this.wheel.y + Math.sin(angle) * innerRadius;
            const outerX = this.wheel.x + Math.cos(angle) * outerRadius;
            const outerY = this.wheel.y + Math.sin(angle) * outerRadius;
            const accent = entry.precisionKind === 'threaded'
                ? ui.SUCCESS
                : ui.ACCENT;

            this.graphics.lineStyle(3, accent, 0.22);
            this.graphics.lineBetween(innerX, innerY, outerX, outerY);
            this.graphics.fillStyle(ui.SURFACE, 0.16);
            this.graphics.fillCircle(outerX, outerY, 8);
            this.graphics.lineStyle(2, accent, 0.28);
            this.graphics.strokeCircle(outerX, outerY, 8);
        }
    }

    destroy() {
        if (this.graphics?.active) this.graphics.destroy();
        this.graphics = null;
        this.trajectory = [];
        this.wheel = null;
    }
}

function installBestRunStore(context) {
    if (!context) return null;
    if (!context.bestRuns) context.bestRuns = new BestRunStore();
    if (!context.__bestRunResetWrapped) {
        const originalReset = context.resetProgress.bind(context);
        context.resetProgress = () => {
            const result = originalReset();
            context.bestRuns?.reset();
            context.badges?.reset?.();
            return result;
        };
        context.__bestRunResetWrapped = true;
    }
    return context.bestRuns;
}

if (typeof APP_CONTEXT !== 'undefined') {
    installBestRunStore(APP_CONTEXT);
}

class ScoringGameScene extends GameScene {
    create() {
        if (!APP_CONTEXT.preferences) {
            APP_CONTEXT.preferences = new GamePreferencesStore();
        }
        if (!APP_CONTEXT.scores && typeof ScoreStore !== 'undefined') {
            APP_CONTEXT.scores = new ScoreStore();
        }
        installBestRunStore(APP_CONTEXT);

        super.create();
        this.dailyChallenge = typeof DAILY_CHALLENGES !== 'undefined'
            ? DAILY_CHALLENGES.matchRoute(this.route)
            : null;
        this.scoringEnabled = this.dailyChallenge
            ? true
            : APP_CONTEXT.preferences.isScoringEnabled();
        this.scoreSession = new ScoreSession(this.levelConfig, {
            enabled: this.scoringEnabled
        });
        this.scoreCompletionAward = null;
        this.scoreRecordResult = null;
        this.bestRunSaveResult = null;
        this.bestRunTrajectory = [];
        this.scoreContractId = ScoreStore.contractId(this.levelConfig);
        this.previousBestRun = APP_CONTEXT.bestRuns.getBest(
            this.route.packId,
            this.route.levelId,
            this.scoreContractId
        );
        this.bestRunDeltaMs = null;
        this.objectiveResult = null;
        this.badgeResult = null;
        this.dailyResult = null;

        const scoreHudEnabled = typeof APP_CONTEXT.preferences.isScoreHudEnabled === 'function'
            ? APP_CONTEXT.preferences.isScoreHudEnabled()
            : true;
        this.scoringHud = this.scoringEnabled && scoreHudEnabled
            ? new ScoringHUD(this, {
                mode: this.dailyChallenge ? 'daily' : this.route.mode
            })
            : null;
        this.scoringFeedback = this.scoringEnabled
            ? this.createScoringFeedback()
            : null;

        const ghostEnabled = typeof APP_CONTEXT.preferences.isGhostEnabled === 'function'
            ? APP_CONTEXT.preferences.isGhostEnabled()
            : true;
        this.bestRunHud = this.scoringEnabled && this.previousBestRun
            ? new BestRunComparisonHUD(this, this.previousBestRun)
            : null;
        this.bestRunGhost = this.scoringEnabled && ghostEnabled && this.previousBestRun
            ? new BestRunGhost(this, this.wheel, this.previousBestRun)
            : null;

        this.objectiveTracker = typeof RunObjectiveTracker !== 'undefined'
            ? new RunObjectiveTracker(this.levelConfig)
            : null;
        this.objectiveHud = this.objectiveTracker
            && typeof ObjectiveHUD !== 'undefined'
            && scoreHudEnabled
            ? new ObjectiveHUD(this, this.objectiveTracker.snapshot())
            : null;
        this.dailyOverlay = this.dailyChallenge
            && typeof DailyChallengeOverlay !== 'undefined'
            ? new DailyChallengeOverlay(this, this.dailyChallenge)
            : null;
        this.updateScoringHud();
        this.updateObjectivePresentation();
    }

    createScoringFeedback() {
        if (typeof ConfigurableScoringFeedback !== 'undefined') {
            return new ConfigurableScoringFeedback(
                this,
                this.levelVisual,
                APP_CONTEXT.preferences
            );
        }
        return new ScoringFeedback(this, this.levelVisual);
    }

    onScreenClick() {
        const statusBefore = this.session?.status;
        super.onScreenClick();
        if (
            this.scoreSession?.status === 'idle'
            && statusBefore === 'ready'
            && this.session?.status === 'in-flight'
        ) {
            this.scoreSession.start();
            this.updateScoringHud();
        }
    }

    update(time, delta) {
        if (this.scoreSession && this.session?.status !== 'failed') {
            this.scoreSession.advance(Math.min(delta, 50));
        }
        super.update(time, delta);
        const scoreSnapshot = this.scoreSession?.getSnapshot();
        this.bestRunGhost?.update(scoreSnapshot?.elapsedMs || 0);
        this.dailyOverlay?.update(scoreSnapshot);
        this.updateScoringHud();
        this.updateObjectivePresentation();
    }

    onNeedleInserted(outcome) {
        if (this.scoreSession) {
            const atMs = this.scoreSession.getSnapshot().elapsedMs;
            const award = this.scoreSession.recordInsertion(outcome.placement);
            const step = this.recordBestRunStep(outcome, award, atMs);
            this.bestRunDeltaMs = this.bestRunHud?.updateSplit(step.index, step.atMs)
                ?? this.bestRunDeltaMs;
            this.objectiveTracker?.update(award.snapshot || this.scoreSession.getSnapshot());
            this.finalizeScoreIfCompleted(outcome);
            this.updateScoringHud();
            this.updateObjectivePresentation();
            this.scoringFeedback?.showInsertion(
                award,
                this.currentNeedle?.getBallPosition()
            );
        }
        super.onNeedleInserted(outcome);
    }

    recordBestRunStep(outcome, award, atMs) {
        const step = {
            index: this.bestRunTrajectory.length,
            atMs: Math.max(0, Number(atMs) || 0),
            wheelAngle: Number(outcome?.wheelAngle) || 0,
            precisionKind: award?.precision?.kind || 'clear'
        };
        this.bestRunTrajectory.push(step);
        return step;
    }

    finalizeScoreIfCompleted(outcome) {
        if (
            !outcome?.completed
            || !this.scoreSession
            || this.scoreCompletionAward
        ) {
            return this.scoreCompletionAward;
        }

        this.scoreCompletionAward = this.scoreSession.complete();
        const scoreSnapshot = this.scoreSession.getSnapshot();
        this.bestRunDeltaMs = this.bestRunHud?.getCompletionDelta(
            scoreSnapshot.elapsedMs
        ) ?? this.bestRunDeltaMs;
        this.scoreRecordResult = APP_CONTEXT.scores?.recordRun({
            packId: this.route.packId,
            packVersion: this.levelConfig.packVersion,
            levelId: this.route.levelId,
            contractId: this.scoreContractId,
            levelOrder: this.levelConfig.order,
            levelName: this.levelConfig.name,
            mode: this.route.mode,
            success: true,
            scoreEligible: Boolean(
                this.scoringEnabled && this.route.mode === 'progression'
            ),
            score: scoreSnapshot
        }) || null;
        this.bestRunSaveResult = APP_CONTEXT.bestRuns.recordBest({
            packId: this.route.packId,
            packVersion: this.levelConfig.packVersion,
            levelId: this.route.levelId,
            contractId: this.scoreContractId,
            levelOrder: this.levelConfig.order,
            levelName: this.levelConfig.name,
            profileId: this.levelConfig.scoring?.profileId || null,
            score: scoreSnapshot,
            scoreRecord: this.scoreRecordResult,
            trajectory: this.bestRunTrajectory
        });

        this.objectiveResult = this.objectiveTracker?.complete(
            scoreSnapshot,
            this.scoreCompletionAward?.timeBonus
        ) || null;
        if (APP_CONTEXT.badges?.recordCompletedRun) {
            this.badgeResult = APP_CONTEXT.badges.recordCompletedRun({
                packId: this.route.packId,
                levelId: this.route.levelId,
                levelOrder: this.levelConfig.order,
                levelName: this.levelConfig.name,
                score: scoreSnapshot,
                timeBonus: this.scoreCompletionAward?.timeBonus || null,
                objectives: this.objectiveResult
            });
        }

        if (this.dailyChallenge && typeof DAILY_CHALLENGES !== 'undefined') {
            try {
                this.dailyResult = DAILY_CHALLENGES.recordVerifiedRun({
                    challenge: this.dailyChallenge,
                    replay: this.getReplayForVerification(),
                    levelConfig: this.levelConfig,
                    score: scoreSnapshot
                });
            } catch (error) {
                console.warn('每日挑战回放验证失败:', error);
                this.dailyResult = {
                    accepted: false,
                    verified: false,
                    reason: error.message
                };
            }
        }

        this.updateScoringHud();
        this.updateObjectivePresentation();
        return this.scoreCompletionAward;
    }

    getReplayForVerification() {
        if (this.session?.finalAttempt?.replay) {
            return this.session.finalAttempt.replay;
        }
        if (typeof this.session?.recorder?.export === 'function') {
            return this.session.recorder.export();
        }
        return null;
    }

    onGameOver(outcome) {
        this.scoreSession?.fail();
        this.objectiveTracker?.fail?.(this.scoreSession?.getSnapshot());
        this.scoringFeedback?.showFailure?.();
        this.updateScoringHud();
        this.updateObjectivePresentation();
        super.onGameOver(outcome);
    }

    onLevelComplete() {
        if (
            !this.completionHandled
            && this.session?.status === 'completed'
        ) {
            this.finalizeScoreIfCompleted({ completed: true });
        }
        super.onLevelComplete();
    }

    createCelebration() {
        super.createCelebration();
        this.scoringFeedback?.showCompletion(this.scoreCompletionAward);
    }

    updateScoringHud() {
        this.scoringHud?.update(this.scoreSession?.getSnapshot());
    }

    updateObjectivePresentation() {
        this.objectiveHud?.update(this.objectiveTracker?.snapshot());
    }

    getResultContext() {
        const acceptedRecord = this.scoreRecordResult?.accepted
            ? {
                isPersonalBest: this.scoreRecordResult.isPersonalBest,
                record: this.scoreRecordResult.record,
                best: this.scoreRecordResult.best
            }
            : null;
        return {
            scoringEnabled: Boolean(this.scoringEnabled),
            score: this.scoreSession?.getSnapshot() || null,
            timeBonus: this.scoreCompletionAward?.timeBonus || null,
            scoreEligible: Boolean(
                this.scoringEnabled && this.route?.mode === 'progression'
            ),
            scoreRecord: acceptedRecord,
            bestRunComparison: {
                hadReference: Boolean(this.previousBestRun),
                previousElapsedMs: this.previousBestRun?.elapsedMs ?? null,
                deltaMs: this.bestRunDeltaMs,
                trajectoryCount: this.bestRunTrajectory.length
            },
            objectives: this.objectiveResult,
            badgeResult: this.badgeResult,
            dailyChallenge: this.dailyChallenge,
            dailyResult: this.dailyResult
        };
    }

    shutdown() {
        this.scoringFeedback?.destroyAll();
        this.scoringHud?.destroy();
        this.bestRunHud?.destroy();
        this.bestRunGhost?.destroy();
        this.objectiveHud?.destroy?.();
        this.dailyOverlay?.destroy?.();
        this.scoringFeedback = null;
        this.scoringHud = null;
        this.bestRunHud = null;
        this.bestRunGhost = null;
        this.objectiveHud = null;
        this.objectiveTracker = null;
        this.dailyOverlay = null;
        this.scoreSession = null;
        this.scoreRecordResult = null;
        super.shutdown();
    }
}
