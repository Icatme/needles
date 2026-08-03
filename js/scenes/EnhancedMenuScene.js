class EnhancedMenuScene extends MenuScene {
    create() {
        super.create();
        this.input.keyboard.once('keydown-L', () => {
            this.scene.start('LevelSelectScene');
        });
    }

    createProgressReadout() {
        const ui = SceneUI.getPalette();
        const pack = this.levelManager.getActivePack();
        const currentConfig = this.levelManager.getLevelConfig(
            this.levelManager.maxUnlockedLevel
        );

        SceneUI.createPanel(this, 300, 398, 488, 82, {
            fillColor: ui.SURFACE,
            strokeColor: ui.RULE,
            radius: 14,
            depth: 10
        });

        const label = this.add.text(82, 369, `当前方案 · ${pack.name}`, {
            fontFamily: ui.BODY_FONT,
            fontSize: '14px',
            color: ui.TEXT_MUTED
        });
        label.setDepth(11);

        const value = this.add.text(
            82,
            410,
            `第 ${this.levelManager.maxUnlockedLevel} 关 · ${currentConfig.name}`,
            {
                fontFamily: ui.DISPLAY_FONT,
                fontSize: '24px',
                color: ui.TEXT_COLOR,
                fontStyle: 'bold'
            }
        );
        value.setOrigin(0, 0.5);
        value.setDepth(11);

        const status = this.add.text(518, 398, currentConfig.rule, {
            fontFamily: ui.BODY_FONT,
            fontSize: '12px',
            color: ui.TEXT_ACCENT,
            letterSpacing: 1
        });
        status.setOrigin(1, 0.5);
        status.setDepth(11);
    }

    createButtons() {
        const ui = SceneUI.getPalette();
        const hasProgress = this.levelManager.maxUnlockedLevel > 1;
        const primaryLabel = hasProgress
            ? `继续第 ${this.levelManager.maxUnlockedLevel} 关`
            : '开始第 1 关';
        const primaryLevel = hasProgress ? this.levelManager.maxUnlockedLevel : 1;

        SceneUI.createButton(this, 300, 568, primaryLabel, () => {
            this.startGame(primaryLevel);
        }, { width: 300, variant: 'primary' });

        SceneUI.createButton(this, 300, 632, '选关测试 · A/B 对照', () => {
            this.scene.start('LevelSelectScene');
        }, { width: 300, variant: 'secondary' });

        SceneUI.createButton(this, 300, 700, '重置全部进度', () => {
            this.confirmReset();
        }, { width: 170, height: 48, variant: 'quiet', fontSize: '15px' });

        const shortcut = this.add.text(300, 760, 'ENTER 开始  ·  L 选关  ·  SPACE 发射', {
            fontFamily: ui.MONO_FONT,
            fontSize: '11px',
            color: ui.TEXT_MUTED,
            letterSpacing: 1
        });
        shortcut.setOrigin(0.5);
    }

    startGame(level) {
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem('needle_game_test_mode');
            }
        } catch (error) {
            console.warn('无法退出测试模式:', error);
        }
        super.startGame(level);
    }
}
