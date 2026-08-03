class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data) {
        this.level = data.level || 1;
        this.levelName = data.levelName || '';
        this.success = Boolean(data.success);
        this.completedAll = Boolean(data.completedAll);
        this.nextLevel = data.nextLevel ?? null;
        this.nextLevelName = data.nextLevelName || '';
        this.insertedCount = data.insertedCount || 0;
        this.totalCount = data.totalCount || 0;
    }

    create() {
        SceneUI.createBackdrop(this, 'result');
        this.createResultDisplay();
        this.createButtons();

        this.input.keyboard.once('keydown-ENTER', () => this.runPrimaryAction());
        this.input.keyboard.once('keydown-ESC', () => this.scene.start('MenuScene'));
    }

    createResultDisplay() {
        const ui = SceneUI.getPalette();
        const stateLabel = this.completedAll
            ? 'ALL LEVELS CLEAR'
            : (this.success ? 'LEVEL CLEAR' : 'COLLISION');
        const stateColor = this.success ? ui.TEXT_SUCCESS : ui.TEXT_ERROR;
        const titleCopy = this.completedAll
            ? '终曲完成。\n五十关通关。'
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

        const noteCopy = this.completedAll
            ? '全部 50 关已完成'
            : (this.success
                ? `下一关 · ${this.nextLevelName}`
                : `${this.levelName} · 再试一次`);
        const note = this.add.text(518, 384, noteCopy, {
            fontFamily: ui.BODY_FONT,
            fontSize: '14px',
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
            ? '返回主菜单'
            : (this.success ? '进入下一关' : '重新挑战');
        SceneUI.createButton(this, 300, 520, primaryLabel, () => this.runPrimaryAction(), {
            width: 300,
            variant: 'primary'
        });
        const secondaryLabel = this.completedAll ? '重玩第 50 关' : '返回主菜单';
        SceneUI.createButton(this, 300, 588, secondaryLabel, () => {
            this.scene.start(
                this.completedAll ? 'GameScene' : 'MenuScene',
                this.completedAll ? { level: 50 } : undefined
            );
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
            this.scene.start('MenuScene');
        } else if (this.success) {
            this.scene.start('GameScene', { level: this.nextLevel });
        } else {
            this.scene.start('GameScene', { level: this.level });
        }
    }
}
