class ScoringHUD {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.mode = options.mode === 'test' ? 'test' : 'progression';
        this.layout = LayoutManager.getSceneLayout('game');
        this.elements = [];
        this.lastScore = null;
        this.lastElapsed = null;
        this.lastCombo = null;
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
            this.mode === 'test' ? '测试得分' : '得分',
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
            this.mode === 'test' ? 'TEST SCORE' : 'SCORE RUN',
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

        if (snapshot.combo !== this.lastCombo) {
            const idleLabel = this.mode === 'test' ? 'TEST SCORE' : 'SCORE RUN';
            this.comboText.setText(
                snapshot.combo > 1 ? `COMBO ×${snapshot.combo}` : idleLabel
            );
            this.comboText.setColor(
                snapshot.combo > 1
                    ? SceneUI.getPalette().TEXT_ACCENT
                    : SceneUI.getPalette().TEXT_MUTED
            );
            this.lastCombo = snapshot.combo;
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
