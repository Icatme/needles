class ScoringGameScene extends GameScene {
    create() {
        if (!APP_CONTEXT.preferences) {
            APP_CONTEXT.preferences = new GamePreferencesStore();
        }
        if (!APP_CONTEXT.scores && typeof ScoreStore !== 'undefined') {
            APP_CONTEXT.scores = new ScoreStore();
        }
        super.create();
        this.scoringEnabled = APP_CONTEXT.preferences.isScoringEnabled();
        this.scoreSession = new ScoreSession(this.levelConfig, {
            enabled: this.scoringEnabled
        });
        this.scoreCompletionAward = null;
        this.scoreRecordResult = null;
        this.scoringHud = this.scoringEnabled
            ? new ScoringHUD(this, { mode: this.route.mode })
            : null;
        this.scoringFeedback = this.scoringEnabled
            ? new ScoringFeedback(this, this.levelVisual)
            : null;
        this.updateScoringHud();
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
        this.updateScoringHud();
    }

    onNeedleInserted(outcome) {
        if (this.scoreSession) {
            const award = this.scoreSession.recordInsertion(outcome.placement);
            this.finalizeScoreIfCompleted(outcome);
            this.updateScoringHud();
            this.scoringFeedback?.showInsertion(
                award,
                this.currentNeedle?.getBallPosition()
            );
        }
        super.onNeedleInserted(outcome);
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
        this.scoreRecordResult = APP_CONTEXT.scores?.recordRun({
            packId: this.route.packId,
            packVersion: this.levelConfig.packVersion,
            levelId: this.route.levelId,
            contractId: ScoreStore.contractId(this.levelConfig),
            levelOrder: this.levelConfig.order,
            levelName: this.levelConfig.name,
            mode: this.route.mode,
            success: true,
            scoreEligible: Boolean(
                this.scoringEnabled && this.route.mode === 'progression'
            ),
            score: this.scoreSession.getSnapshot()
        }) || null;
        this.updateScoringHud();
        return this.scoreCompletionAward;
    }

    onGameOver(outcome) {
        this.scoreSession?.fail();
        this.updateScoringHud();
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
            scoreRecord: acceptedRecord
        };
    }

    shutdown() {
        this.scoringFeedback?.destroyAll();
        this.scoringHud?.destroy();
        this.scoringFeedback = null;
        this.scoringHud = null;
        this.scoreSession = null;
        this.scoreRecordResult = null;
        super.shutdown();
    }
}
