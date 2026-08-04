class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    init(data = {}) {
        this.route = APP_CONTEXT.router.normalizeLevelRoute(data, {
            packId: APP_CONTEXT.getActivePackId(),
            mode: 'progression'
        });
        this.levelManager = new LevelManager(this.route.packId, {
            mode: this.route.mode
        });
        this.themeManager = new ThemeManager();
    }

    create() {
        this.layout = LayoutManager.getSceneLayout('game');
        this.levelConfig = this.levelManager.startLevel(this.route.levelId);
        this.route = this.levelManager.getCurrentRoute();
        this.levelVisual = this.themeManager.getLevelVisual(this.levelConfig);
        this.session = this.route.mode === 'test'
            ? new PlaytestSession(this.levelConfig)
            : new GameSession(this.levelConfig);

        this.insertedNeedles = [];
        this.obstacles = [];
        this.remainingNeedles = [];
        this.currentNeedle = null;
        this.completionHandled = false;
        this.resultSnapshotTimer = null;

        this.createBackground();
        this.wheel = new Wheel(
            this,
            this.layout.wheel.x,
            this.layout.wheel.y,
            this.layout.wheel.radius,
            this.levelVisual
        );
        const initialRhythm = this.session.advance(0).rhythm;

        this.createObstacles();
        this.uiManager = new UIManager(this, this.levelConfig.needleCount);
        this.uiManager.updateLevel(
            this.levelConfig.id,
            this.levelConfig.name,
            this.levelConfig.rule
        );
        this.uiManager.updateRhythm(initialRhythm);
        this.initializeNeedles();

        this.input.on('pointerdown', () => this.onScreenClick());
        this.input.keyboard.on('keydown-SPACE', () => this.onScreenClick());
    }

    createBackground() {
        SceneUI.createBackdrop(this, 'game');
    }

    createObstacles() {
        this.session.getSnapshot().obstacles.forEach(model => {
            const obstacle = new Obstacle(this, model.angle, this.levelVisual);
            obstacle.updatePosition(this.wheel);
            this.obstacles.push(obstacle);
        });
    }

    initializeNeedles() {
        const count = this.levelConfig.needleCount;
        for (let i = count; i >= 1; i--) {
            this.remainingNeedles.push(new Needle(this, i, this.levelVisual));
        }
        this.prepareNextNeedle();
    }

    prepareNextNeedle() {
        const snapshot = this.session.getSnapshot();
        if (snapshot.status === 'completed' || snapshot.remainingCount === 0) {
            this.onLevelComplete();
            return;
        }
        if (snapshot.status !== 'ready') return;
        if (this.remainingNeedles.length === 0) {
            throw new Error('GameSession and needle view queue are out of sync');
        }

        this.currentNeedle = this.remainingNeedles.shift();
        if (this.currentNeedle.id !== snapshot.currentNeedleNumber) {
            throw new Error(
                `Needle view ${this.currentNeedle.id} does not match session `
                    + snapshot.currentNeedleNumber
            );
        }
        this.currentNeedle.setReadyPosition(
            CONSTANTS.WIDTH / 2,
            this.layout.readyNeedleY
        );
        this.uiManager.updateRemaining(snapshot.remainingCount);
    }

    onScreenClick() {
        if (!this.currentNeedle) return;
        const shot = this.session.beginShot();
        if (!shot.accepted) return;

        const impactEdge = this.wheel.getImpactEdgePosition();
        const exposedLength = CONSTANTS.NEEDLE.LENGTH - CONSTANTS.NEEDLE.INSERT_DEPTH;
        const targetX = impactEdge.x + Math.cos(impactEdge.angle) * exposedLength;
        const targetY = impactEdge.y + Math.sin(impactEdge.angle) * exposedLength;
        this.currentNeedle.launch(targetX, targetY);
    }

    update(time, delta) {
        if (!this.session || this.session.status === 'failed') return;

        const frameDelta = Math.min(delta, 50);
        const frame = this.session.advance(frameDelta);
        this.wheel.rotateBy(frame.rotationDelta);
        this.uiManager.updateRhythm(frame.rhythm);
        this.obstacles.forEach(obstacle => obstacle.updatePosition(this.wheel));
        this.insertedNeedles.forEach(needle => needle.updateOnWheel(this.wheel));

        if (this.currentNeedle && this.currentNeedle.flying) {
            const reached = this.currentNeedle.update(frameDelta);
            if (reached) this.onNeedleReachedWheel();
        }
    }

    onNeedleReachedWheel() {
        const outcome = this.session.resolveImpact();
        this.currentNeedle.attachToWheel(this.wheel, outcome.wheelAngle);

        if (outcome.collided) {
            this.onGameOver(outcome);
        } else {
            this.onNeedleInserted(outcome);
        }
    }

    onNeedleInserted(outcome) {
        this.insertedNeedles.push(this.currentNeedle);
        this.currentNeedle.playInsertionCatchlight();
        this.createImpactFeedback();

        this.time.delayedCall(CONSTANTS.DIFFICULTY.INSERT_LOCK_MS, () => {
            if (outcome.completed) {
                this.onLevelComplete();
                return;
            }
            const release = this.session.releaseShotLock();
            if (release.released) this.prepareNextNeedle();
        });
    }

    createImpactFeedback() {
        if (SceneUI.prefersReducedMotion()) return;

        const ui = SceneUI.getPalette(this.levelVisual.theme);
        const impact = this.wheel.getImpactEdgePosition();
        const ripple = this.add.circle(impact.x, impact.y, 5, ui.ACCENT, 0.18);
        ripple.setStrokeStyle(2, ui.ACCENT, 0.65);
        ripple.setDepth(13);

        this.tweens.add({
            targets: ripple,
            scale: 2.4,
            alpha: 0,
            duration: 120,
            ease: 'Quad.easeOut',
            onComplete: () => ripple.destroy()
        });
    }

    onGameOver(outcome) {
        if (!SceneUI.prefersReducedMotion()) {
            this.cameras.main.shake(220, 0.006);
        }
        this.createExplosion(this.currentNeedle.getBallPosition());

        this.captureFailureSnapshot(failureSnapshot => {
            this.uiManager.showFail(() => {
                APP_CONTEXT.router.startResult(this, {
                    route: this.route,
                    level: this.levelConfig.order,
                    success: false,
                    levelName: this.levelConfig.name,
                    insertedCount: outcome.snapshot.insertedCount,
                    totalCount: this.levelConfig.needleCount,
                    failureSnapshot
                });
            });
        });
    }

    captureFailureSnapshot(callback) {
        this.captureResultSnapshot(
            this.layout.failureSnapshotArea,
            '失败',
            callback
        );
    }

    captureSuccessSnapshot(callback) {
        this.captureResultSnapshot(
            this.layout.successSnapshotArea || this.layout.failureSnapshotArea,
            '成功',
            callback
        );
    }

    captureResultSnapshot(logicalArea, label, callback) {
        const renderer = this.game?.renderer;
        const renderScale = typeof HiDPIRenderer === 'undefined'
            ? 1
            : HiDPIRenderer.getRenderScale();
        let settled = false;

        const complete = image => {
            if (settled) return;
            settled = true;

            if (this.resultSnapshotTimer) {
                this.resultSnapshotTimer.remove(false);
                this.resultSnapshotTimer = null;
            }

            const width = Number(image?.naturalWidth || image?.width || 0);
            const height = Number(image?.naturalHeight || image?.height || 0);
            callback(width > 0 && height > 0 ? image : null);
        };

        this.resultSnapshotTimer = this.time.delayedCall(1000, () => complete(null));

        if (!renderer || typeof renderer.snapshotArea !== 'function' || !logicalArea) {
            complete(null);
            return;
        }

        try {
            renderer.snapshotArea(
                Math.round(logicalArea.x * renderScale),
                Math.round(logicalArea.y * renderScale),
                Math.round(logicalArea.width * renderScale),
                Math.round(logicalArea.height * renderScale),
                complete,
                'image/png'
            );
        } catch (error) {
            console.warn(`无法截取${label}画面，将使用静态预览。`, error);
            complete(null);
        }
    }

    onLevelComplete() {
        if (this.completionHandled) return;
        if (this.session.status !== 'completed') return;
        this.completionHandled = true;
        this.levelManager.completeLevel();

        const nextRoute = this.levelManager.getNextLevelRoute();
        const nextConfig = nextRoute
            ? APP_CONTEXT.catalog.getLevelConfig(
                nextRoute.packId,
                nextRoute.levelId
            )
            : null;

        // 先截取干净的最终排布，再播放庆祝粒子和成功提示。
        this.captureSuccessSnapshot(successSnapshot => {
            this.createCelebration();
            this.uiManager.showSuccess(() => {
                APP_CONTEXT.router.startResult(this, {
                    route: this.route,
                    level: this.levelConfig.order,
                    levelName: this.levelConfig.name,
                    success: true,
                    completedAll: nextRoute === null,
                    nextRoute,
                    nextLevelName: nextConfig?.name || '',
                    packLevelCount: this.levelManager.getLevelCount(),
                    successSnapshot
                });
            });
        });
    }

    createExplosion(position) {
        if (SceneUI.prefersReducedMotion()) return;
        const colors = CONSTANTS.PARTICLES.COLORS;

        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const speed = 100 + Math.random() * 200;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const particle = this.add.circle(
                position.x,
                position.y,
                3 + Math.random() * 3,
                color
            );

            this.tweens.add({
                targets: particle,
                x: position.x + Math.cos(angle) * speed,
                y: position.y + Math.sin(angle) * speed,
                alpha: 0,
                scale: 0,
                duration: 500 + Math.random() * 300,
                onComplete: () => particle.destroy()
            });
        }
    }

    createCelebration() {
        if (SceneUI.prefersReducedMotion()) return;
        const colors = CONSTANTS.PARTICLES.COLORS;
        const centerX = CONSTANTS.WIDTH / 2;
        const centerY = CONSTANTS.HEIGHT / 2;

        for (let i = 0; i < 50; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 100 + Math.random() * 300;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const particle = this.add.circle(
                centerX,
                centerY,
                2 + Math.random() * 4,
                color
            );

            this.tweens.add({
                targets: particle,
                x: centerX + Math.cos(angle) * distance,
                y: centerY + Math.sin(angle) * distance,
                alpha: 0,
                scale: 0,
                duration: 1000 + Math.random() * 1000,
                delay: Math.random() * 500,
                onComplete: () => particle.destroy()
            });
        }
    }

    shutdown() {
        if (this.resultSnapshotTimer) {
            this.resultSnapshotTimer.remove(false);
            this.resultSnapshotTimer = null;
        }
        if (this.wheel) this.wheel.destroy();
        if (this.uiManager) this.uiManager.destroy();

        new Set([
            ...this.insertedNeedles,
            ...this.remainingNeedles,
            this.currentNeedle
        ]).forEach(needle => {
            if (needle) needle.destroy();
        });
        this.obstacles.forEach(obstacle => obstacle.destroy());

        this.insertedNeedles = [];
        this.remainingNeedles = [];
        this.obstacles = [];
        this.session = null;
    }
}
