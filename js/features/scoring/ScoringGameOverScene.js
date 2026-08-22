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
        this.bestRunComparison = data.bestRunComparison || null;
        this.objectives = data.objectives || null;
        this.badgeResult = data.badgeResult || null;
        this.dailyChallenge = data.dailyChallenge || null;
        this.dailyResult = data.dailyResult || null;
    }

    createMetricPanel(centerY) {
        if (!this.scoringEnabled || !this.score) {
            super.createMetricPanel(centerY);
            return;
        }

        const ui = SceneUI.getPalette();
        const panelHeight = 140;
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
            centerY - 49,
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
            centerY - 13,
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
            centerY - 45,
            this.getRecordLabel(),
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '11px',
                color: this.getRecordColor(ui),
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
        const meta = this.add.text(518, centerY - 10, progressCopy, {
            fontFamily: ui.BODY_FONT,
            fontSize: '13px',
            color: ui.TEXT_ACCENT
        });
        meta.setOrigin(1, 0.5);
        meta.setDepth(11);

        const breakdown = this.add.text(
            82,
            centerY + 26,
            ScoringGameOverScene.formatBreakdown(this.score.breakdown),
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '11px',
                color: ui.TEXT_MUTED,
                letterSpacing: 0.25
            }
        );
        breakdown.setDepth(11);

        const addenda = this.getResultAddenda();
        if (addenda) {
            const note = this.add.text(82, centerY + 52, addenda, {
                fontFamily: ui.BODY_FONT,
                fontSize: '11px',
                color: this.dailyResult?.verified
                    ? ui.TEXT_SUCCESS
                    : ui.TEXT_MUTED
            });
            note.setDepth(11);
        }
    }

    getRecordColor(ui) {
        if (this.dailyChallenge) {
            return this.dailyResult?.verified ? ui.TEXT_SUCCESS : ui.TEXT_ERROR;
        }
        return this.isPersonalBest ? ui.TEXT_SUCCESS : ui.TEXT_MUTED;
    }

    getRecordLabel() {
        if (this.dailyChallenge) {
            return this.dailyResult?.verified
                ? 'DAILY VERIFIED · 已验证'
                : 'DAILY RUN · 未入榜';
        }
        if (this.route.mode === 'test') return '测试模式 · 不入榜';
        if (!this.success) return '未完成 · 不入榜';
        if (this.isPersonalBest) return 'NEW BEST · 新纪录';
        if (this.bestScore) {
            return `本关最佳 ${String(this.bestScore.score).padStart(6, '0')}`;
        }
        return this.scoreEligible ? '正式成绩' : '未启用正式记录';
    }

    getResultAddenda() {
        const parts = [];
        const comparison = this.bestRunComparison;
        if (
            comparison?.hadReference
            && Number.isFinite(comparison.deltaMs)
        ) {
            const delta = BestRunComparisonHUD.formatDelta(comparison.deltaMs);
            parts.push(comparison.deltaMs <= 0
                ? `较原最佳快 ${delta.replace('−', '')}`
                : `较原最佳慢 ${delta.replace('+', '')}`);
        } else if (this.isPersonalBest) {
            parts.push('已保存逐针最佳轨迹');
        }

        if (this.objectives?.objectives) {
            const completed = this.objectives.objectives.filter(item => item.completed).length;
            parts.push(`局内目标 ${completed}/${this.objectives.objectives.length}`);
        }
        const newBadges = this.badgeResult?.newBadges || [];
        if (newBadges.length > 0) parts.push(`新徽章 ${newBadges.length}`);
        if (this.dailyResult?.verified) parts.push('回放与得分一致');
        return parts.join(' · ');
    }

    static formatBreakdown(breakdown = {}) {
        const value = key => Math.max(0, Math.round(breakdown?.[key] || 0));
        return `基础 ${value('base')}`
            + `  ·  精准 ${value('precision')}`
            + `  ·  连击 ${value('combo')}`
            + `  ·  速度 ${value('time')}`;
    }
}
