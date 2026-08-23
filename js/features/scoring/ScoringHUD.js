class ScoringHUD {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.mode = ['test', 'daily'].includes(options.mode)
            ? options.mode
            : 'progression';
        this.layout = LayoutManager.getSceneLayout('game');
        this.elements = [];
        this.lastScore = null;
        this.lastElapsed = null;
        this.lastCombo = null;
        this.lastComboTick = null;
        this.create();
    }

    track(element) {
        this.elements.push(element);
        return element;
    }

    create() {
        const ui = SceneUI.getPalette();
        const hud = this.layout.hud;

        this.scoreCaption = this.track(this.scene.add.text(
            286,
            hud.captionY,
            this.mode === 'test' ? '测试得分' : (this.mode === 'daily' ? '每日得分' : '得分'),
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '12px',
                color: ui.TEXT_MUTED
            }
        ));
        this.scoreCaption.setOrigin(1, 0);
        this.scoreCaption.setDepth(102);

        this.scoreText = this.track(this.scene.add.text(
            286,
            hud.valueY,
            '000000',
            {
                fontFamily: ui.DISPLAY_FONT,
                fontSize: '23px',
                color: ui.TEXT_COLOR,
                fontStyle: 'bold'
            }
        ));
        this.scoreText.setOrigin(1, 0.5);
        this.scoreText.setDepth(102);

        this.divider = this.track(this.scene.add.rectangle(
            300,
            hud.valueY,
            1,
            38,
            ui.RULE
        ));
        this.divider.setDepth(102);

        this.timeCaption = this.track(this.scene.add.text(
            314,
            hud.captionY,
            '计时',
            {
                fontFamily: ui.BODY_FONT,
                fontSize: '12px',
                color: ui.TEXT_MUTED
            }
        ));
        this.timeCaption.setDepth(102);

        this.timeText = this.track(this.scene.add.text(
            314,
            hud.valueY,
            '00:00.0',
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '18px',
                color: ui.TEXT_ACCENT,
                letterSpacing: 0.6
            }
        ));
        this.timeText.setOrigin(0, 0.5);
        this.timeText.setDepth(102);

        this.comboText = this.track(this.scene.add.text(
            300,
            hud.brandY,
            this.getIdleLabel(),
            {
                fontFamily: ui.MONO_FONT,
                fontSize: '10px',
                color: ui.TEXT_MUTED,
                letterSpacing: 1.2
            }
        ));
        this.comboText.setOrigin(0.5, 0);
        this.comboText.setDepth(102);
    }

    getIdleLabel() {
        if (this.mode === 'test') return 'TEST SCORE';
        if (this.mode === 'daily') return 'DAILY SCORE';
        return 'SCORE RUN';
    }

    update(snapshot) {
        if (!snapshot) return;
        if (snapshot.score !== this.lastScore) {
            this.scoreText.setText(
                String(Math.max(0, snapshot.score || 0)).padStart(6, '0')
            );
            this.lastScore = snapshot.score;
        }

        const elapsedTenths = Math.floor((snapshot.elapsedMs || 0) / 100);
        if (elapsedTenths !== this.lastElapsed) {
            this.timeText.setText(ScoringHUD.formatElapsed(snapshot.elapsedMs));
            this.lastElapsed = elapsedTenths;
        }

        const remainingTenths = Math.max(
            0,
            Math.ceil((snapshot.comboRemainingMs || 0) / 100)
        );
        if (
            snapshot.combo !== this.lastCombo
            || remainingTenths !== this.lastComboTick
        ) {
            const ui = SceneUI.getPalette();
            if (snapshot.combo > 1) {
                this.comboText.setText(
                    `PRECISION ×${snapshot.combo} · ${(remainingTenths / 10).toFixed(1)}s`
                );
            } else if (snapshot.combo === 1 && remainingTenths > 0) {
                this.comboText.setText(
                    `精准窗 · ${(remainingTenths / 10).toFixed(1)}s`
                );
            } else {
                this.comboText.setText(this.getIdleLabel());
            }
            this.comboText.setColor(
                snapshot.combo > 0 && remainingTenths <= 7
                    ? ui.TEXT_ERROR
                    : (snapshot.combo > 0 ? ui.TEXT_ACCENT : ui.TEXT_MUTED)
            );
            this.lastCombo = snapshot.combo;
            this.lastComboTick = remainingTenths;
        }
    }

    destroy() {
        this.elements.forEach(element => element.destroy());
        this.elements = [];
    }

    static formatElapsed(elapsedMs = 0) {
        const tenths = Math.max(0, Math.floor(Number(elapsedMs) / 100));
        const minutes = Math.floor(tenths / 600);
        const seconds = Math.floor((tenths % 600) / 10);
        const fraction = tenths % 10;
        return `${String(minutes).padStart(2, '0')}`
            + `:${String(seconds).padStart(2, '0')}.${fraction}`;
    }
}
