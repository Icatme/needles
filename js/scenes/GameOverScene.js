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
    }

    create() {
        SceneUI.createBackdrop(this, 'result');
        this.createResultDisplay();
        this.createButtons();

        this.input.keyboard.once('keydown-ENTER', () => this.runPrimaryAction());
        this.input.keyboard.once('keydown-ESC', () => APP_CONTEXT.router.startMenu(this));
    }

    createResultDisplay() {
        const ui = SceneUI.getPalette();
        const stateLabel = this.completedAll
            ? 'ALL LEVELS CLEAR'
            : (this.success ? 'LEVEL CLEAR' : 'COLLISION');
        const stateColor = this.success ? ui.TEXT_SUCCESS : ui.TEXT_ERROR;
        const titleCopy = this.completedAll
            ? '终曲完成。\n整套关卡通关。'
            : (this.success ? '漂亮。\n这一圈完成了。' : '撞针了。\n再找一次空隙。');

        this.stateText = this.add.text(56, 102, stateLabel, {
            fontFamily: ui.MONO_FONT,
            fontSize: '12px',
            color: stateColor,
            letterSpacing: 1.8
        });

        this.resultTitle = this.add.text(52, 142, titleCopy, {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '48px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold',
            lineSpacing: -2
        });

        this.createResultGlyph();
        SceneUI.createPanel(this, 300, 384, 488, 106, {
            fillColor: ui.SURFACE,
            strokeColor: ui.RULE,
            radius: 14,
            depth: 10
        });

        const metricLabel = this.add.text(82, 358, this.success ? '已完成' : '本次进度', {
            fontFamily: ui.BODY_FONT,
            fontSize: '14px',
            color: ui.TEXT_MUTED
        });
        metricLabel.setDepth(11);

        const metricValue = this.success
            ? `关卡 ${String(this.level).padStart(2, '0')} · ${this.levelName}`
            : `${this.insertedCount} / ${this.totalCount}`;
        const metric = this.add.text(82, 391, metricValue, {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '34px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        });
        metric.setOrigin(0, 0.5);
        metric.setDepth(11);

        const modeLabel = this.route.mode === 'test' ? '测试模式' : '正常进度';
        const noteCopy = this.completedAll
            ? `全部 ${this.packLevelCount} 关已完成 · ${modeLabel}`
            : (this.success
                ? `下一关 · ${this.nextLevelName} · ${modeLabel}`
                : `${this.levelName} · 再试一次 · ${modeLabel}`);
        const note = this.add.text(518, 384, noteCopy, {
            fontFamily: ui.BODY_FONT,
            fontSize: '13px',
            color: this.success ? ui.TEXT_SUCCESS : ui.TEXT_MUTED
        });
        note.setOrigin(1, 0.5);
        note.setDepth(11);

        if (!SceneUI.prefersReducedMotion()) {
            [this.stateText, this.resultTitle].forEach(element => element.setAlpha(0));
            this.tweens.add({
                targets: [this.stateText, this.resultTitle],
                alpha: 1,
                duration: 360,
                ease: 'Expo.easeOut'
            });
        }
    }

    createResultGlyph() {
        const ui = SceneUI.getPalette();
        const graphics = this.add.graphics();
        graphics.setPosition(490, 226);
        graphics.lineStyle(3, ui.INK, 1);
        graphics.strokeCircle(0, 0, 50);
        graphics.lineStyle(1, ui.RULE, 1);
        graphics.strokeCircle(0, 0, 36);

        if (this.success) {
            graphics.lineStyle(7, ui.SUCCESS, 1);
            graphics.beginPath();
            graphics.moveTo(-20, 1);
            graphics.lineTo(-6, 16);
            graphics.lineTo(24, -18);
            graphics.strokePath();
        } else {
            graphics.lineStyle(6, ui.ERROR, 1);
            graphics.lineBetween(-18, -18, 18, 18);
            graphics.lineBetween(18, -18, -18, 18);
        }
    }

    createButtons() {
        const ui = SceneUI.getPalette();
        const primaryLabel = this.completedAll
            ? (this.route.mode === 'test' ? '返回关卡实验室' : '返回主菜单')
            : (this.success ? '进入下一关' : '重新挑战');
        SceneUI.createButton(this, 300, 520, primaryLabel, () => this.runPrimaryAction(), {
            width: 300,
            variant: 'primary'
        });

        const secondaryLabel = this.completedAll ? '重玩当前关' : '返回主菜单';
        SceneUI.createButton(this, 300, 588, secondaryLabel, () => {
            if (this.completedAll) {
                APP_CONTEXT.router.startLevel(this, this.route);
            } else {
                APP_CONTEXT.router.startMenu(this);
            }
        }, {
            width: 300,
            variant: 'secondary'
        });

        const shortcut = this.add.text(300, 680, 'ENTER 继续  ·  ESC 菜单', {
            fontFamily: ui.MONO_FONT,
            fontSize: '11px',
            color: ui.TEXT_MUTED,
            letterSpacing: 1
        });
        shortcut.setOrigin(0.5);
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
