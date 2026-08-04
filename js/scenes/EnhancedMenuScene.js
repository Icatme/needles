class EnhancedMenuScene extends MenuScene {
    create() {
        super.create();
        this.input.keyboard.once('keydown-L', () => {
            APP_CONTEXT.router.startLevelBrowser(this, {
                packId: this.levelManager.activePackId
            });
        });
    }

    createProgressReadout() {
        const ui = SceneUI.getPalette();
        const progressLayout = this.layout.progress;
        const pack = this.levelManager.getActivePack();
        const currentConfig = this.levelManager.getLevelConfig(
            this.levelManager.maxUnlockedLevel
        );

        SceneUI.createPanel(this, 300, progressLayout.panelY, 488, 82, {
            fillColor: ui.SURFACE,
            strokeColor: ui.RULE,
            radius: 14,
            depth: 10
        });

        const label = this.add.text(
            82,
            progressLayout.labelY,
            `当前方案 · ${pack.name}`,
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '14px',
                color: ui.TEXT_MUTED
            }
        );
        label.setDepth(11);

        const value = this.add.text(
            82,
            progressLayout.valueY,
            `第 ${currentConfig.order} 关 · ${currentConfig.name}`,
            {
                fontFamily: ui.DISPLAY_FONT,
                fontSize: '24px',
                color: ui.TEXT_COLOR,
                fontStyle: 'bold'
            }
        );
        value.setOrigin(0, 0.5);
        value.setDepth(11);

        const status = this.add.text(
            518,
            progressLayout.statusY,
            currentConfig.rule,
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '12px',
                color: ui.TEXT_ACCENT,
                letterSpacing: 1
            }
        );
        status.setOrigin(1, 0.5);
        status.setDepth(11);
    }

    createButtons() {
        const ui = SceneUI.getPalette();
        const buttonLayout = this.layout.buttons;
        const resume = APP_CONTEXT.getResumeRoute(this.levelManager.activePackId);
        const config = APP_CONTEXT.catalog.getLevelConfig(
            resume.packId,
            resume.levelId
        );
        const hasProgress = config.order > 1;
        const primaryLabel = hasProgress
            ? `继续第 ${config.order} 关`
            : '开始第 1 关';

        SceneUI.createButton(this, 300, buttonLayout.primaryY, primaryLabel, () => {
            APP_CONTEXT.router.startLevel(this, resume);
        }, { width: 300, variant: 'primary' });

        SceneUI.createButton(
            this,
            300,
            buttonLayout.secondaryY,
            '选关测试 · A/B 对照',
            () => {
                APP_CONTEXT.router.startLevelBrowser(this, {
                    packId: this.levelManager.activePackId
                });
            },
            { width: 300, variant: 'secondary' }
        );

        SceneUI.createButton(this, 300, buttonLayout.resetY, '重置全部进度', () => {
            this.confirmReset();
        }, { width: 170, height: 48, variant: 'quiet', fontSize: '15px' });

        const shortcut = this.add.text(
            300,
            buttonLayout.footerY,
            'ENTER 开始  ·  L 选关  ·  SPACE 发射',
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '11px',
                color: ui.TEXT_MUTED,
                letterSpacing: 1
            }
        );
        shortcut.setOrigin(0.5);
    }

    startGame(levelRef) {
        const config = this.levelManager.getLevelConfig(levelRef);
        APP_CONTEXT.router.startLevel(this, {
            packId: config.packId,
            levelId: config.packLevelId,
            mode: 'progression'
        });
    }
}
