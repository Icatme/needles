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
        this.collisionManager = new CollisionManager();
    }

    create() {
        this.levelConfig = this.levelManager.startLevel(this.route.levelId);
        this.route = this.levelManager.getCurrentRoute();
        this.levelVisual = this.themeManager.getLevelVisual(this.levelConfig.id);

        this.gameState = 'playing';
        this.insertedNeedles = [];
        this.obstacles = [];
        this.remainingNeedles = [];
        this.currentNeedle = null;
        this.canShoot = true;
        this.rhythmManager = new RhythmManager(
            this.levelConfig.rhythm,
            this.levelConfig.needleCount
        );

        this.createBackground();
        this.wheel = new Wheel(
            this,
            CONSTANTS.WHEEL.CENTER_X,
            CONSTANTS.WHEEL.CENTER_Y,
            CONSTANTS.WHEEL.RADIUS,
            this.levelVisual
        );
        const initialRhythm = this.rhythmManager.getSnapshotAt(0, 0);

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
        this.levelConfig.layout.obstacleAngles.forEach(degrees => {
            const angle = degrees * Math.PI / 180;
            const obstacle = new Obstacle(this, angle, this.levelVisual);
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
        if (this.remainingNeedles.length === 0) {
            this.onLevelComplete();
            return;
        }

        this.currentNeedle = this.remainingNeedles.shift();
        this.currentNeedle.setReadyPosition(
            CONSTANTS.WIDTH / 2,
            CONSTANTS.NEEDLE.READY_Y
        );
        this.uiManager.updateRemaining(this.remainingNeedles.length + 1);
        this.canShoot = true;
    }

    onScreenClick() {
        if (!this.canShoot || this.gameState !== 'playing' || !this.currentNeedle) {
            return;
        }

        this.canShoot = false;
        const impactEdge = this.wheel.getImpactEdgePosition();
        const exposedLength = CONSTANTS.NEEDLE.LENGTH - CONSTANTS.NEEDLE.INSERT_DEPTH;
        const targetX = impactEdge.x + Math.cos(impactEdge.angle) * exposedLength;
        const targetY = impactEdge.y + Math.sin(impactEdge.angle) * exposedLength;

        this.currentNeedle.launch(targetX, targetY);
        this.gameState = 'animating';
    }

    update(time, delta) {
        if (this.gameState === 'failed') return;

        const frameDelta = Math.min(delta, 50);
        const rhythm = this.rhythmManager.advance(frameDelta);
        this.wheel.rotateBy(rhythm.rotationDelta);
        this.uiManager.updateRhythm(rhythm);
        this.obstacles.forEach(obstacle => obstacle.updatePosition(this.wheel));
        this.insertedNeedles.forEach(needle => needle.updateOnWheel(this.wheel));

        if (this.currentNeedle && this.currentNeedle.flying) {
            const reached = this.currentNeedle.update(frameDelta);
            if (reached) this.onNeedleReachedWheel();
        }
    }

    onNeedleReachedWheel() {
        const needleAngle = CONSTANTS.WHEEL.IMPACT_ANGLE - this.wheel.rotation;
        this.currentNeedle.attachToWheel(this.wheel, needleAngle);

        const collision = this.collisionManager.checkAllCollisions(
            this.currentNeedle,
            this.insertedNeedles,
            this.obstacles
        );

        if (collision.collided) {
            this.onGameOver();
        } else {
            this.onNeedleInserted();
        }
    }

    onNeedleInserted() {
        this.insertedNeedles.push(this.currentNeedle);
        this.rhythmManager.recordSuccessfulInsert();
        this.currentNeedle.playInsertionCatchlight();
        this.createImpactFeedback();
        this.gameState = 'playing';

        this.time.delayedCall(200, () => {
            this.prepareNextNeedle();
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

    onGameOver() {
        this.gameState = 'failed';
        if (!SceneUI.prefersReducedMotion()) {
            this.cameras.main.shake(220, 0.006);
        }
        this.createExplosion(this.currentNeedle.getBallPosition());

        this.uiManager.showFail(() => {
            APP_CONTEXT.router.startResult(this, {
                route: this.route,
                level: this.levelConfig.order,
                success: false,
                levelName: this.levelConfig.name,
                insertedCount: this.insertedNeedles.length,
                totalCount: this.levelConfig.needleCount
            });
        });
    }

    onLevelComplete() {
        this.gameState = 'success';
        this.levelManager.completeLevel();
        this.createCelebration();

        const nextRoute = this.levelManager.getNextLevelRoute();
        const nextConfig = nextRoute
            ? APP_CONTEXT.catalog.getLevelConfig(
                nextRoute.packId,
                nextRoute.levelId
            )
            : null;

        this.uiManager.showSuccess(() => {
            APP_CONTEXT.router.startResult(this, {
                route: this.route,
                level: this.levelConfig.order,
                levelName: this.levelConfig.name,
                success: true,
                completedAll: nextRoute === null,
                nextRoute,
                nextLevelName: nextConfig?.name || '',
                packLevelCount: this.levelManager.getLevelCount()
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
    }
}
