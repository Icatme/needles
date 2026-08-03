class PlaytestSession {
    constructor(levelConfig, options = {}) {
        this.level = JSON.parse(JSON.stringify(levelConfig));
        this.store = options.store || PLAYTEST_STORE;
        this.recorder = options.recorder || new ReplayRecorder(
            this.level,
            options
        );
        this.session = this.recorder.session;
        this.shotTimesMs = [];
        this.finalAttempt = null;
    }

    get status() {
        return this.session.status;
    }

    advance(deltaMs) {
        return this.recorder.advance(deltaMs);
    }

    beginShot() {
        const result = this.recorder.beginShot();
        if (result.accepted) {
            this.shotTimesMs.push(this.recorder.elapsedMs);
        }
        return result;
    }

    resolveImpact() {
        const result = this.recorder.resolveImpact();
        if (result.collided || result.completed) {
            this.finish(result);
        }
        return result;
    }

    releaseShotLock() {
        return this.recorder.releaseShotLock();
    }

    getSnapshot() {
        return this.session.getSnapshot();
    }

    drainEvents() {
        return this.session.drainEvents();
    }

    finish(outcome) {
        if (this.finalAttempt) return this.finalAttempt;

        const replay = this.recorder.export();
        const snapshot = outcome.snapshot || this.session.getSnapshot();
        const collision = outcome.collision || null;
        const difficulty = this.level.difficulty || {};
        const drivers = (difficulty.drivers || [])
            .slice(0, 3)
            .map(driver => driver.label || driver.key || String(driver));
        const intervalsMs = this.shotTimesMs
            .slice(1)
            .map((time, index) => time - this.shotTimesMs[index]);

        this.finalAttempt = this.store.addAttempt({
            packId: this.level.packId || null,
            packVersion: this.level.packVersion || null,
            levelId: this.level.packLevelId || String(this.level.id),
            order: Number.isInteger(this.level.order)
                ? this.level.order
                : Number(this.level.id) || null,
            predictedDifficulty: Number.isFinite(difficulty.score)
                ? difficulty.score
                : null,
            difficultyDrivers: drivers,
            result: {
                status: snapshot.status,
                success: Boolean(outcome.completed),
                durationMs: this.recorder.elapsedMs,
                insertedCount: snapshot.insertedCount,
                totalCount: this.level.needleCount,
                failedNeedleNumber: outcome.collided
                    ? outcome.needleNumber
                    : null,
                collisionType: collision?.type || null,
                collisionTargetId: collision?.targetId ?? null
            },
            shots: {
                count: this.shotTimesMs.length,
                acceptedAtMs: [...this.shotTimesMs],
                intervalsMs
            },
            replay
        });
        return this.finalAttempt;
    }
}
