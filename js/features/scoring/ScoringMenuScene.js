class ScoringMenuScene extends EnhancedMenuScene {
    create() {
        if (!APP_CONTEXT.preferences) {
            APP_CONTEXT.preferences = new GamePreferencesStore();
        }
        if (!APP_CONTEXT.scores && typeof ScoreStore !== 'undefined') {
            APP_CONTEXT.scores = new ScoreStore();
        }
        super.create();
        this.createScoringToggle();
        this.input.keyboard.on('keydown-S', () => this.toggleScoring());
        this.input.keyboard.on('keydown-B', () => {
            if (this.scoreboardModal) {
                this.closeScoreboard();
            } else {
                this.showScoreboard();
            }
        });
        this.input.keyboard.on('keydown-ESC', () => {
            if (this.scoreboardModal) this.closeScoreboard();
        });
    }

    createScoringToggle() {
        const enabled = APP_CONTEXT.preferences.isScoringEnabled();
        this.scoringToggleButton = SceneUI.createButton(
            this,
            458,
            this.layout.theme.labelY,
            `S · 计分挑战 ${enabled ? '开' : '关'}`,
            () => this.toggleScoring(),
            {
                width: 154,
                height: 34,
                variant: enabled ? 'secondary' : 'quiet',
                depth: 30,
                fontSize: '12px'
            }
        );
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

        const scoreCount = APP_CONTEXT.scores?.countBest(
            this.levelManager.activePackId
        ) || 0;
        SceneUI.createButton(
            this,
            194,
            buttonLayout.resetY,
            `B · 本机分数表 (${scoreCount})`,
            () => this.showScoreboard(),
            {
                width: 190,
                height: 48,
                variant: 'quiet',
                fontSize: '14px'
            }
        );
        SceneUI.createButton(
            this,
            406,
            buttonLayout.resetY,
            '重置全部进度',
            () => this.confirmReset(),
            {
                width: 190,
                height: 48,
                variant: 'quiet',
                fontSize: '14px'
            }
        );

        const shortcut = this.add.text(
            300,
            buttonLayout.footerY,
            'ENTER 开始 · L 选关 · B 分数表 · S 计分 · SPACE 发射',
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '10px',
                color: ui.TEXT_MUTED,
                letterSpacing: 0.7
            }
        );
        shortcut.setOrigin(0.5);
    }

    toggleScoring() {
        APP_CONTEXT.preferences.toggleScoring();
        this.scene.restart();
    }

    showScoreboard() {
        if (this.scoreboardModal) return;
        const ui = SceneUI.getPalette();
        const packId = this.levelManager.activePackId;
        const pack = this.levelManager.getActivePack();
        const records = APP_CONTEXT.scores.listBest(packId, { limit: 6 });
        const total = APP_CONTEXT.scores.countBest(packId);
        const centerY = CONSTANTS.HEIGHT / 2;
        const elements = [];
        const track = element => {
            elements.push(element);
            return element;
        };

        const overlay = track(this.add.rectangle(
            CONSTANTS.WIDTH / 2,
            CONSTANTS.HEIGHT / 2,
            CONSTANTS.WIDTH,
            CONSTANTS.HEIGHT,
            ui.INK,
            0.72
        ));
        overlay.setDepth(400);
        overlay.setInteractive();

        track(SceneUI.createPanel(
            this,
            300,
            centerY,
            510,
            500,
            {
                fillColor: ui.SURFACE,
                strokeColor: ui.INK,
                strokeWidth: 2,
                radius: 20,
                depth: 401
            }
        ));

        const kicker = track(this.add.text(72, centerY - 216, 'LOCAL BESTS', {
            fontFamily: ui.MONO_FONT,
            fontSize: '11px',
            color: ui.TEXT_ACCENT,
            letterSpacing: 1.5
        }));
        kicker.setDepth(402);
        const title = track(this.add.text(72, centerY - 184, '本机分数表', {
            fontFamily: ui.DISPLAY_FONT,
            fontSize: '30px',
            color: ui.TEXT_COLOR,
            fontStyle: 'bold'
        }));
        title.setDepth(402);
        const subtitle = track(this.add.text(
            528,
            centerY - 176,
            `${pack.name} · 最近刷新 ${Math.min(total, 6)} / ${total}`,
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '12px',
                color: ui.TEXT_MUTED
            }
        ));
        subtitle.setOrigin(1, 0.5);
        subtitle.setDepth(402);

        const columnY = centerY - 126;
        [
            [76, '关卡', 0],
            [316, '最佳得分', 1],
            [432, '用时', 1],
            [524, '连击', 1]
        ].forEach(([x, label, origin]) => {
            const header = track(this.add.text(x, columnY, label, {
                fontFamily: ui.BODY_FONT,
                fontSize: '12px',
                color: ui.TEXT_MUTED
            }));
            header.setOrigin(origin, 0.5);
            header.setDepth(402);
        });

        if (records.length === 0) {
            const empty = track(this.add.text(
                300,
                centerY + 12,
                '完成开启计分的正式关卡后，\n最佳成绩会出现在这里。',
                {
                    fontFamily: ui.BODY_FONT,
                    fontSize: '16px',
                    color: ui.TEXT_MUTED,
                    align: 'center',
                    lineSpacing: 8
                }
            ));
            empty.setOrigin(0.5);
            empty.setDepth(402);
        } else {
            records.forEach((record, index) => {
                const y = centerY - 92 + index * 42;
                const separator = track(this.add.rectangle(
                    300,
                    y + 20,
                    444,
                    1,
                    ui.RULE
                ));
                separator.setDepth(402);
                const levelLabel = `第 ${String(record.levelOrder || 0).padStart(2, '0')} 关`;
                const name = record.levelName.length > 12
                    ? `${record.levelName.slice(0, 12)}…`
                    : record.levelName;
                const level = track(this.add.text(76, y, `${levelLabel} · ${name}`, {
                    fontFamily: ui.BODY_FONT,
                    fontSize: '13px',
                    color: ui.TEXT_COLOR
                }));
                level.setOrigin(0, 0.5);
                level.setDepth(402);
                const score = track(this.add.text(316, y, String(record.score), {
                    fontFamily: ui.MONO_FONT,
                    fontSize: '14px',
                    color: ui.TEXT_ACCENT,
                    fontStyle: 'bold'
                }));
                score.setOrigin(1, 0.5);
                score.setDepth(402);
                const time = track(this.add.text(
                    432,
                    y,
                    ScoringHUD.formatElapsed(record.elapsedMs),
                    {
                        fontFamily: ui.MONO_FONT,
                        fontSize: '12px',
                        color: ui.TEXT_COLOR
                    }
                ));
                time.setOrigin(1, 0.5);
                time.setDepth(402);
                const combo = track(this.add.text(524, y, `×${record.maxCombo}`, {
                    fontFamily: ui.MONO_FONT,
                    fontSize: '12px',
                    color: ui.TEXT_COLOR
                }));
                combo.setOrigin(1, 0.5);
                combo.setDepth(402);
            });
        }

        const note = track(this.add.text(
            300,
            centerY + 174,
            '不同关卡不混排 · 同关同分时，用时更短优先',
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '12px',
                color: ui.TEXT_MUTED
            }
        ));
        note.setOrigin(0.5);
        note.setDepth(402);

        track(SceneUI.createButton(
            this,
            300,
            centerY + 214,
            '关闭分数表',
            () => this.closeScoreboard(),
            {
                width: 210,
                height: 46,
                variant: 'secondary',
                depth: 403
            }
        ));

        overlay.on('pointerup', () => this.closeScoreboard());
        this.scoreboardModal = elements;
    }

    closeScoreboard() {
        if (!this.scoreboardModal) return;
        this.scoreboardModal.forEach(element => element.destroy());
        this.scoreboardModal = null;
    }
}
