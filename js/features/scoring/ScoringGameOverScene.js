class ScoringGameOverScene extends GameOverScene {
    init(data = {}) {
        super.init(data);
        this.scoringEnabled = Boolean(data.scoringEnabled);
        this.score = data.score && typeof data.score === 'object'
            ? data.score
            : null;
        this.timeBonus = data.timeBonus || null;
        this.scoreEligible = Boolean(data.scoreEligible);
        this.scoreRecord = data.scoreRecord || null;
        this.isPersonalBest = Boolean(this.scoreRecord?.isPersonalBest);
        this.bestScore = this.scoreRecord?.best || null;
    }

    createMetricPanel(centerY) {
        if (!this.scoringEnabled || !this.score) {
            super.createMetricPanel(centerY);
            return;
        }

        const ui = SceneUI.getPalette();
        const panelHeight = 126;
        SceneUI.createPanel(
            this,
            300,
            centerY,
            this.layout.metric.panelWidth,
            panelHeight,
            {
                fillColor: ui.SURFACE,
                strokeColor: this.isPersonalBest ? ui.SUCCESS : ui.RULE,
                strokeWidth: this.isPersonalBest ? 2 : 1,
                radius: 14,
                depth: 10
            }
        );

        const label = this.add.text(
            82,
            centerY - 43,
            `本局得分 · 关卡 ${String(this.level).padStart(2, '0')}`,
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '13px',
                color: ui.TEXT_MUTED
            }
        );
        label.setDepth(11);

        const value = this.add.text(
            82,
            centerY - 6,
            String(Math.max(0, this.score.score || 0)).padStart(6, '0'),
            {
                fontFamily: ui.DISPLAY_FONT,
                fontSize: '34px',
                color: ui.TEXT_COLOR,
                fontStyle: 'bold'
            }
        );
        value.setOrigin(0, 0.5);
        value.setDepth(11);

        const recordLabel = this.add.text(
            518,
            centerY - 40,
            this.getRecordLabel(),
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '11px',
                color: this.isPersonalBest ? ui.TEXT_SUCCESS : ui.TEXT_MUTED,
                letterSpacing: 0.6
            }
        );
        recordLabel.setOrigin(1, 0.5);
        recordLabel.setDepth(11);

        const progressCopy = this.success
            ? `用时 ${ScoringHUD.formatElapsed(this.score.elapsedMs)}`
                + ` · 最高连击 ×${this.score.maxCombo || 0}`
            : `进度 ${this.insertedCount} / ${this.totalCount}`
                + ` · 用时 ${ScoringHUD.formatElapsed(this.score.elapsedMs)}`;
        const meta = this.add.text(518, centerY - 4, progressCopy, {
            fontFamily: ui.BODY_FONT,
            fontSize: '13px',
            color: ui.TEXT_ACCENT
        });
        meta.setOrigin(1, 0.5);
        meta.setDepth(11);

        const breakdown = this.add.text(
            82,
            centerY + 38,
            ScoringGameOverScene.formatBreakdown(this.score.breakdown),
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '11px',
                color: ui.TEXT_MUTED,
                letterSpacing: 0.25
            }
        );
        breakdown.setDepth(11);
    }

    getRecordLabel() {
        if (this.route.mode === 'test') return '测试模式 · 不入榜';
        if (!this.success) return '未完成 · 不入榜';
        if (this.isPersonalBest) return 'NEW BEST · 新纪录';
        if (this.bestScore) {
            return `本关最佳 ${String(this.bestScore.score).padStart(6, '0')}`;
        }
        return this.scoreEligible ? '正式成绩' : '未启用正式记录';
    }

    static formatBreakdown(breakdown = {}) {
        const value = key => Math.max(0, Math.round(breakdown?.[key] || 0));
        return `基础 ${value('base')}`
            + `  ·  精准 ${value('precision')}`
            + `  ·  连击 ${value('combo')}`
            + `  ·  速度 ${value('time')}`;
    }
}
