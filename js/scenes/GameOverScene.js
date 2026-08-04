class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data = {}) {
        this.route = APP_CONTEXT.router.normalizeLevelRoute(data.route || data);
        this.level = data.level || APP_CONTEXT.catalog.getLevel(
            this.route.packId,
            this.route.levelId
        ).order;
        this.levelName = data.levelName || '';
        this.success = Boolean(data.success);
        this.completedAll = Boolean(data.completedAll);
        this.nextRoute = data.nextRoute
            ? APP_CONTEXT.router.normalizeLevelRoute(data.nextRoute)
            : null;
        this.nextLevelName = data.nextLevelName || '';
        this.insertedCount = data.insertedCount || 0;
        this.totalCount = data.totalCount || 0;
        this.packLevelCount = data.packLevelCount
            || APP_CONTEXT.catalog.getPack(this.route.packId).levels.length;
        this.failureSnapshot = data.failureSnapshot || null;
        this.failureSnapshotTextureKey = null;
        this.failurePreviewImage = null;
        this.failurePreviewFrame = null;
    }

    create() {
        this.layout = LayoutManager.getSceneLayout('result');
        SceneUI.createBackdrop(this, 'result');
        this.createResultDisplay();
        this.createButtons();

        this.input.keyboard.once('keydown-ENTER', () => this.runPrimaryAction());
        this.input.keyboard.once('keydown-ESC', () => APP_CONTEXT.router.startMenu(this));
        this.events.once('shutdown', () => this.releaseFailureSnapshot());
    }

    isFailureResult() {
        return !this.success && !this.completedAll;
    }

    createResultDisplay() {
        const ui = SceneUI.getPalette();
        const failureResult = this.isFailureResult();
        const activeLayout = failureResult
            ? this.layout.failure
            : this.layout.success;
        const stateLabel = this.completedAll
            ? 'ALL LEVELS CLEAR'
            : (this.success ? 'LEVEL CLEAR' : 'COLLISION');
        const stateColor = this.success ? ui.TEXT_SUCCESS : ui.TEXT_ERROR;

        this.stateText = this.add.text(56, activeLayout.stateY, stateLabel, {
            fontFamily: ui.MONO_FONT,
            fontSize: '12px',
            color: stateColor,
            letterSpacing: 1.8
        });

        if (failureResult) {
            this.resultTitle = null;
            const previewElements = this.createFailurePreview(activeLayout.preview);
            this.resultGlyph = this.createResultGlyph(activeLayout.glyph);
            this.createMetricPanel(activeLayout.metricY);
            this.animateIntro([this.stateText, ...previewElements, this.resultGlyph]);
            return;
        }

        const titleCopy = this.completedAll
            ? '终曲完成。\n整套关卡通关。'
            : '漂亮。\n这一圈完成了。';
        this.resultTitle = this.add.text(52, activeLayout.titleY, titleCopy, {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '48px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold',
            lineSpacing: -2
        });

        this.resultGlyph = this.createResultGlyph(activeLayout.glyph);
        this.createMetricPanel(activeLayout.metricY);
        this.animateIntro([this.stateText, this.resultTitle]);
    }

    createFailurePreview(previewLayout) {
        const ui = SceneUI.getPalette();
        const {
            centerX,
            centerY,
            imageWidth,
            imageHeight,
            frameWidth,
            frameHeight
        } = previewLayout;
        const elements = [];

        this.failurePreviewFrame = SceneUI.createPanel(
            this,
            centerX,
            centerY,
            frameWidth,
            frameHeight,
            {
                fillColor: ui.BACKGROUND_ALT,
                strokeColor: ui.ERROR,
                strokeWidth: 2,
                strokeAlpha: 0.72,
                radius: 16,
                depth: 10
            }
        );
        elements.push(this.failurePreviewFrame);

        const snapshotWidth = Number(
            this.failureSnapshot?.naturalWidth || this.failureSnapshot?.width || 0
        );
        const snapshotHeight = Number(
            this.failureSnapshot?.naturalHeight || this.failureSnapshot?.height || 0
        );

        if (snapshotWidth > 0 && snapshotHeight > 0) {
            const sequence = GameOverScene.failureSnapshotSequence++;
            const textureKey = `failure-snapshot-${sequence}`;
            const texture = this.textures.addImage(textureKey, this.failureSnapshot);

            if (texture) {
                this.failureSnapshotTextureKey = textureKey;
                this.failurePreviewImage = this.add.image(centerX, centerY, textureKey);
                this.failurePreviewImage.setDisplaySize(imageWidth, imageHeight);
                this.failurePreviewImage.setDepth(11);
                elements.push(this.failurePreviewImage);
            }
        }

        if (!this.failurePreviewImage) {
            elements.push(this.createFailurePreviewFallback(
                centerX,
                centerY,
                imageWidth,
                imageHeight
            ));
        }

        const border = this.add.graphics();
        border.setDepth(12);
        border.lineStyle(1, ui.INK, 0.32);
        border.strokeRoundedRect(
            centerX - imageWidth / 2,
            centerY - imageHeight / 2,
            imageWidth,
            imageHeight,
            12
        );
        elements.push(border);

        return elements;
    }

    createFailurePreviewFallback(centerX, centerY, width, height) {
        const ui = SceneUI.getPalette();
        const graphics = this.add.graphics();
        const left = centerX - width / 2;
        const top = centerY - height / 2;
        const wheelX = centerX + 18;
        const wheelY = centerY + 2;
        const wheelRadius = Math.min(66, height * 0.27);

        graphics.setDepth(11);
        graphics.fillStyle(ui.BACKGROUND, 1);
        graphics.fillRoundedRect(left, top, width, height, 12);
        graphics.lineStyle(22, ui.TARGET_RING, 0.08);
        graphics.strokeCircle(wheelX, wheelY, wheelRadius + 20);
        graphics.lineStyle(3, ui.INK, 0.88);
        graphics.strokeCircle(wheelX, wheelY, wheelRadius);
        graphics.lineStyle(1, ui.RULE, 0.72);
        graphics.strokeCircle(wheelX, wheelY, wheelRadius - 18);
        graphics.fillStyle(ui.ACCENT, 0.9);
        graphics.fillCircle(wheelX, wheelY, 9);

        const angles = [-2.45, -1.82, -1.18, -0.48, 0.28, 0.92, 1.46, 2.06];
        angles.forEach(angle => {
            const innerX = wheelX + Math.cos(angle) * wheelRadius;
            const innerY = wheelY + Math.sin(angle) * wheelRadius;
            const outerX = wheelX + Math.cos(angle) * (wheelRadius + 38);
            const outerY = wheelY + Math.sin(angle) * (wheelRadius + 38);
            graphics.lineStyle(3, ui.INK, 0.8);
            graphics.lineBetween(innerX, innerY, outerX, outerY);
            graphics.fillStyle(ui.SURFACE, 1);
            graphics.fillCircle(outerX, outerY, 7);
            graphics.lineStyle(2, ui.INK, 0.85);
            graphics.strokeCircle(outerX, outerY, 7);
        });

        const collisionAngle = -2.45;
        const collisionX = wheelX + Math.cos(collisionAngle) * wheelRadius;
        const collisionY = wheelY + Math.sin(collisionAngle) * wheelRadius;
        graphics.fillStyle(ui.ERROR, 1);
        graphics.fillCircle(collisionX, collisionY, 8);
        graphics.lineStyle(3, ui.ERROR, 0.9);
        for (let index = 0; index < 8; index++) {
            const angle = index * Math.PI / 4;
            graphics.lineBetween(
                collisionX + Math.cos(angle) * 12,
                collisionY + Math.sin(angle) * 12,
                collisionX + Math.cos(angle) * 28,
                collisionY + Math.sin(angle) * 28
            );
        }

        return graphics;
    }

    createMetricPanel(centerY) {
        const ui = SceneUI.getPalette();
        const metricLayout = this.layout.metric;
        SceneUI.createPanel(
            this,
            300,
            centerY,
            metricLayout.panelWidth,
            metricLayout.panelHeight,
            {
                fillColor: ui.SURFACE,
                strokeColor: ui.RULE,
                radius: 14,
                depth: 10
            }
        );

        const metricLabel = this.add.text(
            82,
            centerY + metricLayout.labelOffsetY,
            this.success ? '已完成' : '本次进度',
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '14px',
                color: ui.TEXT_MUTED
            }
        );
        metricLabel.setDepth(11);

        const metricValue = this.success
            ? `关卡 ${String(this.level).padStart(2, '0')} · ${this.levelName}`
            : `${this.insertedCount} / ${this.totalCount}`;
        const metric = this.add.text(
            82,
            centerY + metricLayout.valueOffsetY,
            metricValue,
            {
                fontFamily: ui.DISPLAY_FONT,
                fontSize: '34px',
                color: ui.TEXT_COLOR,
                fontStyle: 'bold'
            }
        );
        metric.setOrigin(0, 0.5);
        metric.setDepth(11);

        const modeLabel = this.route.mode === 'test' ? '测试模式' : '正常进度';
        const noteCopy = this.completedAll
            ? `全部 ${this.packLevelCount} 关已完成 · ${modeLabel}`
            : (this.success
                ? `下一关 · ${this.nextLevelName} · ${modeLabel}`
                : `${this.levelName} · 再试一次 · ${modeLabel}`);
        const note = this.add.text(518, centerY, noteCopy, {
            fontFamily: ui.BODY_FONT,
            fontSize: '13px',
            color: this.success ? ui.TEXT_SUCCESS : ui.TEXT_MUTED
        });
        note.setOrigin(1, 0.5);
        note.setDepth(11);
    }

    animateIntro(elements) {
        if (SceneUI.prefersReducedMotion()) return;
        const targets = elements.filter(Boolean);
        targets.forEach(element => element.setAlpha(0));
        this.tweens.add({
            targets,
            alpha: 1,
            duration: 360,
            ease: 'Expo.easeOut'
        });
    }

    createResultGlyph(options = {}) {
        const ui = SceneUI.getPalette();
        const radius = options.radius ?? 50;
        const graphics = this.add.graphics();
        graphics.setPosition(options.x ?? 490, options.y ?? 226);
        graphics.lineStyle(3, ui.INK, 1);
        graphics.strokeCircle(0, 0, radius);
        graphics.lineStyle(1, ui.RULE, 1);
        graphics.strokeCircle(0, 0, radius * 0.72);

        if (this.success) {
            graphics.lineStyle(7, ui.SUCCESS, 1);
            graphics.beginPath();
            graphics.moveTo(-radius * 0.4, radius * 0.02);
            graphics.lineTo(-radius * 0.12, radius * 0.32);
            graphics.lineTo(radius * 0.48, -radius * 0.36);
            graphics.strokePath();
        } else {
            graphics.lineStyle(6, ui.ERROR, 1);
            graphics.lineBetween(
                -radius * 0.36,
                -radius * 0.36,
                radius * 0.36,
                radius * 0.36
            );
            graphics.lineBetween(
                radius * 0.36,
                -radius * 0.36,
                -radius * 0.36,
                radius * 0.36
            );
        }

        return graphics;
    }

    createButtons() {
        const ui = SceneUI.getPalette();
        const activeLayout = this.isFailureResult()
            ? this.layout.failure
            : this.layout.success;
        const primaryLabel = this.completedAll
            ? (this.route.mode === 'test' ? '返回关卡实验室' : '返回主菜单')
            : (this.success ? '进入下一关' : '重新挑战');
        SceneUI.createButton(
            this,
            300,
            activeLayout.primaryY,
            primaryLabel,
            () => this.runPrimaryAction(),
            {
                width: 300,
                variant: 'primary'
            }
        );

        const secondaryLabel = this.completedAll ? '重玩当前关' : '返回主菜单';
        SceneUI.createButton(
            this,
            300,
            activeLayout.secondaryY,
            secondaryLabel,
            () => {
                if (this.completedAll) {
                    APP_CONTEXT.router.startLevel(this, this.route);
                } else {
                    APP_CONTEXT.router.startMenu(this);
                }
            },
            {
                width: 300,
                variant: 'secondary'
            }
        );

        const shortcut = this.add.text(
            300,
            activeLayout.footerY,
            'ENTER 继续  ·  ESC 菜单',
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '11px',
                color: ui.TEXT_MUTED,
                letterSpacing: 1
            }
        );
        shortcut.setOrigin(0.5);
    }

    releaseFailureSnapshot() {
        if (this.failurePreviewImage?.active) {
            this.failurePreviewImage.destroy();
        }
        if (
            this.failureSnapshotTextureKey
            && this.textures.exists(this.failureSnapshotTextureKey)
        ) {
            this.textures.remove(this.failureSnapshotTextureKey);
        }
        this.failurePreviewImage = null;
        this.failureSnapshotTextureKey = null;
        this.failureSnapshot = null;
    }

    runPrimaryAction() {
        if (this.completedAll) {
            if (this.route.mode === 'test') {
                APP_CONTEXT.router.startLevelBrowser(this, {
                    packId: this.route.packId,
                    chapterId: APP_CONTEXT.catalog
                        .getChapterForLevel(this.route.packId, this.route.levelId)?.id
                });
            } else {
                APP_CONTEXT.router.startMenu(this);
            }
        } else if (this.success && this.nextRoute) {
            APP_CONTEXT.router.startLevel(this, this.nextRoute);
        } else {
            APP_CONTEXT.router.startLevel(this, this.route);
        }
    }
}

GameOverScene.failureSnapshotSequence = 1;
